# DropCharge - Implementierungsplan: Campaign System

**Status:** ❌ NICHT IMPLEMENTIERT  
**Priorität:** MITTEL (Optional für MVP)  
**Geschätzter Aufwand:** 8-12 Stunden  
**Betroffene Dateien:** 4 neue Netlify Functions + 3 JavaScript Functions

---

## Übersicht

Das Campaign System ist im UI vollständig vorhanden, aber alle Backend-Funktionen fehlen. Admin sieht einen kompletten "Campaigns" Tab, aber alle Buttons werfen Errors.

---

## Aktuelle Situation

### ✅ Was existiert

**UI (vollständig):**
- Campaign Form (`/admin.html` Zeilen 236-244)
  - Subject Input
  - Segment Input (optional)
  - HTML Content Textarea
  - Test Email Input
  - "Test senden" Button
  - "An alle senden" Submit Button
- Campaign Preview (Live HTML Preview funktioniert)
- Campaign Log (Liste der gesendeten Kampagnen)

**Datenbank (vollständig):**
```sql
✅ newsletter_subscribers
   (email, status, source, utm_*, last_sent_at)
   
✅ newsletter_campaigns
   (id, subject, body_html, status, total_recipients, sent_count, started_at, completed_at)
   
✅ newsletter_sends
   (campaign_id, subscriber_id, email, status, sent_at, error)
```

**API Endpoints (deklariert aber nicht existent):**
```javascript
// In /assets/admin.js definiert aber Files fehlen:
campaigns: `${API_BASE}/.netlify/functions/admin-campaigns`
campaignSend: `${API_BASE}/.netlify/functions/admin-campaign-send`
campaignCreate: `${API_BASE}/.netlify/functions/admin-campaign-create`
campaignTest: `${API_BASE}/.netlify/functions/admin-campaign-test`
```

### ❌ Was fehlt

**Backend Functions (4 Dateien):**
1. `/netlify/functions/admin-campaigns.js` → GET: Liste aller Kampagnen
2. `/netlify/functions/admin-campaign-create.js` → POST: Erstelle Kampagne
3. `/netlify/functions/admin-campaign-send.js` → POST: Sende Kampagne
4. `/netlify/functions/admin-campaign-test.js` → POST: Test-Email

**Frontend Functions (3 Functions in `/assets/admin.js`):**
1. `submitCampaign(event)` → Form Submit Handler
2. `sendCampaignTest(event)` → Test Button Handler
3. `loadCampaignLog()` → Lade Campaign Historie

---

## 5-Schritte Implementierungsplan

### Schritt 1: Campaign List API (1-2h)

**Datei:** `/netlify/functions/admin-campaigns.js`

**Funktionalität:**
- GET: Liste aller Kampagnen (neueste zuerst)
- Optionale Query Params: `limit`, `offset`, `status`

**Pseudocode:**
```javascript
exports.handler = async (event) => {
  // 1. Validate admin token
  const authError = requireAdmin(event.headers);
  if (authError) return authError;
  
  // 2. Parse query params
  const limit = parseInt(event.queryStringParameters?.limit) || 10;
  const status = event.queryStringParameters?.status;
  
  // 3. Query Supabase
  let query = supabase
    .from('newsletter_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (status) query = query.eq('status', status);
  
  const { data, error } = await query;
  if (error) return { statusCode: 500, body: JSON.stringify({ error }) };
  
  // 4. Return campaigns
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, campaigns: data, total: data.length })
  };
};
```

**Dependencies:**
- `_lib/supabase.js` ✅ exists
- `_lib/admin-token.js` ✅ exists
- `_lib/cors.js` ✅ exists

**Testing:**
```bash
curl -H "x-admin-token: YOUR_TOKEN" \
  https://dropcharge.netlify.app/.netlify/functions/admin-campaigns
```

---

### Schritt 2: Campaign Create API (1-2h)

**Datei:** `/netlify/functions/admin-campaign-create.js`

**Funktionalität:**
- POST: Erstelle neue Kampagne im Status "draft"
- Zähle passende Subscribers

