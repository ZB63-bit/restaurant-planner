import { useEffect, useState } from "react";
import type { RoomData } from "../App";
import {
  pushSupported,
  pushPermission,
  registerAndSubscribe,
  unsubscribe,
  sendTestNotification,
} from "../lib/push";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function SettingsPage({ data }: { data: RoomData }) {
  const [copied, setCopied] = useState(false);
  const joinLink = data.room
    ? `${window.location.origin}/join/${data.room.room_code}`
    : "";

  // --- Push state ---
  const supported = pushSupported();
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? pushPermission() : "denied"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Sync permission state when the page is focused (user may have changed it in OS settings)
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPermission(pushPermission());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [supported]);

  async function togglePush() {
    if (!data.room) return;
    setPushBusy(true);
    if (subscribed) {
      await unsubscribe(data.userId);
      setSubscribed(false);
    } else {
      const ok = await registerAndSubscribe(data.userId, data.room.id);
      if (ok) {
        setSubscribed(true);
        setPermission("granted");
      } else {
        setPermission(pushPermission());
      }
    }
    setPushBusy(false);
  }

  async function testPush() {
    if (!data.room) return;
    setTestSent(true);
    await sendTestNotification(data.userId, data.room.id);
    setTimeout(() => setTestSent(false), 2000);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; the link is shown below regardless */
    }
  }

  return (
    <div className="space-y-3 p-4">
      {data.savedRooms.length > 1 && (
        <Section title="My Rooms">
          <ul className="space-y-2">
            {data.savedRooms.map((r) => {
              const isCurrent = r.id === data.room?.id;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="font-mono text-xs text-slate-400">{r.code}</p>
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                      Current
                    </span>
                  ) : (
                    <button
                      onClick={() => data.switchRoom(r.id)}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors duration-150 active:scale-[0.97] pointer-fine:hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:pointer-fine:hover:bg-slate-700"
                    >
                      Switch
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Room">
        <p className="font-semibold">{data.room?.room_name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Code: <span className="font-mono">{data.room?.room_code}</span>
        </p>
        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">Invite link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinLink}
              className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            />
            <button
              onClick={copyLink}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Members">
        <ul className="space-y-1">
          {data.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              {m.display_name}
              {m.id === data.userId && (
                <span className="text-xs text-slate-400 dark:text-slate-500">(you)</span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Notifications">
        {!supported ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Push notifications aren't supported in this browser. On iOS, add
            the app to your Home Screen and open it from there (Safari 16.4+).
          </p>
        ) : permission === "denied" ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Notifications are blocked. Open your browser settings and allow
            notifications for this site, then reload.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Get notified when someone adds a suggestion or updates the
              schedule.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={togglePush}
                disabled={pushBusy}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  subscribed
                    ? "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                    : "bg-brand text-white hover:bg-brand-dark"
                } disabled:opacity-50`}
              >
                {pushBusy ? "…" : subscribed ? "Turn off" : "Enable notifications"}
              </button>
              {subscribed && (
                <button
                  onClick={testPush}
                  disabled={testSent}
                  className="text-sm text-slate-400 underline hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {testSent ? "Sent!" : "Send test"}
                </button>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title="About">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You are <span className="font-medium">{data.displayName}</span> on
          this device. Clearing browser data or switching devices means
          rejoining as a new person.
        </p>
        <button
          onClick={data.leaveRoom}
          className="mt-3 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          Leave room
        </button>
      </Section>
    </div>
  );
}
