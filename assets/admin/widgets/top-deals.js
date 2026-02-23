/**
 * top-deals.js – Top deals by CTR widget.
 * Uses stats-advanced endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('stats-advanced?range=' + (ctx.range || '7d'));
    if (!data || !data.ok || !data.top_deals || data.top_deals.length === 0) {
      showEmpty(container, 'No deal data yet');
      return;
    }
    container.innerHTML = '<table class="dc-mini-table">' +
      '<thead><tr><th>Deal</th><th>Views</th><th>Clicks</th><th>CTR</th></tr></thead>' +
      '<tbody>' +
      data.top_deals.slice(0, 10).map(d =>
        '<tr>' +
        '<td title="' + escapeHtml(d.slug) + '">' + escapeHtml(truncSlug(d.slug)) + '</td>' +
        '<td>' + (d.views || 0) + '</td>' +
        '<td>' + (d.clicks || 0) + '</td>' +
        '<td class="dc-accent">' + d.ctr + '%</td>' +
        '</tr>'
      ).join('') +
      '</tbody></table>';
  } catch (err) {
    showError(container, 'Failed to load deals');
  }
}

function truncSlug(s) {
  if (!s) return '–';
  return s.length > 24 ? s.slice(0, 22) + '…' : s;
}

export const topDealsWidget = {
  id: 'top-deals',
  title: 'Top Deals (CTR)',
  description: 'Click-through rate per spotlight',
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