**Pseudocode:**
```javascript
exports.handler = async (event) => {
  // 1. Auth check
  const authError = requireAdmin(event.headers);
  if (authError) return authError;
  
  // 2. Parse body
  const { subject, body_html, segment } = JSON.parse(event.body);
  if (!subject || !body_html) {
    return { statusCode: 400, body: JSON.stringify({ error: 'subject and body_html required' }) };
  }
  
  // 3. Count matching subscribers
  let query = supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  
  if (segment) query = query.eq('source', segment);
  
  const { count, error: countError } = await query;
  if (countError) return { statusCode: 500, body: JSON.stringify({ error: countError }) };
  
  // 4. Create campaign
  const { data: campaign, error } = await supabase
    .from('newsletter_campaigns')
    .insert({
      subject,
      body_html,
      segment,
      status: 'draft',
      total_recipients: count || 0
    })
    .select()
    .single();
  
  if (error) return { statusCode: 500, body: JSON.stringify({ error }) };
  
  // 5. Return campaign
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, campaign_id: campaign.id, total_recipients: count })
  };
};
```

**Testing:**
```bash
curl -X POST -H "x-admin-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body_html":"<h1>Hi</h1>","segment":"popup"}' \
  https://dropcharge.netlify.app/.netlify/functions/admin-campaign-create
```

---

### Schritt 3: Campaign Test Email API (1h)

**Datei:** `/netlify/functions/admin-campaign-test.js`

**Funktionalität:**
- POST: Sende Test-Email via Resend API
- Keine DB-Einträge, nur Email senden

**Pseudocode:**
```javascript
const { Resend } = require('resend');

exports.handler = async (event) => {
  // 1. Auth check
  const authError = requireAdmin(event.headers);
  if (authError) return authError;
  
  // 2. Check Resend API key
  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY not configured' }) };
  }
  
  // 3. Parse body
  const { subject, body_html, test_email } = JSON.parse(event.body);
  if (!subject || !body_html || !test_email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }
  
  // 4. Send via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const result = await resend.emails.send({
      from: 'DropCharge <no-reply@dropcharge.gg>',
      to: test_email,
      subject: `[TEST] ${subject}`,
      html: body_html
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message_id: result.id })
    };
  } catch (error) {
    console.error('Resend error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Dependencies:**
- `resend` npm package ✅ (needs to be installed)

**Installation:**
```bash
npm install resend --save
```

**Testing:**
```bash
curl -X POST -H "x-admin-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body_html":"<h1>Hi</h1>","test_email":"admin@example.com"}' \
  https://dropcharge.netlify.app/.netlify/functions/admin-campaign-test
```

---

### Schritt 4: Campaign Send API (3-4h)

**Datei:** `/netlify/functions/admin-campaign-send.js`

**Funktionalität:**
- POST: Sende Kampagne an alle passenden Subscribers
- Batch-Processing (nicht blockierend)
- Update Campaign Status & Counts

**Pseudocode:**
```javascript
const { Resend } = require('resend');

