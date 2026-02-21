# Deployment & Debugging Checklist

## ✅ Implementiert / Implemented

### 1. Zentralisiertes Logging / Centralized Logging
- ✅ `netlify/functions/_lib/logger.js` (CommonJS) erstellt
- ✅ `netlify/functions/_lib/logger.mjs` (ES Modules) erstellt
- ✅ Strukturiertes JSON-Logging mit Request-ID
- ✅ Error Stack Traces in Logs
- ✅ Status-Codes und Timing-Informationen
- ✅ Funktionen aktualisiert:
  - `go.js` (Affiliate-Redirect)
  - `api-activity.js` (Activity API)
  - `activity.js` (Activity Stats)
  - `admin-list-leads.js` (Admin Lead List)
  - `newsletter_signup.js` (Newsletter Signup)
  - `health.js` (Health Check)

### 2. Health Endpoint / Health Check Endpoint
- ✅ `/admin/health` Endpoint implementiert
- ✅ Prüft Supabase-Verbindung
- ✅ Zeigt System-Status und Konfiguration
- ✅ In `netlify.toml` konfiguriert
- ✅ Gibt JSON mit detaillierten Checks zurück

### 3. Environment Variablen / Environment Variables
- ✅ `.env.example` mit allen Variablen erstellt
- ✅ Dokumentiert in `docs/DEPLOYMENT.md`
- ✅ Benötigte Variablen:
  - `SUPABASE_URL` (Pflicht / Required)
  - `SUPABASE_SERVICE_KEY` (Pflicht / Required)
  - `ADMIN_PASSWORD_HASH` (Pflicht / Required)
  - `ADMIN_ALLOWED_ORIGINS` (Optional)
  - `TIKTOK_PIXEL_ID` (Optional)
  - `RESEND_API_KEY` (Optional)

### 4. Dokumentation / Documentation
- ✅ `docs/DEPLOYMENT.md` erstellt mit:
  - ✅ Alle Environment-Variablen erklärt
  - ✅ Lokales Testen (Schritt-für-Schritt)
  - ✅ Production Testing (mit curl-Beispielen)
  - ✅ Deployment-Prozess (Netlify)
  - ✅ Rollout-Verfahren
  - ✅ Health-Monitoring
  - ✅ Troubleshooting
  - ✅ Checklisten (Pre/Post-Deployment)

### 5. Tests / Testing
- ✅ Manuelle Tests der Funktionen durchgeführt
- ✅ Health-Endpoint getestet
- ✅ Logging verifiziert
- ✅ Error-Handling geprüft

---

## 📋 Verwendung / Usage

### Lokales Testen / Local Testing

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. .env Datei erstellen
cp .env.example .env

# 3. Environment-Variablen setzen
# Editiere .env mit deinen Supabase-Credentials

# 4. Dev-Server starten
npx netlify dev

# 5. Health-Check testen
curl http://localhost:8888/admin/health | jq
```

### Production Testing

```bash
# Health Check
curl https://deine-seite.netlify.app/admin/health | jq

# Affiliate Redirect testen
curl -I https://deine-seite.netlify.app/go/psn-20

# Activity API testen
curl "https://deine-seite.netlify.app/api/activity?slug=psn-20" | jq
```

---

## 🔍 Log-Format / Log Format

Alle Funktionen loggen jetzt strukturiert:

```json
{
  "requestId": "abc123def456",
  "function": "go",
  "method": "GET",
  "path": "/go/psn-20",
  "timestamp": "2026-02-21T01:00:00.000Z",
  "level": "info",
  "message": "Processing affiliate redirect",
  "slug": "psn-20",
  "statusCode": 302,
  "durationMs": 15
}
```

Bei Errors:
```json
{
  "level": "error",
  "message": "Click insert failed",
  "error": {
    "message": "Connection failed",
    "name": "Error",
    "stack": "Error: Connection failed\n    at ...",
    "code": "ECONNREFUSED"
  }
}
```

---

## ⚙️ Netlify Environment Variables Setup

1. **Netlify Dashboard öffnen** → Site Settings → Environment Variables
2. **Folgende Variablen hinzufügen:**

   | Variable | Wert | Beschreibung |
   |----------|------|--------------|
   | `SUPABASE_URL` | `https://xxx.supabase.co` | Deine Supabase Project URL |
   | `SUPABASE_SERVICE_KEY` | `eyJhbG...` | Service Role Key (nicht anon key!) |
   | `ADMIN_PASSWORD_HASH` | `$2a$12...` | Mit `node scripts/hash-password.js "pass"` generieren |

