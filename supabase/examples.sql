-- ============================================================================
-- DropCharge Schema - Beispiel-Daten & Verwendung
-- ============================================================================
-- Diese Datei zeigt praktische Beispiele für die Verwendung des Schemas

-- ============================================================================
-- 1. BEISPIEL DEALS EINFÜGEN
-- ============================================================================

-- PlayStation Store Guthaben
insert into public.deals (title, slug, description, price, old_price, affiliate_url, image_url, tags)
values (
  'PlayStation Store Guthaben 20€',
  'playstation-store-guthaben-20',
  'Sofort-Download für PlayStation Network. Code wird per E-Mail verschickt. Gültig für PS5 und PS4.',
  17.99,
  19.99,
  'https://amzn.to/ps-store-20',
  'https://cdn.dropcharge.com/images/ps-store-20.jpg',
  array['PlayStation', 'Guthaben', 'Sale', 'PSN']
);

-- Xbox Game Pass Ultimate
insert into public.deals (title, slug, description, price, old_price, affiliate_url, image_url, tags)
values (
  'Xbox Game Pass Ultimate 3 Monate',
  'xbox-game-pass-ultimate-3m',
  'Zugriff auf 100+ Spiele für Xbox und PC. Inkl. EA Play und Cloud Gaming.',
  32.99,
  44.99,
  'https://amzn.to/xbox-gpu-3m',
  'https://cdn.dropcharge.com/images/xbox-gpu.jpg',
  array['Xbox', 'Game Pass', 'Abo', 'Sale']
);

-- Steam Guthaben
insert into public.deals (title, slug, description, price, old_price, affiliate_url, image_url, tags, active)
values (
  'Steam Guthaben 50€',
  'steam-guthaben-50',
  'Digitales Guthaben für Steam. Kaufe Spiele, DLCs und mehr.',
  47.50,
  50.00,
  'https://amzn.to/steam-50',
  'https://cdn.dropcharge.com/images/steam-50.jpg',
  array['Steam', 'PC Gaming', 'Guthaben'],
  true
);

-- ============================================================================
-- 2. DEALS ABFRAGEN
-- ============================================================================

-- Alle aktiven Deals
select id, title, slug, price, old_price, tags
from public.deals
where active = true
order by created_at desc;

-- Deals nach Tag filtern
select title, price, tags
from public.deals
where 'PlayStation' = any(tags)
  and active = true;

-- Deals mit Rabatt > 20%
select 
  title,
  price,
  old_price,
  round(((old_price - price) / old_price * 100)::numeric, 2) as discount_percent
from public.deals
where old_price > 0
  and active = true
  and (old_price - price) / old_price > 0.20
order by discount_percent desc;

-- ============================================================================
-- 3. EVENTS TRACKEN
-- ============================================================================

-- View Event tracken (wenn Deal-Seite geöffnet wird)
insert into public.deal_events (deal_id, type, utm_source, utm_medium, utm_campaign, referrer)
values (
  (select id from public.deals where slug = 'playstation-store-guthaben-20'),
  'view',
  'tiktok',
  'social',
  'winter-sale-2024',
  'https://www.tiktok.com/@dropcharge'
);

-- Click Event tracken (wenn User auf Affiliate-Link klickt)
insert into public.deal_events (deal_id, type, utm_source, utm_medium, referrer, user_agent_hash)
values (
  (select id from public.deals where slug = 'playstation-store-guthaben-20'),
  'click',
  'instagram',
  'social',
  'https://instagram.com/dropcharge',
  encode(sha256('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'::bytea), 'hex')
);

-- Conversion Event tracken (wenn Purchase bestätigt wurde)
insert into public.deal_events (deal_id, type, utm_source, utm_medium, utm_campaign)
values (
  (select id from public.deals where slug = 'xbox-game-pass-ultimate-3m'),
  'conversion',
  'google',
  'cpc',
  'search-campaign-q1'
);

-- ============================================================================
-- 4. ANALYTICS QUERIES
-- ============================================================================

-- Gesamtübersicht aller Deals (nutzt vordefinierte View)
select 
  title,
  total_views,
  total_clicks,
  total_conversions,
  click_through_rate as ctr,
  last_event_at
from public.deal_stats
where active = true
order by total_clicks desc;