exports.handler = async (event) => {
  // 1. Auth check
  const authError = requireAdmin(event.headers);
  if (authError) return authError;
  
  // 2. Check Resend API key
  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY not configured' }) };
  }
  
  // 3. Parse body
  const { campaign_id } = JSON.parse(event.body);
  if (!campaign_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'campaign_id required' }) };
  }
  
  // 4. Load campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('newsletter_campaigns')
    .select('*')
    .eq('id', campaign_id)
    .single();
  
  if (campaignError || !campaign) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Campaign not found' }) };
  }
  
  if (campaign.status === 'sent') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campaign already sent' }) };
  }
  
  // 5. Fetch subscribers
  let query = supabase
    .from('newsletter_subscribers')
    .select('*')
    .eq('status', 'active');
  
  if (campaign.segment) query = query.eq('source', campaign.segment);
  
  const { data: subscribers, error: subsError } = await query;
  if (subsError) {
    return { statusCode: 500, body: JSON.stringify({ error: subsError }) };
  }
  
  if (!subscribers.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No active subscribers' }) };
  }
  
  // 6. Update campaign status to "sending"
  await supabase
    .from('newsletter_campaigns')
    .update({ status: 'sending', started_at: new Date().toISOString() })
    .eq('id', campaign_id);
  
  // 7. Create newsletter_sends entries
  const sends = subscribers.map(sub => ({
    campaign_id,
    subscriber_id: sub.id,
    email: sub.email,
    status: 'queued',
    queued_at: new Date().toISOString()
  }));
  
  await supabase.from('newsletter_sends').insert(sends);
  
  // 8. Send emails (batched)
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  
  for (const sub of subscribers) {
    try {
      await resend.emails.send({
        from: 'DropCharge <no-reply@dropcharge.gg>',
        to: sub.email,
        subject: campaign.subject,
        html: campaign.body_html
      });
      
      // Update send status
      await supabase
        .from('newsletter_sends')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('campaign_id', campaign_id)
        .eq('email', sub.email);
      
      // Update subscriber last_sent_at
      await supabase
        .from('newsletter_subscribers')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', sub.id);
      
      sent++;
    } catch (error) {
      console.error(`Failed to send to ${sub.email}:`, error);
      
      await supabase
        .from('newsletter_sends')
        .update({ status: 'failed', error: error.message })
        .eq('campaign_id', campaign_id)
        .eq('email', sub.email);
      
      failed++;
    }
  }
  
  // 9. Update campaign final status
  await supabase
    .from('newsletter_campaigns')
    .update({
      status: 'sent',
      sent_count: sent,
      failed_count: failed,
      completed_at: new Date().toISOString()
    })
    .eq('id', campaign_id);
  
  // 10. Return summary
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      sent,
      failed,
      total: subscribers.length
    })
  };
};
```

**⚠️ Optimization Notes:**
- Current implementation is synchronous (blocks for all emails)
- For large lists (>100), consider:
  - Background job queue (e.g., Netlify Background Functions)
  - Batch sending (send 50 at a time, return immediately)
  - Webhook for completion notification

**Testing:**
```bash
# 1. Create campaign
CAMPAIGN_ID=$(curl -X POST -H "x-admin-token: TOKEN" \
  -d '{"subject":"Test","body_html":"<h1>Hi</h1>"}' \
  https://dropcharge.netlify.app/.netlify/functions/admin-campaign-create \
  | jq -r '.campaign_id')

# 2. Send campaign
curl -X POST -H "x-admin-token: TOKEN" \
  -d "{\"campaign_id\":\"$CAMPAIGN_ID\"}" \
  https://dropcharge.netlify.app/.netlify/functions/admin-campaign-send
