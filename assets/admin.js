const API = '/.netlify/functions/stats';
const HEALTH_API = '/.netlify/functions/admin-health';
const platformEls = {
  PSN: document.querySelector('#platform-stats .stat:nth-child(1) strong'),
  Xbox: document.querySelector('#platform-stats .stat:nth-child(2) strong'),
  Nintendo: document.querySelector('#platform-stats .stat:nth-child(3) strong')
};
const amountList = document.getElementById('amount-stats');
const healthStatusEl = document.querySelector('[data-health-status]');
const healthErrorEl = document.querySelector('[data-health-error]');
const healthTable = document.getElementById('health-clicks');
const feed = document.getElementById('feed');
const refreshBtn = document.getElementById('refresh');
const emailCountEl = document.getElementById('email-count');
const emailConvEl = document.getElementById('email-conv');
const emailTable = document.getElementById('email-table');
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
let lastEntryId = null;

async function fetchStats() {
  try {
    const res = await fetch(API);
    if (res.status === 401) {
      window.location.href = '/admin/login';
      return { entries: [], totals: { platform: { PSN: 0, Xbox: 0, Nintendo: 0 }, amount: {} } };
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.error('stats API error', err.message);
    return { entries: [], totals: { platform: { PSN: 0, Xbox: 0, Nintendo: 0 }, amount: {} } };
  }
}

function summarize(entries) {
  const totals = { platform: { PSN: 0, Xbox: 0, Nintendo: 0 }, amount: {} };
  entries.forEach(entry => {
    if (entry.platform && totals.platform[entry.platform] !== undefined) {
      totals.platform[entry.platform] += 1;
    }
    if (entry.amount) {
      totals.amount[entry.amount] = (totals.amount[entry.amount] || 0) + 1;
    }
  });
  return totals;
}

function showToast(entry) {
  if (!entry) return;
  const msg = `Neuer Klick auf ${entry.platform} ${entry.amount} ${entry.utm_campaign ? 'via ' + entry.utm_campaign : ''}`.trim();
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

function render(data) {
  const { entries, totals, emailCount = 0, conversion = 0, emails = [] } = data;
  window.__lastEntries = entries;
  if (emailCountEl) emailCountEl.textContent = emailCount;
  if (emailConvEl) emailConvEl.textContent = (conversion * 100).toFixed(1) + '%';
  if (emailTable) {
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
  Object.entries(platformEls).forEach(([key, el]) => {
    if (el) el.textContent = totals.platform[key] || 0;
  });

  amountList.innerHTML = '';
  const sortedAmounts = Object.entries(totals.amount || {}).sort((a,b) => b[1]-a[1]);
  sortedAmounts.slice(0, 5).forEach(([amount, count]) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span>${amount}</span><strong>${count}</strong>`;
    amountList.appendChild(div);
  });

  const existingRows = feed.querySelectorAll('.table-row');
  existingRows.forEach(row => row.remove());
  entries.forEach((entry, index) => {
    if (index === 0 && entry.id && lastEntryId && entry.id !== lastEntryId) {
      showToast(entry);
      lastEntryId = entry.id;
    }
    const row = document.createElement('div');
    row.className = 'table-row';
    row.dataset.id = entry.id;
    row.innerHTML = `
      <span>${new Date(entry.created_at).toLocaleTimeString()}</span>
      <span>${entry.slug}</span>
      <span>${entry.platform}</span>
      <span>${entry.amount}</span>
      <span>${entry.country || '—'}</span>
      <span>${entry.region || '—'}</span>
      <span>${entry.ip_hash ? entry.ip_hash.slice(0, 12) + '…' : '—'}</span>
      <span>${entry.utm_source || ''}/${entry.utm_campaign || ''}</span>
      <span>${entry.referrer || '—'}</span>
    `;
    feed.appendChild(row);
  });
}

async function fetchHealth() {
  try {
    const res = await fetch(HEALTH_API);
    if (res.status === 401) {
      window.location.href = '/admin/login';
      return { connected: false, clicks: [] };
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.error('health API error', err.message);
    return { connected: false, error: err.message, clicks: [] };
  }
}

function renderHealth(data) {
  if (!healthTable || !healthStatusEl) return;
  const { connected, error, clicks = [] } = data;
  healthStatusEl.textContent = connected ? 'connected' : 'offline';
  healthStatusEl.classList.toggle('ok', connected);
  healthStatusEl.classList.toggle('fail', !connected);
  if (healthErrorEl) {
    healthErrorEl.textContent = error ? `Fehler: ${error}` : '';
  }
  healthTable.querySelectorAll('.table-row').forEach(row => row.remove());
  clicks.forEach(click => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${new Date(click.created_at).toLocaleTimeString()}</span>
      <span>${click.slug}</span>
      <span>${click.platform || '—'}</span>
      <span>${click.amount || '—'}</span>
    `;
    healthTable.appendChild(row);
  });
}

async function loadHealth() {
  const data = await fetchHealth();
  renderHealth(data);
}

async function refresh() {
  const data = await fetchStats();
  render(data);
}

refresh().then(() => {
  lastEntryId = window.__lastEntries?.[0]?.id || null;
});
refreshBtn?.addEventListener('click', refresh);
setInterval(refresh, 2000);

loadHealth();
setInterval(loadHealth, 8000);
