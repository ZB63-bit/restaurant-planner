import { useState } from "react";
import type { NewSuggestion } from "../lib";

interface Props {
  onAdd: (input: NewSuggestion) => void;
}

// Manual entry for Phase 1 (no search yet). Phase 2 replaces this with a Google
// Places search bar that produces the same NewSuggestion shape.
export default function AddSuggestionForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [rating, setRating] = useState("");
  const [price, setPrice] = useState("");
  const [maps, setMaps] = useState("");

  function reset() {
    setName("");
    setCuisine("");
    setRating("");
    setPrice("");
    setMaps("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      cuisine: cuisine.trim(),
      google_rating: rating ? Number(rating) : null,
      price_level: price ? Number(price) : null,
      maps_url: maps.trim() || null,
    });
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-brand hover:text-brand"
      >
        + Add a restaurant
      </button>
    );
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <input
        autoFocus
        className={field}
        placeholder="Restaurant name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={field}
        placeholder="Cuisine (e.g. Tacos)"
        value={cuisine}
        onChange={(e) => setCuisine(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className={field}
          type="number"
          step="0.1"
          min="0"
          max="5"
          placeholder="Rating 0–5"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        />
        <select
          className={field}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        >
          <option value="">Price</option>
          <option value="1">$</option>
          <option value="2">$$</option>
          <option value="3">$$$</option>
          <option value="4">$$$$</option>
        </select>
      </div>
      <input
        className={field}
        placeholder="Google Maps URL (optional)"
        value={maps}
        onChange={(e) => setMaps(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
