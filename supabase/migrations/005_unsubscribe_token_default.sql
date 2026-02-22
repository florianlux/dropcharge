-- Ensure pgcrypto extension is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add unsubscribe_token with a default if not already present
ALTER TABLE IF EXISTS public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token text DEFAULT gen_random_uuid()::text;
