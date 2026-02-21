# DropCharge - Vollständiger Überblick (Executive Summary)

**Erstellt:** 21. Februar 2026  
**Autor:** Senior Engineer Analyse  
**Zweck:** Komplette Übersicht über Repo-Struktur, Datenflüsse und fehlende Komponenten

---

## 🎯 Zusammenfassung

DropCharge ist eine **High-Conversion Gaming-Credit Landing Page** mit Admin-Dashboard. Die Architektur besteht aus:
- **Frontend:** 3 HTML-Seiten (Public, Admin, Login)
- **Backend:** 25 Netlify Serverless Functions
- **Datenbank:** Supabase Postgres (11 Tabellen)
- **Email:** Resend API Integration (optional)

### Status: 🟢 85% Produktionsreif

**Funktioniert vollständig:**
- ✅ Public Landing mit Deal-Showcase
- ✅ Newsletter Signup (Email wird gespeichert)
- ✅ Affiliate Click Tracking
- ✅ Admin Analytics (Live Events, Funnels, UTM)
- ✅ Deal Management (CRUD, Optimizer)
- ✅ Lead Export & Seed Data Generator

**Fehlt komplett:**
- ❌ Campaign System (UI vorhanden, Backend fehlt)
- ❌ A/B Tests (nur Placeholder)

---

## 📁 1. Entry Points (Alle Einstiegspunkte)

### 1.1 HTML Seiten

| Datei | Zeilen | Zweck | Link |
|-------|--------|-------|------|
| **index.html** | 312 | Public Landing Page mit Deals, Newsletter, Spotlight | `/` |
| **admin.html** | 531 | Admin Dashboard mit 8 Tabs (Overview, Live Events, Funnels, A/B, Campaigns, Deals, Email, Settings) | `/admin` |
| **admin-login.html** | 70 | Token-Login für Admin (localStorage) | `/admin/login` |

### 1.2 Netlify Functions (API Endpoints)

#### **Öffentliche APIs (7 Funktionen)**

```
GET  /activity                → Live-Klicks (30 Min) + Top Deal
GET  /spotlight               → Aktueller Game Spotlight
GET  /public-config           → TikTok Pixel ID, Affiliate Links
POST /track-event             → Event Tracking (ViewContent, ScrollDepth, ClickOutbound)
POST /newsletter_signup       → Newsletter-Anmeldung (Resend + Supabase)
POST /subscribe               → Fallback Newsletter (nur Supabase)
POST /unsubscribe             → Newsletter Abmeldung
GET  /go/<slug>               → Affiliate Redirect + Click Tracking
```

**Beispiel-Request:**
```bash
# Affiliate Click tracken
curl https://dropcharge.netlify.app/go/psn-20?utm_source=tiktok

# Newsletter anmelden
curl -X POST https://dropcharge.netlify.app/.netlify/functions/newsletter_signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","source":"popup"}'
```

#### **Admin Analytics APIs (8 Funktionen)**

```
GET /stats                    → Platform Klicks, Email Stats, Top Amounts
GET /admin-health             → System Health (Auth, Supabase, Schema)
GET /events                   → Raw Event Logs (für Live Dashboard)
GET /funnel                   → Conversion-Funnel Analyse
GET /utm                      → UTM-Parameter Tracking
GET /devices                  → Device/Browser/Geo Breakdown
GET /api-activity             → Activity per Deal Slug
GET /last-activity            → Timestamp letzter Klick
```

**Auth:** Alle Admin APIs benötigen `x-admin-token` Header

#### **Admin Deal Management APIs (3 Funktionen)**

```
GET  /deals-admin             → Liste aller Deals mit Metriken (CTR, Conversion, Revenue)
PUT  /deals-admin             → Inline Update (Priority, Active Status)
GET  /spotlight               → Public: Current Spotlight
POST /spotlight               → Admin: Create/Update Spotlight
POST /affiliate-factory       → Generate /go/<slug> Link
```

