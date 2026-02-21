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
  release_date text
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

-- Admin users table for email allowlist
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now(),
  last_login_at timestamptz
);

create unique index if not exists admin_users_email_unique on public.admin_users ((lower(email)));

-- Helper function to check if a user is an admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.admin_users
    where lower(email) = lower(auth.jwt()->>'email')
  );
end;
$$ language plpgsql security definer;

-- RLS Policies: Allow public read, only admins can write
-- NOTE: Public read is enabled to allow service role operations
-- If you need to restrict read access, modify these policies accordingly
alter table public.clicks enable row level security;
alter table public.emails enable row level security;
alter table public.events enable row level security;
alter table public.spotlights enable row level security;
alter table public.settings enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_sends enable row level security;
alter table public.admin_users enable row level security;

-- Public read policies (for service role and anon)
-- These allow the application to read data for display purposes
create policy "Allow public read on clicks" on public.clicks for select using (true);
create policy "Allow public read on emails" on public.emails for select using (true);
create policy "Allow public read on events" on public.events for select using (true);
create policy "Allow public read on spotlights" on public.spotlights for select using (true);
create policy "Allow public read on settings" on public.settings for select using (true);
create policy "Allow public read on newsletter_subscribers" on public.newsletter_subscribers for select using (true);
create policy "Allow public read on newsletter_campaigns" on public.newsletter_campaigns for select using (true);
create policy "Allow public read on newsletter_sends" on public.newsletter_sends for select using (true);

-- Admin write policies
create policy "Allow admin insert on clicks" on public.clicks for insert with check (is_admin());
create policy "Allow admin update on clicks" on public.clicks for update using (is_admin());
create policy "Allow admin delete on clicks" on public.clicks for delete using (is_admin());

create policy "Allow admin insert on emails" on public.emails for insert with check (is_admin());
create policy "Allow admin update on emails" on public.emails for update using (is_admin());
create policy "Allow admin delete on emails" on public.emails for delete using (is_admin());

create policy "Allow admin insert on events" on public.events for insert with check (is_admin());
create policy "Allow admin update on events" on public.events for update using (is_admin());
create policy "Allow admin delete on events" on public.events for delete using (is_admin());

create policy "Allow admin insert on spotlights" on public.spotlights for insert with check (is_admin());
create policy "Allow admin update on spotlights" on public.spotlights for update using (is_admin());
create policy "Allow admin delete on spotlights" on public.spotlights for delete using (is_admin());

create policy "Allow admin insert on settings" on public.settings for insert with check (is_admin());
create policy "Allow admin update on settings" on public.settings for update using (is_admin());
create policy "Allow admin delete on settings" on public.settings for delete using (is_admin());

create policy "Allow admin insert on newsletter_subscribers" on public.newsletter_subscribers for insert with check (is_admin());
create policy "Allow admin update on newsletter_subscribers" on public.newsletter_subscribers for update using (is_admin());
create policy "Allow admin delete on newsletter_subscribers" on public.newsletter_subscribers for delete using (is_admin());

create policy "Allow admin insert on newsletter_campaigns" on public.newsletter_campaigns for insert with check (is_admin());
create policy "Allow admin update on newsletter_campaigns" on public.newsletter_campaigns for update using (is_admin());
create policy "Allow admin delete on newsletter_campaigns" on public.newsletter_campaigns for delete using (is_admin());

create policy "Allow admin insert on newsletter_sends" on public.newsletter_sends for insert with check (is_admin());
create policy "Allow admin update on newsletter_sends" on public.newsletter_sends for update using (is_admin());
create policy "Allow admin delete on newsletter_sends" on public.newsletter_sends for delete using (is_admin());

-- Admin users: only admins can read/write
create policy "Allow admin read on admin_users" on public.admin_users for select using (is_admin());
create policy "Allow admin insert on admin_users" on public.admin_users for insert with check (is_admin());
create policy "Allow admin update on admin_users" on public.admin_users for update using (is_admin());
create policy "Allow admin delete on admin_users" on public.admin_users for delete using (is_admin());
