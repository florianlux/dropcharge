/**
 * funnel.js – Conversion funnel widget.
 * Shows pageview → spotlight_view → cta_click → newsletter_success.
 * Uses tracking-funnel endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml, formatNumber } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('tracking-funnel?range=' + (ctx.range || '7d'));
    if (!data || !data.ok || !data.steps || data.steps.length === 0) {
      showEmpty(container, 'No funnel data');
      return;
    }

    const maxCount = Math.max(...data.steps.map(s => s.count || 0), 1);

    container.innerHTML = '<div class="dc-funnel">' +
      data.steps.map((step, i) => {
        const widthPct = Math.max(Math.round(((step.count || 0) / maxCount) * 100), 4);
        return '<div class="dc-funnel-step">' +
          '<div class="dc-funnel-label">' +
            '<span>' + escapeHtml(step.name) + '</span>' +
            '<strong>' + formatNumber(step.count) + '</strong>' +
          '</div>' +
          '<div class="dc-funnel-bar-wrap">' +
            '<div class="dc-funnel-bar" style="width:' + widthPct + '%"></div>' +
          '</div>' +
          (i > 0 ? '<span class="dc-funnel-pct">' + step.pct_prev + '% from prev</span>' : '') +
          '</div>';
      }).join('') +
      '</div>';
  } catch (err) {
    showError(container, 'Failed to load funnel');
  }
}

export const funnelWidget = {
  id: 'funnel',
  title: 'Conversion Funnel',
  description: 'Visitor → Click → Signup flow',
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
