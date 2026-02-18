const counterEl = document.querySelector('[data-counter]');
const clickDisplays = document.querySelectorAll('[data-clicks]');
const STORAGE_KEY = 'dropcharge-clicks';
const activityClicksEl = document.querySelector('[data-activity-clicks]');
const activityTopEl = document.querySelector('[data-activity-top]');

function loadClicks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { psn: 0, xbox: 0, nintendo: 0 };
  } catch {
    return { psn: 0, xbox: 0, nintendo: 0 };
  }
}

function saveClicks(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function updateUI(data) {
  clickDisplays.forEach(el => {
    const key = el.getAttribute('data-clicks');
    el.textContent = data[key] ?? 0;
  });
}

function updateCounter() {
  if (!counterEl) return;
  const base = 50;
  const variation = Math.floor(Math.random() * 40);
  counterEl.textContent = `Heute ${base + variation} Codes aktiviert`;
}

const clicks = loadClicks();
updateUI(clicks);
updateCounter();

// sticky bar show after scrolling
const sticky = document.getElementById('sticky-cta');
if (sticky) {
  const showAfter = 400;
  window.addEventListener('scroll', () => {
    if (window.scrollY > showAfter) sticky.classList.add('visible');
    else sticky.classList.remove('visible');
  });
}

// intercept buttons to increment local counts
const slugMap = new Map([
  ['/go/psn-10', 'psn'],
  ['/go/psn-20', 'psn'],
  ['/go/psn-50', 'psn'],
  ['/go/xbox-1m', 'xbox'],
  ['/go/xbox-3m', 'xbox'],
  ['/go/xbox-6m', 'xbox'],
  ['/go/nintendo-15', 'nintendo'],
  ['/go/nintendo-25', 'nintendo'],
  ['/go/nintendo-50', 'nintendo'],
]);

document.querySelectorAll('a[href^="/go/"]').forEach(link => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    const key = slugMap.get(href);
    if (key && clicks[key] !== undefined) {
      clicks[key] += 1;
      saveClicks(clicks);
      updateUI(clicks);
    }
    track('ClickOutbound', { slug: href });
  });
});



const spotlightCard = document.querySelector('[data-spotlight]');
const spotlightTitle = document.querySelector('[data-spotlight-title]');
const spotlightDescription = document.querySelector('[data-spotlight-description]');
const spotlightCover = document.querySelector('[data-spotlight-cover]');
const spotlightRelease = document.querySelector('[data-spotlight-release]');
const spotlightPrice = document.querySelector('[data-spotlight-price]');
const spotlightAmazon = document.querySelector('[data-spotlight-amazon]');
const spotlightG2G = document.querySelector('[data-spotlight-g2g]');

