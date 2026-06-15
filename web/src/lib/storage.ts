import type {
  Room,
  Member,
  Suggestion,
  Vote,
  ScheduleSlot,
  HistoryEntry,
  DayOfWeek,
  Slot,
} from "../types";
import type { Repo, NewSuggestion, JoinResult } from "./repo";
import { uuid } from "./identity";
import { generateRoomCode, normalizeRoomCode } from "./roomCode";

const MAX_MEMBERS = 4;

// localStorage-backed implementation of the Repo contract. Each table is a JSON
// array under its own key. This deliberately mirrors how the rows will live in
// Postgres so the Supabase repo in Phase 3 can drop straight in.

const KEYS = {
  rooms: "rp_rooms",
  members: "rp_members",
  suggestions: "rp_suggestions",
  votes: "rp_votes",
  schedule: "rp_schedule",
  history: "rp_history",
} as const;

function read<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO date (YYYY-MM-DD) of the Monday on or before the given date. */
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Recompute vote_total and is_buried for one suggestion from its vote rows.
function recomputeSuggestion(suggestionId: string): void {
  const suggestions = read<Suggestion>(KEYS.suggestions);
  const idx = suggestions.findIndex((s) => s.id === suggestionId);
  if (idx === -1) return;
  const votes = read<Vote>(KEYS.votes).filter(
    (v) => v.suggestion_id === suggestionId,
  );
  const total = votes.reduce((sum, v) => sum + v.value, 0);
  const creatorVote = votes.find(
    (v) => v.voter_id === suggestions[idx].added_by,
  );
  suggestions[idx] = {
    ...suggestions[idx],
    vote_total: total,
    is_buried: creatorVote?.value === -1,
  };
  write(KEYS.suggestions, suggestions);
}

export class LocalStorageRepo implements Repo {
  // --- Session / rooms ---
  async getRoom(roomId: string): Promise<Room | null> {
    return read<Room>(KEYS.rooms).find((r) => r.id === roomId) ?? null;
  }

  async createRoom(
    roomName: string,
    memberId: string,
    displayName: string,
  ): Promise<Room> {
    const rooms = read<Room>(KEYS.rooms);
    // Ensure a unique code among local rooms.
    let code = generateRoomCode();
    while (rooms.some((r) => r.room_code === code)) code = generateRoomCode();
    const room: Room = {
      id: uuid(),
      room_code: code,
      room_name: roomName.trim() || "My Room",
      last_reset_date: null,
      created_at: new Date().toISOString(),
    };
    rooms.push(room);
    write(KEYS.rooms, rooms);

    const members = read<Member>(KEYS.members);
    members.push({
      id: memberId,
      room_id: room.id,
      display_name: displayName.trim() || "Me",
      joined_at: new Date().toISOString(),
    });
    write(KEYS.members, members);
    return room;
  }

  async joinRoom(
    code: string,
    memberId: string,
    displayName: string,
  ): Promise<JoinResult> {
    const wanted = normalizeRoomCode(code);
    const room = read<Room>(KEYS.rooms).find((r) => r.room_code === wanted);
    if (!room) return { ok: false, reason: "not_found" };

    const members = read<Member>(KEYS.members);
    const roomMembers = members.filter((m) => m.room_id === room.id);
    const already = roomMembers.find((m) => m.id === memberId);
    if (already) {
      // Rejoin from same device: refresh the display name, don't recount.
      already.display_name = displayName.trim() || already.display_name;
      write(KEYS.members, members);
      return { ok: true, room };
    }
    if (roomMembers.length >= MAX_MEMBERS) return { ok: false, reason: "full" };

    members.push({
      id: memberId,
      room_id: room.id,
      display_name: displayName.trim() || "Me",
      joined_at: new Date().toISOString(),
    });
    write(KEYS.members, members);
    return { ok: true, room };
  }

