# Tracking System – DropCharge

## Overview

First-party analytics for DropCharge. All tracking is consent-gated (EU-friendly).
Data is stored in Supabase via Netlify Functions. No third-party scripts required.

---

## Database Migration

Run `supabase/migrations/009_tracking.sql` against your Supabase project:

```sql
-- In Supabase SQL editor or psql:
\i supabase/migrations/009_tracking.sql
```

Creates:
- `sessions` table – one row per browser session
- New columns on `events` – `ts`, `session_key`, `event_name`, `user_id`, `props`, `theme`, `device_type`, `os`, `browser`
- `aggregates_daily` table (optional cache)

---

## Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | ✅ |
| `ADMIN_TOKEN` | Secret token for admin API access | ✅ |

No new env vars are required for tracking – it uses the existing ones.

---

## Netlify Functions

### Public (no auth required)

| Function | Method | Description |
|---|---|---|
| `track-event` | POST | Ingest a tracking event. Rate-limited to 100 req/min per IP. |
| `session-init` | POST | Create or refresh a session row. Returns `session_key`. |

### Admin (require `x-admin-token` header)

| Function | Method | Description |
|---|---|---|
| `tracking-stats` | GET | KPI summary (pageviews, sessions, CTR, etc.) |
| `tracking-funnel` | GET | Conversion funnel steps with drop-off percentages |
| `tracking-events` | GET | Paginated recent events with filters |
| `tracking-export` | GET | CSV export of events or spotlight stats |

---

## Consent Gating

The tracker (`assets/tracker.js`) shows a consent banner on first visit.

- **Essential** (always on): session key is stored in `sessionStorage` (ephemeral)
- **Analytics** (opt-in): generates a persistent `dc_uid` in `localStorage` and sends it as `user_id`

Consent choice is stored in `localStorage` as `dc_consent_analytics=true|false`.

When analytics is declined:
- No `user_id` is stored or sent
- `session_key` is ephemeral (sessionStorage only)

---

## Event Taxonomy

| Event | When fired | Key props |
|---|---|---|
| `page_view` | Every page load | `title` |
| `session_start` | New session | – |
| `consent_update` | User accepts/declines | `analytics: true/false` |
| `scroll_depth` | At 25/50/75/90% scroll | `percent` |
| `outbound_click` | Click on external link | `url`, `position` |
| `spotlight_view` | Spotlight page renders | `slug`, `theme`, `brand` |
| `cta_click` | CTA button clicked | `slug`, `theme`, `url`, `position` |
| `coupon_copy` | Coupon copy button clicked | `slug` |
| `newsletter_view` | Newsletter section visible | – |
| `newsletter_submit` | Form submitted | – |
| `newsletter_success` | Signup confirmed | – |
| `newsletter_error` | Signup failed | `message` |

---

## Curl Test Examples

### 1. Track a page_view event
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/track-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "path": "/",
    "session_key": "test-session-123",
    "consent_analytics": false,
    "utm_source": "tiktok",
    "utm_medium": "social",
    "utm_campaign": "summer-sale"
  }'
# Expected: {"ok":true}
```

### 2. Track a cta_click
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/track-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "cta_click",
    "slug": "g2a-steam-20",
    "theme": "g2a",
    "session_key": "test-session-123",
    "consent_analytics": true,
    "user_id": "uid-abc",
    "props": {"position": "hero"}
  }'
# Expected: {"ok":true}
```

### 3. Get tracking stats (admin)
```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  "https://your-site.netlify.app/.netlify/functions/tracking-stats?range=7d"
# Returns JSON with kpis, top_sources, top_campaigns, etc.
```

### 4. Get funnel data (admin)
```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  "https://your-site.netlify.app/.netlify/functions/tracking-funnel?range=7d"
# Returns funnel steps with pct_prev and pct_top
```

### 5. Get recent events (admin)
```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  "https://your-site.netlify.app/.netlify/functions/tracking-events?range=24h&limit=50"
# Returns paginated events array
```

### 6. Export CSV (admin)
```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  "https://your-site.netlify.app/.netlify/functions/tracking-export?range=7d" \
  -o events.csv
```

### 7. Test rate limit (should 429 after 100+ requests in 60s)
```bash
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://your-site.netlify.app/.netlify/functions/track-event \
    -H "Content-Type: application/json" \
    -d '{"event_name":"page_view","session_key":"rl-test"}'
done
# First 100 → 200, subsequent → 429
```

---

## Test Plan

### 1. Basic event ingestion
- Open the site with `?utm_source=tiktok&utm_medium=social&utm_campaign=test`
- Check Supabase `events` table for new rows
- Verify `event_name=page_view`, `utm_source=tiktok` populated correctly

### 2. Consent banner
- Clear localStorage and reload the site
- Banner should appear with "Accept analytics" / "Essential only" buttons
- Click **Accept analytics** → `dc_consent_analytics=true` set in localStorage, `dc_uid` generated
- Reload → no banner; events include `user_id`
- Click **Essential only** → `dc_consent_analytics=false`, no `user_id` in events

### 3. Admin tracking page
- Log into `/admin.html`
- Click **📊 Tracking** in the left nav
- KPI cards should populate within a few seconds
- Funnel visualization should show conversion bars
- Live events table should show recent activity
- Change range selector (24h/7d/30d) → data updates
- Click **Export CSV** → file downloads

### 4. Spotlight tracking
- Visit a spotlight page (e.g. `/spotlight/your-slug`)
- Check Supabase for `spotlight_view` event
- Click the CTA button → `cta_click` event appears in events stream
- Copy coupon → `coupon_copy` event

### 5. Rate limiting
- Send 110 POST requests to `track-event` from the same IP in under 60 seconds
- First 100 should return HTTP 200
- Requests 101+ should return HTTP 429 with `Retry-After: 60`

### 6. Performance check
- Open browser DevTools → Network tab
- Confirm `tracker.js` is < 15 KB
- Confirm no blocking scripts from tracker
- Confirm no console errors on landing page

---

## Data Retention

Raw events are kept indefinitely by default. To purge old data, run:

```sql
-- Delete events older than 90 days
DELETE FROM events WHERE ts < now() - interval '90 days';

-- Delete sessions older than 90 days
DELETE FROM sessions WHERE last_seen < now() - interval '90 days';
```

You can schedule this as a Supabase database cron job (Edge Functions or pg_cron extension).
