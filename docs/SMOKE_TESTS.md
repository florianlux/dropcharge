# Smoke Tests – DropCharge

Manuelle Tests und `curl`-Befehle um die Kernfunktionen nach jedem Deploy zu prüfen.

> **Voraussetzungen:**
> - `BASE_URL` = deine Netlify-URL (z.B. `https://dropcharge.netlify.app`)
> - `ADMIN_TOKEN` = dein Admin-Token (aus Netlify Env-Variablen)

```bash
export BASE_URL="https://dropcharge.netlify.app"
export ADMIN_TOKEN="dein-admin-token"
```

---

## 1. Newsletter Signup

**Ziel:** E-Mail-Adresse wird in `newsletter_subscribers` gespeichert.

```bash
curl -s -X POST "$BASE_URL/.netlify/functions/newsletter_signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "smoketest@example.com", "source": "smoke-test"}' \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON mit Erfolgs-Bestätigung.

**Manuelle Prüfung:**
- [ ] Öffne `index.html` im Browser
- [ ] Newsletter-Popup öffnen, E-Mail eingeben, absenden
- [ ] Erfolgs-Nachricht wird angezeigt
- [ ] Eintrag in Supabase `newsletter_subscribers` prüfen

---

## 2. Admin Dashboard Laden

**Ziel:** Dashboard lädt ohne JS-Errors.

```bash
# Login-Seite erreichbar
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/login"
# Erwartung: 200 oder 302

# Dashboard-Seite erreichbar (nach Redirect)
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin"
# Erwartung: 200 oder 302
```

**Manuelle Prüfung:**
- [ ] `$BASE_URL/admin/login` öffnen → Token-Eingabefeld sichtbar
- [ ] Token eingeben → Weiterleitung zu `/admin`
- [ ] Dashboard lädt alle Tabs ohne Console-Errors
- [ ] Subscriber-Stats werden angezeigt (Dashboard-Tab)

---

## 3. Admin Stats / Analytics

**Ziel:** Admin-Analytics-Endpoint liefert Daten.

```bash
curl -s "$BASE_URL/.netlify/functions/admin-analytics" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON mit Stats (Subscriber-Counts, Click-Daten).

```bash
# Subscriber-Liste abrufen
curl -s "$BASE_URL/.netlify/functions/admin-list-subscribers?limit=5" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON-Array mit Subscriber-Objekten.

---

## 4. Track Event

**Ziel:** Events werden in der `events`-Tabelle gespeichert.

```bash
curl -s -X POST "$BASE_URL/.netlify/functions/track-event" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "smoke_test",
    "page": "/smoke",
    "props": {"test": true}
  }' \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON mit Erfolgs-Bestätigung.

```bash
# Events abrufen (Admin)
curl -s "$BASE_URL/.netlify/functions/tracking-events?limit=5" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON-Array mit Event-Objekten (inkl. `smoke_test`).

---

## 5. Tracking Stats

**Ziel:** Tracking-Stats-Endpoint liefert aggregierte Daten.

```bash
curl -s "$BASE_URL/.netlify/functions/tracking-stats" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON mit aggregierten Tracking-Daten.

---

## 6. Admin Health Check

**Ziel:** Supabase-Verbindung und Basis-Config sind intakt.

```bash
curl -s "$BASE_URL/.netlify/functions/admin-health" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  | jq .
```

**Erwartete Antwort:** HTTP 200, JSON mit `status: "ok"` und Verbindungsdetails.

---

## 7. Public Config

**Ziel:** Öffentliche Konfiguration (z.B. TikTok Pixel) wird korrekt geliefert.

```bash
curl -s "$BASE_URL/.netlify/functions/public-config" | jq .
```

**Erwartete Antwort:** HTTP 200, JSON mit Config-Werten.

---

## 8. Spotlight Pages

**Ziel:** Spotlight-Seiten sind öffentlich abrufbar.

```bash
# Spotlight-Daten abrufen (wenn vorhanden)
curl -s "$BASE_URL/.netlify/functions/spotlight-get?slug=test" | jq .
```

**Erwartete Antwort:** HTTP 200 mit Spotlight-Daten oder HTTP 404 wenn kein Spotlight mit diesem Slug existiert.

---

## 9. Affiliate Redirect

**Ziel:** `/go/*`-Links tracken Klick und leiten weiter.

```bash
curl -s -o /dev/null -w "%{http_code} redirect:%{redirect_url}" "$BASE_URL/go/test"
```

**Erwartete Antwort:** HTTP 302 mit Redirect-URL, oder HTTP 404 falls kein Link konfiguriert.

---

## Checkliste nach Deploy

| # | Test | Methode | Status |
|---|------|---------|--------|
| 1 | Newsletter Signup | curl + UI | ☐ |
| 2 | Admin Login + Dashboard | Browser | ☐ |
| 3 | Admin Stats | curl | ☐ |
| 4 | Track Event | curl | ☐ |
| 5 | Tracking Stats | curl | ☐ |
| 6 | Admin Health | curl | ☐ |
| 7 | Public Config | curl | ☐ |
| 8 | Spotlight Pages | curl | ☐ |
| 9 | Affiliate Redirect | curl | ☐ |