3. **Optional:**
   - `ADMIN_ALLOWED_ORIGINS` (für zusätzliche CORS-Origins)
   - `TIKTOK_PIXEL_ID` (für Tracking)
   - `RESEND_API_KEY` (für Newsletter-Emails)

4. **Deploy auslösen** nach dem Setzen der Variablen

---

## 🚀 Deployment Workflow

1. **Lokal testen:**
   ```bash
   npx netlify dev
   # Tests durchführen
   ```

2. **Committen & Pushen:**
   ```bash
   git add .
   git commit -m "Feature: Description"
   git push origin main
   ```

3. **Netlify deployed automatisch**

4. **Nach Deploy prüfen:**
   ```bash
   # Health Check
   curl https://deine-seite.netlify.app/admin/health
   
   # Logs in Netlify Dashboard überprüfen
   # Dashboard → Functions → [Function Name] → Recent logs
   ```

---

## 🔧 Troubleshooting

### Problem: Health check returns "unhealthy"
**Lösung:** Prüfe Supabase-Credentials in Netlify Environment Variables

### Problem: "Supabase missing env: SUPABASE_URL"
**Lösung:** Setze `SUPABASE_URL` in Netlify und redeploy

### Problem: Funktionen loggen nicht
**Lösung:** 
1. Prüfe Netlify Function Logs im Dashboard
2. Suche nach `requestId` in den Logs
3. Alle strukturierten Logs sollten als JSON erscheinen

### Problem: CORS-Fehler
**Lösung:** Füge deine Domain zu `ADMIN_ALLOWED_ORIGINS` hinzu

---

## 📊 Monitoring

### Health-Endpoint verwenden:
```bash
# Manuell prüfen
curl https://deine-seite.netlify.app/admin/health

# Automatisches Monitoring (z.B. mit cron)
*/5 * * * * curl -s https://deine-seite.netlify.app/admin/health | jq -r '.status'
```

### Empfohlene Monitoring-Services:
- **UptimeRobot** (kostenlos, 5-Min-Intervall)
- **Pingdom** (erweiterte Features)
- **StatusCake** (kostenloser Tier verfügbar)

**Konfiguration:**
- URL: `https://deine-seite.netlify.app/admin/health`
- Intervall: 5 Minuten
- Alert bei: Status != 200 oder `"status": "unhealthy"`

---

## 📝 Pre-Deployment Checklist

- [ ] Alle Environment-Variablen in Netlify gesetzt
- [ ] `SUPABASE_URL` korrekt
- [ ] `SUPABASE_SERVICE_KEY` ist der **service role** key
- [ ] `ADMIN_PASSWORD_HASH` generiert und gesetzt
- [ ] Lokal getestet (`netlify dev`)
- [ ] Health-Endpoint lokal getestet
- [ ] Keine `.env` im Git committed
- [ ] Dokumentation aktualisiert

## 📝 Post-Deployment Checklist

- [ ] Health-Endpoint gibt "healthy" zurück
- [ ] Affiliate-Redirects funktionieren
- [ ] Activity-API liefert Daten
- [ ] Admin-Dashboard lädt
- [ ] Keine Errors in Netlify Function Logs
- [ ] Supabase-Verbindung funktioniert
- [ ] CORS-Headers vorhanden
- [ ] Security-Headers vorhanden

---

## 📞 Support

Bei Problemen:
1. Prüfe Netlify Function Logs
2. Prüfe Supabase Logs
3. Suche nach `requestId` in den Logs für vollständige Request-Traces
4. Siehe `docs/DEPLOYMENT.md` für detaillierte Troubleshooting-Schritte
