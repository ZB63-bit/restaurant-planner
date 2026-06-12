import { Router } from "express";

// Google Places (New) API proxy. The API key lives only here on the server and
// is never sent to the browser. Two endpoints mirror the spec's two-call flow:
//   GET /api/places/search?q=&city=   → Text Search (list of candidates)
//   GET /api/places/details?id=       → Place Details (full info for one place)

const PLACES_BASE = "https://places.googleapis.com/v1";

// Map the New API's price-level enum to the 1..4 integer the data model uses.
const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface PlaceResult {
  place_id: string;
  name: string;
  cuisine: string;
  address: string | null;
  google_rating: number | null;
  price_level: number | null;
  photo_url: string | null;
  maps_url: string | null;
}

// Build a media URL for the first photo via our own proxy so the key stays hidden.
function photoUrl(photoName: string | undefined): string | null {
  if (!photoName) return null;
  return `/api/places/photo?name=${encodeURIComponent(photoName)}`;
}

// The New API returns rich type tokens (e.g. "italian_restaurant"); turn the most
// specific food-ish one into a readable cuisine label.
function cuisineFromTypes(types: string[] | undefined): string {
  if (!types?.length) return "";
  const t =
    types.find((x) => x.endsWith("_restaurant")) ??
    types.find((x) => x.includes("food") || x.includes("cafe")) ??
    "";
  return t
    .replace(/_restaurant$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toResult(place: any): PlaceResult {
  return {
    place_id: place.id,
    name: place.displayName?.text ?? "Unknown",
    cuisine: cuisineFromTypes(place.types),
    address: place.formattedAddress ?? null,
    google_rating: typeof place.rating === "number" ? place.rating : null,
    price_level:
      place.priceLevel != null ? (PRICE_MAP[place.priceLevel] ?? null) : null,
    photo_url: photoUrl(place.photos?.[0]?.name),
    maps_url: place.googleMapsUri ?? null,
  };
}

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.types",
  "places.formattedAddress",
  "places.rating",
  "places.priceLevel",
  "places.googleMapsUri",
  "places.photos",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "types",
  "formattedAddress",
  "rating",
  "priceLevel",
  "googleMapsUri",
  "photos",
  "regularOpeningHours",
  "websiteUri",
  "nationalPhoneNumber",
].join(",");

export function placesRouter(): Router {
  const router = Router();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Surface a clear error if the key is missing rather than calling Google blindly.
  function requireKey(res: import("express").Response): boolean {
    if (!apiKey) {
      res
        .status(503)
        .json({ error: "GOOGLE_PLACES_API_KEY is not configured on the server." });
      return false;
    }
    return true;
  }

  router.get("/search", async (req, res) => {
    if (!requireKey(res)) return;
    const q = String(req.query.q ?? "").trim();
    const city = String(req.query.city ?? "").trim();
    const lat = req.query.lat ? parseFloat(String(req.query.lat)) : null;
    const lng = req.query.lng ? parseFloat(String(req.query.lng)) : null;
    const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
    if (!q) {
      res.status(400).json({ error: "Missing query parameter 'q'." });
      return;
    }
    // When coords are provided, rely on locationRestriction for locality — no
    // need to bake the city into the text query. Fall back to "q in city" when
    // the user typed a city but didn't grant geolocation.
    const textQuery = !hasCoords && city ? `${q} in ${city}` : q;
    // 7 miles in metres
    const RADIUS_M = 11_265;
    const locationRestriction = hasCoords
      ? { circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M } }
      : undefined;
    try {
      const r = await fetch(`${PLACES_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey!,
          "X-Goog-FieldMask": SEARCH_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery,
          includedType: "restaurant",
          ...(locationRestriction && { locationRestriction }),
        }),
      });
      if (!r.ok) {
        const detail = await r.text();
        res.status(r.status).json({ error: "Places search failed", detail });
        return;
      }
      const data = (await r.json()) as { places?: any[] };
      const results: PlaceResult[] = (data.places ?? []).map(toResult);
      res.json({ results });
    } catch (err) {
      res.status(502).json({ error: "Upstream Places request failed", detail: String(err) });
    }
  });

  router.get("/details", async (req, res) => {
    if (!requireKey(res)) return;
    const id = String(req.query.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "Missing query parameter 'id'." });
      return;
    }
    try {
      const r = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(id)}`, {
        headers: {
          "X-Goog-Api-Key": apiKey!,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
      });
      if (!r.ok) {
        const detail = await r.text();
        res.status(r.status).json({ error: "Place details failed", detail });
        return;
      }
      const place = await r.json();
      res.json({ result: toResult(place) });
    } catch (err) {
      res.status(502).json({ error: "Upstream Places request failed", detail: String(err) });
    }
  });

  // Proxy a place photo's binary so the API key never reaches the browser.
  router.get("/photo", async (req, res) => {
    if (!requireKey(res)) return;
    const name = String(req.query.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Missing query parameter 'name'." });
      return;
    }
    const maxWidth = Number(req.query.w ?? 400) || 400;
    try {
      const r = await fetch(
        `${PLACES_BASE}/${name}/media?maxWidthPx=${maxWidth}&key=${apiKey}`,
        { redirect: "follow" },
      );
      if (!r.ok) {
        res.status(r.status).end();
        return;
      }
      res.setHeader("Content-Type", r.headers.get("content-type") ?? "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = Buffer.from(await r.arrayBuffer());
      res.end(buf);
    } catch (err) {
      res.status(502).json({ error: "Photo proxy failed", detail: String(err) });
    }
  });

  return router;
}
