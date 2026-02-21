-- Safe migration: bring DB schema in sync
-- Uses only ADD COLUMN IF NOT EXISTS and CREATE TABLE IF NOT EXISTS
-- Never drops anything.

-- newsletter_subscribers: add source and last_sent_at
ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

-- spotlights: add priority
ALTER TABLE IF EXISTS public.spotlights
  ADD COLUMN IF NOT EXISTS priority integer default 0;

-- events: add type
ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS type text;

-- settings: create table if missing
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
