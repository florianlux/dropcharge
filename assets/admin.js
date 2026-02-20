const API_BASE = (window.ADMIN_API_BASE
  || document.documentElement.getAttribute('data-api-base')
  || (window.location.origin.includes('dropchargeadmin') ? 'https://dropcharge.netlify.app' : window.location.origin)
).replace(/\/$/, '');

const API = {
  stats: `${API_BASE}/.netlify/functions/stats`,
  health: `${API_BASE}/.netlify/functions/admin-health`,
  events: `${API_BASE}/.netlify/functions/events`,
  funnel: `${API_BASE}/.netlify/functions/funnel`,
  utm: `${API_BASE}/.netlify/functions/utm`,
  devices: `${API_BASE}/.netlify/functions/devices`,
  seed: `${API_BASE}/.netlify/functions/admin-seed`,
  spotlight: `${API_BASE}/.netlify/functions/spotlight`,
  deals: `${API_BASE}/.netlify/functions/deals-admin`,
  settings: `${API_BASE}/.netlify/functions/settings`,
  publicConfig: `${API_BASE}/.netlify/functions/public-config`,
  factory: `${API_BASE}/.netlify/functions/affiliate-factory`
};

const TOKEN_STORAGE_KEY = 'admin_token';
const STATS_INTERVAL = 15000;
const HEALTH_INTERVAL = 20000;
const LIVE_INTERVAL = 4000;

const state = {
  live: {
    paused: false,
    filter: 'all',
    session: '',
    interval: null,
    events: []
  },
  funnels: {},
  funnelSummary: null,
  funnelWindow: '24h',
  utm: null,
  devices: null,
  settings: {},
  deals: [],
  dealSummary: {},
  currentDealId: null,
  quickLive: true,
  emailRows: [],
  dealFilters: { platform: 'all', active: 'all', range: '7' },
  dealSort: { field: 'priority', direction: 'desc' }
};

const dom = {
  tabs: document.querySelectorAll('.nav-link'),
  panels: document.querySelectorAll('.tab-panel'),
  platformStats: document.getElementById('platform-stats'),
  clicksMeta: document.getElementById('clicks-meta'),
  emailCount: document.getElementById('email-count'),
  emailConv: document.getElementById('email-conv'),
  amountStats: document.getElementById('amount-stats'),
  emailTable: document.getElementById('email-table'),
  emailsRefresh: document.getElementById('emails-refresh'),
  emailsCopy: document.getElementById('emails-copy'),
  healthStatus: document.querySelector('[data-health-status]'),
  healthAuth: document.querySelector('[data-health-auth]'),
  healthSupabase: document.querySelector('[data-health-supabase]'),
  healthBuild: document.querySelector('[data-health-build]'),
  healthSchema: document.querySelector('[data-health-schema]'),
  healthError: document.querySelector('[data-health-error]'),
  liveTable: document.getElementById('live-table'),
  liveLatest: document.getElementById('live-latest'),
  liveCount: document.getElementById('live-count'),
  livePause: document.getElementById('live-pause'),
  liveFilters: document.getElementById('live-filters'),
  sessionInput: document.getElementById('session-filter'),
  sessionApply: document.getElementById('session-apply'),
  funnelGrid: document.getElementById('funnel-grid'),
  funnelVisual: document.getElementById('funnel-visual'),
  funnelDropoff: document.getElementById('funnel-dropoff'),
  funnelWindow: document.getElementById('funnel-window'),
  funnelRefresh: document.getElementById('funnel-refresh'),
  utmLists: document.getElementById('utm-lists'),
  deviceGrid: document.getElementById('device-grid'),
  quickToggle: document.getElementById('toggle-live'),
  quickRefresh: document.getElementById('refresh-all'),
  quickExport: document.getElementById('export-csv'),
  globalSearch: document.getElementById('global-search'),
  searchTrigger: document.getElementById('search-trigger'),
  spotlightPreview: document.getElementById('spotlight-preview'),
  spotlightMeta: document.getElementById('spotlight-meta'),
  spotlightForm: document.getElementById('spotlight-form'),
  spotlightFetch: document.getElementById('spotlight-fetch'),
  spotlightReset: document.getElementById('spotlight-reset'),
  dealsTable: document.getElementById('deals-table'),
  dealStatus: document.getElementById('deal-status'),
  dealAnalytics: document.getElementById('deal-analytics'),
  dealFilterPlatform: document.getElementById('deal-filter-platform'),
  dealFilterActive: document.getElementById('deal-filter-active'),
  dealFilterRange: document.getElementById('deal-filter-range'),
  dealSortField: document.getElementById('deal-sort-field'),
  dealFilterApply: document.getElementById('deals-filter-apply'),
  factoryForm: document.getElementById('factory-form'),
  factoryResult: document.getElementById('factory-result'),
  emailLeadsTable: document.getElementById('email-leads-table'),
  leadStats: document.getElementById('lead-stats'),
  seedQuick: document.getElementById('seed-data'),
  seedForm: document.getElementById('seed-form'),
  seedClicks: document.getElementById('seed-clicks'),
  seedEmails: document.getElementById('seed-emails'),
  seedEvents: document.getElementById('seed-events'),
  seedMix: document.getElementById('seed-mix'),
  emailExport: document.getElementById('email-export'),
  emailRefresh: document.getElementById('email-refresh'),
  settingsForm: document.getElementById('settings-form'),
  settingsRefresh: document.getElementById('settings-refresh'),
  publicConfig: document.getElementById('public-config'),
  toggleLiveMode: document.getElementById('toggle-live'),
  apiBaseDisplay: document.getElementById('api-base-display'),
  toast: null
};

