// Device-bound identity (no accounts). A random UUID is generated once and kept
// in localStorage; it tags everything the member does. The display name is just
// the friendly label. In Phase 1 we hardcode a single room and ensure a single
// local member exists.

const USER_ID_KEY = "rp_user_id";
const DISPLAY_NAME_KEY = "rp_display_name";
const ROOM_ID_KEY = "rp_room_id";

export function uuid(): string {
  // crypto.randomUUID is available in all modern browsers and Node 24.
  return crypto.randomUUID();
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? "Me";
}

export function setDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export function getRoomId(): string | null {
  return localStorage.getItem(ROOM_ID_KEY);
}

export function setRoomId(roomId: string): void {
  localStorage.setItem(ROOM_ID_KEY, roomId);
}

export function clearRoomId(): void {
  localStorage.removeItem(ROOM_ID_KEY);
}