  subscribe(_roomId: string, onChange: () => void): () => void {
    // Cross-tab "realtime": the storage event fires in *other* tabs whenever any
    // of our keys change. Same-tab updates already flow through the reload path.
    const handler = (e: StorageEvent) => {
      if (!e.key) return;
      if ((Object.values(KEYS) as string[]).includes(e.key)) onChange();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }

  async maybeWeeklyReset(roomId: string): Promise<void> {
    const rooms = read<Room>(KEYS.rooms);
    const idx = rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) return;
    const thisMonday = mondayOf(new Date());
    if (rooms[idx].last_reset_date === thisMonday) return; // already reset this week

    const schedule = read<ScheduleSlot>(KEYS.schedule);
    const visited = schedule.filter((s) => s.room_id === roomId && s.is_visited);
    const visitedSuggestionIds = new Set(visited.map((s) => s.suggestion_id));

    // Clear visited slots (idempotent — deleting already-gone rows is a no-op).
    write(
      KEYS.schedule,
      schedule.filter((s) => !(s.room_id === roomId && s.is_visited)),
    );
    // The visited suggestions are now permanently in history; drop their queue
    // rows + votes so they don't reappear once the schedule slot is cleared.
    write(
      KEYS.suggestions,
      read<Suggestion>(KEYS.suggestions).filter(
        (s) => !visitedSuggestionIds.has(s.id),
      ),
    );
    write(
      KEYS.votes,
      read<Vote>(KEYS.votes).filter(
        (v) => !visitedSuggestionIds.has(v.suggestion_id),
      ),
    );

    rooms[idx] = { ...rooms[idx], last_reset_date: thisMonday };
    write(KEYS.rooms, rooms);
  }

  // --- Members ---
  async listMembers(roomId: string): Promise<Member[]> {
    return read<Member>(KEYS.members).filter((m) => m.room_id === roomId);
  }

  async moveMemberToRoom(memberId: string, roomId: string, displayName: string): Promise<void> {
    // localStorage already supports multiple member rows per device — just
    // ensure a row exists for this room without removing the others.
    const members = read<Member>(KEYS.members);
    const existing = members.find((m) => m.id === memberId && m.room_id === roomId);
    if (!existing) {
      members.push({ id: memberId, room_id: roomId, display_name: displayName, joined_at: new Date().toISOString() });
      write(KEYS.members, members);
    }
  }

  // --- Suggestions ---
  async listSuggestions(roomId: string): Promise<Suggestion[]> {
    return read<Suggestion>(KEYS.suggestions).filter(
      (s) => s.room_id === roomId,
    );
  }

  async addSuggestion(
    roomId: string,
    memberId: string,
    data: NewSuggestion,
  ): Promise<Suggestion> {
    const suggestion: Suggestion = {
      id: uuid(),
      room_id: roomId,
      name: data.name,
      cuisine: data.cuisine,
      address: data.address ?? null,
      google_rating: data.google_rating ?? null,
      price_level: data.price_level ?? null,
      photo_url: data.photo_url ?? null,
      maps_url: data.maps_url ?? null,
      added_by: memberId,
      vote_total: 0,
      is_buried: false,
      created_at: new Date().toISOString(),
    };
    const suggestions = read<Suggestion>(KEYS.suggestions);
    suggestions.push(suggestion);
    write(KEYS.suggestions, suggestions);
    return suggestion;
  }

  async removeSuggestion(suggestionId: string): Promise<void> {
    write(
      KEYS.suggestions,
      read<Suggestion>(KEYS.suggestions).filter((s) => s.id !== suggestionId),
    );
    // Hard delete also drops the suggestion's votes.
    write(
      KEYS.votes,
      read<Vote>(KEYS.votes).filter((v) => v.suggestion_id !== suggestionId),
    );
  }

  // --- Votes ---
  async listVotes(roomId: string): Promise<Vote[]> {
    const suggestionIds = new Set(
      read<Suggestion>(KEYS.suggestions)
        .filter((s) => s.room_id === roomId)
        .map((s) => s.id),
    );
    return read<Vote>(KEYS.votes).filter((v) =>
      suggestionIds.has(v.suggestion_id),
    );
  }

