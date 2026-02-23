/**
 * Growth Ops Panel – renders action cards + modals from the ops registry
 */
import { opsActions } from './ops-registry.js';

/* ── Static content for modals ───────────────────────── */

const CHECKLIST_ITEMS = [
  'TikTok Business Center account active',
  'TikTok Pixel installed & firing (ViewContent, ClickButton)',
  'ClickTemu event configured on landing CTA',
  'Pre-sell landing page live (/compare.html)',
  'Temu affiliate links verified & tracking',
  'Ad creatives uploaded (3+ variations)',
  'Campaign budget set (daily cap)',
  'Targeting: interests + lookalike audiences configured',
  'Conversion API (optional) connected',
  'Monitoring dashboard bookmarked'
];

const CREATIVE_PACK = {
  hooks: [
    '🎮 "POV: You found the CHEAPEST RGB gaming setup on Temu"',
    '🔥 "I can\'t believe this RGB strip was only $3.99"',
    '💡 "Stop overpaying for gaming LEDs — here\'s the hack"',
    '🎯 "This $4 LED strip looks like a $40 setup"',
    '👀 "Watch me transform my setup for under $5"'
  ],
  scripts: [
    'Hook → Show boring setup → Peel & stick LED → Reveal glow-up → CTA "Link in bio"',
    'Hook → Unboxing close-up → React to brightness → Show remote colors → CTA',
    'Hook → Split screen: before/after → Price reveal → CTA with urgency'
  ],
  ctas: [
    '🔗 "Link in bio — grab it before the sale ends"',
    '💰 "Tap the link, thank me later"',
    '⚡ "Get yours now — only [X] left at this price"',
    '🎁 "New user bonus: extra 30% off with my link"'
  ]
};

const OPTIMIZER_NOTES = [
  { area: 'Above the fold', note: 'Hero image + single CTA visible without scroll. Keep headline under 8 words.' },
  { area: 'Social proof', note: 'Add TikTok view count badge or "As seen on TikTok" trust marker near CTA.' },
  { area: 'CTA button', note: 'Use contrasting neon color. Text: action-oriented ("Get Deal" > "Learn More").' },
  { area: 'Page speed', note: 'Compress hero image to < 100 KB. Lazy-load below-fold images.' },
  { area: 'Mobile-first', note: 'Thumb-zone CTA placement. Min tap target 48×48 px.' },
  { area: 'Urgency', note: 'Countdown timer or stock-scarcity indicator boosts CVR 15-25%.' },
  { area: 'Exit intent', note: 'Spin-wheel popup on exit recaptures 5-8% of bouncing traffic.' },
  { area: 'Pixel events', note: 'Fire ViewContent on load, ClickButton on CTA click, Purchase on conversion page.' }
];

/* ── Feature flag cache ──────────────────────────────── */
let _featureFlags = null;

async function loadFeatureFlags(apiGet) {
  if (_featureFlags) return _featureFlags;
  try {
    const cfg = await apiGet('public-config');
    _featureFlags = cfg || {};
  } catch {
    _featureFlags = {};
  }
  return _featureFlags;
}

function isFeatureEnabled(flags, flag) {
  if (!flag) return true;
  const v = flags[flag];
  return v === true || v === '1' || v === 'true';
}

/* ── Rendering ───────────────────────────────────────── */

function createActionCard(action, onClick) {
  const card = document.createElement('div');
  card.className = 'ops-card';
  card.dataset.opsId = action.id;

  const label = action.type === 'link' ? 'Open' : action.type === 'api' ? 'Check' : action.type === 'tab' ? 'Go' : 'Run';

  card.innerHTML = `
    <span class="ops-card-icon">${action.icon}</span>
    <div class="ops-card-body">
      <strong class="ops-card-title">${action.title}</strong>
      <span class="ops-card-desc">${action.description}</span>
    </div>
    <button class="btn mini primary ops-card-btn">${label}</button>
  `;

  card.querySelector('.ops-card-btn').addEventListener('click', () => onClick(action));
  return card;
}

/* ── Modals ──────────────────────────────────────────── */

function getOrCreateOverlay() {
  let overlay = document.getElementById('ops-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ops-overlay';
    overlay.className = 'ops-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
  }
  return overlay;
}

