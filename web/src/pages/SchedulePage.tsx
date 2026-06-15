import type { RoomData } from "../App";
import type { DayOfWeek, Slot, ScheduleSlotWithSuggestion } from "../types";
import { Meta } from "../components/MetaBits";

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h - 12}:${m.toString().padStart(2, "0")} PM`;
}

function SlotView({
  label,
  data,
  entry,
  day,
  slot,
}: {
  label: string;
  data: RoomData;
  entry: ScheduleSlotWithSuggestion | null;
  day: DayOfWeek;
  slot: Slot;
}) {
  if (!entry) {
    return (
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-300 dark:text-slate-600">
          {label}
        </span>
        <span className="text-xs text-slate-300 dark:text-slate-600">Nothing planned</span>
      </div>
    );
  }

  const s = entry.suggestion;
  return (
    <div
      className={`rounded-lg border px-3 py-2 transition-colors duration-200 ${
        entry.is_visited
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
          {entry.reservation_time && (
            <span className="ml-2 normal-case tracking-normal text-brand">
              {formatTime(entry.reservation_time)}
            </span>
          )}
        </span>
        {entry.is_visited && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Visited</span>
        )}
      </div>
      {s?.maps_url ? (
        <a
          href={s.maps_url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand underline-offset-2 pointer-fine:hover:underline"
        >
          {s.name}
        </a>
      ) : (
        <span className="font-semibold">{s?.name ?? "(removed)"}</span>
      )}
      <Meta cuisine={s?.cuisine} rating={s?.google_rating} price={s?.price_level} />
      <div className="mt-1.5 flex gap-2">
        {!entry.is_visited && (
          <button
            onClick={() => data.markVisited(entry.id)}
            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition-[transform,background-color] duration-150 active:scale-[0.96] pointer-fine:hover:bg-emerald-700"
          >
            Mark visited
          </button>
        )}
        <button
          onClick={() => data.clearSlot(day, slot)}
          className="rounded-md px-2 py-1 text-xs text-slate-400 dark:text-slate-500 transition-[transform,background-color,color] duration-150 active:scale-[0.96] pointer-fine:hover:bg-rose-50 pointer-fine:hover:text-rose-500 dark:pointer-fine:hover:bg-rose-900/20 dark:pointer-fine:hover:text-rose-400"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

const dayTitle = (d: DayOfWeek) => d.charAt(0).toUpperCase() + d.slice(1);

export default function SchedulePage({ data }: { data: RoomData }) {
  return (
    <div className="space-y-2 p-4">
      {data.scheduleByDay.map(({ day, primary, backup }) => (
        <div
          key={day}
          className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"
        >
          <h3 className="mb-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">{dayTitle(day)}</h3>
          <SlotView label="Primary" data={data} entry={primary} day={day} slot="primary" />
          <SlotView label="Backup" data={data} entry={backup} day={day} slot="backup" />
        </div>
      ))}
    </div>
  );
}
