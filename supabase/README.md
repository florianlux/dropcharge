# DropCharge Supabase Schema

Dieses Verzeichnis enthält SQL-Migrationen für das DropCharge Supabase-Projekt.

## Dateien

- **`deals-schema.sql`** - Hauptschema für Deals und Analytics Events
- **`newsletter.sql`** - Newsletter/Email-Verwaltung (bereits vorhanden)

## Deals Schema - Überblick

### Tabelle: `deals`

Die Haupttabelle für alle Gaming-Credit Angebote und Deals.

#### Felder und Begründung:

| Feld | Typ | Beschreibung | Warum so gewählt? |
|------|-----|--------------|-------------------|
| `id` | uuid | Primary Key | UUIDs sind ideal für verteilte Systeme, API-Konsistenz und verhindern Enumeration-Attacks |
| `title` | text | Deal-Titel | Für Frontend-Anzeige und SEO-Meta-Tags |
| `slug` | text (unique) | URL-freundlicher Identifier | SEO-optimierte URLs (z.B. `/deals/playstation-guthaben-20`), eindeutig indexiert |
| `description` | text | Detaillierte Beschreibung | Flexibel für HTML/Markdown, wichtig für SEO und User-Information |
| `price` | numeric(10,2) | Aktueller Preis | Numeric für exakte Geldbeträge, vermeidet Float-Rundungsfehler |
| `old_price` | numeric(10,2) | Ursprünglicher Preis | Für Rabatt-Berechnung und "Spare X%" Anzeige |
| `affiliate_url` | text | Affiliate-Link | Der wichtigste Link - wohin User weitergeleitet werden |
| `image_url` | text | Bild-URL | Für Deal-Cards und Social Media Sharing |
| `tags` | text[] | Kategorien/Tags | Flexibles Array für Multi-Tagging (z.B. ["PlayStation", "Sale", "20EUR"]) |
| `active` | boolean | Aktiv/Inaktiv | Schnelles Ein-/Ausblenden ohne Datenlöschung (wichtig für Analytics-Historie) |
| `created_at` | timestamptz | Erstellungsdatum | Audit-Trail und Sortierung |
| `updated_at` | timestamptz | Letzte Änderung | Auto-Update via Trigger, wichtig für Change-Tracking |

#### Indexe:

- **`deals_slug_unique`** (UNIQUE) - Garantiert eindeutige URLs, essentiell für Routing
- **`deals_active_idx`** - Optimiert `WHERE active = true ORDER BY created_at` Queries
- **`deals_tags_idx`** (GIN) - Schnelle Array-Suchen für Tag-Filter

### Tabelle: `deal_events`

Event-Tracking für alle Deal-Interaktionen. Optimiert für hohe Schreiblast.

#### Felder und Begründung:

| Feld | Typ | Beschreibung | Warum so gewählt? |
|------|-----|--------------|-------------------|
| `id` | bigserial | Primary Key | Auto-Increment, sehr schnell bei vielen Inserts, keine UUID-Generation-Overhead |
| `deal_id` | uuid (FK) | Referenz zu Deal | Foreign Key mit CASCADE DELETE - wenn Deal gelöscht wird, auch Events |
| `type` | text (CHECK) | Event-Typ | ENUM via CHECK Constraint: 'click', 'view', 'conversion' - Datenkonsistenz |
| `ts` | timestamptz | Timestamp | Separate Spalte (nicht `created_at`) für flexible Event-Zeit-Verwaltung |
| `utm_source` | text | UTM Source | Standard Marketing Attribution - z.B. "tiktok", "instagram" |
| `utm_medium` | text | UTM Medium | z.B. "social", "email", "cpc" |
| `utm_campaign` | text | UTM Campaign | Spezifische Kampagne für ROI-Tracking |
| `utm_term` | text | UTM Term | Keywords (für Paid Search) |
| `utm_content` | text | UTM Content | A/B-Test Varianten |
| `referrer` | text | HTTP Referrer | Woher kam der Traffic? |
| `user_agent_hash` | text | User Agent Hash | SHA256 Hash für anonymisiertes Tracking (DSGVO-konform) |

#### Indexe:

- **`deal_events_deal_id_idx`** - Composite Index (deal_id + ts) für "Zeige alle Events eines Deals"
- **`deal_events_ts_idx`** - Zeitbasierte Queries (z.B. "Events der letzten 24h")
- **`deal_events_type_idx`** - Filter nach Event-Type (z.B. nur Conversions)
- **`deal_events_deal_type_idx`** - Composite für "Clicks pro Deal" Queries

## Installation

### 1. In Supabase SQL Editor:

```sql
-- Kopiere den Inhalt von deals-schema.sql und führe ihn aus
```

### 2. Oder via Supabase CLI:

```bash
supabase db push --db-url "postgresql://..."
```

## Verwendung

### Deal erstellen:

```sql
insert into public.deals (title, slug, description, price, old_price, affiliate_url, image_url, tags)
values (
  'PlayStation Store Guthaben 20€',
  'playstation-store-guthaben-20',
  'Sofort-Download für PlayStation Network. Gültig für PS5 und PS4.',
  17.99,
  19.99,
  'https://amzn.to/xyz123',
  'https://cdn.dropcharge.com/ps-store-20.jpg',
  array['PlayStation', 'Guthaben', 'Sale']
);
```

### Event tracken:

```sql
insert into public.deal_events (deal_id, type, utm_source, utm_medium, referrer, user_agent_hash)
values (
  '550e8400-e29b-41d4-a716-446655440000',
  'click',
  'tiktok',
  'social',
  'https://tiktok.com/@dropcharge',
  'a3b5c7d9e1f2...'
);
```

### Analytics abfragen:

```sql
-- Nutze die vordefinierte View
select * from public.deal_stats
where active = true
order by total_clicks desc;

-- Oder custom Query
select 
  d.title,
  count(*) filter (where de.type = 'click') as clicks,
  count(*) filter (where de.utm_source = 'tiktok') as tiktok_clicks
from deals d
join deal_events de on de.deal_id = d.id
where d.active = true
  and de.ts >= now() - interval '7 days'
group by d.id, d.title;
```

## Vorteile dieser Schema-Struktur

1. **Performance**: 
   - Optimierte Indexe für häufige Queries
   - `bigserial` für Events = schnellere Inserts
   - GIN-Index für Tag-Suchen

2. **Skalierbarkeit**:
   - Events in eigener Tabelle = kein Bloat der Deals-Tabelle
   - Partition-ready (kann später nach Datum partitioniert werden)

3. **Analytics-freundlich**:
   - Vordefinierte View `deal_stats` für Dashboards
   - Alle UTM-Parameter für Marketing Attribution
   - Flexible Event-Types via CHECK Constraint

4. **DSGVO-konform**:
   - User Agent als Hash statt Plaintext
   - Keine IP-Adressen (können optional hinzugefügt werden)
   - CASCADE DELETE für "Recht auf Vergessenwerden"

5. **Wartbarkeit**:
   - Auto-Update Trigger für `updated_at`
   - Klare Namenskonventionen
   - Extensive Comments im SQL

## Nächste Schritte

- [ ] Row Level Security (RLS) Policies definieren
- [ ] Backup-Strategie einrichten
- [ ] Monitoring/Alerting für hohe Event-Raten
- [ ] Optional: Partitionierung von `deal_events` nach Monat
- [ ] API-Layer mit Supabase Client oder PostgREST
