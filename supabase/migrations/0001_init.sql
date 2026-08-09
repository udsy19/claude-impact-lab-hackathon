-- Tablestakes v1 schema.
-- Apply with: supabase db push, or paste into the SQL editor.
-- No auth in v1: anonymous usage keyed by a localStorage device id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- restaurants
create table if not exists restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  city          text,
  neighborhood  text,
  lat           float8,
  lng           float8,
  cuisine_tags  text[] default '{}',
  vibe_tags     text[] default '{}',   -- drink | snack | munch | meal
  price_tier    int,                   -- 1..4, null when unknown
  osm_id        text,
  website       text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists restaurants_city_idx on restaurants (city);
create index if not exists restaurants_geo_idx on restaurants (lat, lng);
create index if not exists restaurants_vibe_idx on restaurants using gin (vibe_tags);
create index if not exists restaurants_cuisine_idx on restaurants using gin (cuisine_tags);

-- ------------------------------------------------------------------ dossiers
create table if not exists dossiers (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  status         text not null default 'running',   -- fresh|stale|running|failed
  verdict        text,
  badges         jsonb default '[]',
  vitals         jsonb,
  patterns       jsonb default '[]',
  diner_view     jsonb,
  key_reviews    jsonb default '[]',
  bright_spots   jsonb default '[]',
  social_pulse   jsonb,
  -- {grade|score, inspected_at, critical_violations[], match_confidence} or
  -- {status:"no_confident_match"}. Never rendered unless confidently matched.
  health         jsonb,
  -- [{text, source, url, date, kind}] — the grounding corpus for chat.
  evidence       jsonb default '[]',
  sources        text[] default '{}',
  evidence_count int default 0,
  generated_at   timestamptz default now(),
  refresh_after  timestamptz,
  health_checked_at timestamptz,
  view_count     int default 0
);

create unique index if not exists dossiers_restaurant_idx on dossiers (restaurant_id);
create index if not exists dossiers_status_idx on dossiers (status);

-- --------------------------------------------------------------- share_cards
create table if not exists share_cards (
  id         uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  slug       text unique not null,
  og_image   text,
  created_at timestamptz default now()
);

-- -------------------------------------------------------------- owner_claims
create table if not exists owner_claims (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants (id) on delete set null,
  email         text not null,
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------- decision_logs
-- The personalization asset and the engagement metric. Log every session.
create table if not exists decision_logs (
  id          uuid primary key default gen_random_uuid(),
  device_id   text,
  constraints jsonb,
  shown       jsonb,
  chosen      uuid references restaurants (id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists decision_logs_device_idx on decision_logs (device_id);

-- ------------------------------------------------------------------------ RLS
-- v1 is anonymous: the anon key reads everything and writes the tables a user
-- legitimately appends to. Dossiers/restaurants are written by the client swarm
-- in v1; move those to an edge function before this is genuinely public.
alter table restaurants   enable row level security;
alter table dossiers      enable row level security;
alter table share_cards   enable row level security;
alter table owner_claims  enable row level security;
alter table decision_logs enable row level security;

drop policy if exists anon_read_restaurants on restaurants;
create policy anon_read_restaurants on restaurants for select using (true);
drop policy if exists anon_write_restaurants on restaurants;
create policy anon_write_restaurants on restaurants for all using (true) with check (true);

drop policy if exists anon_read_dossiers on dossiers;
create policy anon_read_dossiers on dossiers for select using (true);
drop policy if exists anon_write_dossiers on dossiers;
create policy anon_write_dossiers on dossiers for all using (true) with check (true);

drop policy if exists anon_read_share on share_cards;
create policy anon_read_share on share_cards for select using (true);
drop policy if exists anon_write_share on share_cards;
create policy anon_write_share on share_cards for insert with check (true);

-- Claims are append-only and never readable by the public.
drop policy if exists anon_insert_claims on owner_claims;
create policy anon_insert_claims on owner_claims for insert with check (true);

drop policy if exists anon_insert_logs on decision_logs;
create policy anon_insert_logs on decision_logs for insert with check (true);
drop policy if exists anon_update_logs on decision_logs;
create policy anon_update_logs on decision_logs for update using (true) with check (true);
