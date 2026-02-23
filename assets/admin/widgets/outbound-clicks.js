/**
 * outbound-clicks.js – Outbound click tracking widget.
 * Uses stats-advanced endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('stats-advanced?range=' + (ctx.range || '7d'));
    if (!data || !data.ok || !data.outbound_clicks || data.outbound_clicks.length === 0) {
      showEmpty(container, 'No outbound clicks yet');
      return;
    }
    const maxVal = Math.max(...data.outbound_clicks.map(r => r.count || 0), 1);
    container.innerHTML = '<div class="dc-bar-list">' +
      data.outbound_clicks.slice(0, 8).map(r => {
        const pct = Math.max(Math.round(((r.count || 0) / maxVal) * 100), 4);
        return '<div class="dc-bar-item">' +
          '<div class="dc-bar-label"><span>' + escapeHtml(r.domain) + '</span><strong>' + r.count + '</strong></div>' +
          '<div class="dc-bar-track"><div class="dc-bar-fill dc-bar-fill-cyan" style="width:' + pct + '%"></div></div>' +
          '</div>';
      }).join('') +
      '</div>';
  } catch (err) {
    showError(container, 'Failed to load outbound clicks');
  }
}

export const outboundClicksWidget = {
  id: 'outbound-clicks',
  title: 'Outbound Clicks',
  description: 'Affiliate link click distribution',
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
