import type { DayOfWeek, Slot, SuggestionWithVote } from "../types";
import { DAYS_OF_WEEK } from "../types";

interface Props {
  suggestion: SuggestionWithVote;
  onAssign: (day: DayOfWeek, slot: Slot) => void;
  onClose: () => void;
}

const dayLabel = (d: DayOfWeek) => d.charAt(0).toUpperCase() + d.slice(1, 3);

export default function AssignModal({ suggestion, onAssign, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-bold">Schedule “{suggestion.name}”</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Pick a day and slot. This removes it from the queue.
        </p>
        <div className="space-y-2">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="flex items-center gap-2">
              <span className="w-12 text-sm font-medium text-slate-600 dark:text-slate-300">
                {dayLabel(day)}
              </span>
              <button
                onClick={() => onAssign(day, "primary")}
                className="flex-1 rounded-lg bg-brand/10 py-2 text-sm font-medium text-brand hover:bg-brand/20"
              >
                Primary
              </button>
              <button
                onClick={() => onAssign(day, "backup")}
                className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                Backup
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
