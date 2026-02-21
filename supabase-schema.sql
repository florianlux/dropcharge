-- Supabase schema for DropCharge tracking & admin tooling

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  slug text,
  platform text,
  amount text,
  utm_source text,
  utm_campaign text,
  utm_medium text,
  referrer text,
  user_agent text,
  user_agent_hash text,
  device_hint text,
  country text,
  region text,
  ip_hash text
);

create index if not exists clicks_created_idx on public.clicks (created_at desc);
create index if not exists clicks_slug_idx on public.clicks (slug);
create index if not exists clicks_platform_idx on public.clicks (platform);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  confirmed boolean default false,
  created_at timestamptz default now(),
  source text,
  meta jsonb default '{}'::jsonb
);

create unique index if not exists emails_lower_unique on public.emails ((lower(email)));

alter table if exists public.emails
  add column if not exists confirmed boolean default false,
  add column if not exists source text,
  add column if not exists meta jsonb default '{}'::jsonb;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  type text not null,
  name text,
  slug text,
  platform text,
  path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  session_id text,
  user_agent_hash text,
  device_hint text,
  country text,
  meta jsonb default '{}'::jsonb
);

create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_type_idx on public.events (type);
create index if not exists events_slug_idx on public.events (slug);
create index if not exists events_session_idx on public.events (session_id);

create table if not exists public.spotlights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  title text not null,
  subtitle text,
  description text,
  platform text,
  vendor text,
  slug text,
  price text,
  price_cents integer,
  affiliate_url text,
  code_label text,
  code_url text,
  cover_url text,
  active boolean default true,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer default 0,
  amazon_url text,
  g2g_url text,
  release_date text,
  utm_source text,
  utm_campaign text,
  utm_medium text
);

create unique index if not exists spotlights_slug_unique on public.spotlights (slug);
create index if not exists spotlights_active_idx on public.spotlights (active, starts_at, ends_at);
create index if not exists spotlights_priority_idx on public.spotlights (priority desc, created_at desc);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create index if not exists settings_updated_idx on public.settings (updated_at desc);
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text default 'active',
  created_at timestamptz default now(),
  unsubscribed_at timestamptz,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  last_sent_at timestamptz,
  meta jsonb default '{}'::jsonb
);

create unique index if not exists newsletter_subscribers_email_unique on public.newsletter_subscribers ((lower(email)));
create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers (status);
create index if not exists newsletter_subscribers_created_idx on public.newsletter_subscribers (created_at desc);

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  subject text not null,
  body_html text not null,
  status text default 'draft',
  segment text,
  total_recipients integer default 0,
  sent_count integer default 0,
  failed_count integer default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists newsletter_campaigns_created_idx on public.newsletter_campaigns (created_at desc);
create index if not exists newsletter_campaigns_status_idx on public.newsletter_campaigns (status);

create table if not exists public.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete cascade,
  email text not null,
  status text default 'queued',
  error text,
  attempts integer default 0,
  queued_at timestamptz default now(),
  sent_at timestamptz
);

create index if not exists newsletter_sends_campaign_idx on public.newsletter_sends (campaign_id, status);
create index if not exists newsletter_sends_subscriber_idx on public.newsletter_sends (subscriber_id);


create table if not exists public.admin_sessions (
  token text primary key,
  ip text,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text,
  created_at timestamptz default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  event text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists admin_login_attempts_ip_created_idx on public.admin_login_attempts (ip, created_at desc);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);

-- Add UTM columns to spotlights table if they don't exist
alter table if exists public.spotlights
  add column if not exists utm_source text,
  add column if not exists utm_campaign text,
  add column if not exists utm_medium text;
