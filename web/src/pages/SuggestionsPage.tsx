import { useState } from "react";
import type { RoomData } from "../App";
import type { DayOfWeek, Slot, SuggestionWithVote } from "../types";
import AddSuggestionForm from "../components/AddSuggestionForm";
import SearchBar from "../components/SearchBar";
import SuggestionCard from "../components/SuggestionCard";
import AssignModal from "../components/AssignModal";

function EmptySuggestions() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-300">
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v5" />
      </svg>
      <p className="text-center text-sm leading-relaxed text-slate-400">
        No suggestions yet.<br />
        Search for a restaurant above to add the first one.
      </p>
    </div>
  );
}

export default function SuggestionsPage({ data }: { data: RoomData }) {
  const [assigning, setAssigning] = useState<SuggestionWithVote | null>(null);

  async function handleAssign(day: DayOfWeek, slot: Slot) {
    if (!assigning) return;
    await data.assignToSlot(day, slot, assigning.id);
    setAssigning(null);
  }

  return (
    <div className="space-y-3 p-4">
      <SearchBar onAdd={data.addSuggestion} />
      <details className="text-sm">
        <summary className="cursor-pointer select-none text-slate-400 transition-colors duration-150 pointer-fine:hover:text-slate-600">
          ▸ Add manually instead
        </summary>
        <div className="mt-2">
          <AddSuggestionForm onAdd={data.addSuggestion} />
        </div>
      </details>

      {data.queue.length === 0 ? (
        <EmptySuggestions />
      ) : (
        data.queue.map((s, i) => (
          <div
            key={s.id}
            className="card-enter"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <SuggestionCard
              suggestion={s}
              onVote={(value) => data.castVote(s.id, value)}
              onRemove={() => data.removeSuggestion(s.id)}
              onSchedule={() => setAssigning(s)}
            />
          </div>
        ))
      )}

      {assigning && (
        <AssignModal
          suggestion={assigning}
          onAssign={handleAssign}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
}
