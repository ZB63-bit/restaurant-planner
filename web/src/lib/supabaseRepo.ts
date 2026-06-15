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
import { supabase } from "./supabaseClient";
import { generateRoomCode, normalizeRoomCode } from "./roomCode";

// Supabase implementation of the Repo contract. vote_total / is_buried are kept
// in sync by a DB trigger (see supabase/schema.sql), and the four-member cap is
// enforced by a trigger too, so this layer stays thin.

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** ISO date (YYYY-MM-DD) of the Monday on or before the given date. */
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export class SupabaseRepo implements Repo {
  // --- Session / rooms ---
  async getRoom(roomId: string): Promise<Room | null> {
    const { data } = await db()
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();
    return (data as Room) ?? null;
  }

  async createRoom(
    roomName: string,
    memberId: string,
    displayName: string,
  ): Promise<Room> {
    // Retry on the (rare) room_code unique collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const { data, error } = await db()
        .from("rooms")
        .insert({ room_code: code, room_name: roomName.trim() || "My Room" })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") continue; // unique_violation → new code
        throw error;
      }
      const room = data as Room;
      await db().from("members").upsert(
        { id: memberId, room_id: room.id, display_name: displayName.trim() || "Me" },
        { onConflict: "id" },
      );
      return room;
    }
    throw new Error("Could not generate a unique room code.");
  }

  async joinRoom(
    code: string,
    memberId: string,
    displayName: string,
  ): Promise<JoinResult> {
    const { data: room } = await db()
      .from("rooms")
      .select("*")
      .eq("room_code", normalizeRoomCode(code))
      .maybeSingle();
    if (!room) return { ok: false, reason: "not_found" };

    const name = displayName.trim() || "Me";

    // Rejoin from same device: update name, don't trip the cap trigger.
    const { data: existing } = await db()
      .from("members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();
    if (existing) {
      await db().from("members").update({ display_name: name }).eq("id", memberId);
      return { ok: true, room: room as Room };
    }

    const { error } = await db()
      .from("members")
      .insert({ id: memberId, room_id: (room as Room).id, display_name: name });
    if (error) {
      // The cap trigger raises with errcode check_violation (23514).
      if (error.code === "23514" || error.message.includes("room_full")) {
        return { ok: false, reason: "full" };
      }
      throw error;
    }
    return { ok: true, room: room as Room };
  }

  subscribe(roomId: string, onChange: () => void): () => void {
    const channel = db().channel(`room:${roomId}`);
    // Tables carrying room_id can be server-filtered; votes can't, so we listen
    // to all vote changes (small volume) and let the reload re-scope them.
    for (const table of ["suggestions", "schedule", "history", "members"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `room_id=eq.${roomId}` },
        onChange,
      );
    }
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes" },
      onChange,
    );
    channel.subscribe();
    return () => {
      void db().removeChannel(channel);
    };
  }

  async maybeWeeklyReset(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;
    const thisMonday = mondayOf(new Date());
    if (room.last_reset_date === thisMonday) return;

    const { data: visited } = await db()
      .from("schedule")
      .select("suggestion_id")
      .eq("room_id", roomId)
      .eq("is_visited", true);
    const ids = (visited ?? []).map((r) => (r as { suggestion_id: string }).suggestion_id);
    if (ids.length > 0) {
      // Deleting the suggestion cascades to its schedule slot and votes.
      await db().from("suggestions").delete().in("id", ids);
    }
    await db()
      .from("rooms")
      .update({ last_reset_date: thisMonday })
      .eq("id", roomId);
  }

  // --- Members ---
  async listMembers(roomId: string): Promise<Member[]> {
    const { data } = await db().from("members").select("*").eq("room_id", roomId);
    return (data as Member[]) ?? [];
  }

  // --- Suggestions ---
  async listSuggestions(roomId: string): Promise<Suggestion[]> {
    const { data } = await db()
      .from("suggestions")
      .select("*")
      .eq("room_id", roomId);
    return (data as Suggestion[]) ?? [];
  }

  async addSuggestion(
    roomId: string,
    memberId: string,
    input: NewSuggestion,
  ): Promise<Suggestion> {
    const { data, error } = await db()
      .from("suggestions")
      .insert({
        room_id: roomId,
        name: input.name,
        cuisine: input.cuisine,
        address: input.address ?? null,
        google_rating: input.google_rating ?? null,
        price_level: input.price_level ?? null,
        photo_url: input.photo_url ?? null,
        maps_url: input.maps_url ?? null,
        added_by: memberId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Suggestion;
  }

  async removeSuggestion(suggestionId: string): Promise<void> {
    await db().from("suggestions").delete().eq("id", suggestionId);
  }

  // --- Votes ---
  async listVotes(roomId: string): Promise<Vote[]> {
    const suggestions = await this.listSuggestions(roomId);
    const ids = suggestions.map((s) => s.id);
    if (ids.length === 0) return [];
    const { data } = await db().from("votes").select("*").in("suggestion_id", ids);
    return (data as Vote[]) ?? [];
  }

  async castVote(
    suggestionId: string,
    voterId: string,
    value: 1 | -1,
  ): Promise<void> {
    const { data: existing } = await db()
      .from("votes")
      .select("id, value")
      .eq("suggestion_id", suggestionId)
      .eq("voter_id", voterId)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; value: number };
      if (row.value === value) {
        await db().from("votes").delete().eq("id", row.id); // toggle off
      } else {
        await db().from("votes").update({ value }).eq("id", row.id);
      }
    } else {
      await db()
        .from("votes")
        .insert({ suggestion_id: suggestionId, voter_id: voterId, value });
    }
    // suggestions.vote_total / is_buried are updated by the DB trigger.
  }

  // --- Schedule ---
  async listSchedule(roomId: string): Promise<ScheduleSlot[]> {
    const { data } = await db().from("schedule").select("*").eq("room_id", roomId);
    return (data as ScheduleSlot[]) ?? [];
  }

  async assignToSlot(
    roomId: string,
    day: DayOfWeek,
    slot: Slot,
    suggestionId: string,
  ): Promise<void> {
    await db()
      .from("schedule")
      .upsert(
        {
          room_id: roomId,
          day_of_week: day,
          slot,
          suggestion_id: suggestionId,
          is_visited: false,
        },
        { onConflict: "room_id,day_of_week,slot" },
      );
  }

  async clearSlot(roomId: string, day: DayOfWeek, slot: Slot): Promise<void> {
    await db()
      .from("schedule")
      .delete()
      .eq("room_id", roomId)
      .eq("day_of_week", day)
      .eq("slot", slot);
  }

  async markVisited(scheduleId: string): Promise<void> {
    const { data: slot } = await db()
      .from("schedule")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();
    if (!slot) return;
    const s = slot as ScheduleSlot;

    const { data: suggestion } = await db()
      .from("suggestions")
      .select("*")
      .eq("id", s.suggestion_id)
      .maybeSingle();
    const sg = suggestion as Suggestion | null;

    await db().from("history").insert({
      room_id: s.room_id,
      name: sg?.name ?? "(removed)",
      cuisine: sg?.cuisine ?? "",
      address: sg?.address ?? null,
      google_rating: sg?.google_rating ?? null,
      price_level: sg?.price_level ?? null,
      maps_url: sg?.maps_url ?? null,
    });
    await db().from("schedule").update({ is_visited: true }).eq("id", scheduleId);
  }

  // --- History ---
  async listHistory(roomId: string): Promise<HistoryEntry[]> {
    const { data } = await db()
      .from("history")
      .select("*")
      .eq("room_id", roomId)
      .order("visited_date", { ascending: false });
    return (data as HistoryEntry[]) ?? [];
  }

  async updateHistoryNotes(historyId: string, notes: string): Promise<void> {
    await db().from("history").update({ notes }).eq("id", historyId);
  }
}
