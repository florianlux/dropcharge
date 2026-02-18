const counterEl = document.querySelector('[data-counter]');
const clickDisplays = document.querySelectorAll('[data-clicks]');
const STORAGE_KEY = 'dropcharge-clicks';

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
