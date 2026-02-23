/**
 * _types.js – Widget contract helpers (vanilla JS)
 *
 * Widget shape:
 *   {
 *     id:          string,       // unique slug
 *     title:       string,       // display name
 *     description: string?,      // optional subtitle
 *     size:        "sm"|"md"|"lg", // grid hint
 *     mount(container, ctx),     // render into DOM node
 *     refresh?(ctx),             // re-fetch data
 *     destroy?()                 // cleanup
 *   }
 *
 * ctx = { apiGet, apiPost, range, showToast }
 */

export function validateWidget(w) {
  if (!w || typeof w.id !== 'string' || typeof w.title !== 'string' || typeof w.mount !== 'function') {
    console.warn('[widget] invalid widget definition', w);
    return false;
  }
  return true;
}

/** Shorthand: create a card wrapper inside a container */
export function createWidgetCard(container, { title, description, size }) {
  const card = document.createElement('div');
  card.className = 'dc-widget-card dc-widget-' + (size || 'md');
  const header = document.createElement('div');
  header.className = 'dc-widget-header';
  header.innerHTML =
    '<h4 class="dc-widget-title">' + escapeHtml(title) + '</h4>' +
    (description ? '<p class="dc-widget-desc">' + escapeHtml(description) + '</p>' : '');
  card.appendChild(header);
  const body = document.createElement('div');
  body.className = 'dc-widget-body';
  card.appendChild(body);
  container.appendChild(card);
  return body;
}

/** Safe HTML escape */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format large numbers: 1234 → "1.2k" */
export function formatNumber(n) {
  if (n == null || isNaN(n)) return '–';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

/** Show a loading spinner placeholder */
export function showLoading(container) {
  container.innerHTML = '<div class="dc-widget-loading"><span class="dc-spinner"></span></div>';
}

/** Show an error state */
export function showError(container, message) {
  container.innerHTML = '<div class="dc-widget-error">' + escapeHtml(message || 'Failed to load') + '</div>';
}

/** Show empty-data state */
export function showEmpty(container, message) {
  container.innerHTML = '<div class="dc-widget-empty">' + escapeHtml(message || 'No data yet') + '</div>';
}
