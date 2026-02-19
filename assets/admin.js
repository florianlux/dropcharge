const API_STATS = '/.netlify/functions/stats';
const API_HEALTH = '/.netlify/functions/admin-health';
const API_SPOTLIGHT = '/.netlify/functions/spotlight';
const API_SEED = '/.netlify/functions/admin-seed';

const TOKEN_STORAGE_KEY = 'admin_token';
const STATS_INTERVAL = 10000;
const HEALTH_INTERVAL = 15000;

const platformEls = {
  PSN: document.querySelector('#platform-stats .stat:nth-child(1) strong'),
  Xbox: document.querySelector('#platform-stats .stat:nth-child(2) strong'),
  Nintendo: document.querySelector('#platform-stats .stat:nth-child(3) strong')
};
const amountList = document.getElementById('amount-stats');
const feedTable = document.getElementById('feed');
const emailCountEl = document.getElementById('email-count');
const emailConvEl = document.getElementById('email-conv');
const clicksMetaEl = document.getElementById('clicks-meta');
const bannerEl = document.getElementById('admin-banner');
const healthStatusEl = document.querySelector('[data-health-status]');
const healthAuthEl = document.querySelector('[data-health-auth]');
const healthSupabaseEl = document.querySelector('[data-health-supabase]');
const healthBuildEl = document.querySelector('[data-health-build]');
const healthErrorEl = document.querySelector('[data-health-error]');
const emailTable = document.getElementById('email-table');
const spotlightForm = document.getElementById('spotlight-form');
const spotlightFetchBtn = document.getElementById('spotlight-fetch');
const seedBtn = document.getElementById('seed-data');
const clearTokenBtn = document.getElementById('admin-clear-token');
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

(function ensureTokenPresent() {
  if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
    window.location.href = '/admin-login.html';
  }
})();

function showToast(message) {
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

function buildHeaders(extra = {}) {
  const headers = { ...extra };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) headers['x-admin-token'] = token;
  return headers;
}

function handleUnauthorized() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.location.href = '/admin-login.html';
}

function updateBanner(authEnabled) {
  if (!bannerEl) return;
  if (authEnabled) {
    bannerEl.classList.remove('visible');
  } else {
    bannerEl.classList.add('visible');
  }
}

function renderStats(data) {
  const metrics = data?.metrics;
  if (!metrics) return;
  const { platformCounts = {}, emails24h = 0, conversion24h = 0, topAmounts = [], feed = [], clicks24h = 0, clicks30m = 0 } = metrics;

  const values = { PSN: platformCounts.PSN || 0, Xbox: platformCounts.Xbox || 0, Nintendo: platformCounts.Nintendo || 0 };
  Object.entries(values).forEach(([key, value]) => {
    if (platformEls[key]) platformEls[key].textContent = value;
  });
  if (clicksMetaEl) {
    clicksMetaEl.textContent = `${clicks24h} Klicks / ${clicks30m} in 30 Min`;
  }

  if (emailCountEl) emailCountEl.textContent = emails24h;
  if (emailConvEl) emailConvEl.textContent = `${conversion24h.toFixed(1)}%`;

  if (amountList) {
    amountList.innerHTML = '';
    if (!topAmounts.length) {
      amountList.innerHTML = '<div class="list-item"><span>Keine Daten</span><strong>0</strong></div>';
    } else {
      topAmounts.forEach(item => {
        const row = document.createElement('div');
        row.className = 'list-item';
        row.innerHTML = `
          <div>
            <strong>${item.amount || '—'}</strong>
            <small>${item.platform || '—'} · ${item.slug || ''}</small>
          </div>
          <strong>${item.count}</strong>
        `;
        amountList.appendChild(row);
      });
    }
  }

  if (feedTable) {
    feedTable.querySelectorAll('.table-row').forEach(row => row.remove());
    feed.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = `
        <span>${new Date(entry.created_at).toLocaleTimeString()}</span>
        <span>${entry.slug || '—'}</span>
        <span>${entry.platform || '—'}</span>
        <span>${entry.amount || '—'}</span>
      `;
      feedTable.appendChild(row);
    });
  }
}

