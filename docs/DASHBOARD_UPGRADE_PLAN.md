# Dashboard Upgrade Plan – DropCharge

## 1. IST-Zustand

### Entrypoints

| Datei | URL | Beschreibung |
|---|---|---|
| `admin-login.html` | `/admin/login` | Token-Eingabe → speichert in `localStorage` |
| `admin.html` | `/admin` | Haupt-Dashboard (10+ Tabs) |
| `assets/admin.js` | (module) | Gesamte Dashboard-Logik (Tab-Init, API-Calls, UI-Rendering) |
| `assets/admin.css` | (stylesheet) | Dashboard-Styles |

### Tabs im Admin Dashboard

1. **Dashboard** – Subscriber-Stats, News-Banner
2. **Newsletter** – Subscriber-Liste (Suche, Filter, Status)
3. **Email Hub** – Audience-Übersicht, Templates, Test-E-Mails, Logs
4. **Campaigns** – Composer mit Segment-Targeting & HTML-Editor
5. **Deals/Spotlights** – G2A Reflink-Repair
6. **Gaming Drops** – Outbound-Links mit Affiliate-Tagging
7. **Spotlight Pages** – Erstellen/Bearbeiten (Templates: Temu, Amazon, G2A …)
8. **Tracking Links** – UTM-Generator
9. **Analytics** – Top 10 Links, Latest Events
10. **Deep Tracking** – Echtzeit-Events, Funnel, Sources, Campaigns, Devices

### Netlify Functions (36 gesamt)

**Admin (9):**
`admin-analytics`, `admin-drops`, `admin-email-logs`, `admin-email-templates`, `admin-fix-g2a-links`, `admin-health`, `admin-list-leads`, `admin-list-subscribers`, `admin-send-campaign`

**Core:**
`go`, `last-activity`, `newsletter_signup`, `product-fetch`, `public-config`, `session-init`, `settings`, `subscribe`, `send-test-email`, `unsubscribe`, `email-health`, `email-debug`

**Tracking:**
`track-click`, `track-event`, `tracking-events`, `tracking-export`, `tracking-funnel`, `tracking-stats`, `activity`, `api-activity`

**Spotlight:**
`spotlight`, `spotlight-autofill`, `spotlight-click`, `spotlight-create`, `spotlight-create-from-product`, `spotlight-get`

**Sonstige:**
`spin-enter`

**Shared Library (`_lib/`):**
`admin-token.js`, `cors.js`, `settings.js`, `supabase.js`, `email-templates.js`, `ts-column.js`, `affiliates.js`, `send-welcome.js`

### Supabase-Tabellen

| Tabelle | Migrations | Genutzt von |
|---|---|---|
| `newsletter_subscribers` | 001, 003 | newsletter_signup, admin-list-subscribers, admin-send-campaign |
| `newsletter_campaigns` | 002 | admin-send-campaign |
| `clicks` | 001 | track-click, admin-analytics |
| `events` | 001, 009, 010 | track-event, tracking-events, tracking-stats, tracking-funnel |
| `settings` | 001 | settings, admin.js (Banner) |
| `email_logs` | 004 | admin-email-logs, send-welcome |
| `drops` | 005, 006 | admin-drops |
| `spotlights` | 001 | spotlight-create, spotlight-get |
| `spotlight_pages` | 007, 008 | spotlight-create, spotlight-get |
| `product_cache` | 008 | product-fetch, spotlight-autofill |

### Auth-Modell

- Token wird client-seitig in `localStorage` gespeichert (`admin_token`)
- Jeder Admin-API-Call sendet `x-admin-token` Header
- Server validiert gegen `ADMIN_TOKEN` / `ADMIN_API_TOKEN` Env-Variablen
- Admin-Login via `admin-login.html` (kein Passwort — nur Token)

---

## 2. Risiken

| Risiko | Bereich | Auswirkung |
|---|---|---|
| **admin.js ist monolithisch** | Frontend | Jede Änderung kann andere Tabs brechen |
| **Kein Build-Step** | Frontend | Kein Tree-Shaking, kein Bundling, kein TypeScript |
| **Token-Auth ohne Expiry** | Security | Token bleibt in localStorage bis manuell gelöscht |
| **Keine Unit-Tests für Functions** | Backend | Regressions werden erst in E2E-Tests entdeckt |
| **CORS-Config in jeder Function** | Backend | Inkonsistente CORS-Handhabung möglich |
| **Supabase Service-Role Key** | Security | Functions nutzen Service-Role → voller DB-Zugriff |
| **Kein Rate-Limiting auf Public-Endpoints** | Security | newsletter_signup, track-event angreifbar |
| **Keine CSP für Inline-Scripts** | Security | admin.html nutzt inline JS in einigen Stellen |

**Was NICHT kaputt gehen darf:**
- Newsletter Signup Flow (index.html → newsletter_signup → Supabase)
- Affiliate-Link Redirect (`/go/*` → go.js → clicks tracking)
- Admin-Auth (Token-Flow login → dashboard)
- Spotlight-Seiten (öffentliche Landing-Pages)
- Tracking-Pipeline (tracker.js → track-event → events-Tabelle)
- E-Mail-Versand (Campaigns + Welcome-Mail via Resend)

---

## 3. Upgrade Roadmap

### Phase 2 – Admin JS Modularisierung
- [ ] `assets/admin.js` in Module aufteilen (je Tab ein Modul)
- [ ] Shared Helpers extrahieren (`api.js`, `toast.js`, `utils.js`)
- [ ] ES-Module-Imports nutzen (bereits `type="module"` in admin.html)
- [ ] Smoke-Tests nach jedem Modul-Split durchführen

### Phase 3 – API-Härtung
- [ ] Rate-Limiting für öffentliche Endpoints (newsletter_signup, track-event)
- [ ] Token-Expiry / Refresh-Mechanismus für Admin-Auth
- [ ] Input-Validation in allen Functions vereinheitlichen
- [ ] CORS-Handling in `_lib/cors.js` zentralisieren (falls nicht schon überall genutzt)

### Phase 4 – Dashboard UI Verbesserungen
- [ ] Responsive Layout für Mobile-Admin
- [ ] Loading-States & Error-Boundaries pro Tab
- [ ] Pagination für Subscriber-Liste & Event-Logs
- [ ] Dark-Mode-Support (CSS-Variablen bereits teilweise vorhanden)

### Phase 5 – Daten & Analytics
- [ ] Aggregation-Layer für Tracking (daily rollups → schnellere Queries)
- [ ] Dashboard-Widgets: Conversion-Funnel, Geo-Verteilung, Trend-Charts
- [ ] CSV/JSON-Export für alle Listen-Tabs
- [ ] Scheduled Reports (Netlify Scheduled Functions oder Cron)

### Phase 6 – E-Mail & Campaigns
- [ ] Template-Editor mit Live-Preview im Dashboard
- [ ] Segmentierung: Tags, Custom Fields, Engagement-Score
- [ ] A/B-Testing für Subject-Lines
- [ ] Automatische Welcome-Sequenz (Drip Campaign)

### Phase 7 – DevOps & Testing
- [ ] CI/CD: Playwright-Tests in GitHub Actions
- [ ] Staging-Environment (separate Supabase-Instanz)
- [ ] Function-Unit-Tests (vitest oder jest)
- [ ] Monitoring & Alerting (Uptime, Error-Rate, E-Mail-Bounce)
- [ ] Supabase RLS-Policies für alle Tabellen aktivieren