function openModal(title, contentHtml) {
  const overlay = getOrCreateOverlay();
  overlay.innerHTML = `
    <div class="ops-modal">
      <div class="ops-modal-head">
        <h3>${title}</h3>
        <button class="ops-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="ops-modal-body">${contentHtml}</div>
    </div>
  `;
  overlay.classList.add('active');
  overlay.querySelector('.ops-modal-close').addEventListener('click', closeModal);
}

function closeModal() {
  const overlay = document.getElementById('ops-overlay');
  if (overlay) overlay.classList.remove('active');
}

/* ── Modal content builders ──────────────────────────── */

function buildChecklist() {
  const items = CHECKLIST_ITEMS.map((text, i) =>
    `<label class="ops-check-item"><input type="checkbox" data-idx="${i}"> ${text}</label>`
  ).join('');
  return `<div class="ops-checklist">${items}</div>
    <button class="btn mini ghost ops-copy-checklist" style="margin-top:.75rem">📋 Copy as text</button>`;
}

function buildSimulator(ctx) {
  return `
    <form class="ops-sim-form" id="ops-sim-form">
      <div class="ops-sim-grid">
        <label>Traffic (visits)<input type="number" name="traffic" value="10000" min="0"></label>
        <label>CPC ($)<input type="number" name="cpc" value="0.08" step="0.01" min="0"></label>
        <label>Click Rate (%)<input type="number" name="clickRate" value="12" step="0.1" min="0" max="100"></label>
        <label>Conv Rate (%)<input type="number" name="convRate" value="4" step="0.1" min="0" max="100"></label>
        <label>AOV ($)<input type="number" name="aov" value="28" step="0.01" min="0"></label>
        <label>Commission (%)<input type="number" name="commission" value="10" step="0.1" min="0" max="100"></label>
        <label>Bonus per sale ($)<input type="number" name="bonus" value="0" step="0.01" min="0"></label>
      </div>
      <button type="submit" class="btn primary" style="margin-top:.75rem">▶ Simulate</button>
    </form>
    <div class="ops-sim-result" id="ops-sim-result" style="display:none">
      <div class="ops-sim-kpis">
        <div class="ops-sim-kpi"><span class="ops-sim-label">Expected Revenue</span><strong id="sim-revenue">–</strong></div>
        <div class="ops-sim-kpi"><span class="ops-sim-label">Expected Cost</span><strong id="sim-cost">–</strong></div>
        <div class="ops-sim-kpi"><span class="ops-sim-label">Expected Profit</span><strong id="sim-profit">–</strong></div>
        <div class="ops-sim-kpi"><span class="ops-sim-label">Breakeven CPC</span><strong id="sim-breakeven">–</strong></div>
      </div>
    </div>`;
}

function buildCreativePack() {
  const hooksList = CREATIVE_PACK.hooks.map(h => `<li>${h}</li>`).join('');
  const scriptsList = CREATIVE_PACK.scripts.map(s => `<li>${s}</li>`).join('');
  const ctasList = CREATIVE_PACK.ctas.map(c => `<li>${c}</li>`).join('');

  return `
    <div class="ops-tabs">
      <button class="ops-tab active" data-ops-tab="hooks">Hooks</button>
      <button class="ops-tab" data-ops-tab="scripts">Scripts</button>
      <button class="ops-tab" data-ops-tab="ctas">CTAs</button>
    </div>
    <div class="ops-tab-panel active" data-ops-panel="hooks"><ul class="ops-list">${hooksList}</ul></div>
    <div class="ops-tab-panel" data-ops-panel="scripts"><ul class="ops-list">${scriptsList}</ul></div>
    <div class="ops-tab-panel" data-ops-panel="ctas"><ul class="ops-list">${ctasList}</ul></div>`;
}

