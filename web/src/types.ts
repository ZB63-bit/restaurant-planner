// Mirrors the six-table data model from the spec. Kept deliberately close to the
// eventual Postgres/Supabase schema so the localStorage repo and the Supabase
// repo can share one interface (see lib/repo.ts).

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export type Slot = "primary" | "backup";

export interface Room {
  id: string;
  room_code: string;
  room_name: string;
  last_reset_date: string | null; // ISO date (YYYY-MM-DD)
  created_at: string;
}

export interface Member {
  id: string; // this is the user ID stored in localStorage
  room_id: string;
  display_name: string;
  joined_at: string;
}

export interface Suggestion {
  id: string;
  room_id: string;
  name: string;
  cuisine: string;
  address: string | null;
  google_rating: number | null;
  price_level: number | null; // 1..4
  photo_url: string | null;
  maps_url: string | null;
  added_by: string; // members.id
  vote_total: number; // cached net score for sorting
  is_buried: boolean; // creator downvoted their own suggestion
  created_at: string;
}

export interface Vote {
  id: string;
  suggestion_id: string;
  voter_id: string; // members.id
  value: 1 | -1;
}

export interface ScheduleSlot {
  id: string;
  room_id: string;
  day_of_week: DayOfWeek;
  slot: Slot;
  suggestion_id: string;
  is_visited: boolean;
  reservation_time: string | null; // "HH:MM" 24-hour, e.g. "18:30"
}

export interface HistoryEntry {
  id: string;
  room_id: string;
  name: string;
  cuisine: string;
  address: string | null;
  google_rating: number | null;
  price_level: number | null;
  maps_url: string | null;
  notes: string;
  visited_date: string; // ISO date
}

export interface PushSubscriptionRow {
  id: string;
  room_id: string;
  member_id: string;
  subscription: unknown; // browser PushSubscription JSON
}

// A suggestion joined with the current member's vote, ready for rendering.
export interface SuggestionWithVote extends Suggestion {
  my_vote: 1 | -1 | 0;
  added_by_name: string;
}

// A schedule slot joined with its suggestion details, ready for rendering.
export interface ScheduleSlotWithSuggestion extends ScheduleSlot {
  suggestion: Suggestion | null;
}
