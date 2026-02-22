-- 004_email_logs.sql
-- Creates the email_logs table for tracking all outbound email events.

CREATE TABLE IF NOT EXISTS public.email_logs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient    text        NOT NULL,
  template     text        NOT NULL,
  subject      text,
  status       text        NOT NULL DEFAULT 'ok',   -- ok | error | sent | failed
  message_id   text,
  error        text,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sent_at      timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
  ON public.email_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient
  ON public.email_logs (recipient);
