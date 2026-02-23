# Dashboard Upgrade Plan

## IST-Zustand (Current State)

### Entrypoints

| File | URL | Purpose |
|---|---|---|
| `admin-login.html` | `/admin/login` | Login page (bcrypt auth) |
| `admin.html` | `/admin` | Main dashboard shell |
| `assets/admin.js` | — | Client-side logic (V2, SPA-style tabs) |
| `assets/admin.css` | — | Dashboard styles |

### Dashboard Tabs (in `admin.html`)

1. **Dashboard** — overview / stats
2. **Newsletter** — subscriber management
3. **Email** — email debug & health
4. **Campaigns** — newsletter campaigns
5. **Deals** — spotlight/deals management
6. **Gaming Drops** — voucher drop management
7. **Spotlight** — product spotlight pages
8. **Tracking Links** — link tracking
9. **Analytics** — analytics data
10. **📊 Tracking** — deep tracking / funnel view

### Netlify Functions (Admin)

| Function | Method | Purpose |
|---|---|---|
| `admin-health` | GET | System health check |
| `admin-list-subscribers` | GET | List newsletter subscribers |
| `admin-list-leads` | GET | List leads |
| `admin-send-campaign` | POST | Send email campaign |
| `admin-email-logs` | GET | Email send logs |
| `admin-email-templates` | GET/POST | Manage email templates |
| `admin-analytics` | GET | Analytics data |
| `admin-drops` | GET/POST | CRUD for gaming drops |
| `admin-fix-g2a-links` | POST | G2A link repair utility |

### Netlify Functions (Public / Tracking)

| Function | Purpose |
|---|---|
| `newsletter_signup` | Newsletter subscription |
| `subscribe` | Legacy email subscribe |
| `unsubscribe` | Unsubscribe handler |
| `track-click` | Click tracking |
| `track-event` | Event tracking |
| `tracking-stats` | Stats aggregation |
| `tracking-events` | Event listing |
| `tracking-funnel` | Funnel analysis |
| `tracking-export` | CSV/JSON export |
| `session-init` | Session initialization |
| `activity` / `api-activity` / `last-activity` | Activity feed |
| `spotlight` / `spotlight-get` / `spotlight-create` / `spotlight-click` / `spotlight-autofill` / `spotlight-create-from-product` | Spotlight CRUD |
| `go` | Short URL redirect handler |
| `spin-enter` | Spin wheel entry |
| `public-config` | Public config |
| `settings` | Settings CRUD |
| `send-test-email` | Test email sender |
| `email-health` / `email-debug` | Email diagnostics |
| `product-fetch` | Product data fetcher |

### Shared Libraries (`netlify/functions/_lib/`)

| Module | Purpose |
|---|---|
| `supabase.js` | Supabase client singleton |
| `admin-token.js` | `x-admin-token` header verification |
| `cors.js` | CORS headers helper |
| `settings.js` | Settings read/write |
| `affiliates.js` | Affiliate link helpers |
| `email-templates.js` | Email template rendering |
| `send-welcome.js` | Welcome email sender (Resend) |
| `ts-column.js` | Timestamp column safety util |

### Supabase Tables

| Table | Purpose |
|---|---|
| `clicks` | Click tracking with UTM, geo, device |
| `emails` | Email collection (legacy) |
| `events` | Generic event tracking |
| `newsletter_subscribers` | Subscribers with status, tokens, UTM |
| `newsletter_campaigns` | Campaign definitions & status |
| `newsletter_sends` | Per-recipient send records |
| `email_logs` | Email send audit trail |
| `settings` | Key-value config store |
| `spotlights` | Product spotlights / deals |
| `spotlight_pages` | Spotlight page variants |
| `drops` | Gaming voucher drops |
| `product_cache` | Cached product metadata |
| `sessions` | First-party session tracking |
| `aggregates_daily` | Daily analytics cache |
| `admin_sessions` | Admin auth sessions |
| `admin_login_attempts` | Login rate-limiting |
| `admin_audit_log` | Admin action audit log |

### Frontend Assets

| File | Purpose |
|---|---|
| `assets/app.js` | Main landing page logic |
| `assets/tracker.js` | Client-side event tracker |
| `assets/spin.js` | Spin wheel logic |
| `assets/styles.css` | Global styles |
| `assets/spin.css` | Spin wheel styles |

---

## Risiken (What Must Not Break)

1. **Newsletter signup flow** — `newsletter_signup` function + Supabase insert must keep working. This is the primary conversion funnel from TikTok traffic.
2. **Admin authentication** — `x-admin-token` header check and `admin-login.html` bcrypt flow. Breaking auth = open dashboard or locked-out admin.
3. **Click/event tracking** — `track-click`, `track-event`, `session-init` feed into analytics. Data loss is unrecoverable.
4. **Spotlight/deals pages** — Revenue-generating affiliate links. `spotlight.html` + related functions must render correctly.
5. **Gaming drops redirect** — `/go/*` → `go.js` short-URL redirect is the core monetisation link.
6. **Security headers** — CSP, HSTS, X-Frame-Options in `netlify.toml`. Removing them weakens security posture.
7. **Existing Playwright tests** — `tests/` directory contains E2E tests (`admin-actions.spec.ts`, `affiliates.test.js`, `drops.test.js`, `spotlight.test.js`, `spotlight-g2a.test.js`, `ts-column.test.js`). All must pass after changes.
8. **Environment variables** — Functions depend on `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`, `RESEND_API_KEY`. Env mismatch = runtime errors.

---

## Upgrade Roadmap

### Phase 2 — Admin Dashboard Hardening

- [ ] Add loading states and error boundaries to every tab
- [ ] Implement consistent toast notifications for all API calls
- [ ] Add auto-refresh / polling for live stats on Dashboard tab
- [ ] Add pagination to subscriber and leads lists

### Phase 3 — Analytics & Tracking Deep Dive

- [ ] Wire Analytics tab to `admin-analytics` + `tracking-stats` functions
- [ ] Build funnel visualisation using `tracking-funnel` data
- [ ] Add date-range picker for all analytics views
- [ ] Show session-level data from `sessions` table

### Phase 4 — Campaign Management

- [ ] Build campaign composer UI (subject, body HTML, segment selector)
- [ ] Add campaign preview / test-send before broadcast
- [ ] Show send progress with live `newsletter_sends` status
- [ ] Add campaign performance metrics (open rate proxy via email logs)

### Phase 5 — Email Template System

- [ ] Build template editor in admin (CRUD via `admin-email-templates`)
- [ ] Add template preview with variable substitution
- [ ] Link templates to campaigns for reuse
- [ ] Add default templates for welcome, confirmation, unsubscribe

### Phase 6 — Spotlight & Drops Management

- [ ] Improve spotlight creation form (image upload, rich description)
- [ ] Add drag-and-drop sort for drops priority
- [ ] Add bulk actions (activate/deactivate, delete)
- [ ] Show click stats per spotlight / drop inline

### Phase 7 — Operational Excellence

- [ ] Add admin audit log viewer in dashboard
- [ ] Implement admin role-based access (read-only vs full)
- [ ] Add data export (CSV) for subscribers, events, clicks
- [ ] Add health-check dashboard panel aggregating `admin-health` + `email-health`
- [ ] Document all API endpoints in an OpenAPI spec