#### **Admin Tools (4 Funktionen)**

```
POST /admin-seed              → Test-Daten generieren (Clicks, Emails, Events)
GET  /admin-list-leads        → Email-Subscriber mit Filtern
GET  /admin-export-leads      → CSV Export von Leads
POST /optimize-deals          → Auto-Optimization (CTR-basiert: >2% boost, <0.5% deactivate)
GET  /settings                → Feature Flags lesen
PUT  /settings                → Feature Flags setzen (disable_email_capture, disable_affiliate_redirect)
```

#### **❌ FEHLENDE Campaign APIs (4 Funktionen)**

```
GET  /admin-campaigns         → ❌ NICHT IMPLEMENTIERT
POST /admin-campaign-create   → ❌ NICHT IMPLEMENTIERT
POST /admin-campaign-send     → ❌ NICHT IMPLEMENTIERT
POST /admin-campaign-test     → ❌ NICHT IMPLEMENTIERT
```

### 1.3 Config-Dateien

| Datei | Zweck | Beispiel |
|-------|-------|----------|
| **/netlify.toml** | Redirects, Security Headers, Functions Config | CSP, HSTS, /go/* Routing |
| **/config.json** | Public Config (TikTok Pixel, Affiliate Links) | `{"tiktokPixelId":"TT-XXX"}` |
| **ENV Variables** | Supabase, Resend, Admin Auth | `SUPABASE_URL`, `RESEND_API_KEY` |

**Erforderliche Environment Variables:**
```bash
SUPABASE_URL=https://xyz.supabase.co           # Pflicht
SUPABASE_SERVICE_KEY=eyJhbGci...               # Pflicht
ADMIN_PASSWORD_HASH=<bcrypt hash>              # Optional (für Token-Generierung)
RESEND_API_KEY=re_...                          # Optional (für Email-Versand)
TIKTOK_PIXEL_ID=TT-XXXXXXXX                    # Optional (für Tracking)
```

---

## 🔄 2. Datenflüsse (UI → API → DB)

### 2.1 Newsletter Signup Flow

```
User klickt "Benachrichtige mich"
    ↓
POST /.netlify/functions/newsletter_signup
    { email: "user@example.com", source: "popup" }
    ↓
Validierung + Duplikat-Check
    ↓
Falls RESEND_API_KEY vorhanden:
    → Resend API: Send Welcome Email
    ↓
INSERT INTO newsletter_subscribers
    (email, status='active', source, utm_*)
    ↓
Return { ok: true }
    ↓
Browser zeigt: "✅ Danke! Check dein Postfach."
```

**Supabase Tabelle:**
```sql
newsletter_subscribers (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  status text DEFAULT 'active',
  source text,
  utm_source text,
  utm_campaign text,
  created_at timestamptz,
  last_sent_at timestamptz
)
```

### 2.2 Affiliate Click & Redirect Flow

```
User klickt "Zum Code" (/go/psn-20?utm_source=tiktok)
    ↓
Netlify Redirect → /.netlify/functions/go
    ↓
Lookup Offer:
    1. Supabase: SELECT * FROM spotlights WHERE slug='psn-20'
    2. Fallback: Hardcoded offers in go.js
    ↓
Tracking Data sammeln:
    - IP Hash (SHA256)
    - User-Agent Hash
    - GeoIP Lookup (Country, Region)
    - Device Detection (mobile/desktop/tablet)
    ↓
INSERT INTO clicks (
  slug, platform, amount, utm_*, 
  ip_hash, country, region, device_hint
)
    ↓
302 Redirect → https://www.g2a.com/n/psn5_lux
    ↓
User landet auf Affiliate Partner
```

### 2.3 Admin Live Events Stream

