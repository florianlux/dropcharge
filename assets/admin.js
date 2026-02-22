/* ===== DropCharge Admin V2 ===== */

// ── Config ─────────────────────────────────────────────
const API_BASE = window.location.origin.replace(/\/$/, '');
const TOKEN_KEY = 'admin_token';

// ── Auth ───────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

(function checkAuth() {
  if (!getToken()) {
    window.location.href = '/admin-login.html';
  }
})();

// ── API helpers ────────────────────────────────────────
async function api(path, options = {}) {
  const url = `${API_BASE}/.netlify/functions/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-token': getToken(),
    ...(options.headers || {})
  };
  try {
    const res = await fetch(url, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = body.error || `HTTP ${res.status}`;
      const detail = body.details ? `: ${body.details}` : '';
      throw new Error(`${errMsg}${detail}`);
    }
    return body;
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    throw err;
  }
}

function apiGet(path) {
  return api(path, { method: 'GET' });
}

function apiPost(path, data) {
  return api(path, { method: 'POST', body: JSON.stringify(data) });
}

// Silent GET — no error toast on failure; returns null instead
async function apiGetSilent(path) {
  const url = `${API_BASE}/.netlify/functions/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-token': getToken()
  };
  try {
    const res = await fetch(url, { method: 'GET', headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return body;
  } catch {
    return null;
  }
}

// ── Toast ──────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(message, type = 'success') {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = 'toast visible' + (type === 'error' ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3500);
}

// ── DOM refs ───────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Tab navigation ─────────────────────────────────────
function initTabs() {
  const links = $$('.nav-link');
  const panels = $$('.tab-panel');
  links.forEach(link => {
    link.addEventListener('click', () => {
      const tab = link.dataset.tab;
      links.forEach(l => l.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      link.classList.add('active');
      const panel = $(`[data-panel="${tab}"]`);
      if (panel) panel.classList.add('active');
      onTabActivate(tab);
    });
  });
}

function onTabActivate(tab) {
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'newsletter') loadSubscribers();
  if (tab === 'email') loadEmailTab();
  if (tab === 'drops') loadDrops();
  if (tab === 'spotlight') loadSpotlights();
  if (tab === 'analytics') loadAnalytics();
}

// ── Logout ─────────────────────────────────────────────
function initLogout() {
  const btn = $('#admin-logout');
  if (btn) {
    btn.addEventListener('click', () => {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin-login.html';
    });
  }
}

// ── Dashboard Overview ─────────────────────────────────
async function loadDashboard() {
  try {
    const [subData, analyticsData] = await Promise.all([
      apiGet('admin-list-subscribers?limit=1&status=all').catch(() => null),
      apiGet('admin-analytics').catch(() => null)
    ]);
    // Subscriber counts
    if (subData) {
      const totalEl = $('#stat-total-subscribers');
      if (totalEl) totalEl.textContent = subData.total ?? '–';
    }
    // Active count
    try {
      const activeData = await apiGet('admin-list-subscribers?limit=1&status=active');
      const el = $('#stat-active-subscribers');
      if (el) el.textContent = activeData.total ?? '–';
    } catch { /* ignore */ }
    // Unsubscribed count
    try {
      const unsubData = await apiGet('admin-list-subscribers?limit=1&status=unsubscribed');
      const el = $('#stat-unsubscribed');
      if (el) el.textContent = unsubData.total ?? '–';
    } catch { /* ignore */ }
    // Analytics stats
    if (analyticsData) {
      const c24 = $('#stat-clicks-24h');
      const e24 = $('#stat-events-24h');
      if (c24) c24.textContent = analyticsData.clicks_24h ?? '–';
      if (e24) e24.textContent = analyticsData.events_24h ?? '–';
    }
  } catch { /* errors shown via toast */ }
}

// ── Newsletter Manager ─────────────────────────────────
async function loadSubscribers() {
  const search = ($('#subscriber-search') || {}).value || '';
  const status = ($('#subscriber-status-filter') || {}).value || 'active';
  const rows = $('#subscriber-rows');
  if (!rows) return;
  rows.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const params = new URLSearchParams({ limit: '50', status });
    if (search) params.set('search', search);
    const data = await apiGet(`admin-list-subscribers?${params}`);
    if (!data.items || data.items.length === 0) {
      rows.innerHTML = '<p class="empty">No subscribers found.</p>';
      return;
    }
    rows.innerHTML = data.items.map(s => {
      const statusClass = s.status === 'active' ? 'status-active'
        : s.status === 'unsubscribed' ? 'status-unsubscribed'
        : s.status === 'bounced' ? 'status-bounced' : '';
      const created = s.created_at ? new Date(s.created_at).toLocaleDateString() : '–';
      const source = s.source || '–';
      const prize = s.prize || (s.meta && s.meta.prize) || '–';
      return `<div class="table-row">
        <span>${escapeHtml(s.email)}</span>
        <span class="${statusClass}">${escapeHtml(s.status || 'unknown')}</span>
        <span>${escapeHtml(source)}</span>
        <span>${escapeHtml(prize)}</span>
        <span>${created}</span>
      </div>`;
    }).join('');
  } catch {
    rows.innerHTML = '<p class="empty">Failed to load subscribers.</p>';
  }
}

