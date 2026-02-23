# Smoke Tests

Manual smoke tests and `curl` commands to verify core functionality.
Replace `$BASE` with your deployment URL (e.g. `https://dropcharge.netlify.app`)
and `$ADMIN_TOKEN` with your admin token.

---

## 1. Newsletter Signup

**What:** Verify the newsletter subscription endpoint accepts an email and returns success.

```bash
curl -s -X POST "$BASE/.netlify/functions/newsletter_signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "smoketest@example.com", "source": "smoke-test"}' \
  | jq .
```

**Expected:**
- HTTP 200
- JSON body contains `"ok": true` or a success message
- Row appears in `newsletter_subscribers` table with status `active` (or `pending` if double opt-in is enabled)

**Manual check:**
- Open the landing page (`$BASE/`), fill in the newsletter popup, submit
- Confirm no JS console errors
- If `RESEND_API_KEY` is set, check that a welcome email is delivered

---

## 2. Tracking Stats

**What:** Verify the stats endpoint returns aggregated data.

```bash
curl -s "$BASE/.netlify/functions/tracking-stats" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Expected:**
- HTTP 200
- JSON body with stats object (e.g. click counts, event counts)

---

## 3. Track Event

**What:** Verify the event tracking endpoint accepts and stores events.

```bash
curl -s -X POST "$BASE/.netlify/functions/track-event" \
  -H "Content-Type: application/json" \
  -d '{"type": "smoke_test", "name": "ping", "path": "/smoke"}' \
  | jq .
```

**Expected:**
- HTTP 200
- JSON body contains success confirmation
- Row appears in `events` table with `type = 'smoke_test'`

---

## 4. Track Click

**What:** Verify click tracking stores a click record.

```bash
curl -s -X POST "$BASE/.netlify/functions/track-click" \
  -H "Content-Type: application/json" \
  -d '{"slug": "smoke-test", "platform": "test"}' \
  | jq .
```

**Expected:**
- HTTP 200
- Row appears in `clicks` table with `slug = 'smoke-test'`

---

## 5. Admin Dashboard Loads Without Errors

**What:** Verify the admin page returns valid HTML and assets load.

```bash
# Check admin login page loads
curl -s -o /dev/null -w "%{http_code}" "$BASE/admin/login"
# Expected: 200

# Check admin page loads (will redirect to login if no auth)
curl -s -o /dev/null -w "%{http_code}" "$BASE/admin"
# Expected: 200 (or 302 redirect to login)

# Check admin CSS loads
curl -s -o /dev/null -w "%{http_code}" "$BASE/assets/admin.css"
# Expected: 200

# Check admin JS loads
curl -s -o /dev/null -w "%{http_code}" "$BASE/assets/admin.js"
# Expected: 200
```

**Manual check:**
- Open `$BASE/admin/login` in a browser
- Log in with valid credentials
- Verify the dashboard renders all tabs without JS console errors
- Click through each tab and confirm no broken layouts or 500 errors in the network tab

---

## 6. Admin Health Endpoint

**What:** Verify the admin health check returns system status.

```bash
curl -s "$BASE/.netlify/functions/admin-health" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Expected:**
- HTTP 200
- JSON body with health/status information

---

## 7. Admin List Subscribers

**What:** Verify the subscriber listing endpoint works.

```bash
curl -s "$BASE/.netlify/functions/admin-list-subscribers" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Expected:**
- HTTP 200
- JSON body with array of subscribers

---

## 8. Gaming Drops Redirect

**What:** Verify the `/go/` short-URL redirect works.

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "$BASE/go/nintendo15"
```

**Expected:**
- HTTP 301 or 302 redirect to the destination URL (e.g. G2A affiliate link)

---

## 9. Public Config

**What:** Verify the public configuration endpoint returns config data.

```bash
curl -s "$BASE/.netlify/functions/public-config" | jq .
```

**Expected:**
- HTTP 200
- JSON body with public configuration values

---

## 10. Spotlight Page

**What:** Verify the spotlight page renders.

```bash
curl -s -o /dev/null -w "%{http_code}" "$BASE/spotlight/test"
```

**Expected:**
- HTTP 200 (catch-all route serves `spotlight.html`)

---

## Quick Full Smoke Run

Run all critical checks in sequence:

```bash
BASE="https://your-site.netlify.app"
ADMIN_TOKEN="your-admin-token"

echo "=== Newsletter Signup ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/.netlify/functions/newsletter_signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "smoke-'$(date +%s)'@example.com", "source": "smoke-test"}'

echo "=== Track Event ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/.netlify/functions/track-event" \
  -H "Content-Type: application/json" \
  -d '{"type": "smoke_test", "name": "ping", "path": "/smoke"}'

echo "=== Tracking Stats ==="
curl -s -w "\nHTTP %{http_code}\n" "$BASE/.netlify/functions/tracking-stats" \
  -H "x-admin-token: $ADMIN_TOKEN"

echo "=== Admin Health ==="
curl -s -w "\nHTTP %{http_code}\n" "$BASE/.netlify/functions/admin-health" \
  -H "x-admin-token: $ADMIN_TOKEN"

echo "=== Admin Dashboard ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BASE/admin"

echo "=== Landing Page ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BASE/"

echo "=== Done ==="
```