function formatRelease(dateText) {
  if (!dateText) return 'Release: tba';
  const date = new Date(dateText);
  if (!isNaN(date.getTime())) {
    return `Release: ${date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  return `Release: ${dateText}`;
}

function updateSpotlight(data) {
  if (!data || !spotlightCard) return;
  if (spotlightTitle) spotlightTitle.textContent = data.title || 'Weekly Spotlight';
  if (spotlightDescription) spotlightDescription.textContent = data.description || 'Ein kuratiertes Game mit ehrlicher Empfehlung.';
  if (spotlightCover) {
    const fallback = spotlightCover.getAttribute('data-default') || spotlightCover.src;
    spotlightCover.src = data.cover_url || fallback;
  }
  if (spotlightRelease) spotlightRelease.textContent = data.release_date ? formatRelease(data.release_date) : 'Release: tba';
  if (spotlightPrice) spotlightPrice.textContent = data.price ? `Preis: ${data.price}` : 'Preis: auf Partnerseite';
  if (spotlightAmazon) {
    if (data.amazon_url) {
      spotlightAmazon.href = data.amazon_url;
      spotlightAmazon.removeAttribute('disabled');
    } else {
      spotlightAmazon.href = '#';
      spotlightAmazon.setAttribute('disabled', 'true');
    }
  }
  if (spotlightG2G) {
    if (data.g2g_url) {
      spotlightG2G.href = data.g2g_url;
      spotlightG2G.removeAttribute('disabled');
    } else {
      spotlightG2G.href = '#';
      spotlightG2G.setAttribute('disabled', 'true');
    }
  }
}

async function loadSpotlight() {
  if (!spotlightCard) return;
  try {
    const res = await fetch('/.netlify/functions/spotlight');
    if (!res.ok) throw new Error('failed spotlight');
    const data = await res.json();
    updateSpotlight(data.spotlight);
  } catch (err) {
    console.warn('spotlight fetch failed', err.message);
  }
}

loadSpotlight();

const urlParams = new URLSearchParams(window.location.search);
const utm_source = urlParams.get('utm_source');
const utm_campaign = urlParams.get('utm_campaign');

async function logEvent(name, meta = {}) {
  try {
    await fetch('/.netlify/functions/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, utm_source, utm_campaign, meta })
    });
  } catch (err) {
    console.warn('event log failed', err);
  }
}

function firePixel(name, meta = {}) {
  if (window.ttq && window.TIKTOK_PIXEL_ID && window.TIKTOK_PIXEL_ID !== 'TIKTOK_PIXEL_ID') {
    window.ttq.track(name, meta);
  }
}

function track(name, meta = {}) {
  firePixel(name, meta);
  logEvent(name, meta);
}

document.addEventListener('DOMContentLoaded', () => {
  track('ViewContent');
  setTimeout(() => track('TimeOnPage15s'), 15000);
});

let scrollTracked = false;
window.addEventListener('scroll', () => {
  if (scrollTracked) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return;
  const depth = (scrollTop / docHeight) * 100;
  if (depth >= 60) {
    scrollTracked = true;
    track('ScrollDepth', { depth: Math.round(depth) });
  }
});

const popup = document.getElementById('email-popup');
const emailForm = document.getElementById('email-form');
const closeBtn = document.querySelector('[data-close-email]');
let popupShown = false;

function showPopup() {
  if (!popup || popupShown) return;
  popup.classList.add('visible');
  popupShown = true;
}

if (popup) {
  setTimeout(showPopup, 5000);
}

closeBtn?.addEventListener('click', () => popup?.classList.remove('visible'));

emailForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(emailForm);
  const email = formData.get('email');
  try {
    const res = await fetch('/.netlify/functions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Failed');
    emailForm.innerHTML = '<p class="success">Danke! Deals landen im Postfach.</p>';
    setTimeout(() => popup?.classList.remove('visible'), 2000);
  } catch (err) {
    alert('Speichern fehlgeschlagen. Bitte später erneut versuchen.');
  }
});

async function fetchActivity() {
  if (!activityClicksEl && !activityTopEl) return;
  try {
    const res = await fetch('/.netlify/functions/activity');
    if (!res.ok) throw new Error('activity failed');
    const data = await res.json();
    if (activityClicksEl && typeof data.clicksLast30m === 'number') {
      activityClicksEl.textContent = data.clicksLast30m;
    }
    if (activityTopEl) {
      activityTopEl.textContent = data.topDeal?.label || '—';
    }
  } catch (err) {
    console.warn('activity fetch failed', err.message);
  }
}

fetchActivity();
setInterval(fetchActivity, 30000);

const activityTimerEl = document.getElementById('activity-timer');
const activityBadgeEl = document.getElementById('activity-badge');
const activityCountEl = document.getElementById('activity-count');
let activityBase = null;
let activityInterval = null;

function renderTimer() {
  if (!activityTimerEl || activityBase === null) return;
  const diff = activityBase ? Math.max(0, Math.floor((Date.now() - activityBase) / 1000)) : 0;
  const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
  const seconds = String(diff % 60).padStart(2, '0');
  activityTimerEl.textContent = `Letzte Aktivität: ${minutes}:${seconds}`;

  if (activityBadgeEl) {
    activityBadgeEl.classList.remove('badge-hot', 'badge-pulse');
    activityBadgeEl.textContent = 'Idle';
    if (diff < 120) {
      activityBadgeEl.classList.add('badge-hot');
      activityBadgeEl.textContent = '🔥 Aktiv';
    }
    if (diff < 30) {
      activityBadgeEl.classList.add('badge-pulse');
    }
  }
}

async function fetchLastActivity() {
  if (!activityTimerEl) return;
  try {
    const res = await fetch('/api/activity?slug=psn-20');
    if (!res.ok) throw new Error('activity timer failed');
    const data = await res.json();
    if (typeof data.lastClickTs === 'number') {
      activityBase = data.lastClickTs;
      renderTimer();
    }
    if (activityCountEl && typeof data.clicks30m === 'number') {
      activityCountEl.textContent = `${data.clicks30m} Klicks in den letzten 30 Minuten`;
    }
  } catch (err) {
    console.warn('last activity fetch failed', err.message);
  }
}

if (activityTimerEl) {
  fetchLastActivity();
  activityInterval = setInterval(() => {
    renderTimer();
  }, 1000);
  setInterval(fetchLastActivity, 10000);
}