function initNewsletter() {
  const loadBtn = $('#subscriber-load');
  if (loadBtn) loadBtn.addEventListener('click', loadSubscribers);
  const searchInput = $('#subscriber-search');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); loadSubscribers(); }
    });
  }
  const statusFilter = $('#subscriber-status-filter');
  if (statusFilter) statusFilter.addEventListener('change', loadSubscribers);
  const exportBtn = $('#newsletter-export');
  if (exportBtn) exportBtn.addEventListener('click', exportSubscribers);
}

async function exportSubscribers() {
  try {
    const data = await apiGet('admin-list-subscribers?limit=200&status=all');
    if (!data.items || data.items.length === 0) {
      showToast('No subscribers to export.', 'error');
      return;
    }
    const header = 'email,status,source,prize,created_at';
    const csvRows = data.items.map(s =>
      `${csvEscape(s.email)},${csvEscape(s.status)},${csvEscape(s.source || '')},${csvEscape(s.prize || (s.meta && s.meta.prize) || '')},${csvEscape(s.created_at)}`
    );
    const csv = [header, ...csvRows].join('\n');
    downloadCsv(csv, 'subscribers.csv');
    showToast(`Exported ${data.items.length} subscribers.`);
  } catch { /* toast shown by api() */ }
}

// ── Campaign Composer ──────────────────────────────────
function initCampaigns() {
  const form = $('#campaign-form');
  const testBtn = $('#campaign-test');
  const segmentSelect = $('#campaign-segment');
  const sendBtn = $('#campaign-send');

  if (segmentSelect && sendBtn) {
    segmentSelect.addEventListener('change', () => {
      const label = segmentSelect.options[segmentSelect.selectedIndex].text;
      sendBtn.textContent = `Send to ${label}`;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const subject = fd.get('subject');
      const html = fd.get('html');
      const segment = fd.get('segment') || undefined;
      if (!subject || !html) { showToast('Subject and HTML required.', 'error'); return; }
      const segmentLabel = segmentSelect ? segmentSelect.options[segmentSelect.selectedIndex].text : 'All Active';
      if (!confirm(`Send campaign to "${segmentLabel}"?`)) return;
      try {
        const result = await apiPost('admin-send-campaign', { subject, html, segment });
        if (result.warning) {
          showToast(`Campaign sent (${result.sent || 0} delivered). Warning: ${result.details || result.warning}`);
        } else {
          showToast(`Campaign sent! ${result.sent || 0} delivered.`);
        }
        logEvent('campaign_sent', { subject, segment });
      } catch (err) {
        // api() already shows error toast with details
      }
    });
  }
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      if (!form) return;
      const fd = new FormData(form);
      const subject = fd.get('subject');
      const html = fd.get('html');
      const testEmail = fd.get('testEmail');
      const segment = fd.get('segment') || undefined;
      if (!subject || !html) { showToast('Subject and HTML required.', 'error'); return; }
      if (!testEmail) { showToast('Enter a test email address.', 'error'); return; }
      try {
        const result = await apiPost('admin-send-campaign', { subject, html, testEmail, segment });
        if (result.warning) {
          showToast(`Test email sent to ${testEmail}. Warning: ${result.details || result.warning}`);
        } else {
          showToast(`Test email sent to ${testEmail}.`);
        }
      } catch (err) {
        // api() already shows error toast with details
      }
    });
  }
}

// ── Email Hub ──────────────────────────────────────────
let _currentPreviewHtml = '';
let _currentPreviewKey = '';

async function loadEmailTab() {
  loadEmailAudience();
  loadEmailTemplates();
  loadEmailLogs();
}

