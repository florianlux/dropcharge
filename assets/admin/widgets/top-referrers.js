/**
 * top-referrers.js – Top referrers by signup widget.
 * Uses stats-advanced endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('stats-advanced?range=' + (ctx.range || '7d'));
    if (!data || !data.ok || !data.top_referrers || data.top_referrers.length === 0) {
      showEmpty(container, 'No referrer data yet');
      return;
    }
    const maxVal = Math.max(...data.top_referrers.map(r => r.count || 0), 1);
    container.innerHTML = '<div class="dc-bar-list">' +
      data.top_referrers.slice(0, 8).map(r => {
        const pct = Math.max(Math.round(((r.count || 0) / maxVal) * 100), 4);
        return '<div class="dc-bar-item">' +
          '<div class="dc-bar-label"><span>' + escapeHtml(r.name) + '</span><strong>' + r.count + '</strong></div>' +
          '<div class="dc-bar-track"><div class="dc-bar-fill" style="width:' + pct + '%"></div></div>' +
          '</div>';
      }).join('') +
      '</div>';
  } catch (err) {
    showError(container, 'Failed to load referrers');
  }
}

export const topReferrersWidget = {
  id: 'top-referrers',
  title: 'Top Referrers',
  description: 'Traffic sources by signups',
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
