/**
 * tracker.js – DropCharge first-party tracker
 *
 * Features:
 *  - Consent banner (Essential / Analytics)
 *  - Session key (sessionStorage) + user_id (localStorage, only after consent)
 *  - page_view on load
 *  - scroll_depth events at 25/50/75/90 %
 *  - Batched event queue flushed every 4 s or on visibilitychange
 *  - [data-track] attribute hooks for CTA / coupon / newsletter
 *  - sendBeacon with fetch keepalive fallback
 *  - Never throws; fails silently
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  var API_BASE = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, '');
  var TRACK_ENDPOINT = API_BASE + '/.netlify/functions/track-event';
  var CONSENT_KEY_ANALYTICS = 'dc_consent_analytics';
  var USER_ID_KEY = 'dc_uid';
  var SESSION_KEY_NAME = 'dc_session_key';
  var FLUSH_INTERVAL_MS = 4000;

  // ── State ───────────────────────────────────────────────
  var _queue = [];
  var _flushTimer = null;
  var _sessionKey = null;
  var _userId = null;
  var _consentAnalytics = false;
  var _utmParams = {};
  var _scrollSent = {};

  // ── Safe storage wrappers ───────────────────────────────
  function safeGet(storage, key) {
    try { return storage.getItem(key); } catch { return null; }
  }
  function safeSet(storage, key, val) {
    try { storage.setItem(key, val); } catch { /* ignore */ }
  }

  // ── UUID v4 ─────────────────────────────────────────────
  function uuid4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ── UTM parsing ─────────────────────────────────────────
  function parseUtm() {
    try {
      var sp = new URLSearchParams(window.location.search);
      var utm = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
        var v = sp.get(k);
        if (v) utm[k] = v;
      });
      return utm;
    } catch { return {}; }
  }

  // ── Consent ─────────────────────────────────────────────
  function readConsent() {
    return safeGet(localStorage, CONSENT_KEY_ANALYTICS) === 'true';
  }

  function applyConsent(value) {
    _consentAnalytics = value;
    safeSet(localStorage, CONSENT_KEY_ANALYTICS, value ? 'true' : 'false');
    if (value) {
      if (!_userId) {
        _userId = safeGet(localStorage, USER_ID_KEY) || uuid4();
        safeSet(localStorage, USER_ID_KEY, _userId);
      }
      enqueue({ event_name: 'consent_update', props: { analytics: true } });
    } else {
      _userId = null;
      try { localStorage.removeItem(USER_ID_KEY); } catch { /* ignore */ }
    }
    hideBanner();
  }

  function hideBanner() {
    var b = document.getElementById('dc-consent-banner');
    if (b) b.style.display = 'none';
  }

  function showConsentBanner() {
    if (document.getElementById('dc-consent-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'dc-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:99999',
      'background:rgba(15,15,25,.97)', 'color:#e5e7eb',
      'font-family:system-ui,sans-serif', 'font-size:14px',
      'padding:14px 20px', 'display:flex', 'gap:12px',
      'align-items:center', 'flex-wrap:wrap',
      'border-top:1px solid rgba(124,58,237,.4)',
      'box-shadow:0 -4px 20px rgba(0,0,0,.5)',
      'backdrop-filter:blur(8px)'
    ].join(';');
    banner.innerHTML = [
      '<span style="flex:1;min-width:200px;">',
      '🍪 We use analytics to improve your experience.',
      ' <a href="/privacy" style="color:#a78bfa;text-decoration:underline;" target="_blank">Privacy policy</a>',
      '</span>',
      '<button id="dc-consent-accept" style="',
        'padding:7px 18px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;',
        'background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;">',
      'Accept analytics',
      '</button>',
      '<button id="dc-consent-decline" style="',
        'padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer;',
        'background:transparent;color:#9ca3af;font-size:13px;">',
      'Essential only',
      '</button>'
    ].join('');
    document.body.appendChild(banner);
    document.getElementById('dc-consent-accept').addEventListener('click', function () { applyConsent(true); });
    document.getElementById('dc-consent-decline').addEventListener('click', function () { applyConsent(false); });
  }

  // ── Session key ─────────────────────────────────────────
  function initSession() {
    _sessionKey = safeGet(sessionStorage, SESSION_KEY_NAME);
    if (!_sessionKey) {
      _sessionKey = uuid4();
      safeSet(sessionStorage, SESSION_KEY_NAME, _sessionKey);
    }
  }

  // ── Event queue / flush ─────────────────────────────────
  function enqueue(eventData) {
    var payload = Object.assign({}, eventData, _utmParams, {
      session_key: _sessionKey,
      user_id: _consentAnalytics ? _userId : null,
      consent_analytics: _consentAnalytics,
      path: window.location.pathname,
      referrer: document.referrer || null
    });
    _queue.push(payload);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }

  function flush() {
    _flushTimer = null;
    if (_queue.length === 0) return;
    var batch = _queue.splice(0, _queue.length);
    batch.forEach(function (payload) { send(payload); });
  }

  function send(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(TRACK_ENDPOINT, blob);
      } else {
        fetch(TRACK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () { /* ignore */ });
      }
    } catch (e) { /* silent */ }
  }

  // ── Scroll depth ────────────────────────────────────────
  var _scrollThresholds = [25, 50, 75, 90];
  var _scrollTicking = false;

  function onScroll() {
    if (_scrollTicking) return;
    _scrollTicking = true;
    requestAnimationFrame(function () {
      _scrollTicking = false;
      var scrolled = window.scrollY + window.innerHeight;
      var total = document.documentElement.scrollHeight;
      if (!total) return;
      var pct = Math.round((scrolled / total) * 100);
      _scrollThresholds.forEach(function (threshold) {
        if (pct >= threshold && !_scrollSent[threshold]) {
          _scrollSent[threshold] = true;
          enqueue({ event_name: 'scroll_depth', props: { percent: threshold } });
        }
      });
    });
  }

  // ── [data-track] hooks ──────────────────────────────────
  function bindDataTrack() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      // Walk up the DOM tree looking for a data-track attribute
      for (var i = 0; i < 5 && el && el !== document.body; i++) {
        if (el.dataset && el.dataset.track) {
          var evtName = el.dataset.track;
          var props = {};
          // Collect all other data-* attributes as props
          var ds = el.dataset;
          for (var key in ds) {
            if (key !== 'track') props[key] = ds[key];
          }
          enqueue({ event_name: evtName, props: props });
          break;
        }
        el = el.parentElement;
      }
    }, true); // capture phase to catch before href navigation
  }

  // ── Outbound link tracking ──────────────────────────────
  function bindOutboundLinks() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      for (var i = 0; i < 5 && el && el.tagName !== 'BODY'; i++) {
        if (el.tagName === 'A' && el.href) {
          try {
            var url = new URL(el.href);
            if (url.host !== window.location.host) {
              enqueue({ event_name: 'outbound_click', props: { url: url.href.slice(0, 256), position: el.dataset.position || null } });
            }
          } catch { /* ignore */ }
          break;
        }
        el = el.parentElement;
      }
    }, true);
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    try {
      _utmParams = parseUtm();
      initSession();
      _consentAnalytics = readConsent();
      if (_consentAnalytics) {
        _userId = safeGet(localStorage, USER_ID_KEY) || null;
      }

      // Send page_view immediately (no consent required for anonymous event)
      enqueue({ event_name: 'page_view', props: { title: document.title } });

      // Show consent banner if user hasn't chosen yet
      if (safeGet(localStorage, CONSENT_KEY_ANALYTICS) === null) {
        showConsentBanner();
      }

      // Scroll depth tracking
      window.addEventListener('scroll', onScroll, { passive: true });

      // Data-track attribute hooks
      bindDataTrack();

      // Outbound link tracking
      bindOutboundLinks();

      // Flush on page hide / tab switch
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flush();
      });
      window.addEventListener('pagehide', flush);

    } catch (e) { /* silent */ }
  }

  // Run after DOM is available
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a minimal public API for manual event firing
  window.dcTrack = function (eventName, props) {
    try { enqueue({ event_name: eventName, props: props || {} }); } catch { /* silent */ }
  };
})();
