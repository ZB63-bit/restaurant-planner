-- Restaurant Planner — Supabase schema (Phase 3)
-- Run this in the Supabase SQL editor for a fresh project.
--
-- Notes:
--  * Identity is device-bound: members.id is the UUID the browser stores in
--    localStorage. There are no auth users.
--  * RLS is permissive (anyone with the anon key can read/write any room). This
--    is NOT real security — it's the casual-app tradeoff from the spec. Anyone
--    who knows a room code can participate, which is the intended behavior.

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists rooms (
  id              uuid primary key default gen_random_uuid(),
  room_code       text not null unique,
  room_name       text not null,
  last_reset_date date,
  created_at      timestamptz not null default now()
);

create table if not exists members (
  id           uuid primary key,                       -- = localStorage user id
  room_id      uuid not null references rooms(id) on delete cascade,
  display_name text not null,
  joined_at    timestamptz not null default now()
);

create table if not exists suggestions (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  name          text not null,
  cuisine       text not null default '',
  address       text,
  google_rating numeric,
  price_level   int,
  photo_url     text,
  maps_url      text,
  added_by      uuid not null references members(id) on delete cascade,
  vote_total    int not null default 0,               -- maintained by trigger
  is_buried     boolean not null default false,       -- maintained by trigger
  created_at    timestamptz not null default now()
);

create table if not exists votes (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  voter_id      uuid not null references members(id) on delete cascade,
  value         int not null check (value in (-1, 1)),
  unique (suggestion_id, voter_id)                     -- one vote per member
);

create table if not exists schedule (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  day_of_week   text not null check (day_of_week in
                  ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  slot          text not null check (slot in ('primary','backup')),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  is_visited    boolean not null default false,
  unique (room_id, day_of_week, slot)                  -- one entry per slot
);

create table if not exists history (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references rooms(id) on delete cascade,
  name          text not null,
  cuisine       text not null default '',
  address       text,
  google_rating numeric,
  price_level   int,
  maps_url      text,
  notes         text not null default '',
  visited_date  date not null default current_date
);

create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  subscription jsonb not null,
  unique (member_id)                                   -- one subscription per device
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_members_room       on members(room_id);
create index if not exists idx_suggestions_room    on suggestions(room_id);
create index if not exists idx_votes_suggestion    on votes(suggestion_id);
create index if not exists idx_schedule_room       on schedule(room_id);
create index if not exists idx_history_room        on history(room_id);
create index if not exists idx_push_room           on push_subscriptions(room_id);

-- ---------------------------------------------------------------------------
-- Trigger: enforce the four-member cap
-- ---------------------------------------------------------------------------

create or replace function enforce_member_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from members where room_id = new.room_id) >= 4 then
    raise exception 'room_full' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_member_cap on members;
create trigger trg_member_cap
  before insert on members
  for each row execute function enforce_member_cap();

-- ---------------------------------------------------------------------------
-- Trigger: keep suggestions.vote_total and is_buried in sync with votes
-- ---------------------------------------------------------------------------

create or replace function refresh_suggestion_votes()
returns trigger
language plpgsql
as $$
declare
  sid uuid := coalesce(new.suggestion_id, old.suggestion_id);
begin
  update suggestions s
  set
    vote_total = coalesce((select sum(v.value) from votes v where v.suggestion_id = sid), 0),
    is_buried  = coalesce((
      select v.value = -1
      from votes v
      where v.suggestion_id = sid and v.voter_id = s.added_by
    ), false)
  where s.id = sid;
  return null;
end;
$$;

drop trigger if exists trg_refresh_votes on votes;
create trigger trg_refresh_votes
  after insert or update or delete on votes
  for each row execute function refresh_suggestion_votes();

-- ---------------------------------------------------------------------------
-- Row Level Security — permissive (casual no-auth app, see note at top)
-- ---------------------------------------------------------------------------

alter table rooms              enable row level security;
alter table members            enable row level security;
alter table suggestions        enable row level security;
alter table votes              enable row level security;
alter table schedule           enable row level security;
alter table history            enable row level security;
alter table push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'rooms','members','suggestions','votes','schedule','history','push_subscriptions'
  ] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Realtime — broadcast row changes to subscribed clients
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table suggestions;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table schedule;
alter publication supabase_realtime add table history;
alter publication supabase_realtime add table members;
