# Restaurant Planner — Handoff

## Goal

Build a shared web app for ≤4 people to suggest restaurants, vote on them, schedule them across a weekly Mon–Sun grid (Primary + Backup slots), view visit history, and receive browser push notifications. No accounts — device-stored UUID + display name. Full spec: `C:\Users\zachb\Downloads\Restaurant_Planner_v5.md`.

---

## Current State

**Phases 1–3 complete. The app runs today.**

| Phase | What | Status |
|-------|------|--------|
| 1 | localStorage MVP — suggestions, voting, bury, schedule, history | Done, verified |
| 2 | Google Places search proxy (Express backend) | Code done; needs a real API key to verify live search |
| 3 | Supabase real-time sync, room create/join, members | Code done; needs a Supabase project to verify cross-device sync |
| 4 | Web Push notifications (VAPID, service worker) | Not built |
| 5 | Polish — history filters, mobile layout, empty/error states | Not built |

`npm run dev` inside `web/` starts the app on localhost:5173. Everything works in on-device localStorage mode with no credentials.

---

## Architecture

```
restaurant-planner/
  web/        Vite + React + TypeScript + Tailwind
  server/     Node + Express (Google Places proxy; Phase 4 VAPID fan-out stub)
  supabase/   schema.sql — 6 tables, triggers, RLS, realtime
  README.md   setup instructions
```

**Key design:** `web/src/lib/repo.ts` defines a single `Repo` interface. `LocalStorageRepo` (`storage.ts`) implements it for Phase 1. `SupabaseRepo` (`supabaseRepo.ts`) implements the same interface for Phase 3. The swap is one line in `web/src/lib/index.ts` — it checks for `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env vars and picks accordingly. All UI code depends only on the interface.

The Express backend exists solely to hide secrets (Google Places API key, future VAPID private key). All Supabase reads/writes go directly browser → Supabase.

---

## Files Actively Maintained

| File | Purpose |
|------|---------|
| `web/src/lib/repo.ts` | The Repo interface (data-access contract) |
| `web/src/lib/storage.ts` | LocalStorageRepo implementation |
| `web/src/lib/supabaseRepo.ts` | SupabaseRepo implementation |
| `web/src/lib/index.ts` | The one-line backend selector |
| `web/src/lib/identity.ts` | UUID + display name + room ID in localStorage |
| `web/src/lib/api.ts` | Typed fetch wrappers to the Express proxy |
| `web/src/hooks/useRoomData.ts` | All room state, queue + schedule derived data |
| `web/src/App.tsx` | Router, bottom nav, join-gate |
| `web/src/pages/JoinPage.tsx` | Create/join form, deep-link `/join/:code` |
| `web/src/pages/SettingsPage.tsx` | Room code, invite link, members, leave |
| `web/src/components/SuggestionCard.tsx` | Vote/bury/schedule/remove per suggestion |
| `web/src/components/SearchBar.tsx` | Google Places search → add to queue |
| `web/src/components/AssignModal.tsx` | Mon–Sun × Primary/Backup grid picker |
| `server/src/index.ts` | Express entry; mounts places router |
| `server/src/routes/places.ts` | Search/details/photo proxy routes |
| `supabase/schema.sql` | Full DB schema with triggers and RLS |

---

## What Has Been Tried and Failed

| Attempt | What went wrong | How it was fixed |
|---------|----------------|-----------------|
| `assignToSlot()` deleting the suggestion row | `markVisited()` snapshots the suggestion into history — deleting it first broke the snapshot | Removed the delete entirely; suggestion stays alive; queue view filters `scheduledIds` out |
| `(await r.json()).places` in TypeScript strict mode | `r.json()` returns `unknown`; property access fails type check | Explicit cast: `(await r.json()) as { places?: any[] }` |
| `node --experimental-strip-types src/index.ts` | Node 24 strips types but can't remap `.js` imports to `.ts` files | Use `npx tsx src/index.ts` (already in the dev script) |

---

## Next Steps (in order)

### Immediate — verify live credentials

1. **Phase 2 (Google Places search):** get a Google Cloud key with "Places API (New)" enabled.
   - `cd server && copy .env.example .env` → set `GOOGLE_PLACES_API_KEY`
   - `npm run dev` in `server/`, then use the search bar in the app

2. **Phase 3 (cross-device sync):** create a Supabase project.
   - Run `supabase/schema.sql` in the Supabase SQL editor
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `web/.env`, restart dev server
   - Test with two browser windows: changes should sync live

### Phase 4 — Web Push

Generate VAPID keys (no account needed):
```
npx web-push generate-vapid-keys
```
Then:
- `public/sw.js` — service worker: handle `push` event → `showNotification`; `notificationclick` → focus app
- `web/src/lib/push.ts` — register SW, request permission, POST subscription to server
- `server/routes/push.ts` — upsert `push_subscriptions`; fan out to all-but-actor on suggestion-added and scheduled events
- Settings page already has a "Notifications" placeholder section to wire up

iOS caveat: Web Push only works in Safari with the site added to the Home Screen (iOS 16.4+). iOS Chrome does not support it.

### Phase 5 — Polish

- History filters: cuisine, date range, minimum rating
- Editable notes per history entry (already in the data model)
- Empty states, loading states, error toasts
- Mobile layout pass — this is primarily a phone app

---

## Environment Variables Reference

**`server/.env`**
```
GOOGLE_PLACES_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
WEB_ORIGIN=http://localhost:5173
```

**`web/.env`**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8787
VITE_VAPID_PUBLIC_KEY=
```
