/**
 * kpi-quick.js – Quick KPI overview widget.
 * Pulls data from tracking-stats endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml, formatNumber } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('tracking-stats?range=' + (ctx.range || '7d'));
    if (!data || !data.ok) {
      showError(container, 'Could not load KPIs');
      return;
    }
    const k = data.kpis || {};
    container.innerHTML = '<div class="dc-kpi-grid">' +
      kpiCard('Pageviews', k.pageviews, '') +
      kpiCard('Sessions', k.sessions, '') +
      kpiCard('Unique Visitors', k.uniques, '') +
      kpiCard('CTA Clicks', k.cta_clicks, '') +
      kpiCard('CTR', k.ctr, '%') +
      kpiCard('Newsletter', k.newsletter_success, '') +
      kpiCard('NL Conv.', k.newsletter_conversion, '%') +
      kpiCard('Consent Rate', k.consent_rate, '%') +
      '</div>';
  } catch (err) {
    showError(container, 'Failed to load KPIs');
  }
}

function kpiCard(label, value, suffix) {
  const display = (value != null && value !== '') ? formatNumber(value) + suffix : '–';
  return '<div class="dc-kpi-item">' +
    '<span class="dc-kpi-value">' + escapeHtml(display) + '</span>' +
    '<span class="dc-kpi-label">' + escapeHtml(label) + '</span>' +
    '</div>';
}

export const kpiQuickWidget = {
  id: 'kpi-quick',
  title: 'KPI Overview',
  description: 'Key metrics at a glance',
  size: 'lg',
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
