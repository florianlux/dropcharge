-- Supabase schema for DropCharge tracking

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  slug text,
  platform text,
  amount text,
  utm_source text,
  utm_campaign text,
  referrer text,
  user_agent text,
  country text,
  region text,
  ip_hash text
);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text unique not null,
  confirmed boolean default true
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  utm_source text,
  utm_campaign text,
  referrer text,
  meta jsonb
);
