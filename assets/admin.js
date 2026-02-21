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
      throw new Error(body.error || `HTTP ${res.status}`);
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
      const prize = (s.meta && s.meta.prize) ? s.meta.prize : '–';
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
      `${csvEscape(s.email)},${csvEscape(s.status)},${csvEscape(s.source || '')},${csvEscape(s.meta && s.meta.prize ? s.meta.prize : '')},${csvEscape(s.created_at)}`
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
        showToast(`Campaign sent! ${result.sent || 0} delivered.`);
        logEvent('campaign_sent', { subject, segment });
      } catch { /* toast shown */ }
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
        await apiPost('admin-send-campaign', { subject, html, testEmail, segment });
        showToast(`Test email sent to ${testEmail}.`);
      } catch { /* toast shown */ }
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

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initLogout();
  initNewsletter();
  initCampaigns();
  initTracking();
  loadDashboard();
});