```
Admin öffnet "Live Events" Tab
    ↓
setInterval(() => loadLiveEvents(), 4000)  // Alle 4 Sekunden
    ↓
GET /.netlify/functions/events?limit=50&since=<5min>
    Headers: { 'x-admin-token': <token> }
    ↓
SELECT * FROM events
  WHERE created_at >= NOW() - INTERVAL '5 minutes'
  ORDER BY created_at DESC
  LIMIT 50
    ↓
Return Events Array
    ↓
renderLiveTable(events)
    → Neue Events flashen grün
    → Counter aktualisieren
    → "Letzte Aktivität" Zeit updaten
```

### 2.4 Deal Management (CRUD)

```
Admin füllt "Deal erstellen" Form aus
    ↓
POST /.netlify/functions/spotlight
    {
      title: "PSN 20€ Card",
      slug: "psn-20",
      platform: "PSN",
      price: "17.99",
      affiliate_url: "https://g2a.com/...",
      active: true,
      priority: 120
    }
    ↓
INSERT INTO spotlights (...)
    ↓
Return { ok: true }
    ↓
Admin UI: Deal erscheint in "Alle Deals" Tabelle
```

**Metriken werden berechnet via:**
```javascript
// clicks24 = Clicks in letzten 24h für diesen slug
// ctr24 = (deals24 / cta24) * 100
// conversion24 = (emails24 / clicks24) * 100
// revenue24 = price * clicks24
```

---

## ⚠️ 3. Tote Buttons & Unverdrahtete UI-Elemente

### 🔴 KRITISCH: Campaign System

**Status:** UI komplett vorhanden, Backend 100% fehlend

**Betroffene Seite:** `/admin.html` → "Campaigns" Tab (Zeilen 225-265)

#### Was existiert (aber nicht funktioniert):

| UI Element | ID/Selector | Zeile | Status |
|------------|-------------|-------|--------|
| Campaign Form | `#campaign-form` | 236 | ❌ Submit wirft Error |
| "Test senden" Button | `#campaign-test` | 243 | ❌ Kein Handler |
| "An alle senden" Button | Form Submit | 244 | ❌ submitCampaign() fehlt |
| Campaign Preview | `#campaign-preview` | 254 | ✅ Funktioniert |
| Campaign Log | `#campaign-log` | 262 | ❌ loadCampaignLog() fehlt |
| "Refresh" Button | `#campaign-log-refresh` | 260 | ❌ Ruft fehlende Funktion auf |

#### Fehlende Dateien:

**Backend (4 Netlify Functions):**
```
❌ /netlify/functions/admin-campaigns.js
❌ /netlify/functions/admin-campaign-create.js
❌ /netlify/functions/admin-campaign-send.js
❌ /netlify/functions/admin-campaign-test.js
```

**Frontend (3 JavaScript Functions in `/assets/admin.js`):**
```javascript
❌ async function submitCampaign(event) { ... }
❌ async function sendCampaignTest(event) { ... }
❌ async function loadCampaignLog() { ... }
```

#### Datenbank (existiert bereits):

```sql
✅ newsletter_campaigns (subject, body_html, status, total_recipients, sent_count)
✅ newsletter_sends (campaign_id, subscriber_id, email, status, sent_at)
✅ newsletter_subscribers (email, status, utm_*, last_sent_at)
```

**Impact:**
- Admin sieht komplettes Campaign UI
- Beim Klick auf "Test senden" oder "An alle senden":
  - JavaScript Error: `Uncaught ReferenceError: submitCampaign is not defined`
  - Kein User Feedback
  - Kampagne wird nicht gesendet

**Geschätzter Aufwand:** 8-12 Stunden

---

### ⚠️ Minor: A/B Tests Tab

**Status:** Placeholder UI, keine Implementierung

**Betroffene Seite:** `/admin.html` → "A/B Tests" Tab (Zeilen 201-222)

| Element | ID | Status |
|---------|-----|--------|
| "Experiment anlegen" Button | `#experiment-add` | ❌ Kein Event Listener |
| Experiment Table | `#experiment-table` | ❌ Keine Load-Funktion |

**Impact:** Geringfügig (Tab ist offensichtlich leer/WIP)