-- Performance der letzten 7 Tage
select 
  d.title,
  count(*) filter (where de.type = 'view') as views,
  count(*) filter (where de.type = 'click') as clicks,
  count(*) filter (where de.type = 'conversion') as conversions
from public.deals d
left join public.deal_events de on de.deal_id = d.id and de.ts >= now() - interval '7 days'
where d.active = true
group by d.id, d.title
order by clicks desc;

-- UTM Source Performance
select 
  utm_source,
  count(*) filter (where type = 'view') as views,
  count(*) filter (where type = 'click') as clicks,
  count(*) filter (where type = 'conversion') as conversions,
  round(
    count(*) filter (where type = 'click')::numeric / 
    nullif(count(*) filter (where type = 'view'), 0) * 100, 
    2
  ) as ctr,
  round(
    count(*) filter (where type = 'conversion')::numeric / 
    nullif(count(*) filter (where type = 'click'), 0) * 100, 
    2
  ) as conversion_rate
from public.deal_events
where ts >= now() - interval '30 days'
group by utm_source
order by conversions desc;

-- Best Performing Deal pro Tag
select 
  date_trunc('day', de.ts) as day,
  d.title,
  count(*) filter (where de.type = 'click') as clicks
from public.deals d
join public.deal_events de on de.deal_id = d.id
where de.ts >= now() - interval '14 days'
group by day, d.id, d.title
order by day desc, clicks desc;

-- Hourly Event Distribution (für Traffic-Muster)
select 
  extract(hour from ts) as hour,
  count(*) filter (where type = 'view') as views,
  count(*) filter (where type = 'click') as clicks
from public.deal_events
where ts >= now() - interval '7 days'
group by hour
order by hour;

-- ============================================================================
-- 5. DEAL MANAGEMENT
-- ============================================================================

-- Deal deaktivieren (statt löschen - behält Analytics)
update public.deals
set active = false, updated_at = now()
where slug = 'steam-guthaben-50';

-- Preis aktualisieren
update public.deals
set price = 15.99, updated_at = now()
where slug = 'playstation-store-guthaben-20';

-- Tag hinzufügen
update public.deals
set tags = array_append(tags, 'Hot Deal'), updated_at = now()
where slug = 'xbox-game-pass-ultimate-3m';

-- Tags komplett ersetzen
update public.deals
set tags = array['PlayStation', 'PSN', 'Top Deal', 'Limited'], updated_at = now()
where slug = 'playstation-store-guthaben-20';

-- ============================================================================
-- 6. CLEANUP & MAINTENANCE
-- ============================================================================

-- Alte Events löschen (nach 90 Tagen)
delete from public.deal_events
where ts < now() - interval '90 days';

-- Deals ohne Events finden
select d.title, d.created_at
from public.deals d
left join public.deal_events de on de.deal_id = d.id
where de.id is null
  and d.created_at < now() - interval '30 days';

-- Duplicate Slug Check (sollte durch Unique Index verhindert werden)
select slug, count(*)
from public.deals
group by slug
having count(*) > 1;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (Optional)
-- ============================================================================

-- Wenn RLS aktiviert werden soll:

-- RLS für deals aktivieren
-- alter table public.deals enable row level security;

-- Policy: Jeder kann aktive Deals lesen
-- create policy "Public can view active deals"
--   on public.deals for select
--   using (active = true);

-- Policy: Nur Service Role kann schreiben
-- create policy "Only service role can modify deals"
--   on public.deals for all
--   using (auth.jwt()->>'role' = 'service_role');

-- RLS für deal_events
-- alter table public.deal_events enable row level security;

-- Policy: Jeder kann Events schreiben (für Tracking)
-- create policy "Anyone can insert events"
--   on public.deal_events for insert
--   with check (true);

-- ============================================================================
-- 8. BACKUP & EXPORT
-- ============================================================================

-- Export aller Deals als JSON
-- select json_agg(d) from (
--   select * from public.deals where active = true
-- ) d;

-- Export Event-Statistiken
-- select 
--   d.title,
--   d.slug,
--   count(*) filter (where de.type = 'click') as total_clicks,
--   min(de.ts) as first_event,
--   max(de.ts) as last_event
-- from public.deals d
-- left join public.deal_events de on de.deal_id = d.id
-- group by d.id, d.title, d.slug;
