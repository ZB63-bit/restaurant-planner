import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// When both env vars are present the app runs in Supabase mode (real-time sync,
// shared across devices). Otherwise it falls back to the localStorage repo.
export const hasSupabase = Boolean(url && anon);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anon!, { realtime: { params: { eventsPerSecond: 5 } } })
  : null;