**Geschätzter Aufwand:** 2-3 Stunden

---

## 📋 4. Minimal-Invasiver Implementierungsplan

### Phase 1: ✅ ERLEDIGT (Newsletter & Tracking)

**Was funktioniert:**
- ✅ Newsletter Popup erscheint nach 5s
- ✅ Email wird in Supabase gespeichert
- ✅ Optional: Resend API für Welcome Email
- ✅ Event Tracking (ViewContent, ScrollDepth, ClickOutbound)

**Dateien:**
- `/assets/app.js` (Zeilen 297-343)
- `/netlify/functions/newsletter_signup.js`
- `/netlify/functions/subscribe.js` (Fallback)
- `/netlify/functions/track-event.js`

---

### Phase 2: ✅ ERLEDIGT (Deals CRUD)

**Was funktioniert:**
- ✅ Deal Liste mit Filtern (Platform, Active Status, Zeitraum)
- ✅ Deal erstellen/bearbeiten (Spotlight Form)
- ✅ Inline-Update (Priority, Active Status)
- ✅ Affiliate Factory (generiert /go/ Links)
- ✅ Deal Metriken (CTR, Conversion, Revenue)

**Dateien:**
- `/assets/admin.js` (Zeilen 600-900)
- `/netlify/functions/deals-admin.js`
- `/netlify/functions/spotlight.js`
- `/netlify/functions/affiliate-factory.js`

---

### Phase 3: ✅ ERLEDIGT (Basic Analytics)

**Was funktioniert:**
- ✅ Live Events Stream (alle 4s Refresh)
- ✅ Funnel Analytics (Landing → Deal → Email)
- ✅ UTM Tracking & Source Attribution
- ✅ Device/Browser/Geo Breakdown
- ✅ Platform Stats (PSN, Xbox, Nintendo)

**Dateien:**
- `/assets/admin.js` (Zeilen 300-500)
- `/netlify/functions/events.js`
- `/netlify/functions/funnel.js`
- `/netlify/functions/utm.js`
- `/netlify/functions/devices.js`
- `/netlify/functions/stats.js`

---

### Phase 4: ❌ FEHLT (Campaign System)

**Ziel:** Email-Kampagnen an Subscriber senden

**Erforderliche Schritte:**

#### Schritt 1: Backend Functions erstellen (6-8h)

**Datei 1:** `/netlify/functions/admin-campaigns.js`
- GET: Liste aller Kampagnen (neueste zuerst)
- Query Params: `limit`, `status`

**Datei 2:** `/netlify/functions/admin-campaign-create.js`
- POST: Erstelle Kampagne im Status "draft"
- Zähle passende Subscribers (optional: filter by segment)

**Datei 3:** `/netlify/functions/admin-campaign-test.js`
- POST: Sende Test-Email via Resend API
- Keine DB-Einträge, nur Email senden

**Datei 4:** `/netlify/functions/admin-campaign-send.js`
- POST: Sende Kampagne an alle Active Subscribers
- Batch Processing (1 Email pro Subscriber)
- Update Campaign Status & Counts
- **⚠️ Warnung:** Blocking Operation (für >100 Subscriber Background Function nutzen)

#### Schritt 2: Frontend Functions ergänzen (1-2h)

**In `/assets/admin.js` hinzufügen:**

```javascript
// Zeile ~1200+
async function submitCampaign(event) {
  // 1. Create campaign via admin-campaign-create
  // 2. Confirm with user: "An X Subscriber senden?"
  // 3. Send via admin-campaign-send
  // 4. Show success toast
  // 5. Reload campaign log
}

async function sendCampaignTest(event) {
  // 1. Parse test_email from form
  // 2. POST to admin-campaign-test
  // 3. Show success toast
}

async function loadCampaignLog() {
  // 1. GET admin-campaigns?limit=10
  // 2. renderCampaignLog(campaigns)
}

function renderCampaignLog(campaigns) {
  // Render campaign history with:
  // - Subject, Status, Sent/Failed Counts, Timestamp
}
```

