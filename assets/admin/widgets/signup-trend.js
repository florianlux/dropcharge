/**
 * signup-trend.js – Signup trend sparkline widget (pure SVG, no libraries).
 * Uses stats-advanced endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('stats-advanced?range=' + (ctx.range || '7d'));
    if (!data || !data.ok || !data.signup_trend || data.signup_trend.length === 0) {
      showEmpty(container, 'No trend data yet');
      return;
    }

    const points = data.signup_trend;
    const total = points.reduce((s, p) => s + (p.count || 0), 0);
    container.innerHTML = renderSparkline(points) +
      '<div class="dc-trend-summary">' +
        '<span class="dc-trend-total">' + total + ' signups</span>' +
        '<span class="dc-trend-range">' + escapeHtml(data.range || '') + '</span>' +
      '</div>';
  } catch (err) {
    showError(container, 'Failed to load trend');
  }
}

function renderSparkline(points) {
  if (!points.length) return '';

  const W = 280, H = 60, PAD = 4;
  const maxVal = Math.max(...points.map(p => p.count || 0), 1);
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p.count || 0) / maxVal) * (H - PAD * 2);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  const linePath = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c.x + ',' + c.y).join(' ');
  const areaPath = linePath + ' L' + coords[coords.length - 1].x + ',' + (H - PAD) + ' L' + coords[0].x + ',' + (H - PAD) + ' Z';

  return '<svg class="dc-sparkline" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--dc-neon)" stop-opacity="0.25"/>' +
      '<stop offset="100%" stop-color="var(--dc-neon)" stop-opacity="0.02"/>' +
    '</linearGradient></defs>' +
    '<path d="' + areaPath + '" fill="url(#sg)"/>' +
    '<path d="' + linePath + '" fill="none" stroke="var(--dc-neon)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}

export const signupTrendWidget = {
  id: 'signup-trend',
  title: 'Signup Trend',
  description: 'Daily signups over time',
  size: 'md',
  mount(container, ctx) {
    _container = container;
    loadData(container, ctx);
  },
  refresh(ctx) {
    if (_container) loadData(_container, ctx);
  },
  destroy() {
    _container = null;
  }
};
