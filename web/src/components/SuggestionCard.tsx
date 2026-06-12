import type { SuggestionWithVote } from "../types";
import { Meta } from "./MetaBits";

interface Props {
  suggestion: SuggestionWithVote;
  onVote: (value: 1 | -1) => void;
  onRemove: () => void;
  onSchedule: () => void;
}

export default function SuggestionCard({
  suggestion: s,
  onVote,
  onRemove,
  onSchedule,
}: Props) {
  const voteLabel = s.vote_total > 0 ? `+${s.vote_total}` : `${s.vote_total}`;

  return (
    <div
      className={`flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-[opacity,box-shadow] duration-300 pointer-fine:hover:shadow-md ${
        s.is_buried ? "opacity-50" : "opacity-100"
      }`}
    >
      {s.photo_url ? (
        <img
          src={s.photo_url}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <svg className="h-6 w-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v5" />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{s.name}</h3>
        <Meta cuisine={s.cuisine} rating={s.google_rating} price={s.price_level} />
        {s.address && (
          <p className="truncate text-xs text-slate-400">{s.address}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-1">
          <span className="text-xs text-slate-400">
            by {s.added_by_name}
            {s.is_buried && (
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-400">
                buried
              </span>
            )}
          </span>

          <div className="flex items-center gap-1">
            {/* Vote group: ▲ score ▼ */}
            <div className="flex items-center rounded-lg bg-slate-100">
              <button
                aria-label="Upvote"
                onClick={() => onVote(1)}
                className={`rounded-lg px-2 py-1 text-sm transition-[transform,background-color,color] duration-150 active:scale-[0.95] ${
                  s.my_vote === 1
                    ? "bg-emerald-500 text-white"
                    : "text-slate-500 pointer-fine:hover:bg-slate-200 pointer-fine:hover:text-slate-700"
                }`}
              >
                ▲
              </button>
              <span className="w-6 select-none text-center text-xs font-bold tabular-nums text-slate-600">
                {voteLabel}
              </span>
              <button
                aria-label="Downvote"
                onClick={() => onVote(-1)}
                className={`rounded-lg px-2 py-1 text-sm transition-[transform,background-color,color] duration-150 active:scale-[0.95] ${
                  s.my_vote === -1
                    ? "bg-rose-500 text-white"
                    : "text-slate-500 pointer-fine:hover:bg-slate-200 pointer-fine:hover:text-slate-700"
                }`}
              >
                ▼
              </button>
            </div>

            <button
              onClick={onSchedule}
              className="rounded-lg bg-brand px-2.5 py-1 text-sm font-medium text-white transition-[transform,background-color] duration-150 active:scale-[0.95] pointer-fine:hover:bg-brand-dark"
            >
              Schedule
            </button>

            <button
              aria-label="Remove"
              onClick={onRemove}
              className="rounded-lg p-1.5 text-slate-300 transition-[transform,background-color,color] duration-150 active:scale-[0.95] pointer-fine:hover:bg-rose-50 pointer-fine:hover:text-rose-500"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
