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

// The single data-access contract shared by every backend. Phase 1 implements
// this against localStorage (lib/storage.ts); Phase 3 implements the exact same
// interface against Supabase. UI code depends only on this interface, so the
// swap is a one-line change in lib/index.ts — not a rewrite.
//
// Everything is async (returns Promises) even in the localStorage impl, so the
// UI never has to change when the real network calls arrive.

export interface NewSuggestion {
  name: string;
  cuisine: string;
  address?: string | null;
  google_rating?: number | null;
  price_level?: number | null;
  photo_url?: string | null;
  maps_url?: string | null;
}

export type JoinResult =
  | { ok: true; room: Room }
  | { ok: false; reason: "not_found" | "full" };

export interface Repo {
  // --- Session / rooms ---
  getRoom(roomId: string): Promise<Room | null>;
  /** Create a new room and add the creator as its first member. */
  createRoom(
    roomName: string,
    memberId: string,
    displayName: string,
  ): Promise<Room>;
  /**
   * Join an existing room by code. Enforces the four-member cap: returns
   * { ok: false, reason: "full" } if the room already has four *other* members,
   * or "not_found" if the code doesn't match a room. Rejoining from the same
   * device (memberId already present) always succeeds and doesn't recount.
   */
  joinRoom(
    code: string,
    memberId: string,
    displayName: string,
  ): Promise<JoinResult>;

  /**
   * Subscribe to changes for a room (suggestions, votes, schedule, history,
   * members). Calls onChange whenever something relevant changes. Returns an
   * unsubscribe function.
   */
  subscribe(roomId: string, onChange: () => void): () => void;

  /** Run the Monday visited-clear if last_reset_date is stale. Idempotent. */
  maybeWeeklyReset(roomId: string): Promise<void>;

  // --- Members ---
  listMembers(roomId: string): Promise<Member[]>;
  /** Move this device's member record to a different room (for room switching). */
  moveMemberToRoom(memberId: string, roomId: string, displayName: string): Promise<void>;

  // --- Suggestions ---
  listSuggestions(roomId: string): Promise<Suggestion[]>;
  addSuggestion(
    roomId: string,
    memberId: string,
    data: NewSuggestion,
  ): Promise<Suggestion>;
  removeSuggestion(suggestionId: string): Promise<void>;

  // --- Votes ---
  listVotes(roomId: string): Promise<Vote[]>;
  /**
   * Cast or change a member's vote on a suggestion. Upserts a single vote row
   * (never a second). Recomputes the suggestion's vote_total and is_buried.
   * Passing the same value again clears the vote (toggle off).
   */
  castVote(
    suggestionId: string,
    voterId: string,
    value: 1 | -1,
  ): Promise<void>;

  // --- Schedule ---
  listSchedule(roomId: string): Promise<ScheduleSlot[]>;
  /** Assign a suggestion to a day/slot. Removes it from the queue. */
  assignToSlot(
    roomId: string,
    day: DayOfWeek,
    slot: Slot,
    suggestionId: string,
    time: string | null,
  ): Promise<void>;
  clearSlot(roomId: string, day: DayOfWeek, slot: Slot): Promise<void>;
  /** Mark a scheduled slot visited and copy a snapshot into history. */
  markVisited(scheduleId: string): Promise<void>;

  // --- History ---
  listHistory(roomId: string): Promise<HistoryEntry[]>;
  updateHistoryNotes(historyId: string, notes: string): Promise<void>;
}
