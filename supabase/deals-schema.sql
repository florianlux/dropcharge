-- ============================================================================
-- DropCharge Deals Schema Migration
-- ============================================================================
-- Erstellt eine saubere Struktur für Deals und deren Analytics Events
--
-- Erklärung der Felder:
--
-- DEALS TABELLE:
-- - uuid: Standardisierter Primary Key für verteilte Systeme & API-Konsistenz
-- - title: Deal-Titel für Frontend & SEO
-- - slug: URL-freundlicher unique identifier (z.B. "playstation-store-guthaben-20")
-- - description: Detaillierte Deal-Beschreibung (kann HTML/Markdown enthalten)
-- - price: Aktueller Preis (als numeric für präzise Berechnungen)
-- - old_price: Ursprünglicher Preis für Rabatt-Berechnung und Anzeige
-- - affiliate_url: Link zum Partner (Amazon, G2A, etc.)
-- - image_url: Deal-Bild für Cards & Social Sharing
-- - tags: Array für flexible Kategorisierung (z.B. ["PlayStation", "Guthaben", "Sale"])
-- - active: Schnelles Ein/Ausblenden ohne Löschung (für abgelaufene Deals)
-- - created_at/updated_at: Audit Trail & Sortierung
--
-- DEAL_EVENTS TABELLE:
-- - id: Einfacher bigserial für hohe Performance bei vielen Events
-- - deal_id: Foreign Key zu deals für Relation
-- - type: Event-Typ als ENUM für Datenkonsistenz (click/view/conversion)
-- - ts: Timestamp für zeitbasierte Analytics & Aggregationen
-- - utm_*: Standard UTM Parameter für Marketing Attribution
-- - referrer: Traffic-Quelle Analyse
-- - user_agent_hash: Anonymisiertes User-Tracking (DSGVO-konform)
-- ============================================================================

-- Deals Haupttabelle
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  description text,
  price numeric(10,2),
  old_price numeric(10,2),
  affiliate_url text not null,
  image_url text,
  tags text[] default '{}',
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_discount check (old_price is null or price is null or old_price >= price)
);

-- Unique Index auf slug für SEO-freundliche URLs
create unique index if not exists deals_slug_unique on public.deals (slug);

-- Index für aktive Deals Abfragen (häufigster Query)
create index if not exists deals_active_idx on public.deals (active, created_at desc);

-- Index für Tag-basierte Suchen
create index if not exists deals_tags_idx on public.deals using gin (tags);

-- Deal Events / Analytics Tabelle
create table if not exists public.deal_events (
  id bigserial primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  type text not null check (type in ('click', 'view', 'conversion')),
  ts timestamptz not null default now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  user_agent_hash text
);

-- Index auf deal_id für Event-Abfragen pro Deal (wird auch von deal_events_deal_type_idx abgedeckt)
-- create index if not exists deal_events_deal_id_idx on public.deal_events (deal_id, ts desc);

-- Index auf Timestamp für zeitbasierte Analytics (nur wenn häufig ohne deal_id/type gefiltert wird)
-- Falls nur selten benötigt, kann dieser Index entfernt werden - die Composite Indexes decken die meisten Fälle ab
create index if not exists deal_events_ts_idx on public.deal_events (ts desc);

-- Index auf Event-Type für gefilterte Aggregationen
create index if not exists deal_events_type_idx on public.deal_events (type, ts desc);

-- Composite Index für häufige Analytics Queries (Deal + Type) - deckt auch deal_id-only Queries ab
create index if not exists deal_events_deal_type_idx on public.deal_events (deal_id, type, ts desc);

-- Funktion zum automatischen Update von updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger für auto-update von updated_at bei deals
drop trigger if exists update_deals_updated_at on public.deals;
create trigger update_deals_updated_at
  before update on public.deals
  for each row
  execute function public.update_updated_at_column();

-- Optional: Row Level Security aktivieren (auskommentiert für Service Role Zugriff)
-- alter table public.deals enable row level security;
-- alter table public.deal_events enable row level security;

-- Optional: Views für häufige Analytics Queries
create or replace view public.deal_stats as
select 
  d.id,
  d.slug,
  d.title,
  d.active,
  count(de.id) filter (where de.type = 'view') as total_views,
  count(de.id) filter (where de.type = 'click') as total_clicks,
  count(de.id) filter (where de.type = 'conversion') as total_conversions,
  case 
    when count(de.id) filter (where de.type = 'view') > 0 
    then round((count(de.id) filter (where de.type = 'click')::numeric / 
                count(de.id) filter (where de.type = 'view')::numeric) * 100, 2)
    else 0 
  end as click_through_rate,
  max(de.ts) as last_event_at
from public.deals d
left join public.deal_events de on de.deal_id = d.id
group by d.id, d.slug, d.title, d.active;

comment on table public.deals is 'Haupttabelle für alle Deals/Angebote mit Affiliate-Links';
comment on table public.deal_events is 'Event-Tracking für Analytics: Views, Clicks, Conversions';
comment on view public.deal_stats is 'Aggregierte Statistiken pro Deal (Views, Clicks, CTR, Conversions)';