(function ensureTokenPresent() {
  if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
    window.location.href = '/admin-login.html';
  }
})();

function initToast() {
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.position = 'fixed';
  toast.style.right = '1.5rem';
  toast.style.bottom = '1.5rem';
  toast.style.padding = '0.9rem 1.4rem';
  toast.style.borderRadius = '14px';
  toast.style.background = 'rgba(16, 124, 16, 0.9)';
  toast.style.color = '#fdfdfd';
  toast.style.boxShadow = '0 15px 35px rgba(0,0,0,0.35)';
  toast.style.opacity = '0';
  toast.style.pointerEvents = 'none';
  toast.style.transition = 'opacity 0.3s ease';
  document.body.appendChild(toast);
  dom.toast = toast;
}

function showToast(message, tone = 'success') {
  if (!dom.toast) initToast();
  dom.toast.textContent = message;
  dom.toast.style.background = tone === 'error' ? 'rgba(211,63,63,0.92)' : 'rgba(16,124,16,0.92)';
  dom.toast.style.opacity = '1';
  clearTimeout(dom.toast._timer);
  dom.toast._timer = setTimeout(() => { dom.toast.style.opacity = '0'; }, 3500);
}

function handleRequestError(context, error) {
  const message = error?.message || 'request_failed';
  showToast(`${context}: ${message}`, 'error');
}

function escapeAttr(value) {
  return (value ?? '').toString().replace(/"/g, '&quot;');
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return '0€';
  return `${value.toFixed(2)}€`;
}

function buildHeaders(extra = {}) {
  const headers = { ...extra };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) headers['x-admin-token'] = token;
  return headers;
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const config = { ...options };
  config.headers = buildHeaders({ 'Content-Type': options.body ? 'application/json' : undefined, ...options.headers });
  if (config.headers['Content-Type'] === undefined) delete config.headers['Content-Type'];
  try {
    const res = await fetch(url, config);
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.location.href = '/admin-login.html';
      return null;
    }
    if (!res.ok) {
      const text = await res.text();
      const message = text || res.statusText || 'request_failed';
      console.error('[API]', url, res.status, message);
      const error = new Error(`HTTP ${res.status}: ${message}`);
      error.status = res.status;
      error.url = url;
      throw error;
    }
    const isJson = res.headers.get('content-type')?.includes('application/json');
    return isJson ? res.json() : res.text();
  } catch (err) {
    if (!err.url) {
      console.error('[API] network_error', url, err.message);
    }
    throw err;
  }
}

function switchTab(tabId) {
  dom.tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  dom.panels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabId));
}

dom.tabs.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