async function loadEmailAudience() {
  try {
    const [activeData, unsubData] = await Promise.all([
      apiGet('admin-list-subscribers?limit=1&status=active').catch(() => null),
      apiGet('admin-list-subscribers?limit=1&status=unsubscribed').catch(() => null)
    ]);
    // Logs stats are fetched silently — failures do not trigger error toast
    const [sentData, failedData] = await Promise.all([
      apiGetSilent('admin-email-logs?limit=1&status=sent'),
      apiGetSilent('admin-email-logs?limit=1&status=failed')
    ]);
    const setVal = (id, data) => {
      const el = $(`#${id}`);
      if (el && data) el.textContent = data.total ?? '–';
    };
    setVal('email-stat-active', activeData);
    setVal('email-stat-unsub', unsubData);
    setVal('email-stat-sent', sentData);
    setVal('email-stat-failed', failedData);
  } catch { /* errors shown via toast */ }
}

async function loadEmailTemplates() {
  const container = $('#email-templates-list');
  if (!container) return;
  try {
    const data = await apiGet('admin-email-templates');
    if (!data.templates || data.templates.length === 0) {
      container.innerHTML = '<p class="empty">No templates found.</p>';
      return;
    }
    container.innerHTML = data.templates.map(tpl =>
      `<div class="template-card" data-template="${escapeHtml(tpl.key)}">
        <strong>${escapeHtml(tpl.name)}</strong>
        <p class="template-desc">${escapeHtml(tpl.description)}</p>
        <div class="template-actions">
          <button class="btn mini primary" data-preview="${escapeHtml(tpl.key)}">Preview</button>
          <button class="btn mini ghost" data-copy="${escapeHtml(tpl.key)}">Copy HTML</button>
          <button class="btn mini ghost" data-download="${escapeHtml(tpl.key)}">Download</button>
        </div>
      </div>`
    ).join('');
    container.querySelectorAll('[data-preview]').forEach(btn => {
      btn.addEventListener('click', () => previewTemplate(btn.dataset.preview));
    });
    container.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copyTemplateHtml(btn.dataset.copy));
    });
    container.querySelectorAll('[data-download]').forEach(btn => {
      btn.addEventListener('click', () => downloadTemplateHtml(btn.dataset.download));
    });
  } catch {
    container.innerHTML = '<p class="empty">Failed to load templates.</p>';
  }
}

async function previewTemplate(key) {
  const card = $('#email-template-preview-card');
  const nameEl = $('#email-preview-name');
  const frame = $('#email-preview-frame');
  if (!card || !frame) return;
  try {
    const data = await apiPost('admin-email-templates', { template: key });
    if (nameEl) nameEl.textContent = key;
    _currentPreviewHtml = data.html || '';
    _currentPreviewKey = key;
    card.style.display = 'block';
    frame.srcdoc = data.html;
  } catch { /* toast shown */ }
}

async function fetchTemplateHtml(key) {
  if (_currentPreviewKey === key && _currentPreviewHtml) return _currentPreviewHtml;
  const data = await apiPost('admin-email-templates', { template: key });
  return data.html || '';
}

async function copyTemplateHtml(key) {
  try {
    const html = await fetchTemplateHtml(key);
    if (!html) { showToast('No HTML to copy.', 'error'); return; }
    await navigator.clipboard.writeText(html);
    showToast('HTML copied to clipboard!');
  } catch { showToast('Copy failed.', 'error'); }
}

async function downloadTemplateHtml(key) {
  try {
    const html = await fetchTemplateHtml(key);
    if (!html) { showToast('No HTML to download.', 'error'); return; }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${key}.html`);
  } catch { showToast('Download failed.', 'error'); }
}

async function loadEmailLogs() {
  const rows = $('#email-log-rows');
  if (!rows) return;
  rows.innerHTML = '<p class="empty">Loading…</p>';
  const status = ($('#email-log-status-filter') || {}).value || '';
  try {
    const params = new URLSearchParams({ limit: '50' });
    if (status) params.set('status', status);
    const url = `${API_BASE}/.netlify/functions/admin-email-logs?${params}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-admin-token': getToken()
    };
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 401) {
      rows.innerHTML = '<p class="empty warning">Unauthorized (admin token missing/invalid).</p>';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status >= 500) {
      rows.innerHTML = `<p class="empty warning">Server error: ${escapeHtml(data.error || 'unknown')}</p>`;
      return;
    }
    if (!data || !data.ok) {
      if (data && data.error === 'email_logs_missing') {
        rows.innerHTML = `<p class="empty warning">Table missing. ${escapeHtml(data.hint || 'Run migration 004_email_logs.sql.')}</p>`;
        return;
      }
      rows.innerHTML = '<p class="empty warning">Logs unavailable. Check connection or run migration.</p>';
      return;
    }
    if (!data.items || data.items.length === 0) {
      rows.innerHTML = '<p class="empty">No logs yet.</p>';
      return;
    }
    rows.innerHTML = data.items.map(log => {
      const time = log.created_at ? new Date(log.created_at).toLocaleString() : '–';
      const statusClass = log.status === 'sent' ? 'status-active' : log.status === 'failed' ? 'status-bounced' : '';
      return `<div class="table-row">
        <span>${escapeHtml(log.recipient)}</span>
        <span>${escapeHtml(log.template || '–')}</span>
        <span>${escapeHtml(log.subject || '–')}</span>
        <span class="${statusClass}">${escapeHtml(log.status || '–')}</span>
        <span>${time}</span>
      </div>`;
    }).join('');
  } catch {
    rows.innerHTML = '<p class="empty warning">Logs unavailable. Check connection or run migration.</p>';
  }
}

