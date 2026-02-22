/**
 * Affiliate URL normalisation helpers.
 * Works in both Node.js (Netlify Functions) and browser environments.
 */

/**
 * Check whether a URL points to g2a.com (including www and subdomains).
 * Never throws — returns false on unparseable input.
 */
function isG2AUrl(input) {
  try {
    const raw = String(input || '').trim();
    if (!raw) return false;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    return host === 'g2a.com' || host === 'www.g2a.com' || host.endsWith('.g2a.com');
  } catch {
    return false;
  }
}

/**
 * Normalise a G2A URL by setting/replacing the `gtag` query parameter.
 *
 * Behaviour:
 *  - trims whitespace
 *  - prepends https:// when scheme is missing
 *  - only modifies URLs whose hostname is g2a.com / www.g2a.com / *.g2a.com
 *  - preserves all other query params and hash fragment
 *  - never throws; returns the original string on parse failure
 */
function normalizeG2AReflink(inputUrl, gtag) {
  try {
    const raw = String(inputUrl || '').trim();
    if (!raw) return raw;
    if (!gtag) return raw;

    const hadScheme = /^https?:\/\//i.test(raw);
    const withScheme = hadScheme ? raw : 'https://' + raw;
    const url = new URL(withScheme);

    const host = url.hostname.toLowerCase();
    const isG2A = host === 'g2a.com' || host === 'www.g2a.com' || host.endsWith('.g2a.com');
    if (!isG2A) return raw;

    url.searchParams.set('gtag', gtag);

    let result = url.toString();
    // If original had no scheme, strip the one we added
    if (!hadScheme) {
      result = result.replace(/^https:\/\//i, '');
    }
    return result;
  } catch {
    return String(inputUrl || '').trim();
  }
}

/**
 * Future-proof dispatcher: normalise a deal URL based on its provider.
 * Currently only G2A is supported.
 *
 * @param {string} url       – the deal URL
 * @param {string} provider  – provider hint (e.g. 'g2a'), currently unused for auto-detect
 * @param {object} env       – environment map (defaults to process.env in Node)
 * @returns {string} normalised URL
 */
function normalizeDealUrlByProvider(url, provider, env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {});

  // Auto-detect G2A regardless of provider hint
  if (isG2AUrl(url) && e.G2A_GTAG) {
    return normalizeG2AReflink(url, e.G2A_GTAG);
  }

  return String(url || '').trim();
}

// CommonJS for Netlify Functions; also works when bundled for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isG2AUrl, normalizeG2AReflink, normalizeDealUrlByProvider };
}
