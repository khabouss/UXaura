-- UXaura multi-tenant schema. One row per project = one customer app.
-- End users of a customer's app are NOT Supabase auth users — they're an
-- opaque id string the customer's own app supplies (see Part four).

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  api_key text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- The Map + live Boundary state, merged. One row per named part of a
-- project's app. `locked`/`lock_reason` are the owner-editable override the
-- dashboard writes to.
create table if not exists anchors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  route text not null,
  anchor_key text not null,
  name text not null,
  description text,
  locked boolean not null default false,
  lock_reason text,
  created_at timestamptz not null default now(),
  unique (project_id, route, anchor_key)
);

-- End-user rules.
create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  end_user_id text not null,
  route text not null,
  target text,
  target_name text,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  state text not null default 'active',
  created_from text,
  created_at timestamptz not null default now()
);
create index if not exists rules_lookup on rules (project_id, end_user_id, route);

-- Anonymous counts for the reports screen. No end_user_id on purpose.
create table if not exists events (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('granted', 'refused', 'clarified')),
  route text,
  created_at timestamptz not null default now()
);
create index if not exists events_lookup on events (project_id, created_at);

-- RLS: dashboard (browser, publishable key) can only ever see rows for
-- projects it owns. Our server (secret key) bypasses RLS entirely for
-- tenant-scoped application-level queries — see api.js.
alter table projects enable row level security;
alter table anchors enable row level security;
alter table rules enable row level security;
alter table events enable row level security;

create policy "owners manage their own projects" on projects
  for all using (owner_id = auth.uid());

create policy "owners manage their own anchors" on anchors
  for all using (project_id in (select id from projects where owner_id = auth.uid()));

create policy "owners read their own rules" on rules
  for select using (project_id in (select id from projects where owner_id = auth.uid()));

create policy "owners read their own events" on events
  for select using (project_id in (select id from projects where owner_id = auth.uid()));
