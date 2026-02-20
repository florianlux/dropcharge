create extension if not exists citext;

create table if not exists public.newsletter_leads (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  status text not null default 'pending',
  source text,
  page text,
  user_agent text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz,
  unsubscribe_token text not null default encode(gen_random_bytes(16), 'hex'),
  metadata jsonb default '{}'::jsonb
);

alter table public.newsletter_leads enable row level security;

create table if not exists public.newsletter_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.newsletter_leads(id) on delete cascade,
  type text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists newsletter_events_lead_idx on public.newsletter_events (lead_id, type, created_at desc);
