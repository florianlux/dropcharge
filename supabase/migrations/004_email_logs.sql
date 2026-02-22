-- 004_email_logs.sql
-- Creates the email_logs table for tracking all outbound email events.

CREATE TABLE IF NOT EXISTS public.email_logs (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           timestamptz DEFAULT now(),
  recipient            text        NOT NULL,
  template             text        NOT NULL,
  subject              text,
  status               text        NOT NULL DEFAULT 'queued',  -- queued | sent | failed
  provider             text,                                   -- e.g. resend
  provider_message_id  text,
  error                text,
  meta                 jsonb       DEFAULT '{}'::jsonb  -- extra metadata (headers, tags, etc.)
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
  ON public.email_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient
  ON public.email_logs (recipient);

CREATE INDEX IF NOT EXISTS idx_email_logs_status
  ON public.email_logs (status);

-- Enable RLS (service_role key used by Netlify functions bypasses RLS)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
