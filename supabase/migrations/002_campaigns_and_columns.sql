-- Migration 002: Add newsletter_campaigns table and missing columns
-- Safe: uses IF NOT EXISTS / IF EXISTS only. Never drops anything.

-- newsletter_subscribers: add unsubscribed_at if missing
ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- newsletter_campaigns: create if missing
CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_html text,
  segment text,
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  status text DEFAULT 'pending',
  error text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- clicks: ensure utm columns exist
ALTER TABLE IF EXISTS public.clicks
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS device_hint text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text;

-- events: ensure all columns exist
ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS device_hint text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;
