-- Migration 004: Ensure newsletter_subscribers has source, prize and meta columns
-- All changes are additive and idempotent. Never drops anything.

-- source: tracks where the subscriber came from (e.g. 'spin_wheel', 'footer')
ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'unknown';

-- prize: direct column for the prize label won (e.g. via spin wheel)
ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS prize text;

-- meta: flexible jsonb bag for additional subscriber metadata
ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;