async function loadStats({ silent = false } = {}) {
  try {
    const data = await request(API.stats);
    if (!data?.ok) throw new Error('stats_failed');
    const metrics = data.metrics || {};
    const counts = metrics.platformCounts || {};
    if (dom.platformStats) {
      const order = ['PSN', 'Xbox', 'Nintendo'];
      Array.from(dom.platformStats.querySelectorAll('.stat strong')).forEach((el, idx) => {
        const key = order[idx];
        el.textContent = counts[key] || 0;
      });
    }
    if (dom.clicksMeta) dom.clicksMeta.textContent = `${metrics.clicks24h || 0} Klicks / ${metrics.clicks30m || 0} in 30 Min`;
    if (dom.emailCount) dom.emailCount.textContent = metrics.emails24h || 0;
    if (dom.emailConv) dom.emailConv.textContent = `${metrics.conversion24h?.toFixed ? metrics.conversion24h.toFixed(1) : (metrics.conversion24h || 0)}%`;
    if (dom.amountStats) {
      const list = metrics.topAmounts || [];
      dom.amountStats.innerHTML = '';
      if (!list.length) {
        dom.amountStats.innerHTML = '<div class="list-item"><span>Keine Daten</span><strong>0</strong></div>';
      } else {
        list.forEach(item => {
          const row = document.createElement('div');
          row.className = 'list-item';
          row.innerHTML = `<div><strong>${item.amount || '—'}</strong><small>${item.platform || '—'} · ${item.slug || ''}</small></div><strong>${item.count}</strong>`;
          dom.amountStats.appendChild(row);
        });
      }
    }
    state.emailRows = metrics.emailRows || [];
    if (dom.emailTable) renderEmailTable(state.emailRows);
    if (dom.emailLeadsTable) renderEmailLeads(state.emailRows);
    if (dom.leadStats) renderLeadStats(state.emailRows);
  } catch (err) {
    console.error('stats load failed', err.message);
    if (!silent) handleRequestError('Stats', err);
  }
}

function renderEmailTable(rows) {
  dom.emailTable.querySelectorAll('.table-row').forEach(row => row.remove());
  rows.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${entry.email}</span>
      <span>${new Date(entry.created_at).toLocaleString()}</span>
      <span>${entry.confirmed ? 'Confirmed' : 'Pending'}</span>
    `;
    dom.emailTable.appendChild(row);
  });
}

function renderEmailLeads(rows) {
  const table = dom.emailLeadsTable;
  if (!table) return;
  table.querySelectorAll('.table-row').forEach(row => row.remove());
  rows.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${entry.email}</span>
      <span>${entry.confirmed ? 'Confirmed' : 'Pending'}</span>
      <span>${new Date(entry.created_at).toLocaleString()}</span>
    `;
    table.appendChild(row);
  });
}

function renderLeadStats(rows) {
  const stats = {
    confirmed: rows.filter(r => r.confirmed).length,
    pending: rows.filter(r => !r.confirmed).length,
  };
  dom.leadStats.innerHTML = '';
  Object.entries(stats).forEach(([label, value]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    dom.leadStats.appendChild(li);
  });
}

