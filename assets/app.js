const counterEl = document.querySelector('[data-counter]');
const clickDisplays = document.querySelectorAll('[data-clicks]');
const STORAGE_KEY = 'dropcharge-clicks';
const activityClicksEl = document.querySelector('[data-activity-clicks]');
const activityTopEl = document.querySelector('[data-activity-top]');

const defaultConfig = {
  tiktokPixelId: null,
  affiliateLinks: {}
};

let runtimeConfig = {
  ...defaultConfig,
  ...(window.__CONFIG__ || {})
};
let pixelLoaded = false;

loadRuntimeConfig();

async function loadRuntimeConfig() {
  let remoteConfig = {};
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (res.ok) {
      remoteConfig = await res.json();
    }
  } catch (err) {
    console.warn('config load failed', err.message);
  }

  runtimeConfig = {
    ...defaultConfig,
    ...(window.__CONFIG__ || {}),
    ...(remoteConfig || {})
  };

  if (runtimeConfig.tiktokPixelId) {
    initTikTokPixel(runtimeConfig.tiktokPixelId);
  }
  hydrateAffiliateLinks();
}

function initTikTokPixel(pixelId) {
  if (!pixelId || pixelLoaded) return;
  ensureTikTokBootstrap();
  if (typeof window.ttq === 'undefined') return;
  window.ttq.load(pixelId);
  window.ttq.page();
  pixelLoaded = true;
}

function ensureTikTokBootstrap() {
  if (window.ttq) return;
  const name = 'ttq';
  window.TiktokAnalyticsObject = name;
  const ttq = window[name] = window[name] || [];
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
  ttq.setAndDefer = function(t, e) { t[e] = function() { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
  for (let i = 0; i < ttq.methods.length; i += 1) {
    ttq.setAndDefer(ttq, ttq.methods[i]);
  }
  ttq.instance = function(id) {
    const instance = ttq._i[id] || [];
    for (let n = 0; n < ttq.methods.length; n += 1) {
      ttq.setAndDefer(instance, ttq.methods[n]);
    }
    return instance;
  };
  ttq.load = function(id, opts) {
    const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._i[id]._u = src;
    ttq._t = ttq._t || {};
    ttq._t[id] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[id] = opts || {};
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `${src}?sdkid=${id}&lib=${name}`;
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  };
}

function hydrateAffiliateLinks() {
  const links = document.querySelectorAll('[data-affiliate]');
  links.forEach(link => {
    const slug = link.getAttribute('data-affiliate');
    if (!slug) return;
    const href = getAffiliateUrl(slug);
    link.setAttribute('href', href);
    if (/^https?:\/\//i.test(href)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    } else {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });
}

function getAffiliateUrl(slug) {
  if (!slug) return '#';
  const overrides = runtimeConfig.affiliateLinks || {};
  return overrides[slug] || `/go/${slug}`;
}

function resolveSlugFromLink(link) {
  if (!link) return null;
  const dataSlug = link.getAttribute('data-affiliate');
  if (dataSlug) return dataSlug;
  const href = link.getAttribute('href') || '';
  return href.startsWith('/go/') ? href.replace('/go/', '') : null;
}

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
  ['psn-10', 'psn'],
  ['psn-20', 'psn'],
  ['psn-50', 'psn'],
  ['xbox-1m', 'xbox'],
  ['xbox-3m', 'xbox'],
  ['xbox-6m', 'xbox'],
  ['nintendo-15', 'nintendo'],
  ['nintendo-25', 'nintendo'],
  ['nintendo-50', 'nintendo'],
]);

const affiliateLinks = document.querySelectorAll('a[href^="/go/"], [data-affiliate]');
affiliateLinks.forEach(link => {
  link.addEventListener('click', () => {
    const slug = resolveSlugFromLink(link);
    if (!slug) return;
    const bucket = slugMap.get(slug);
    if (bucket && typeof clicks[bucket] === 'number') {
      clicks[bucket] += 1;
      saveClicks(clicks);
      updateUI(clicks);
    }
    track('ClickOutbound', { slug: `/go/${slug}` });
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
  if (!pixelLoaded || !window.ttq) return;
  window.ttq.track(name, meta);
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
  const submitBtn = emailForm.querySelector('button[type="submit"]');
  const utmParams = Object.fromEntries(new URLSearchParams(window.location.search));
  if (submitBtn) submitBtn.disabled = true;
  try {
    const res = await fetch('/.netlify/functions/newsletter-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        source: 'popup',
        utm: utmParams,
        consent: true
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');
    emailForm.innerHTML = '<p class="success">Danke! Deals landen im Postfach.</p>';
    setTimeout(() => popup?.classList.remove('visible'), 2000);
  } catch (err) {
    alert('Signup fehlgeschlagen. Bitte später erneut versuchen.');
    if (submitBtn) submitBtn.disabled = false;
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

