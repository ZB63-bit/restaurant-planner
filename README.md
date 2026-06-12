# Restaurant Planner

A lightweight shared web app for up to four people to suggest restaurants, vote on
them, schedule them across a week, and get browser push notifications — no real
accounts (device-stored ID + display name), real-time sync via Supabase.

Built in five phases. **Phases 1–3 are built; the app runs today.** It works in
two modes: on-device localStorage (default, no setup) and shared Supabase mode
(set the env vars). Phase 2 search needs the backend + a Google key.

## Structure

```
restaurant-planner/
  web/        # Vite + React + TypeScript + Tailwind  (→ Vercel)
  server/     # Node + Express — Google Places proxy   (→ Railway/Render)
  supabase/   # schema.sql — 6 tables, triggers, RLS, realtime
```

## Run the web app (Phase 1)

```powershell
cd web
npm install
npm run dev        # http://localhost:5173
```

Everything is stored in your browser's `localStorage`, shaped exactly like the
eventual database so Phase 3 swaps the backend in via one line
(`web/src/lib/index.ts`).

## Run the backend (Phase 2 — restaurant search)

```powershell
cd server
npm install
copy .env.example .env   # then add your GOOGLE_PLACES_API_KEY
npm run dev              # http://localhost:8787
```

The frontend's search bar calls this proxy; the Google API key never reaches the
browser. Without a key the proxy returns a clear 503 and the manual-entry form
still works.

## Enable shared mode (Phase 3 — Supabase real-time sync)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (creates the 6 tables, the
   four-member-cap trigger, the vote-total trigger, permissive RLS, and adds the
   tables to the realtime publication).
3. In `web/.env` set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then
   restart `npm run dev`.

With those set, the app automatically switches from localStorage to Supabase
(see `web/src/lib/index.ts`) — rooms are shared across devices and sync live.
Without them it stays fully functional on-device (other tabs still sync via the
`storage` event).

### What works in Phases 1–3
- Create/join rooms by short code (e.g. `CURRY-6935`), shareable `/join/:code` link
- Four-member cap enforced (localStorage check + Supabase trigger)
- Add restaurants manually (name, cuisine, rating, price, Maps URL)
- One vote per member per suggestion; change/toggle your vote any time
- **Bury**: downvoting your own suggestion forces it to the bottom
- Sort: highest net votes first, buried items always last
- Remove (hard delete) from the queue
- Weekly schedule: Mon–Sun, Primary + Backup slots; assigning removes from the queue
- Mark visited → copies a permanent snapshot into History
- Monday weekly reset clears visited slots (idempotent, driven by `last_reset_date`)
- History list with editable notes

## Architecture notes
- The `Repo` interface (`web/src/lib/repo.ts`) is the single data-access contract.
  Phase 1 implements it against localStorage (`storage.ts`); Phase 3 will provide a
  Supabase implementation with the same interface.
- The Express backend (Phase 2+) exists only to hide secrets: the Google Places API
  key and the Web Push VAPID private key. All other reads/writes go straight to
  Supabase from the browser.

## Upcoming phases (need credentials)
- **Phase 2 — Search**: requires a Google Cloud **Places API** key.
- **Phase 3 — Sync**: requires a **Supabase** project (URL + anon key).
- **Phase 4 — Push**: requires generated **VAPID** keys (`npx web-push generate-vapid-keys`).
  iOS caveat: push only works in Safari with the site added to the Home Screen
  (iOS 16.4+); iOS Chrome does not support Web Push.
