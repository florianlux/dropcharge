# DropCharge Schema - Quick Start

## 🚀 Installation (Supabase SQL Editor)

**Einfach kopieren und in Supabase SQL Editor einfügen:**

```sql
-- Siehe supabase/deals-schema.sql für das komplette Schema
```

## 📋 Zusammenfassung

### Tabelle: `deals`
```
✅ uuid Primary Key (ideal für APIs)
✅ title, slug (unique), description
✅ price, old_price (numeric für Präzision)
✅ affiliate_url (Hauptlink zu Partner)
✅ image_url, tags[] (Array für Multi-Tagging)
✅ active (Boolean für schnelles Ein/Ausblenden)
✅ created_at, updated_at (Auto-Trigger)
```

### Tabelle: `deal_events`
```
✅ bigserial ID (Performance bei hoher Schreiblast)
✅ deal_id (Foreign Key mit CASCADE DELETE)
✅ type: 'click' | 'view' | 'conversion' (CHECK Constraint)
✅ ts (Timestamp für Analytics)
✅ utm_source, utm_medium, utm_campaign, utm_term, utm_content
✅ referrer, user_agent_hash (anonymisiert)
```

### Indexe
```
✅ slug UNIQUE Index
✅ deal_id + ts Composite Index
✅ type + ts Index
✅ tags GIN Index (Array-Suchen)
✅ active + created_at Index
```

### Bonus
```
✅ Auto-Update Trigger für updated_at
✅ View: deal_stats (Aggregierte Analytics)
✅ Comments auf allen Tabellen
```

## 🎯 Warum diese Felder?

### UUID statt Integer ID
- Keine Enumeration möglich
- API-Konsistenz
- Verteilte Systeme

### numeric statt float für Preise
- Keine Rundungsfehler
- Exakte Geldbeträge
- Standard für Financial Data

### slug unique Index
- SEO-freundliche URLs
- Eindeutige Routen
- Schnelles Lookup

### tags als Array
- Flexibles Multi-Tagging
- Keine Junction Table nötig
- GIN Index für schnelle Suchen

### active Boolean
- Soft-Delete Pattern
- Analytics-Historie bleibt erhalten
- Schnelles Filtern

### bigserial für Events
- Auto-Increment = schnell
- Kein UUID Generation Overhead
- Millionen Events kein Problem

### user_agent_hash
- DSGVO-konform
- Anonymisiertes Tracking
- Pattern Detection möglich

### CHECK Constraint für type
- Datenkonsistenz
- Typsicherheit
- Keine invaliden Werte

### Composite Indexes
- Optimiert häufige Queries
- deal_id + ts = "Events pro Deal"
- type + ts = "Clicks letzte 24h"

## 💡 Best Practices

1. **Immer slug verwenden** statt ID in URLs
2. **active = false** statt DELETE (für Analytics)
3. **user_agent_hash** mit SHA256 erzeugen
4. **tags** in Kleinbuchstaben speichern
5. **UTM Parameter** immer ausfüllen (Marketing Attribution)

## 📊 Beispiel-Queries

### Deal mit Stats
```sql
select * from deal_stats where active = true;
```

### Top Performer letzte 7 Tage
```sql
select 
  d.title,
  count(*) as clicks
from deals d
join deal_events de on de.deal_id = d.id
where de.type = 'click'
  and de.ts >= now() - interval '7 days'
group by d.id
order by clicks desc
limit 10;
```

### Conversion Rate pro UTM Source
```sql
select 
  utm_source,
  count(*) filter (where type = 'click') as clicks,
  count(*) filter (where type = 'conversion') as conversions,
  round(
    count(*) filter (where type = 'conversion')::numeric / 
    nullif(count(*) filter (where type = 'click'), 0) * 100, 
    2
  ) as conversion_rate
from deal_events
where ts >= now() - interval '30 days'
group by utm_source
order by conversions desc;
```

---

**📖 Für Details siehe:** `supabase/README.md`
**🔧 SQL Migration:** `supabase/deals-schema.sql`