function initEmail() {
  const refreshBtn = $('#email-log-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', loadEmailLogs);
  const statusFilter = $('#email-log-status-filter');
  if (statusFilter) statusFilter.addEventListener('change', loadEmailLogs);

  const copyBtn = $('#email-copy-html');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    if (_currentPreviewHtml) {
      navigator.clipboard.writeText(_currentPreviewHtml).then(
        () => showToast('HTML copied to clipboard!'),
        () => showToast('Copy failed.', 'error')
      );
    }
  });
  const downloadBtn = $('#email-download-html');
  if (downloadBtn) downloadBtn.addEventListener('click', () => {
    if (_currentPreviewHtml) {
      const blob = new Blob([_currentPreviewHtml], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${_currentPreviewKey || 'template'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${_currentPreviewKey || 'template'}.html`);
    }
  });

  const testForm = $('#email-test-form');
  if (testForm) {
    testForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const template = ($('#email-test-template') || {}).value || 'welcome';
      const recipient = ($('#email-test-recipient') || {}).value || '';
      if (!recipient) { showToast('Enter a recipient email.', 'error'); return; }
      try {
        const result = await apiPost('send-test-email', {
          to: recipient,
          templateId: template
        });
        if (result.warning === 'log_insert_failed') {
          showToast(`Test email sent to ${recipient}. (Logs unavailable — run migration)`);
        } else {
          showToast(`Test email (${template}) sent to ${recipient}.`);
        }
        loadEmailLogs();
      } catch { /* toast shown by api() */ }
    });
  }
}

// ── Tracking Link Generator ────────────────────────────
function initTracking() {
  const form = $('#tracking-form');
  const resultBox = $('#tracking-result');
  const urlDisplay = $('#tracking-url');
  const copyBtn = $('#copy-tracking-url');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const slug = (fd.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!slug) { showToast('Enter a valid slug.', 'error'); return; }
      const params = new URLSearchParams();
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(key => {
        const val = (fd.get(key) || '').trim();
        if (val) params.set(key, val);
      });
      const qs = params.toString();
      const url = `${window.location.origin}/go/${slug}${qs ? '?' + qs : ''}`;
      if (urlDisplay) urlDisplay.textContent = url;
      if (resultBox) resultBox.style.display = 'block';
      logEvent('tracking_link_generated', { slug });
      showToast(`Link generated for: ${slug}`);
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = urlDisplay ? urlDisplay.textContent : '';
      if (text) {
        navigator.clipboard.writeText(text).then(
          () => showToast('Copied to clipboard!'),
          () => showToast('Copy failed.', 'error')
        );
      }
    });
  }
}

// ── Analytics ──────────────────────────────────────────
async function loadAnalytics() {
  const rows = $('#analytics-rows');
  if (rows) {
    rows.innerHTML = '<p class="empty">Loading…</p>';
    try {
      const data = await apiGet('admin-analytics');
      const topLinks = data.top_links || [];
      if (topLinks.length === 0) {
        rows.innerHTML = '<p class="empty">No click data available.</p>';
      } else {
        rows.innerHTML = topLinks.map(link =>
          `<div class="table-row">
            <span>${escapeHtml(link.slug)}</span>
            <span><strong>${link.count}</strong></span>
          </div>`
        ).join('');
      }
      // Populate latest events if present
      const eventsRows = $('#events-rows');
      if (eventsRows) {
        const latestEvents = data.latest_events || [];
        if (latestEvents.length === 0) {
          eventsRows.innerHTML = '<p class="empty">No recent events.</p>';
        } else {
          eventsRows.innerHTML = latestEvents.map(ev => {
            const time = ev.created_at ? new Date(ev.created_at).toLocaleString() : '–';
            return `<div class="table-row">
              <span>${escapeHtml(ev.type || ev.name || 'unknown')}</span>
              <span>${escapeHtml(ev.slug || '–')}</span>
              <span>${time}</span>
            </div>`;
          }).join('');
        }
      }
    } catch {
      rows.innerHTML = '<p class="empty">Failed to load analytics.</p>';
    }
  }
}

// ── Event logging (writes to events table) ─────────────
function logEvent(type, meta = {}) {
  apiPost('track-event', { type, name: type, meta }).catch(() => {});
}

// ── Utility functions ──────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Neon News Banner ───────────────────────────────────
async function loadNewsBanner() {
  try {
    const data = await apiGetSilent('settings');
    if (!data || !data.settings) return;
    const text = (data.settings.news_banner_text != null)
      ? String(data.settings.news_banner_text)
      : '';
    renderBanner(text);
    // Populate admin input if present
    const input = $('#banner-text-input');
    if (input) input.value = text;
  } catch { /* silent */ }
}

function renderBanner(text) {
  const banner = $('#neon-news-banner');
  const textEl = $('#neon-banner-text');
  if (!banner || !textEl) return;
  const trimmed = (text || '').trim();
  if (!trimmed) {
    banner.style.display = 'none';
    return;
  }
  textEl.textContent = trimmed;
  banner.style.display = 'block';
  // Double rAF ensures layout recalc so scrollWidth is accurate
  requestAnimationFrame(() => { requestAnimationFrame(() => {
    const track = banner.querySelector('.neon-banner-track');
    if (!track) return;
    const needsScroll = textEl.scrollWidth > track.clientWidth;
    textEl.classList.toggle('scrolling', needsScroll);
    if (needsScroll) {
      // ~0.25s per character, minimum 10s for comfortable reading speed
      const duration = Math.max(10, trimmed.length * 0.25);
      textEl.style.setProperty('--ticker-duration', duration + 's');
    }
  }); });
}

function initBannerSettings() {
  const form = $('#banner-settings-form');
  const input = $('#banner-text-input');
  const clearBtn = $('#banner-clear-btn');
  if (form && input) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('settings', {
          method: 'PUT',
          body: JSON.stringify({ news_banner_text: input.value.trim() })
        });
        renderBanner(input.value.trim());
        showToast('Banner updated!');
      } catch { /* toast shown by api() */ }
    });
  }
  if (clearBtn && input) {
    clearBtn.addEventListener('click', async () => {
      try {
        await api('settings', {
          method: 'PUT',
          body: JSON.stringify({ news_banner_text: '' })
        });
        input.value = '';
        renderBanner('');
        showToast('Banner cleared.');
      } catch { /* toast shown by api() */ }
    });
  }
}

// ── Deals / G2A Repair ─────────────────────────────────
function initDeals() {
  const fixBtn = $('#g2a-fix-btn');
  if (fixBtn) {
    fixBtn.addEventListener('click', async () => {
      fixBtn.disabled = true;
      fixBtn.textContent = 'Scanning…';
      const resultBox = $('#g2a-fix-result');
      const statsEl = $('#g2a-fix-stats');
      const examplesEl = $('#g2a-fix-examples');
      try {
        const data = await apiPost('admin-fix-g2a-links', {});
        if (resultBox) resultBox.style.display = 'block';
        if (statsEl) {
          statsEl.innerHTML = [
            statCard('Scanned', data.scanned),
            statCard('Updated', data.updated),
            statCard('Skipped', data.skipped),
            statCard('Errors', (data.errors || []).length)
          ].join('');
        }
        if (examplesEl && data.examples && data.examples.length > 0) {
          examplesEl.innerHTML = '<h4 style="margin:0 0 .5rem">Examples</h4>' +
            data.examples.map(ex =>
              `<div style="font-size:.85rem;margin-bottom:.35rem;">
                <strong>${escapeHtml(ex.column || 'url')}</strong> (${escapeHtml(ex.id.slice(0, 8))}…)<br/>
                <span style="opacity:.5">${escapeHtml(ex.before)}</span> →<br/>
                <span style="color:var(--accent,#60f)">${escapeHtml(ex.after)}</span>
              </div>`
            ).join('');
        } else if (examplesEl) {
          examplesEl.innerHTML = '';
        }
        showToast(`G2A fix complete: ${data.updated} updated, ${data.skipped} skipped.`);
      } catch {
        /* toast shown by api() */
      } finally {
        fixBtn.disabled = false;
        fixBtn.textContent = 'Fix G2A Links';
      }
    });
  }
}

function statCard(label, value) {
  return `<div class="stat-card"><span class="stat-label">${escapeHtml(label)}</span><strong class="stat-value">${value ?? '–'}</strong></div>`;
}

// ── G2A URL normalisation (client-side) ────────────────
// Mirrors netlify/functions/_lib/affiliates.js for browser use (no build step).
function isG2AUrl(input) {
  try {
    const raw = String(input || '').trim();
    if (!raw) return false;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    return host === 'g2a.com' || host === 'www.g2a.com' || host.endsWith('.g2a.com');
  } catch {
    return false;
  }
}

function normalizeG2AReflinkClient(inputUrl, gtag) {
  try {
    const raw = String(inputUrl || '').trim();
    if (!raw || !gtag) return raw;
    const hadScheme = /^https?:\/\//i.test(raw);
    const withScheme = hadScheme ? raw : 'https://' + raw;
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    if (host !== 'g2a.com' && host !== 'www.g2a.com' && !host.endsWith('.g2a.com')) return raw;
    url.searchParams.set('gtag', gtag);
    let result = url.toString();
    if (!hadScheme) result = result.replace(/^https:\/\//i, '');
    return result;
  } catch {
    return String(inputUrl || '').trim();
  }
}

// ── Gaming Drops Manager ───────────────────────────────
async function loadDrops() {
  const rows = $('#drops-rows');
  if (!rows) return;
  rows.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const data = await apiGet('admin-drops');
    if (!data.items || data.items.length === 0) {
      rows.innerHTML = '<p class="empty">No drops configured.</p>';
      return;
    }
    rows.innerHTML = data.items.map(d => {
      const activeClass = d.active ? 'status-active' : 'status-unsubscribed';
      const activeLabel = d.active ? 'Yes' : 'No';
      return `<div class="table-row">
        <span><strong>${escapeHtml(d.id)}</strong></span>
        <span>${escapeHtml(d.title || '–')}</span>
        <span>${escapeHtml(d.platform || '–')}</span>
        <span style="font-size:.8rem;word-break:break-all;">${escapeHtml(d.destination_url || '–')}</span>
        <span class="${activeClass}">${activeLabel}</span>
        <span>${d.sort_order ?? 0}</span>
        <span>
          <button class="btn mini ghost" data-edit-drop="${escapeHtml(d.id)}">Edit</button>
          <button class="btn mini ghost" data-toggle-drop="${escapeHtml(d.id)}" data-active="${escapeHtml(String(d.active))}">${d.active ? 'Disable' : 'Enable'}</button>
        </span>
      </div>`;
    }).join('');
    // Bind edit buttons
    rows.querySelectorAll('[data-edit-drop]').forEach(btn => {
      btn.addEventListener('click', () => {
        const drop = data.items.find(d => d.id === btn.dataset.editDrop);
        if (drop) populateDropForm(drop);
      });
    });
    // Bind toggle buttons
    rows.querySelectorAll('[data-toggle-drop]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isActive = btn.dataset.active === 'true';
        try {
          await apiPost('admin-drops', { id: btn.dataset.toggleDrop, active: !isActive });
          showToast(`Drop ${btn.dataset.toggleDrop} ${!isActive ? 'enabled' : 'disabled'}.`);
          loadDrops();
        } catch { /* toast shown */ }
      });
    });
  } catch {
    rows.innerHTML = '<p class="empty">Failed to load drops.</p>';
  }
}

function populateDropForm(drop) {
  const setVal = (id, val) => { const el = $(`#${id}`); if (el) el.value = val ?? ''; };
  setVal('drop-id', drop.id);
  setVal('drop-title', drop.title);
  setVal('drop-platform', drop.platform);
  setVal('drop-value', drop.value_eur);
  setVal('drop-url', drop.destination_url);
  setVal('drop-sort', drop.sort_order);
  const activeEl = $('#drop-active');
  if (activeEl) activeEl.checked = drop.active !== false;
}

function initDrops() {
  const form = $('#drop-form');
  const resetBtn = $('#drop-reset');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = ($('#drop-id') || {}).value || '';
      const title = ($('#drop-title') || {}).value || '';
      const platform = ($('#drop-platform') || {}).value || '';
      const value_eur = parseInt(($('#drop-value') || {}).value, 10) || null;
      const destination_url = ($('#drop-url') || {}).value || '';
      const sort_order = parseInt(($('#drop-sort') || {}).value, 10) || 0;
      const active = ($('#drop-active') || {}).checked !== false;
      if (!id || !destination_url) { showToast('ID and URL are required.', 'error'); return; }
      try {
        await apiPost('admin-drops', { id, title, platform, value_eur, destination_url, sort_order, active });
        showToast(`Drop "${id}" saved.`);
        form.reset();
        loadDrops();
      } catch { /* toast shown */ }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (form) form.reset();
    });
  }
}

// ── Spotlight Manager ───────────────────────────────────
let spotlightItems = [];

async function loadSpotlights() {
  const rows = $('#spotlight-rows');
  if (!rows) return;
  rows.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const data = await apiGet('spotlight-create');
    spotlightItems = data.items || [];
    updateSpotlightStats();
    if (spotlightItems.length === 0) {
      rows.innerHTML = '<p class="empty">No spotlight pages yet.</p>';
      return;
    }
    rows.innerHTML = spotlightItems.map(s => {
      const activeClass = s.is_active ? 'status-active' : 'status-unsubscribed';
      const activeLabel = s.is_active ? 'Yes' : 'No';
      return `<div class="table-row">
        <span><strong>${escapeHtml(s.title)}</strong></span>
        <span>${escapeHtml(s.brand || '–')}</span>
        <span style="font-size:.8rem;">${escapeHtml(s.slug)}</span>
        <span><strong>${s.clicks || 0}</strong></span>
        <span class="${activeClass}">${activeLabel}</span>
        <span>
          <button class="btn mini ghost" data-edit-spotlight="${escapeHtml(s.id)}">Edit</button>
          <button class="btn mini ghost" data-toggle-spotlight="${escapeHtml(s.id)}" data-active="${s.is_active}">
            ${s.is_active ? 'Disable' : 'Enable'}
          </button>
          <button class="btn mini ghost" data-copy-spotlight="${escapeHtml(s.slug)}">Copy URL</button>
          <button class="btn mini ghost" data-preview-spotlight="${escapeHtml(s.slug)}">Preview</button>
          <button class="btn mini ghost" data-delete-spotlight="${escapeHtml(s.id)}">Delete</button>
        </span>
      </div>`;
    }).join('');

    // Bind edit buttons
    rows.querySelectorAll('[data-edit-spotlight]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = spotlightItems.find(s => s.id === btn.dataset.editSpotlight);
        if (item) populateSpotlightForm(item);
      });
    });
    // Bind toggle buttons
    rows.querySelectorAll('[data-toggle-spotlight]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isActive = btn.dataset.active === 'true';
        const item = spotlightItems.find(s => s.id === btn.dataset.toggleSpotlight);
        if (!item) return;
        try {
          await apiPost('spotlight-create', {
            id: item.id,
            title: item.title,
            affiliate_url: item.affiliate_url,
            slug: item.slug,
            is_active: !isActive
          });
          showToast(`Spotlight "${item.title}" ${!isActive ? 'enabled' : 'disabled'}.`);
          loadSpotlights();
        } catch { /* toast shown */ }
      });
    });
    // Bind copy URL buttons
    rows.querySelectorAll('[data-copy-spotlight]').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = `${window.location.origin}/spotlight/${btn.dataset.copySpotlight}`;
        navigator.clipboard.writeText(url).then(
          () => showToast('Spotlight URL copied!'),
          () => showToast('Copy failed.', 'error')
        );
      });
    });
    // Bind preview buttons
    rows.querySelectorAll('[data-preview-spotlight]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(`/spotlight/${btn.dataset.previewSpotlight}`, '_blank');
      });
    });
    // Bind delete buttons
    rows.querySelectorAll('[data-delete-spotlight]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this spotlight page?')) return;
        try {
          await api('spotlight-create', {
            method: 'DELETE',
            body: JSON.stringify({ id: btn.dataset.deleteSpotlight })
          });
          showToast('Spotlight deleted.');
          loadSpotlights();
        } catch { /* toast shown */ }
      });
    });
  } catch {
    rows.innerHTML = '<p class="empty">Failed to load spotlights.</p>';
  }
}

