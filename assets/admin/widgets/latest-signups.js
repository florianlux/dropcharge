/**
 * latest-signups.js – Shows the most recent newsletter signups.
 * Uses admin-list-subscribers endpoint.
 */

import { showLoading, showError, showEmpty, escapeHtml } from './_types.js';

let _container = null;

async function loadData(container, ctx) {
  showLoading(container);
  try {
    const data = await ctx.apiGet('admin-list-subscribers?limit=8&status=all');
    if (!data || !data.items || data.items.length === 0) {
      showEmpty(container, 'No signups yet');
      return;
    }
    container.innerHTML = '<div class="dc-signups-list">' +
      data.items.slice(0, 8).map(s => {
        const date = s.created_at ? new Date(s.created_at).toLocaleDateString() : '–';
        const statusClass = s.status === 'active' ? 'dc-status-active'
          : s.status === 'unsubscribed' ? 'dc-status-unsub' : '';
        return '<div class="dc-signup-row">' +
          '<span class="dc-signup-email">' + escapeHtml(s.email) + '</span>' +
          '<span class="dc-signup-meta">' +
            '<span class="' + statusClass + '">' + escapeHtml(s.status || '–') + '</span>' +
            '<span class="dc-signup-date">' + escapeHtml(date) + '</span>' +
          '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  } catch (err) {
    showError(container, 'Failed to load signups');
  }
}

export const latestSignupsWidget = {
  id: 'latest-signups',
  title: 'Latest Signups',
  description: 'Recent newsletter subscribers',
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