function copyEmailList() {
  if (!state.emailRows.length) {
    showToast('Keine Emails verfügbar', 'error');
    return;
  }
  const text = state.emailRows.map(entry => entry.email).join('
');
  navigator.clipboard.writeText(text).then(() => showToast('Emails kopiert')).catch(() => showToast('Clipboard blockiert', 'error'));
}

function exportEmailsCsv() {
  if (!state.emailRows.length) {
    showToast('Keine Emails verfügbar', 'error');
    return;
  }
  const header = ['email','confirmed','created_at'];
  const csv = [header.join(',')].concat(state.emailRows.map(entry => header.map(key => JSON.stringify(entry[key] ?? '')).join(','))).join('
');
  navigator.clipboard.writeText(csv).then(() => showToast('CSV kopiert')).catch(() => showToast('Clipboard blockiert', 'error'));
}

async function loadHealth() {
  try {
    const data = await request(API.health);
    if (!data) return;
    dom.healthStatus.textContent = data.ok ? 'CONNECTED' : 'ISSUE';
    dom.healthStatus.classList.toggle('ok', data.ok);
    dom.healthStatus.classList.toggle('fail', !data.ok);
    dom.healthAuth.textContent = data.authEnabled ? 'Aktiv' : 'Offen';
    dom.healthSupabase.textContent = data.hasSupabase ? 'OK' : 'Fehlt';
    dom.healthBuild.textContent = data.build || 'local';
    dom.healthSchema.textContent = data.schemaOk ? 'OK' : (data.missingTables?.join(', ') || '—');
    dom.healthError.textContent = data.ok ? '' : (data.error || 'Unbekannter Fehler');
  } catch (err) {
    console.error('health load failed', err.message);
  }
}

async function loadLiveEvents({ silent = false } = {}) {
  if (state.live.paused) return;
  try {
    const params = new URLSearchParams({ limit: 100 });
    if (state.live.filter && state.live.filter !== 'all') params.set('type', state.live.filter);
    if (state.live.session) params.set('session', state.live.session);
    const data = await request(`${API.events}?${params.toString()}`);
    if (!data?.ok) throw new Error('live_failed');
    state.live.events = data.events || [];
    renderLiveEvents();
    if (dom.liveLatest) dom.liveLatest.textContent = data.summary?.latest ? new Date(data.summary.latest).toLocaleTimeString() : '—';
    if (dom.liveCount) dom.liveCount.textContent = data.events?.length || 0;
  } catch (err) {
    console.error('live events failed', err.message);
    if (!silent) handleRequestError('Live Events', err);
  }
}

function renderLiveEvents() {
  dom.liveTable.querySelectorAll('.table-row').forEach(row => row.remove());
  state.live.events.forEach(evt => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${new Date(evt.created_at).toLocaleTimeString()}</span>
      <span>${evt.type}</span>
      <span>${evt.slug || '—'}</span>
      <span>${evt.path || '—'}</span>
      <span>${evt.platform || '—'}</span>
      <span>${evt.session_id || '—'}</span>
      <span>${evt.country || '—'}</span>
      <span>${JSON.stringify(evt.meta || {})}</span>
    `;
    dom.liveTable.appendChild(row);
  });
}

async function loadFunnels({ silent = false } = {}) {
  try {
    const params = new URLSearchParams({ range: state.funnelWindow });
    const data = await request(`${API.funnel}?${params.toString()}`);
    if (!data?.ok) throw new Error('funnel_failed');
    state.funnels = data.funnels || {};
    state.funnelSummary = data.funnel || null;
    renderFunnelVisual();
    renderFunnelGrid(state.funnelWindow);
  } catch (err) {
    console.error('funnel load failed', err.message);
    if (!silent) handleRequestError('Funnel Daten', err);
  }
}

function renderFunnelVisual() {
  if (!dom.funnelVisual) return;
  const summary = state.funnelSummary || {};
  const stages = [
    { key: 'landing_views', label: 'Landing Views', count: summary.landing_views || 0 },
    { key: 'cta_clicks', label: 'CTA Clicks', count: summary.cta_clicks || 0, conversion: summary.conversion_landing_to_cta },
    { key: 'deal_clicks', label: 'Deal Clicks', count: summary.deal_clicks || 0, conversion: summary.conversion_cta_to_deal },
    { key: 'email_submits', label: 'Email Submits', count: summary.email_submits || 0, conversion: summary.conversion_deal_to_email }
  ];
  const maxCount = Math.max(...stages.map(stage => stage.count), 1);
  dom.funnelVisual.innerHTML = stages
    .map((stage, index) => {
      const width = Math.max(5, (stage.count / maxCount) * 100);
      const conversion = stage.conversion ?? null;
      const prevCount = index === 0 ? null : stages[index - 1].count;
      const drop = prevCount ? prevCount - stage.count : null;
      return `
        <div class="funnel-stage">
          <span>${stage.label}</span>
          <strong>${stage.count}</strong>
          <div class="funnel-bar"><i style="width:${width}%"></i></div>
          ${conversion !== null && prevCount ? `<div class="conversion">${conversion}% → ${drop > 0 ? `-${drop}` : '0'} drop</div>` : ''}
        </div>
      `;
    })
    .join('');
  renderFunnelDropoff(summary);
}

function renderFunnelDropoff(summary) {
  if (!dom.funnelDropoff) return;
  const dropData = [
    { label: 'Landing → CTA', value: summary?.dropoff_landing_to_cta || 0 },
    { label: 'CTA → Deal', value: summary?.dropoff_cta_to_deal || 0 },
    { label: 'Deal → Email', value: summary?.dropoff_deal_to_email || 0 }
  ];
  const maxDrop = Math.max(...dropData.map(item => item.value), 0);
  dom.funnelDropoff.innerHTML = dropData
    .map(item => `<div class="dropoff-card ${item.value === maxDrop ? 'highlight' : ''}"><span>${item.label}</span><strong>${item.value}%</strong></div>`)
    .join('');
}

function renderFunnelGrid(label) {
  if (!dom.funnelGrid) return;
  const dataset = state.funnels[label] || { counts: {}, conversions: {} };
  dom.funnelGrid.innerHTML = '';
  const stages = ['landing_view', 'cta_click', 'deal_click', 'email_submit', 'email_confirmed'];
  stages.forEach(stage => {
    const card = document.createElement('div');
    card.className = 'funnel-card';
    const count = dataset.counts?.[stage] || 0;
    card.innerHTML = `<h4>${stage.replace('_', ' ')}</h4><div class="progress"><span style="width:${Math.min(100, count)}%"></span></div><p>${count} Events</p>`;
    dom.funnelGrid.appendChild(card);
  });
  dom.funnelMeta?.replaceChildren?.();
}

async function loadUtm(windowLabel = '7d', { silent = false } = {}) {
  try {
    const data = await request(`${API.utm}?window=${windowLabel}`);
    state.utm = data.top;
    renderUtm();
  } catch (err) {
    console.error('utm load failed', err.message);
    if (!silent) handleRequestError('UTM Daten', err);
  }
}

function renderUtm() {
  if (!state.utm || !dom.utmLists) return;
  dom.utmLists.innerHTML = '';
  Object.entries(state.utm).forEach(([key, list]) => {
    const block = document.createElement('div');
    block.className = 'utm-block';
    block.innerHTML = `<h4>${key}</h4>`;
    (list || []).forEach(entry => {
      const row = document.createElement('div');
      row.className = 'device-row';
      row.innerHTML = `<span>${entry.value || '—'}</span><strong>${entry.count}</strong>`;
      block.appendChild(row);
    });
    dom.utmLists.appendChild(block);
  });
}

async function loadDevices({ silent = false } = {}) {
  try {
    const data = await request(API.devices);
    if (!data?.ok) throw new Error('devices_failed');
    state.devices = data;
    renderDevices();
  } catch (err) {
    console.error('devices load failed', err.message);
    if (!silent) handleRequestError('Device Daten', err);
  }
}

function renderDevices() {
  if (!state.devices) return;
  dom.deviceGrid.innerHTML = '';
  ['devices', 'platforms', 'countries'].forEach(key => {
    const list = state.devices[key] || [];
    const block = document.createElement('div');
    block.className = 'utm-block';
    block.innerHTML = `<h4>${key}</h4>`;
    list.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'device-row';
      row.innerHTML = `<span>${entry.value}</span><strong>${entry.count}</strong>`;
      block.appendChild(row);
    });
    dom.deviceGrid.appendChild(block);
  });
}

async function fetchSpotlight({ silent = false } = {}) {
  try {
    const data = await request(API.spotlight);
    updateSpotlightPreview(data?.spotlight);
  } catch (err) {
    console.error('spotlight fetch failed', err.message);
    if (!silent) handleRequestError('Spotlight laden', err);
  }
}

function updateSpotlightPreview(entry) {
  if (!entry || !dom.spotlightPreview) return;
  dom.spotlightPreview.querySelector('h3').textContent = entry.title || '—';
  dom.spotlightPreview.querySelector('.desc').textContent = entry.description || 'Noch kein Text.';
  dom.spotlightPreview.querySelector('.meta').textContent = [entry.subtitle, entry.platform, entry.discount].filter(Boolean).join(' · ') || '—';
  dom.spotlightMeta.innerHTML = `
    <p>Vendor: ${entry.vendor || '—'}</p>
    <p>Preis: ${entry.price || '—'}</p>
    <p>Zeitraum: ${entry.starts_at || '—'} → ${entry.ends_at || '—'}</p>
  `;
  dom.dealStatus.textContent = entry.active ? 'Live' : 'Draft';
  dom.dealStatus.classList.toggle('ok', entry.active);
}

async function fetchDeals({ silent = false } = {}) {
  try {
    const params = new URLSearchParams();
    if (state.dealFilters.platform !== 'all') params.set('platform', state.dealFilters.platform);
    if (state.dealFilters.active !== 'all') params.set('active', state.dealFilters.active);
    if (state.dealFilters.range && state.dealFilters.range !== 'all') params.set('since', state.dealFilters.range);
    params.set('sort', state.dealSort.field);
    params.set('direction', state.dealSort.direction);
    const data = await request(`${API.deals}?${params.toString()}`);
    state.deals = data.deals || [];
    state.dealSummary = data.summary || {};
    renderDeals();
    renderDealAnalytics();
  } catch (err) {
    console.error('deals load failed', err.message);
    if (!silent) handleRequestError('Deals laden', err);
  }
}

function renderDeals() {
  dom.dealsTable.querySelectorAll('.table-row').forEach(row => row.remove());
  state.deals.forEach(deal => {
    const metrics = deal.metrics || {};
    const row = document.createElement('div');
    row.className = 'table-row';
    row.dataset.id = deal.id;
    row.innerHTML = `
      <span><input class="deal-field" data-field="title" value="${escapeAttr(deal.title || '')}" /></span>
      <span><input class="deal-field" data-field="price" value="${escapeAttr(deal.price || '')}" /></span>
      <span><input class="deal-field" data-field="affiliate_url" value="${escapeAttr(deal.affiliate_url || '')}" /></span>
      <span><input class="deal-field" data-field="priority" type="number" value="${deal.priority ?? 0}" /></span>
      <span>
        <label class="toggle mini">
          <input type="checkbox" class="deal-field" data-field="active" ${deal.active ? 'checked' : ''} />
        </label>
      </span>
      <span>${metrics.clicks24 || 0} / ${metrics.clicks7 || 0}</span>
      <span>${formatPercent(metrics.ctr24 || 0)}</span>
      <span>${formatPercent(metrics.conversion24 || 0)}</span>
      <span>${formatCurrency(metrics.revenue24 || 0)}</span>
      <span class="table-actions">
        <button class="btn mini ghost" data-action="edit">Edit</button>
        <button class="btn mini" data-action="live">Set Live</button>
        <button class="btn mini ghost" data-action="toggle">${deal.active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn mini ghost" data-action="delete">Delete</button>
      </span>
    `;
    dom.dealsTable.appendChild(row);
  });
}

function renderDealAnalytics() {
  if (!dom.dealAnalytics) return;
  const summary = state.dealSummary || {};
  const items = [
    { label: 'Clicks 24h', value: summary.clicks24 || 0 },
    { label: 'Clicks 7d', value: summary.clicks7 || 0 },
    { label: 'Revenue 24h', value: formatCurrency(summary.revenue24 || 0) },
    { label: 'Revenue 7d', value: formatCurrency(summary.revenue7 || 0) },
    { label: 'Leads 24h', value: summary.emails24 || 0 },
    { label: 'Leads 7d', value: summary.emails7 || 0 }
  ];
  dom.dealAnalytics.innerHTML = items
    .map(item => `<div class="analytics-stat"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join('');
}

function renderFactoryResult(payload) {
  if (!dom.factoryResult) return;
  if (!payload?.slug) {
    dom.factoryResult.innerHTML = '';
    return;
  }
  const goUrl = `${API_BASE}/go/${payload.slug}`;
  dom.factoryResult.innerHTML = `
    <p><strong>${goUrl}</strong></p>
    <p><small>${payload.affiliate_url || ''}</small></p>
    <button type="button" class="btn mini ghost" data-factory-copy>Copy /go URL</button>
  `;
  dom.factoryResult.querySelector('[data-factory-copy]')?.addEventListener('click', () => {
    navigator.clipboard.writeText(goUrl)
      .then(() => showToast('Link kopiert'))
      .catch(() => showToast('Clipboard blockiert', 'error'));
  });
}

async function submitFactory(event) {
  event.preventDefault();
  const formData = new FormData(dom.factoryForm);
  const payload = Object.fromEntries(formData.entries());
  payload.auto_live = formData.get('auto_live') === 'on';
  try {
    const data = await request(API.factory, { method: 'POST', body: JSON.stringify(payload) });
    showToast('Affiliate Link erstellt');
    dom.factoryForm.reset();
    renderFactoryResult(data);
    fetchDeals();
  } catch (err) {
    console.error('factory failed', err.message);
    handleRequestError('Factory Fehler', err);
  }
}

function populateDealForm(deal) {
  state.currentDealId = deal.id;
  Array.from(dom.spotlightForm.elements).forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') {
      el.checked = Boolean(deal[el.name]);
    } else {
      el.value = deal[el.name] || '';
    }
  });
}

async function submitDeal(event) {
  event.preventDefault();
  const formData = new FormData(dom.spotlightForm);
  const payload = Object.fromEntries(formData.entries());
  payload.active = formData.get('active') === 'on';
  if (payload.price_cents) payload.price_cents = Number(payload.price_cents);
  const method = state.currentDealId ? 'PUT' : 'POST';
  if (state.currentDealId) payload.id = state.currentDealId;
  try {
    await request(API.spotlight, { method, body: JSON.stringify(payload) });
    showToast('Deal gespeichert');
    dom.spotlightForm.reset();
    state.currentDealId = null;
    fetchDeals();
    fetchSpotlight();
  } catch (err) {
    console.error('spotlight save failed', err.message);
    handleRequestError('Deal speichern', err);
  }
}

async function dealAction(id, action) {
  const deal = state.deals.find(item => item.id === id);
  if (!deal) return;
  if (action === 'edit') {
    populateDealForm(deal);
    updateSpotlightPreview(deal);
    return;
  }
  const payload = { id: deal.id };
  if (action === 'live') {
    payload.active = true;
    payload.priority = 999;
  }
  if (action === 'toggle') {
    payload.active = !deal.active;
  }
  try {
    if (action === 'delete') {
      await request(API.spotlight, { method: 'DELETE', body: JSON.stringify({ id: deal.id }) });
    } else {
      await request(API.spotlight, { method: 'PUT', body: JSON.stringify(payload) });
    }
    showToast('Deal aktualisiert');
    fetchDeals();
    fetchSpotlight();
  } catch (err) {
    console.error('deal action failed', err.message);
    handleRequestError('Deal Aktion', err);
  }
}

function applyDealFilters() {
  state.dealFilters.platform = dom.dealFilterPlatform?.value || 'all';
  state.dealFilters.active = dom.dealFilterActive?.value || 'all';
  state.dealFilters.range = dom.dealFilterRange?.value || '7';
  fetchDeals();
}

function handleDealInlineChange(event) {
  const target = event.target;
  if (!target.classList.contains('deal-field')) return;
  const row = target.closest('.table-row');
  const id = row?.dataset.id;
  if (!id) return;
  const field = target.dataset.field;
  if (!field) return;
  let value = target.type === 'number' ? Number(target.value || 0) : target.value;
  if (target.type === 'checkbox') {
    value = target.checked;
  }
  updateDealField(id, { [field]: value });
}

async function updateDealField(id, patch) {
  try {
    await request(API.deals, { method: 'PUT', body: JSON.stringify({ id, ...patch }) });
    showToast('Deal aktualisiert');
    fetchDeals();
  } catch (err) {
    console.error('inline update failed', err.message);
    handleRequestError('Inline Update', err);
  }
}

async function runSeedGenerator(event) {
  event.preventDefault();
  const payload = {
    clicks: Number(dom.seedClicks.value),
    includeEmails: dom.seedEmails.checked,
    includeEvents: dom.seedEvents.checked,
    platformMix: dom.seedMix.value
  };
  try {
    showToast('Generator läuft...');
    await request(API.seed, { method: 'POST', body: JSON.stringify(payload) });
    showToast('Seed erstellt');
    loadStats();
    loadLiveEvents();
  } catch (err) {
    console.error('seed failed', err.message);
    handleRequestError('Seed fehlgeschlagen', err);
  }
}

async function submitSettings(event) {
  event.preventDefault();
  const formData = new FormData(dom.settingsForm);
  const flags = {
    disable_email_capture: formData.get('disable_email_capture') === 'on',
    disable_affiliate_redirect: formData.get('disable_affiliate_redirect') === 'on',
    banner_message: formData.get('banner_message') || ''
  };
  try {
    await request(API.settings, { method: 'PUT', body: JSON.stringify({ updates: { flags, banner_message: flags.banner_message } }) });
    showToast('Settings gespeichert');
    fetchSettings();
    fetchPublicConfig();
  } catch (err) {
    console.error('settings failed', err.message);
    handleRequestError('Settings speichern', err);
  }
}

async function fetchSettings({ silent = false } = {}) {
  try {
    const data = await request(API.settings);
    state.settings = data.settings || {};
    const flags = state.settings.flags || {};
    dom.settingsForm.elements['disable_email_capture'].checked = Boolean(flags.disable_email_capture);
    dom.settingsForm.elements['disable_affiliate_redirect'].checked = Boolean(flags.disable_affiliate_redirect);
    dom.settingsForm.elements['banner_message'].value = state.settings.banner_message || flags.banner_message || '';
  } catch (err) {
    console.error('settings fetch failed', err.message);
    if (!silent) handleRequestError('Settings laden', err);
  }
}

async function fetchPublicConfig({ silent = false } = {}) {
  try {
    const data = await request(API.publicConfig);
    dom.publicConfig.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('public config failed', err.message);
    if (!silent) handleRequestError('Public Config', err);
  }
}

function toggleLiveMode() {
  state.quickLive = !state.quickLive;
  state.live.paused = !state.quickLive;
  dom.toggleLiveMode.textContent = `Live Mode: ${state.quickLive ? 'ON' : 'OFF'}`;
}

function exportLiveCsv() {
  const rows = state.live.events;
  if (!rows.length) {
    showToast('Keine Events zum Export', 'error');
    return;
  }
  const header = ['timestamp', 'type', 'slug', 'path', 'platform', 'session', 'country'];
  const csv = [header.join(',')].concat(rows.map(evt => header.map(key => JSON.stringify(evt[key] || evt[ key === 'timestamp' ? 'created_at' : key ] || '')).join(','))).join('\n');
  navigator.clipboard.writeText(csv).then(() => showToast('CSV kopiert')).catch(() => showToast('Clipboard blockiert', 'error'));
}

function applyGlobalSearch() {
  const term = (dom.globalSearch.value || '').trim();
  if (!term) return;
  switchTab('live');
  state.live.session = term;
  loadLiveEvents();
}

function attachEvents() {
  dom.livePause?.addEventListener('click', () => {
    state.live.paused = !state.live.paused;
    dom.livePause.textContent = state.live.paused ? 'Resume' : 'Pause';
  });
  dom.liveFilters?.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    Array.from(dom.liveFilters.children).forEach(child => child.classList.toggle('active', child === btn));
    state.live.filter = btn.dataset.filter;
    loadLiveEvents();
  });
  dom.sessionApply?.addEventListener('click', () => {
    state.live.session = dom.sessionInput.value.trim();
    loadLiveEvents();
  });
  dom.funnelWindow?.addEventListener('change', (event) => {
    state.funnelWindow = event.target.value;
    loadFunnels();
  });
  dom.funnelRefresh?.addEventListener('click', loadFunnels);
  dom.spotlightForm?.addEventListener('submit', submitDeal);
  dom.spotlightFetch?.addEventListener('click', fetchSpotlight);
  dom.spotlightReset?.addEventListener('click', () => {
    dom.spotlightForm.reset();
    state.currentDealId = null;
  });
  dom.dealsTable?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('.table-row')?.dataset.id;
    if (!id) return;
    dealAction(id, btn.dataset.action);
  });
  dom.dealsTable?.addEventListener('change', handleDealInlineChange);
  dom.dealFilterApply?.addEventListener('click', applyDealFilters);
  dom.dealSortField?.addEventListener('change', () => {
    state.dealSort.field = dom.dealSortField.value;
    fetchDeals();
  });
  dom.seedQuick?.addEventListener('click', () => {
    switchTab('email');
    dom.seedForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  dom.seedForm?.addEventListener('submit', runSeedGenerator);
  dom.settingsForm?.addEventListener('submit', submitSettings);
  dom.quickRefresh?.addEventListener('click', () => {
    showToast('Aktualisierung gestartet');
    loadStats();
    loadLiveEvents();
    loadFunnels();
    loadUtm();
    loadDevices();
    fetchDeals();
  });
  dom.quickExport?.addEventListener('click', exportLiveCsv);
  dom.toggleLiveMode?.addEventListener('click', toggleLiveMode);
  dom.globalSearch?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyGlobalSearch();
  });
  dom.searchTrigger?.addEventListener('click', applyGlobalSearch);
  dom.emailRefresh?.addEventListener('click', loadStats);
  dom.emailsRefresh?.addEventListener('click', loadStats);
  dom.emailExport?.addEventListener('click', exportEmailsCsv);
  dom.emailsCopy?.addEventListener('click', copyEmailList);
  dom.settingsRefresh?.addEventListener('click', fetchSettings);
}

function startIntervals() {
  loadStats({ silent: true });
  loadHealth();
  loadLiveEvents({ silent: true });
  loadFunnels({ silent: true });
  loadUtm('7d', { silent: true });
  loadDevices({ silent: true });
  fetchSpotlight({ silent: true });
  fetchDeals({ silent: true });
  fetchSettings({ silent: true });
  fetchPublicConfig({ silent: true });

  setInterval(() => loadStats({ silent: true }), STATS_INTERVAL);
  setInterval(loadHealth, HEALTH_INTERVAL);
  setInterval(() => loadFunnels({ silent: true }), 60000);
  setInterval(() => loadUtm('7d', { silent: true }), 45000);
  setInterval(() => loadDevices({ silent: true }), 45000);
  state.live.interval = setInterval(() => loadLiveEvents({ silent: true }), LIVE_INTERVAL);
}

function init() {
  attachEvents();
  if (dom.apiBaseDisplay) {
    dom.apiBaseDisplay.textContent = API_BASE;
  }
  startIntervals();
}

init();