function buildOptimizer() {
  const rows = OPTIMIZER_NOTES.map(n =>
    `<tr><td class="ops-opt-area">${n.area}</td><td>${n.note}</td></tr>`
  ).join('');
  return `<table class="ops-opt-table"><thead><tr><th>Area</th><th>Recommendation</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildPixelStatus(data) {
  const dot = (ok) => `<span class="ops-dot ${ok ? 'green' : 'red'}"></span>`;
  return `
    <div class="ops-status-grid">
      <div class="ops-status-row">${dot(data.pixelDetected)} TikTok Pixel configured</div>
      <div class="ops-status-row">${dot(data.dbOk)} Database connected</div>
      <div class="ops-status-row">${dot(data.landingLive)} Landing page live</div>
      <div class="ops-status-row">
        <span class="ops-status-label">ClickTemu events (24 h)</span>
        <strong>${data.clickTemuCount24h}</strong>
      </div>
      <div class="ops-status-row">
        <span class="ops-status-label">Last event seen</span>
        <strong>${data.lastEventSeenAt ? new Date(data.lastEventSeenAt).toLocaleString() : '—'}</strong>
      </div>
    </div>`;
}

/* ── Action handlers ─────────────────────────────────── */

function handleAction(action, ctx) {
  switch (action.type) {
    case 'link':
      window.open(action.target, '_blank');
      break;
    case 'tab':
      switchToTab(action.target);
      break;
    case 'modal':
      openModalForAction(action, ctx);
      break;
    case 'api':
      handleApiAction(action, ctx);
      break;
  }
}

function switchToTab(tabName) {
  const link = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
  if (link) link.click();
}

function openModalForAction(action, ctx) {
  let content = '';
  switch (action.id) {
    case 'temu-checklist':
      content = buildChecklist();
      break;
    case 'kpi-simulator':
      content = buildSimulator(ctx);
      break;
    case 'creative-pack':
      content = buildCreativePack();
      break;
    case 'landing-optimizer':
      content = buildOptimizer();
      break;
    default:
      content = '<p>Content not available.</p>';
  }
  openModal(action.title, content);

  // Post-render wiring
  if (action.id === 'temu-checklist') wireChecklist();
  if (action.id === 'kpi-simulator') wireSimulator(ctx);
  if (action.id === 'creative-pack') wireCreativeTabs();
}

async function handleApiAction(action, ctx) {
  if (action.id === 'pixel-status') {
    openModal(action.title, '<p class="ops-loading">Loading status…</p>');
    try {
      const data = await ctx.apiGet('ops-health');
      const body = document.querySelector('.ops-modal-body');
      if (body) body.innerHTML = buildPixelStatus(data);
    } catch {
      const body = document.querySelector('.ops-modal-body');
      if (body) body.innerHTML = '<p class="ops-error">Failed to load status.</p>';
    }
  }
}

/* ── Interactive wiring ──────────────────────────────── */

function wireChecklist() {
  const btn = document.querySelector('.ops-copy-checklist');
  if (btn) {
    btn.addEventListener('click', () => {
      const items = document.querySelectorAll('.ops-check-item');
      const text = Array.from(items).map(el => {
        const cb = el.querySelector('input');
        return `${cb.checked ? '[x]' : '[ ]'} ${el.textContent.replace(/^\s+/, '').trim()}`;
      }).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy as text'; }, 2000);
      });
    });
  }
}

function wireSimulator(ctx) {
  const form = document.getElementById('ops-sim-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const input = {};
    for (const [k, v] of fd.entries()) input[k] = Number(v);

    try {
      const res = await ctx.apiPost('ops-simulate', input);
      const box = document.getElementById('ops-sim-result');
      if (box) box.style.display = '';
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('sim-revenue', '$' + (res.expectedRevenue || 0).toFixed(2));
      set('sim-cost', '$' + (res.expectedCost || 0).toFixed(2));
      set('sim-profit', '$' + (res.expectedProfit || 0).toFixed(2));
      set('sim-breakeven', '$' + (res.breakevenCpc || 0).toFixed(4));

      const profitEl = document.getElementById('sim-profit');
      if (profitEl) {
        profitEl.classList.toggle('positive', res.expectedProfit > 0);
        profitEl.classList.toggle('negative', res.expectedProfit < 0);
      }
    } catch {
      const box = document.getElementById('ops-sim-result');
      if (box) { box.style.display = ''; box.innerHTML = '<p class="ops-error">Simulation failed.</p>'; }
    }
  });
}

function wireCreativeTabs() {
  const tabs = document.querySelectorAll('.ops-tab');
  const panels = document.querySelectorAll('.ops-tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.querySelector(`[data-ops-panel="${tab.dataset.opsTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ── Public init ─────────────────────────────────────── */

export async function initOpsPanel(ctx) {
  const container = document.getElementById('ops-actions-grid');
  if (!container) return;

  const flags = await loadFeatureFlags(ctx.apiGet);

  container.innerHTML = '';
  for (const action of opsActions) {
    if (!isFeatureEnabled(flags, action.featureFlag)) continue;
    const card = createActionCard(action, (a) => handleAction(a, ctx));
    container.appendChild(card);
  }
}
