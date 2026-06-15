import { useState } from "react";
import type { RoomData } from "../App";
import type { HistoryEntry } from "../types";
import { Meta } from "../components/MetaBits";

function HistoryRow({
  entry,
  onSaveNotes,
}: {
  entry: HistoryEntry;
  onSaveNotes: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(entry.notes);
  const dirty = notes !== entry.notes;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {entry.maps_url ? (
            <a
              href={entry.maps_url}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline-offset-2 pointer-fine:hover:underline"
            >
              {entry.name}
            </a>
          ) : (
            entry.name
          )}
        </h3>
        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{entry.visited_date}</span>
      </div>
      <Meta cuisine={entry.cuisine} rating={entry.google_rating} price={entry.price_level} />
      <div className="mt-2 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm transition-colors duration-150 focus:border-brand focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          placeholder="Add a note…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {dirty && (
          <button
            onClick={() => onSaveNotes(notes)}
            className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white transition-[transform,background-color] duration-150 active:scale-[0.96] pointer-fine:hover:bg-brand-dark"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-300 dark:text-slate-600">
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
      <p className="text-center text-sm leading-relaxed text-slate-400 dark:text-slate-500">
        Nothing visited yet.<br />
        Mark a scheduled restaurant as visited<br />
        to log it here.
      </p>
    </div>
  );
}

export default function HistoryPage({ data }: { data: RoomData }) {
  return (
    <div className="space-y-3 p-4">
      {data.history.length === 0 ? (
        <EmptyHistory />
      ) : (
        data.history.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            onSaveNotes={(notes) => data.updateHistoryNotes(entry.id, notes)}
          />
        ))
      )}
    </div>
  );
}