  async castVote(
    suggestionId: string,
    voterId: string,
    value: 1 | -1,
  ): Promise<void> {
    const votes = read<Vote>(KEYS.votes);
    const existing = votes.find(
      (v) => v.suggestion_id === suggestionId && v.voter_id === voterId,
    );
    if (existing) {
      if (existing.value === value) {
        // Same button pressed again — toggle the vote off.
        write(
          KEYS.votes,
          votes.filter((v) => v.id !== existing.id),
        );
      } else {
        existing.value = value;
        write(KEYS.votes, votes);
      }
    } else {
      votes.push({ id: uuid(), suggestion_id: suggestionId, voter_id: voterId, value });
      write(KEYS.votes, votes);
    }
    recomputeSuggestion(suggestionId);
  }

  // --- Schedule ---
  async listSchedule(roomId: string): Promise<ScheduleSlot[]> {
    return read<ScheduleSlot>(KEYS.schedule).filter(
      (s) => s.room_id === roomId,
    );
  }

  async assignToSlot(
    roomId: string,
    day: DayOfWeek,
    slot: Slot,
    suggestionId: string,
  ): Promise<void> {
    const schedule = read<ScheduleSlot>(KEYS.schedule);
    // One suggestion per (day, slot): clear any existing occupant first.
    const filtered = schedule.filter(
      (s) => !(s.room_id === roomId && s.day_of_week === day && s.slot === slot),
    );
    filtered.push({
      id: uuid(),
      room_id: roomId,
      day_of_week: day,
      slot,
      suggestion_id: suggestionId,
      is_visited: false,
    });
    write(KEYS.schedule, filtered);
    // The suggestion row stays alive (the schedule slot references it); the
    // queue view excludes any suggestion that is currently scheduled. This
    // mirrors the FK model so markVisited can still snapshot its details.
  }

  async clearSlot(roomId: string, day: DayOfWeek, slot: Slot): Promise<void> {
    write(
      KEYS.schedule,
      read<ScheduleSlot>(KEYS.schedule).filter(
        (s) =>
          !(s.room_id === roomId && s.day_of_week === day && s.slot === slot),
      ),
    );
  }

  async markVisited(scheduleId: string): Promise<void> {
    const schedule = read<ScheduleSlot>(KEYS.schedule);
    const slot = schedule.find((s) => s.id === scheduleId);
    if (!slot) return;

    // Copy a permanent snapshot of the suggestion into history. The suggestion
    // row is still alive (it's referenced by this schedule slot), so its details
    // are available to snapshot here.
    const suggestion = read<Suggestion>(KEYS.suggestions).find(
      (s) => s.id === slot.suggestion_id,
    );
    const entry: HistoryEntry = {
      id: uuid(),
      room_id: slot.room_id,
      name: suggestion?.name ?? "(removed)",
      cuisine: suggestion?.cuisine ?? "",
      address: suggestion?.address ?? null,
      google_rating: suggestion?.google_rating ?? null,
      price_level: suggestion?.price_level ?? null,
      maps_url: suggestion?.maps_url ?? null,
      notes: "",
      visited_date: todayISO(),
    };
    const history = read<HistoryEntry>(KEYS.history);
    history.push(entry);
    write(KEYS.history, history);

    slot.is_visited = true;
    write(KEYS.schedule, schedule);
  }

  // --- History ---
  async listHistory(roomId: string): Promise<HistoryEntry[]> {
    return read<HistoryEntry>(KEYS.history)
      .filter((h) => h.room_id === roomId)
      .sort((a, b) => b.visited_date.localeCompare(a.visited_date));
  }

  async updateHistoryNotes(historyId: string, notes: string): Promise<void> {
    const history = read<HistoryEntry>(KEYS.history);
    const entry = history.find((h) => h.id === historyId);
    if (!entry) return;
    entry.notes = notes;
    write(KEYS.history, history);
  }
}