#### Schritt 3: Dependencies installieren

```bash
npm install resend --save
```

#### Schritt 4: Testing

**Test 1: Test-Email senden**
```bash
# Via UI: Campaigns Tab → Test Email eingeben → "Test senden"
# Erwartung: Email kommt an mit Subject "[TEST] ..."
```

**Test 2: Campaign an 1 Subscriber**
```bash
# 1. Erstelle Test-Subscriber in Supabase
# 2. Via UI: Campaign erstellen → "An alle senden"
# 3. Erwartung: Email kommt an, Campaign Log zeigt "1/1 gesendet"
```

**Test 3: Segment Filter**
```bash
# 1. Erstelle 2 Subscriber mit unterschiedlichen Sources
# 2. Campaign mit Segment "tiktok" senden
# 3. Erwartung: Nur Subscriber mit source='tiktok' erhält Email
```

---

### Phase 5: ⚠️ OPTIONAL (A/B Tests)

**Scope:** Niedrige Priorität, kann nach Launch ergänzt werden

**Erforderlich:**
1. Supabase Tabelle: `experiments`
2. Netlify Function: `admin-experiments.js`
3. Event Listener für `#experiment-add` Button
4. Experiment-Rendering in UI

**Geschätzter Aufwand:** 2-3 Stunden

---

### Phase 6: ✅ Launch Validation

**Checklist:**

```
✅ Newsletter Signup (Index) testen
✅ Deal-Klick → /go/psn-20 → Redirect funktioniert
✅ Admin Login mit Token
✅ Admin Health Check → Alle grün
✅ Live Events Stream lädt
✅ Deal erstellen & bearbeiten
✅ Optimizer Run
✅ Email Export (CSV)
✅ Settings: Feature Flags setzen

❌ Campaign Test-Email (nur wenn Phase 4 implementiert)
❌ Campaign an Subscriber senden (nur wenn Phase 4 implementiert)
```

---

## 🗂️ 5. Technische Details

### 5.1 Supabase Schema

**11 Tabellen:**

```sql
✅ clicks              -- Affiliate Click Tracking
✅ events              -- Event Tracking (ViewContent, ScrollDepth, etc.)
✅ emails              -- Legacy Email Capture (deprecated, use newsletter_subscribers)
✅ spotlights          -- Deals/Game Spotlights
✅ settings            -- Feature Flags (disable_email_capture, banner_message)
✅ newsletter_subscribers    -- Newsletter Email List
✅ newsletter_campaigns      -- Email Kampagnen
✅ newsletter_sends          -- Campaign Sends (pro Subscriber)
✅ admin_sessions            -- Admin Token Sessions
✅ admin_login_attempts      -- Rate Limiting
✅ admin_audit_log           -- Admin Actions Audit Trail
```

**Wichtige Relationships:**

```
newsletter_campaigns (1) ──┐
                           │
                           ├─→ newsletter_sends (N)
                           │
newsletter_subscribers (1) ─┘

spotlights (slug) ←── clicks (slug)
                 ←── events (slug)
```

### 5.2 Authentication

**Public:**
- Keine Auth erforderlich
- Rate Limiting via IP (`admin_login_attempts` Tabelle)

**Admin:**
- Token-based Auth (localStorage)
- Token wird in `x-admin-token` Header gesendet
- Validation via `requireAdmin()` Helper (`_lib/admin-token.js`)

**Token Generierung:**
```bash
# Manuell via Script
node scripts/hash-password.js "my-secure-token"

# Output: <bcrypt hash>
# In Netlify ENV: ADMIN_PASSWORD_HASH=<hash>
```

### 5.3 Deployment

**Development:**
```bash
npm install
npx netlify dev
# Läuft auf http://localhost:8888
```

**Production:**
```bash
git push origin main
# Netlify Auto-Deploy
```