function updateSpotlightStats() {
  const totalEl = $('#spotlight-stat-total');
  const activeEl = $('#spotlight-stat-active');
  const clicksEl = $('#spotlight-stat-clicks');
  if (totalEl) totalEl.textContent = spotlightItems.length;
  if (activeEl) activeEl.textContent = spotlightItems.filter(s => s.is_active).length;
  if (clicksEl) clicksEl.textContent = spotlightItems.reduce((sum, s) => sum + (s.clicks || 0), 0);
}

function populateSpotlightForm(item) {
  const setVal = (id, val) => { const el = $(`#${id}`); if (el) el.value = val ?? ''; };
  $('#spotlight-edit-id').value = item.id || '';
  setVal('spotlight-title', item.title);
  setVal('spotlight-slug', item.slug);
  setVal('spotlight-subtitle', item.subtitle);
  setVal('spotlight-brand', item.brand);
  setVal('spotlight-badge', item.badge_text);
  setVal('spotlight-affiliate-url', item.affiliate_url);
  setVal('spotlight-coupon', item.coupon_code);
  setVal('spotlight-cta', item.cta_text);
  setVal('spotlight-logo-url', item.logo_url);
  setVal('spotlight-hero-url', item.hero_url);
  if (item.gradient) {
    const gradientSelect = $('#spotlight-gradient');
    if (gradientSelect) {
      // Try to find the matching option, otherwise keep default
      const opts = gradientSelect.options;
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].value === item.gradient) {
          gradientSelect.selectedIndex = i;
          break;
        }
      }
    }
  }
  if (item.countdown_date) {
    const cdEl = $('#spotlight-countdown');
    if (cdEl) {
      // Convert ISO to datetime-local format
      const d = new Date(item.countdown_date);
      cdEl.value = d.toISOString().slice(0, 16);
    }
  }
  const activeEl = $('#spotlight-active');
  if (activeEl) activeEl.checked = item.is_active !== false;

  // Update form title and button
  const formTitle = $('#spotlight-form-title');
  if (formTitle) formTitle.textContent = '✏️ Edit Spotlight Page';
  const saveBtn = $('#spotlight-save-btn');
  if (saveBtn) saveBtn.textContent = 'Update Spotlight';
  const previewBtn = $('#spotlight-preview-btn');
  if (previewBtn && item.slug) {
    previewBtn.style.display = 'inline-flex';
    previewBtn.onclick = () => window.open(`/spotlight/${item.slug}`, '_blank');
  }
}

