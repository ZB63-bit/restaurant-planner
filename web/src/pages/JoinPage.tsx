import { useState } from "react";
import { useParams } from "react-router-dom";
import type { RoomData } from "../App";
import { isSharedBackend } from "../lib";

type Mode = "create" | "join";

export default function JoinPage({ data }: { data: RoomData }) {
  const { code: codeParam } = useParams<{ code?: string }>();
  const [mode, setMode] = useState<Mode>(codeParam ? "join" : "create");
  const [name, setName] = useState(data.displayName === "Me" ? "" : data.displayName);
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState(codeParam ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter a display name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        await data.createRoom(roomName, name);
      } else {
        const result = await data.joinRoom(code, name);
        if (!result.ok) {
          setError(
            result.reason === "full"
              ? "That room is full (4 people max)."
              : "No room found with that code.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const tab = (m: Mode) =>
    `flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.97] ${
      mode === m
        ? "bg-brand text-white"
        : "bg-slate-100 text-slate-600 pointer-fine:hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:pointer-fine:hover:bg-slate-600"
    }`;

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-center text-2xl font-bold text-brand">
        Restaurant Planner
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Plan where to eat, together.
      </p>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setMode("create")} className={tab("create")}>
          Create a room
        </button>
        <button onClick={() => setMode("join")} className={tab("join")}>
          Join a room
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          className={field}
          placeholder="Your display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {mode === "create" ? (
          <input
            className={field}
            placeholder="Room name (e.g. Lunch Crew)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
        ) : (
          <input
            className={`${field} font-mono uppercase`}
            placeholder="Room code (e.g. TACO-7842)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition-[transform,background-color] duration-150 active:scale-[0.97] pointer-fine:hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "…" : mode === "create" ? "Create room" : "Join room"}
        </button>
      </form>

      {!isSharedBackend && (
        <p className="mt-6 text-center text-xs text-slate-400">
          Running in on-device mode (no Supabase configured). Rooms live in this
          browser; other tabs on this device sync live.
        </p>
      )}
    </div>
  );
}
