create extension if not exists citext;

create table if not exists public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  source text,
  page text,
  user_agent text,
  last_sent_at timestamptz,
  meta jsonb default '{}'::jsonb
);

alter table public.newsletter_signups enable row level security;

create policy "newsletter_insert" on public.newsletter_signups
  for insert
  with check (true);

create policy "newsletter_read_admin" on public.newsletter_signups
  for select
  to service_role
  using (true);
