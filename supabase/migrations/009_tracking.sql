-- 009_tracking.sql
-- First-party tracking: sessions table + new columns on events + daily aggregates
-- Run after 008_product_spotlight.sql

-- ── Sessions table ─────────────────────────────────────────────────────────────
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  session_key     text unique not null,
  user_id         text null,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  landing_path    text,
  referrer        text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  device_type     text default 'unknown',
  os              text,
  browser         text,
  country         text,
  consent_analytics boolean not null default false
);

create index if not exists idx_sessions_last_seen     on sessions(last_seen);
create index if not exists idx_sessions_utm_campaign  on sessions(utm_campaign);
create index if not exists idx_sessions_utm_source    on sessions(utm_source);
create index if not exists idx_sessions_session_key   on sessions(session_key);

-- ── New columns on the existing events table ────────────────────────────────────
-- All are additive (IF NOT EXISTS) so existing rows keep working.
alter table events add column if not exists ts           timestamptz default now();
alter table events add column if not exists session_key  text;
alter table events add column if not exists event_name   text;
alter table events add column if not exists user_id      text;
alter table events add column if not exists props        jsonb default '{}'::jsonb;
alter table events add column if not exists theme        text;
alter table events add column if not exists device_type  text;
alter table events add column if not exists os           text;
alter table events add column if not exists browser      text;

-- Fill ts from created_at for existing rows (one-off backfill, safe to re-run)
update events set ts = created_at where ts is null and created_at is not null;

-- Indexes for analytics queries
create index if not exists idx_events_ts_desc       on events(ts desc);
create index if not exists idx_events_event_name    on events(event_name);
create index if not exists idx_events_session_key   on events(session_key);
-- slug and utm_campaign indexes may already exist; add if missing
create index if not exists idx_events_slug_track    on events(slug);
create index if not exists idx_events_utm_campaign  on events(utm_campaign);

-- ── Optional daily aggregates (cache table) ─────────────────────────────────────
create table if not exists aggregates_daily (
  day     date primary key,
  metrics jsonb not null default '{}'::jsonb
);

-- ── Retention hint (manual cron, not enforced here) ────────────────────────────
-- To purge events older than 90 days run:
--   delete from events where ts < now() - interval '90 days';
-- Schedule this as a Supabase database function or external cron as needed.