**Environment Variables setzen:**
```
Netlify Dashboard → Site Settings → Environment Variables
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- ADMIN_PASSWORD_HASH (optional)
- RESEND_API_KEY (optional)
- TIKTOK_PIXEL_ID (optional)
```

---

## 📊 Status-Übersicht

| Komponente | Funktionalität | Status | Für MVP erforderlich? |
|------------|----------------|--------|----------------------|
| Public Landing | Deals, Newsletter, Live Stats | ✅ 100% | ✅ Ja |
| Admin Login | Token Auth | ✅ 100% | ✅ Ja |
| Admin Analytics | Stats, Events, Funnels | ✅ 100% | ✅ Ja |
| Deal Management | CRUD, Optimizer, Factory | ✅ 100% | ✅ Ja |
| Email Leads | List, Export, Seed Data | ✅ 100% | ✅ Ja |
| **Campaign System** | Email Campaigns | ❌ 0% | ⚠️ Optional |
| A/B Tests | Experiment Management | ❌ 0% | ❌ Nein |

**Gesamtstatus:** 🟢 85% Launch-Ready

---

## 🎯 Empfehlungen

### Für sofortigen Launch (ohne Campaign System):

1. **Code anpassen:**
   ```javascript
   // In /assets/admin.js, Zeile ~64
   // Verstecke Campaigns & A/B Tabs
   const hiddenTabs = ['campaigns', 'ab'];
   hiddenTabs.forEach(id => {
     const tab = document.querySelector(`[data-tab="${id}"]`);
     if (tab) tab.style.display = 'none';
   });
   ```

2. **Newsletter-Leads nutzen:**
   - Export via CSV (`/admin.html` → Email & Leads → Export CSV)
   - Import in externes Tool (Mailchimp, ConvertKit, Brevo)
   - Kampagnen dort versenden

3. **Fokus auf Conversion:**
   - Deal Optimizer nutzen (Auto-Boost bei CTR > 2%)
   - Live Events monitoren
   - UTM Tracking für Traffic-Quellen analysieren

### Für Campaign System Implementation:

1. **Phase 4 Implementieren:** (siehe oben, 8-12h)
2. **Resend API Key besorgen:** https://resend.com (Free: 100 Emails/Tag)
3. **Testen mit 1 Subscriber:** Erstelle Test-Subscriber, sende Campaign
4. **Launch:** Aktiviere Campaign Tab

---

## 📚 Weitere Dokumentation

**Erstellt:**
- ✅ `/docs/ARCHITECTURE_ANALYSIS.md` (detaillierte Architektur)
- ✅ `/docs/DATA_FLOWS.md` (visuelle Datenfluss-Diagramme)
- ✅ `/docs/IMPLEMENTATION_PLAN.md` (Campaign System Step-by-Step)
- ✅ `/docs/DROPCHARGE_OVERVIEW.md` (dieses Dokument)

**Bestehende Docs:**
- `/README.md` (Setup & Deployment)
- `/docs/IMPLEMENTATION.md` (Alte Implementation Notes)
- `/ops/newsletter.md` (Newsletter Setup)

---

## 🚀 Quick Start

```bash
# 1. Clone Repo
git clone https://github.com/florianlux/dropcharge.git
cd dropcharge

# 2. Install Dependencies
npm install

# 3. Set Environment Variables
# Erstelle .env File (nicht committen!)
cat > .env << EOF
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
RESEND_API_KEY=re_...
EOF

# 4. Start Dev Server
npx netlify dev

# 5. Open Browser
open http://localhost:8888
```

**Test Public Landing:**
- ✅ Newsletter Popup öffnet sich nach 5s
- ✅ Deal-Button klicken → Redirect zu Affiliate
- ✅ Live Activity Counter lädt

**Test Admin:**
1. Öffne http://localhost:8888/admin-login.html
2. Gib beliebigen Token ein (für Dev)
3. Navigiere zu Admin Dashboard
4. Tabs testen: Overview, Live Events, Deals

---

**Ende des Überblicks**
