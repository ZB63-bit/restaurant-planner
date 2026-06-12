const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export function pushPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function registerAndSubscribe(
  memberId: string,
  roomId: string
): Promise<boolean> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      }));

    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), memberId, roomId }),
    });
    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

export async function unsubscribe(memberId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
  }
}

export async function sendTestNotification(memberId: string, roomId: string): Promise<void> {
  await fetch(`${API_BASE}/api/push/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, roomId }),
  });
}

export async function notifyRoom(
  roomId: string,
  actorId: string,
  title: string,
  body: string,
  tag: string
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/push/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, actorId, title, body, tag }),
    });
  } catch {
    // push is best-effort; never block the UI
  }
}
