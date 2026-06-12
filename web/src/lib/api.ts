// Typed client for the Express backend (Phase 2+). The backend hides the Google
// Places API key; the browser only ever talks to our own proxy.

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8787";

export interface PlaceResult {
  place_id: string;
  name: string;
  cuisine: string;
  address: string | null;
  google_rating: number | null;
  price_level: number | null;
  photo_url: string | null; // relative proxy path, or null
  maps_url: string | null;
}

// Photo URLs come back as relative proxy paths ("/api/places/photo?...").
// Resolve them against the API base so <img> can load them.
function resolvePhoto(r: PlaceResult): PlaceResult {
  return r.photo_url && r.photo_url.startsWith("/")
    ? { ...r, photo_url: `${API_BASE}${r.photo_url}` }
    : r;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function searchPlaces(
  q: string,
  city: string,
  coords?: { lat: number; lng: number },
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q });
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  } else if (city) {
    params.set("city", city);
  }
  const data = await getJson<{ results: PlaceResult[] }>(
    `/api/places/search?${params.toString()}`,
  );
  return data.results.map(resolvePhoto);
}

export async function placeDetails(id: string): Promise<PlaceResult> {
  const data = await getJson<{ result: PlaceResult }>(
    `/api/places/details?id=${encodeURIComponent(id)}`,
  );
  return resolvePhoto(data.result);
}
