const { withCors } = require('./_lib/cors');
const { requireAdmin } = require('./_lib/admin-token');

function simulate({ traffic, cpc, clickRate, convRate, aov, commission, bonus }) {
  const t = Number(traffic) || 0;
  const costPerClick = Number(cpc) || 0;
  const cr = Number(clickRate) || 0;
  const cv = Number(convRate) || 0;
  const orderValue = Number(aov) || 0;
  const comm = Number(commission) || 0;
  const bon = Number(bonus) || 0;

  const expectedCost = t * costPerClick;
  const clicks = t * (cr / 100);
  const conversions = clicks * (cv / 100);
  const expectedRevenue = conversions * (orderValue * (comm / 100) + bon);
  const expectedProfit = expectedRevenue - expectedCost;
  const breakevenCpc = clicks > 0 ? expectedRevenue / t : 0;

  return {
    breakevenCpc: Math.round(breakevenCpc * 10000) / 10000,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    expectedRevenue: Math.round(expectedRevenue * 100) / 100,
    expectedCost: Math.round(expectedCost * 100) / 100
  };
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  const authErr = requireAdmin(event.headers);
  if (authErr) return authErr;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  const result = simulate(input);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, ...result })
  };
}

exports.handler = withCors(handler);
