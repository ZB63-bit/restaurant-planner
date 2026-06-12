import { useCallback, useEffect, useMemo, useState } from "react";
import { repo } from "../lib";
import type { NewSuggestion, JoinResult } from "../lib";
import { notifyRoom } from "../lib/push";
import {
  getUserId,
  getDisplayName,
  setDisplayName,
  getRoomId,
  setRoomId as persistRoomId,
  clearRoomId,
} from "../lib/identity";
import type {
  Room,
  Member,
  Suggestion,
  Vote,
  ScheduleSlot,
  HistoryEntry,
  SuggestionWithVote,
  ScheduleSlotWithSuggestion,
  DayOfWeek,
  Slot,
} from "../types";
import { DAYS_OF_WEEK } from "../types";

interface RawData {
  room: Room | null;
  members: Member[];
  suggestions: Suggestion[];
  votes: Vote[];
  schedule: ScheduleSlot[];
  history: HistoryEntry[];
}

const EMPTY: RawData = {
  room: null,
  members: [],
  suggestions: [],
  votes: [],
  schedule: [],
  history: [],
};

// Sort: buried items always last; otherwise highest net votes first, ties broken
// by oldest-first so order is stable.
function sortQueue(a: SuggestionWithVote, b: SuggestionWithVote): number {
  if (a.is_buried !== b.is_buried) return a.is_buried ? 1 : -1;
  if (a.vote_total !== b.vote_total) return b.vote_total - a.vote_total;
  return a.created_at.localeCompare(b.created_at);
}

export function useRoomData() {
  const userId = getUserId();
  const [roomId, setRoomId] = useState<string | null>(getRoomId());
  const [data, setData] = useState<RawData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [displayName, setName] = useState(getDisplayName());

  const refresh = useCallback(async (rid: string): Promise<boolean> => {
    const [room, members, suggestions, votes, schedule, history] =
      await Promise.all([
        repo.getRoom(rid),
        repo.listMembers(rid),
        repo.listSuggestions(rid),
        repo.listVotes(rid),
        repo.listSchedule(rid),
        repo.listHistory(rid),
      ]);
    if (!room) {
      // Room doesn't exist in this backend (e.g. stale localStorage ID after
      // switching to Supabase). Drop back to the join flow.
      clearRoomId();
      setRoomId(null);
      return false;
    }
    setData({ room, members, suggestions, votes, schedule, history });
    return true;
  }, []);

  // Load + subscribe whenever the joined room changes.
  useEffect(() => {
    if (!roomId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      setLoading(true);
      await repo.maybeWeeklyReset(roomId);
      if (!active) return;
      const found = await refresh(roomId);
      if (!active) return;
      if (!found) return;
      setLoading(false);
      unsubscribe = repo.subscribe(roomId, () => {
        void refresh(roomId);
      });
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [roomId, refresh]);

  const reload = useCallback(async () => {
    if (roomId) await refresh(roomId);
  }, [roomId, refresh]);

  // --- Session actions ---

  const createRoom = useCallback(
    async (roomName: string, name: string) => {
      setDisplayName(name);
      setName(name);
      const room = await repo.createRoom(roomName, userId, name);
      persistRoomId(room.id);
      setRoomId(room.id);
    },
    [userId],
  );

  const joinRoom = useCallback(
    async (code: string, name: string): Promise<JoinResult> => {
      const result = await repo.joinRoom(code, userId, name);
      if (result.ok) {
        setDisplayName(name);
        setName(name);
        persistRoomId(result.room.id);
        setRoomId(result.room.id);
      }
      return result;
    },
    [userId],
  );

  const leaveRoom = useCallback(() => {
    clearRoomId();
    setRoomId(null);
  }, []);

  // --- Derived views ---

  const memberName = useCallback(
    (id: string) => data.members.find((m) => m.id === id)?.display_name ?? "?",
    [data.members],
  );

  const scheduledIds = useMemo(
    () => new Set(data.schedule.map((s) => s.suggestion_id)),
    [data.schedule],
  );

  const queue: SuggestionWithVote[] = useMemo(() => {
    const myVotes = new Map(
      data.votes
        .filter((v) => v.voter_id === userId)
        .map((v) => [v.suggestion_id, v.value]),
    );
    return data.suggestions
      .filter((s) => !scheduledIds.has(s.id))
      .map((s) => ({
        ...s,
        my_vote: (myVotes.get(s.id) ?? 0) as 1 | -1 | 0,
        added_by_name: memberName(s.added_by),
      }))
      .sort(sortQueue);
  }, [data.suggestions, data.votes, scheduledIds, userId, memberName]);

  const scheduleByDay = useMemo(() => {
    const byKey = new Map<string, ScheduleSlotWithSuggestion>();
    for (const slot of data.schedule) {
      const suggestion =
        data.suggestions.find((s) => s.id === slot.suggestion_id) ?? null;
      byKey.set(`${slot.day_of_week}:${slot.slot}`, { ...slot, suggestion });
    }
    return DAYS_OF_WEEK.map((day) => ({
      day,
      primary: byKey.get(`${day}:primary`) ?? null,
      backup: byKey.get(`${day}:backup`) ?? null,
    }));
  }, [data.schedule, data.suggestions]);

  // --- Data actions (each mutates then reloads) ---

  const actions = useMemo(
    () => ({
      addSuggestion: async (input: NewSuggestion) => {
        if (!roomId) return;
        await repo.addSuggestion(roomId, userId, input);
        await reload();
        void notifyRoom(roomId, userId, "New suggestion", `${input.name} was added to the queue`, "rp-suggestion");
      },
      castVote: async (suggestionId: string, value: 1 | -1) => {
        await repo.castVote(suggestionId, userId, value);
        await reload();
      },
      removeSuggestion: async (suggestionId: string) => {
        await repo.removeSuggestion(suggestionId);
        await reload();
      },
      assignToSlot: async (day: DayOfWeek, slot: Slot, suggestionId: string) => {
        if (!roomId) return;
        await repo.assignToSlot(roomId, day, slot, suggestionId);
        await reload();
        const name = data.suggestions.find((s) => s.id === suggestionId)?.name ?? "A restaurant";
        const day2 = day.charAt(0).toUpperCase() + day.slice(1);
        void notifyRoom(roomId, userId, "Schedule updated", `${name} was added to ${day2} (${slot})`, "rp-schedule");
      },
      clearSlot: async (day: DayOfWeek, slot: Slot) => {
        if (!roomId) return;
        await repo.clearSlot(roomId, day, slot);
        await reload();
      },
      markVisited: async (scheduleId: string) => {
        await repo.markVisited(scheduleId);
        await reload();
      },
      updateHistoryNotes: async (historyId: string, notes: string) => {
        await repo.updateHistoryNotes(historyId, notes);
        await reload();
      },
    }),
    [roomId, userId, reload],
  );

  return {
    loading,
    joined: roomId != null,
    room: data.room,
    members: data.members,
    history: data.history,
    queue,
    scheduleByDay,
    userId,
    displayName,
    createRoom,
    joinRoom,
    leaveRoom,
    ...actions,
  };
}