function renderEmails(emails = []) {
  if (!emailTable) return;
  emailTable.querySelectorAll('.table-row').forEach(row => row.remove());
  emails.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${entry.email}</span>
      <span>${new Date(entry.created_at).toLocaleString()}</span>
      <span>${entry.confirmed ? 'Confirmed' : 'Pending'}</span>
    `;
    emailTable.appendChild(row);
  });
}

async function loadStats() {
  try {
    const res = await fetch(API_STATS, { headers: buildHeaders() });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('Failed to load stats');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Stats error');
    renderStats(json);
    renderEmails(json.metrics?.emailRows || []);
  } catch (err) {
    console.error('stats load failed', err.message);
  }
}

async function loadHealth() {
  try {
    const res = await fetch(API_HEALTH, { headers: buildHeaders() });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('Failed health');
    const json = await res.json();
    updateBanner(json.authEnabled);
    if (healthStatusEl) {
      healthStatusEl.textContent = json.ok ? 'CONNECTED' : 'ISSUE';
      healthStatusEl.classList.toggle('ok', json.ok);
      healthStatusEl.classList.toggle('fail', !json.ok);
    }
    if (healthAuthEl) healthAuthEl.textContent = json.authEnabled ? 'Aktiv' : 'Offen';
    if (healthSupabaseEl) healthSupabaseEl.textContent = json.hasSupabase ? 'OK' : 'Fehlt';
    if (healthBuildEl) healthBuildEl.textContent = json.build || 'local';
    if (healthErrorEl) healthErrorEl.textContent = json.ok ? '' : (json.error || 'Unbekannter Fehler');
  } catch (err) {
    console.error('health load failed', err.message);
    if (healthStatusEl) {
      healthStatusEl.textContent = 'ISSUE';
      healthStatusEl.classList.add('fail');
    }
    if (healthErrorEl) healthErrorEl.textContent = err.message;
  }
}

const spotlightPreviewEl = document.getElementById('spotlight-preview');

function updateSpotlightPreview(data) {
  if (!spotlightPreviewEl) return;
  const entry = data || {};
  spotlightPreviewEl.querySelector('h3').textContent = entry.title || '—';
  const desc = spotlightPreviewEl.querySelector('.desc');
  if (desc) desc.textContent = entry.description || 'Noch kein Text.';
  const meta = spotlightPreviewEl.querySelector('.meta');
  const details = [entry.subtitle, entry.platform, entry.discount].filter(Boolean).join(' · ');
  meta.textContent = details || '—';
}

async function fetchSpotlightAdmin() {
  try {
    const res = await fetch(API_SPOTLIGHT);
    if (!res.ok) throw new Error('spotlight fetch');
    const data = await res.json();
    updateSpotlightPreview(data.spotlight);
  } catch (err) {
    console.warn('spotlight admin fetch failed', err.message);
  }
}

spotlightFetchBtn?.addEventListener('click', fetchSpotlightAdmin);
spotlightForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(spotlightForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const res = await fetch(API_SPOTLIGHT, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('spotlight save');
    showToast('Spotlight gespeichert');
    spotlightForm.reset();
    fetchSpotlightAdmin();
  } catch (err) {
    alert('Spotlight konnte nicht gespeichert werden.');
  }
});

seedBtn?.addEventListener('click', async () => {
  seedBtn.disabled = true;
  try {
    const res = await fetch(API_SEED, { method: 'POST', headers: buildHeaders() });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('seed failed');
    showToast('Seed erstellt');
    loadStats();
  } catch (err) {
    alert('Seed fehlgeschlagen.');
  } finally {
    seedBtn.disabled = false;
  }
});

clearTokenBtn?.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.location.href = '/admin-login.html';
});

fetchSpotlightAdmin();
loadStats();
loadHealth();
setInterval(loadStats, STATS_INTERVAL);
setInterval(loadHealth, HEALTH_INTERVAL);
