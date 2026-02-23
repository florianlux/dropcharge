/**
 * widget-host.js – Renders the widget grid and manages lifecycle.
 *
 * Usage (from admin.js or inline script):
 *   import { initWidgets, refreshWidgets, destroyWidgets } from './assets/admin/widget-host.js';
 *   initWidgets({ apiGet, apiPost, showToast });
 */

import { widgetList } from './widget-registry.js';
import { validateWidget, createWidgetCard, showError } from './widgets/_types.js';

let _mounted = [];
let _currentRange = '7d';

/**
 * Mount all registered widgets into #dc-widgets.
 * @param {object} ctx  – { apiGet, apiPost, showToast }
 */
export function initWidgets(ctx) {
  const host = document.getElementById('dc-widgets');
  if (!host) return;

  // Prevent double-init
  if (_mounted.length) destroyWidgets();
  host.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'dc-widget-grid';
  host.appendChild(grid);

  const enrichedCtx = { ...ctx, range: _currentRange };

  widgetList.forEach(w => {
    if (!validateWidget(w)) return;
    try {
      const body = createWidgetCard(grid, w);
      w.mount(body, enrichedCtx);
      _mounted.push(w);
    } catch (err) {
      console.error('[widget-host] mount error for', w.id, err);
    }
  });
}

/** Refresh all mounted widgets (e.g. after range change). */
export function refreshWidgets(ctx) {
  const enrichedCtx = { ...ctx, range: _currentRange };
  _mounted.forEach(w => {
    try {
      if (typeof w.refresh === 'function') {
        w.refresh(enrichedCtx);
      }
    } catch (err) {
      console.error('[widget-host] refresh error for', w.id, err);
    }
  });
}

/** Destroy / cleanup all mounted widgets. */
export function destroyWidgets() {
  _mounted.forEach(w => {
    try {
      if (typeof w.destroy === 'function') w.destroy();
    } catch (err) {
      console.error('[widget-host] destroy error for', w.id, err);
    }
  });
  _mounted = [];
}

/** Update the global range and re-render widgets. */
export function setWidgetRange(range, ctx) {
  _currentRange = range || '7d';
  refreshWidgets(ctx);
}
