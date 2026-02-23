# Smoke Tests

Quick curl commands to verify each endpoint after deploy.

Replace `$BASE` with your site URL (e.g. `https://dropcharge.netlify.app`)
and `$TOKEN` with your `ADMIN_TOKEN`.

## Health Check (public)
```bash
curl -s "$BASE/.netlify/functions/health" | jq .
```
Expected: `{ "ok": true, "checks": { ... } }`

## Track Event (public POST)
```bash
curl -s -X POST "$BASE/.netlify/functions/track-event" \
  -H "Content-Type: application/json" \
  -d '{"event_name":"page_view","path":"/test","session_key":"smoke-test-123"}' | jq .
```
Expected: `{ "ok": true }`

## Stats (admin)
```bash
curl -s "$BASE/.netlify/functions/tracking-stats?range=7d" \
  -H "x-admin-token: $TOKEN" | jq .
```
Expected: `{ "ok": true, "range": "7d", "kpis": { ... } }`

## Stats Funnel (admin)
```bash
curl -s "$BASE/.netlify/functions/tracking-funnel?range=7d" \
  -H "x-admin-token: $TOKEN" | jq .
```
Expected: `{ "ok": true, "range": "7d", "steps": [...] }`

## Stats Advanced (admin)
```bash
curl -s "$BASE/.netlify/functions/stats-advanced?range=7d" \
  -H "x-admin-token: $TOKEN" | jq .
```
Expected: `{ "ok": true, "top_deals": [...], "top_referrers": [...], ... }`

## Newsletter Signup (public POST)
```bash
curl -s -X POST "$BASE/.netlify/functions/newsletter_signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com"}' | jq .
```
Expected: `{ "ok": true, ... }` (or duplicate error if already exists)

## Admin Health (admin)
```bash
curl -s "$BASE/.netlify/functions/admin-health" \
  -H "x-admin-token: $TOKEN" | jq .
```
Expected: `{ "ok": true, "checks": { ... } }`

## Admin List Subscribers (admin)
```bash
curl -s "$BASE/.netlify/functions/admin-list-subscribers?limit=5&status=all" \
  -H "x-admin-token: $TOKEN" | jq .
```
Expected: `{ "ok": true, "items": [...], "total": ... }`