function resetSpotlightForm() {
  const form = $('#spotlight-form');
  if (form) form.reset();
  $('#spotlight-edit-id').value = '';
  const formTitle = $('#spotlight-form-title');
  if (formTitle) formTitle.textContent = '➕ Create Spotlight Page';
  const saveBtn = $('#spotlight-save-btn');
  if (saveBtn) saveBtn.textContent = 'Create Spotlight';
  const previewBtn = $('#spotlight-preview-btn');
  if (previewBtn) previewBtn.style.display = 'none';
}

function initSpotlight() {
  const form = $('#spotlight-form');
  const resetBtn = $('#spotlight-reset');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = ($('#spotlight-edit-id') || {}).value || '';
      const title = ($('#spotlight-title') || {}).value || '';
      const slug = ($('#spotlight-slug') || {}).value || '';
      const subtitle = ($('#spotlight-subtitle') || {}).value || '';
      const brand = ($('#spotlight-brand') || {}).value || '';
      const badge_text = ($('#spotlight-badge') || {}).value || '';
      const affiliate_url = ($('#spotlight-affiliate-url') || {}).value || '';
      const coupon_code = ($('#spotlight-coupon') || {}).value || '';
      const cta_text = ($('#spotlight-cta') || {}).value || '';
      const logo_url = ($('#spotlight-logo-url') || {}).value || '';
      const hero_url = ($('#spotlight-hero-url') || {}).value || '';
      const gradient = ($('#spotlight-gradient') || {}).value || '';
      const countdown_raw = ($('#spotlight-countdown') || {}).value || '';
      const is_active = ($('#spotlight-active') || {}).checked !== false;

      if (!title || !affiliate_url) {
        showToast('Title and Affiliate URL are required.', 'error');
        return;
      }

      const payload = {
        title, subtitle, brand, affiliate_url, coupon_code,
        gradient, logo_url, hero_url, badge_text, cta_text, is_active
      };
      if (slug) payload.slug = slug;
      if (editId) payload.id = editId;
      if (countdown_raw) payload.countdown_date = new Date(countdown_raw).toISOString();
      else payload.countdown_date = null;

      try {
        const result = await apiPost('spotlight-create', payload);
        showToast(editId ? 'Spotlight updated!' : `Spotlight "${title}" created!`);
        resetSpotlightForm();
        loadSpotlights();
      } catch { /* toast shown */ }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetSpotlightForm);
  }
}

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initLogout();
  initNewsletter();
  initEmail();
  initCampaigns();
  initDeals();
  initDrops();
  initSpotlight();
  initTracking();
  initBannerSettings();
  loadDashboard();
  loadNewsBanner();
});
