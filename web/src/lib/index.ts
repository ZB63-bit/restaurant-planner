import { LocalStorageRepo } from "./storage";
import { SupabaseRepo } from "./supabaseRepo";
import { hasSupabase } from "./supabaseClient";
import type { Repo } from "./repo";

// The single place that chooses a backend. If Supabase env vars are present we
// use the real-time shared backend; otherwise everything stays on-device in
// localStorage. Nothing else in the UI changes between the two.
export const repo: Repo = hasSupabase
  ? new SupabaseRepo()
  : new LocalStorageRepo();

export const isSharedBackend = hasSupabase;

export * from "./repo";