```

---

### Schritt 5: Frontend Functions (1-2h)

**Datei:** `/assets/admin.js`

**Zeile ~1200+ (nach loadCampaigns):**

```javascript
// Campaign Form Submit Handler
async function submitCampaign(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Wird gesendet...';
  
  try {
    const formData = new FormData(dom.campaignForm);
    const payload = {
      subject: formData.get('subject'),
      body_html: formData.get('html'),
      segment: formData.get('segment') || null
    };
    
    // 1. Create campaign
    const createRes = await fetch(API.campaignCreate, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': getToken()
      },
      body: JSON.stringify(payload)
    });
    
    if (!createRes.ok) {
      const error = await createRes.json();
      throw new Error(error.error || 'Failed to create campaign');
    }
    
    const { campaign_id, total_recipients } = await createRes.json();
    
    // 2. Confirm send
    const confirmed = confirm(
      `Kampagne an ${total_recipients} Subscriber senden?`
    );
    if (!confirmed) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'An alle senden';
      return;
    }
    
    // 3. Send campaign
    const sendRes = await fetch(API.campaignSend, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': getToken()
      },
      body: JSON.stringify({ campaign_id })
    });
    
    if (!sendRes.ok) {
      const error = await sendRes.json();
      throw new Error(error.error || 'Failed to send campaign');
    }
    
    const result = await sendRes.json();
    
    // 4. Success feedback
    showToast(
      `✅ Kampagne gesendet! ${result.sent} erfolgreich, ${result.failed} fehlgeschlagen.`,
      'success'
    );
    
    // 5. Reset form & reload log
    dom.campaignForm.reset();
    loadCampaignLog();
    
  } catch (error) {
    console.error('submitCampaign error:', error);
    showToast(`❌ Fehler: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'An alle senden';
  }
}

// Test Email Handler
async function sendCampaignTest(event) {
  event.preventDefault();
  const testBtn = event.currentTarget;
  testBtn.disabled = true;
  testBtn.textContent = 'Wird gesendet...';
  
  try {
    const formData = new FormData(dom.campaignForm);
    const testEmail = formData.get('testEmail');
    
    if (!testEmail) {
      showToast('⚠️ Bitte Test-Email eingeben', 'warning');
      return;
    }
    
    const payload = {
      subject: formData.get('subject'),
      body_html: formData.get('html'),
      test_email: testEmail
    };
    
    const res = await fetch(API.campaignTest, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': getToken()
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Test email failed');
    }
    
    const result = await res.json();
    showToast(`✅ Test-Email gesendet an ${testEmail}`, 'success');
    
  } catch (error) {
    console.error('sendCampaignTest error:', error);
    showToast(`❌ Fehler: ${error.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test senden';
  }
}

// Load Campaign History
async function loadCampaignLog({ silent = false } = {}) {
  try {
    const res = await fetch(`${API.campaigns}?limit=10`, {
      headers: { 'x-admin-token': getToken() }
    });
    
    if (!res.ok) {
      throw new Error('Failed to load campaigns');
    }
    
    const data = await res.json();
    renderCampaignLog(data.campaigns || []);
    
  } catch (error) {
    console.error('loadCampaignLog error:', error);
    if (!silent) {
      showToast('❌ Kampagnen laden fehlgeschlagen', 'error');
    }
  }
}

// Render Campaign Log
function renderCampaignLog(campaigns) {
  if (!campaigns.length) {
    dom.campaignLog.innerHTML = '<p class="empty">Noch keine Kampagnen gesendet.</p>';
    return;
  }
  
  const html = campaigns.map(c => `
    <div class="campaign-log-item">
      <div class="campaign-log-header">
        <strong>${escapeHtml(c.subject)}</strong>
        <span class="badge ${c.status}">${c.status}</span>
      </div>
      <div class="campaign-log-meta">
        <span>📧 ${c.sent_count || 0}/${c.total_recipients || 0} gesendet</span>
        ${c.failed_count ? `<span class="error">❌ ${c.failed_count} fehlgeschlagen</span>` : ''}
        ${c.segment ? `<span>📊 Segment: ${c.segment}</span>` : ''}
        <span>🕐 ${new Date(c.created_at).toLocaleString('de-DE')}</span>
      </div>
    </div>
  `).join('');
  
  dom.campaignLog.innerHTML = html;
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add to initialization (line ~1600)
// Already exists but ensure these are uncommented:
// dom.campaignForm.addEventListener('submit', submitCampaign);
// dom.campaignTest.addEventListener('click', sendCampaignTest);
// dom.campaignLogRefresh.addEventListener('click', () => loadCampaignLog());
```

**Zeile ~22-27 (API Endpoints hinzufügen):**

```javascript
const API = {
  // ... existing endpoints ...
  campaigns: `${API_BASE}/.netlify/functions/admin-campaigns`,
  campaignCreate: `${API_BASE}/.netlify/functions/admin-campaign-create`,
  campaignSend: `${API_BASE}/.netlify/functions/admin-campaign-send`,
  campaignTest: `${API_BASE}/.netlify/functions/admin-campaign-test`,  // Neu hinzufügen
  // ... rest ...
};
```

---

## Deployment Checklist

### 1. Environment Variables

```bash
# Netlify Dashboard → Site Settings → Environment Variables
RESEND_API_KEY=re_...        # Erforderlich für Email-Versand
SUPABASE_URL=https://...     # Bereits vorhanden
SUPABASE_SERVICE_KEY=...     # Bereits vorhanden
```

### 2. Dependencies

```bash
# Install Resend package
npm install resend --save

# Commit package.json
git add package.json package-lock.json
git commit -m "Add resend dependency for campaign system"
```

### 3. Create Backend Files

```bash
# Create all 4 Netlify functions
touch netlify/functions/admin-campaigns.js
touch netlify/functions/admin-campaign-create.js
touch netlify/functions/admin-campaign-send.js
touch netlify/functions/admin-campaign-test.js

# Copy code from this document into each file
```

### 4. Update Frontend

```bash
# Edit /assets/admin.js
# - Add 3 functions (submitCampaign, sendCampaignTest, loadCampaignLog)
# - Add 1 helper function (renderCampaignLog)
# - Update API object (add campaignTest endpoint)
# - Verify event listeners are registered
```

### 5. Test Locally

```bash
# Start dev server
npx netlify dev

# Navigate to http://localhost:8888/admin.html
# - Login with admin token
# - Go to "Campaigns" tab
# - Create test campaign
# - Send test email
# - Send to 1 real subscriber (yourself)
```

### 6. Deploy to Production

```bash
git add .
git commit -m "Implement campaign system: 4 APIs + frontend handlers"
git push origin main

# Netlify auto-deploys
# Verify in production
```

---

## Testing Scenarios

### Scenario 1: Test Email

1. Admin öffnet Campaigns Tab
2. Füllt Form aus:
   - Subject: "Test Newsletter"
   - HTML: `<h1>Hallo!</h1><p>Das ist ein Test.</p>`
   - Test Email: `admin@example.com`
3. Klickt "Test senden"
4. **Erwartung:** Email kommt an `admin@example.com` mit Prefix "[TEST]"

### Scenario 2: Campaign an 1 Subscriber

1. Erstelle Test-Subscriber in DB:
   ```sql
   INSERT INTO newsletter_subscribers (email, status, source)
   VALUES ('test@example.com', 'active', 'manual');
   ```
2. Admin füllt Campaign Form aus
3. Klickt "An alle senden"
4. Bestätigt Popup: "Kampagne an 1 Subscriber senden?"
5. **Erwartung:**
   - Email kommt an
   - Campaign Log zeigt: "1/1 gesendet"
   - newsletter_campaigns hat Eintrag mit status='sent'

### Scenario 3: Segment Filter

1. Erstelle 2 Subscriber:
   ```sql
   INSERT INTO newsletter_subscribers (email, status, source)
   VALUES
     ('tiktok@example.com', 'active', 'tiktok'),
     ('popup@example.com', 'active', 'popup');
   ```
2. Admin erstellt Campaign mit Segment: "tiktok"
3. Sendet Kampagne
4. **Erwartung:** Nur `tiktok@example.com` erhält Email

---

## Fehlerbehandlung

### Fall 1: Resend API Key fehlt

**Symptom:** 500 Error beim Test-Email senden

**Fix:**
```bash
# Netlify Dashboard
RESEND_API_KEY=re_YOUR_KEY_HERE
```

### Fall 2: Keine Active Subscribers

**Symptom:** 400 Error "No active subscribers"

**Fix:** Prüfe Supabase:
```sql
SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'active';
```

Falls 0: Erstelle Test-Subscriber oder ändere Newsletter Popup Code.

### Fall 3: Campaign already sent

**Symptom:** 400 Error "Campaign already sent"

**Reason:** Campaign status ist bereits 'sent'

**Fix:** Campaign ist bereits versendet. Erstelle neue Kampagne für erneuten Versand.

---

## Optionale Erweiterungen

### 1. Background Processing (Netlify Background Functions)

Für große Listen (>100 Subscriber) sollte Campaign Send nicht blockieren:

```javascript
// netlify/functions/admin-campaign-send-background.js
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Same logic as admin-campaign-send.js but:
  // - Return immediately after starting send
  // - Update campaign status incrementally
  // - Use webhook for completion
};
```

### 2. Email Templates

Statt Raw HTML, Template System mit Variablen:

```html
<h1>Hallo {{subscriber.name}}!</h1>
<p>Unser aktueller Deal: {{deal.title}}</p>
<a href="{{deal.url}}">Zum Deal</a>
```

### 3. A/B Testing für Subject Lines

Split Campaign in 2 Gruppen mit unterschiedlichen Subjects:

```javascript
{
  subject_a: "Deal Alert!",
  subject_b: "Exklusiv: 20% Rabatt",
  traffic_split: 0.5
}
```

---

## Zusammenfassung

**Gesamtaufwand:** 8-12 Stunden

| Aufgabe | Zeitaufwand | Dateien |
|---------|-------------|---------|
| Campaign List API | 1-2h | `admin-campaigns.js` |
| Campaign Create API | 1-2h | `admin-campaign-create.js` |
| Campaign Test API | 1h | `admin-campaign-test.js` |
| Campaign Send API | 3-4h | `admin-campaign-send.js` |
| Frontend Functions | 1-2h | `admin.js` (3 functions) |
| Testing & Debugging | 1-2h | — |

**Launch-Ready Status:**
- ❌ Campaign System → Optional
- ✅ Deals CRUD → Fertig
- ✅ Newsletter Signup → Fertig
- ✅ Basic Analytics → Fertig

**Empfehlung:** Implementiere nur wenn Email Marketing für MVP erforderlich. Alternativ: Nutze externe Newsletter-Tools (Mailchimp, ConvertKit) und importiere Leads via CSV Export.

---

**Ende des Implementierungsplans**
