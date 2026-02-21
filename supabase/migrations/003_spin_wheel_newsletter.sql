-- Migration: Ensure newsletter_subscribers supports spin wheel entries
-- All changes are additive and idempotent.

-- Add source column if not exists
alter table if exists public.newsletter_subscribers
  add column if not exists source text default 'unknown';

-- Add meta column (jsonb) if not exists
alter table if exists public.newsletter_subscribers
  add column if not exists meta jsonb default '{}'::jsonb;

-- Unique index on lower(email) for case-insensitive dedup
create unique index if not exists newsletter_subscribers_email_unique
  on public.newsletter_subscribers ((lower(email)));
