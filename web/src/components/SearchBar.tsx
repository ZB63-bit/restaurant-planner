import { useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceResult } from "../lib/api";
import type { NewSuggestion } from "../lib";
import { Meta } from "./MetaBits";

interface Props {
  onAdd: (input: NewSuggestion) => void;
  existingNames?: Set<string>;
}

function toNewSuggestion(r: PlaceResult): NewSuggestion {
  return {
    name: r.name,
    cuisine: r.cuisine,
    address: r.address,
    google_rating: r.google_rating,
    price_level: r.price_level,
    photo_url: r.photo_url,
    maps_url: r.maps_url,
  };
}

export default function SearchBar({ onAdd, existingNames }: Props) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Request geolocation once on mount. Results within 7 miles are used when
  // coords are available; city-based fallback is used when permission is denied.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* denied — city fallback stays active */ },
      { timeout: 5000, maximumAge: 60_000 }
    );
  }, []);

  // Live search: fires 400ms after the user stops typing (min 2 chars).
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Show a loading indicator immediately so the UI feels responsive.
    setLoading(true);

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const r = await searchPlaces(trimmed, city.trim(), coords ?? undefined);
        if (!controller.signal.aborted) {
          setResults(r);
          setError(null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Search failed. Is the backend running?"
          );
          setResults(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      // Don't abort here — we just cancel the pending timer. The in-flight
      // request (if any) is cancelled via abortRef on the next keystroke.
      setLoading(false);
    };
  }, [q, city, coords]);

  function add(r: PlaceResult) {
    onAdd(toNewSuggestion(r));
    clear();
  }

  function clear() {
    setQ("");
    setResults(null);
    setError(null);
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Query input with inline loading/clear controls */}
        <div className="relative flex-1">
          <input
            className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-sm transition-colors duration-150 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Search restaurants…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
          <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
            {loading ? (
              <svg
                className="h-3.5 w-3.5 animate-spin text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : q ? (
              <button
                type="button"
                onClick={clear}
                className="pointer-events-auto text-slate-300 transition-colors duration-150 pointer-fine:hover:text-slate-500 active:scale-90"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        <input
          className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors duration-150 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          autoComplete="off"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </p>
      )}

      {results && results.length === 0 && !loading && (
        <p className="px-1 text-sm text-slate-400 dark:text-slate-500">No results for "{q}".</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
          {results.map((r) => (
            <div
              key={r.place_id}
              className="flex items-center gap-3 rounded-lg p-1.5 transition-colors duration-150 pointer-fine:hover:bg-slate-50 dark:pointer-fine:hover:bg-slate-700"
            >
              {r.photo_url ? (
                <img
                  src={r.photo_url}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                  <svg className="h-5 w-5 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v5" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <Meta cuisine={r.cuisine} rating={r.google_rating} price={r.price_level} />
                {r.address && (
                  <p className="truncate text-xs text-slate-400">{r.address}</p>
                )}
              </div>
              {(() => {
                const inList = existingNames?.has(r.name.trim().toLowerCase()) ?? false;
                return (
                  <button
                    onClick={() => !inList && add(r)}
                    disabled={inList}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-[transform,background-color] duration-150 active:scale-[0.95] disabled:cursor-default ${
                      inList
                        ? "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                        : "bg-brand text-white pointer-fine:hover:bg-brand-dark"
                    }`}
                  >
                    {inList ? "In list" : "Add"}
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
