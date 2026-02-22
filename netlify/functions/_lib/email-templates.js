/**
 * DropCharge Email Templates
 * Professional HTML email templates for transactional & marketing emails.
 */

const BASE_URL = (process.env.PUBLIC_SITE_URL || 'https://dropcharge.netlify.app').replace(/\/$/, '');

/* ── Shared wrapper ─────────────────────────────────── */
function wrap(content, { unsubscribeUrl } = {}) {
  const footer = unsubscribeUrl
    ? `<tr><td style="padding:32px 24px 24px;text-align:center;font-size:12px;color:#999;">
        Du willst keine Deals mehr? <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Hier abmelden</a>
       </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1a1a24;border-radius:12px;overflow:hidden;">
    ${content}
    ${footer}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/* ── Welcome Email ──────────────────────────────────── */
function welcomeEmail({ email, unsubscribeUrl }) {
  const siteUrl = BASE_URL;
  const content = `
    <tr><td style="padding:40px 32px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🚀</div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;">
        Willkommen bei DropCharge!
      </h1>
      <p style="margin:0;font-size:15px;color:#a0a0b0;line-height:1.5;">
        Du bist jetzt auf der Liste. Wir benachrichtigen dich bei den besten Gaming-Deals &amp; Drops – vor allen anderen.
      </p>
    </td></tr>
    <tr><td style="padding:0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#25253a;border-radius:10px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:13px;color:#7c7c96;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Was dich erwartet</p>
          <p style="margin:0;font-size:14px;color:#d0d0e0;line-height:1.6;">
            ⚡ Flash-Deals bevor sie ausverkauft sind<br/>
            🎮 Exklusive Rabattcodes &amp; Insider-Tipps<br/>
            🔥 Neue Drops direkt in dein Postfach
          </p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:28px 32px;text-align:center;">
      <a href="${siteUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6c5ce7,#4f46e5);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
        Deals entdecken →
      </a>
    </td></tr>`;
  return {
    subject: 'Willkommen bei DropCharge 🚀',
    html: wrap(content, { unsubscribeUrl })
  };
}

/* ── Flash Deal Email ───────────────────────────────── */
function flashDealEmail({ title, subtitle, price, originalPrice, dealUrl, imageUrl, unsubscribeUrl }) {
  const priceBlock = originalPrice
    ? `<span style="text-decoration:line-through;color:#666;font-size:16px;margin-right:8px;">${originalPrice}</span>
       <span style="font-size:28px;font-weight:800;color:#22c55e;">${price}</span>`
    : `<span style="font-size:28px;font-weight:800;color:#22c55e;">${price}</span>`;

  const image = imageUrl
    ? `<tr><td style="padding:0;">
        <img src="${imageUrl}" alt="${title || 'Deal'}" width="560" style="display:block;width:100%;max-width:560px;border-radius:0;" />
       </td></tr>`
    : '';

  const content = `
    <tr><td style="padding:24px 32px 8px;text-align:center;">
      <span style="display:inline-block;padding:4px 14px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;border-radius:20px;text-transform:uppercase;letter-spacing:0.06em;">
        ⚡ Flash Deal
      </span>
    </td></tr>
    ${image}
    <tr><td style="padding:20px 32px 8px;text-align:center;">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        ${title || 'Neuer Flash Deal!'}
      </h1>
      ${subtitle ? `<p style="margin:0;font-size:14px;color:#a0a0b0;">${subtitle}</p>` : ''}
    </td></tr>
    <tr><td style="padding:16px 32px;text-align:center;">
      ${priceBlock}
    </td></tr>
    <tr><td style="padding:8px 32px 32px;text-align:center;">
      <a href="${dealUrl || BASE_URL}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
        Deal sichern →
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#666;">Solange der Vorrat reicht</p>
    </td></tr>`;
  return {
    subject: `⚡ Flash Deal: ${title || 'Neuer Deal!'} – nur ${price}`,
    html: wrap(content, { unsubscribeUrl })
  };
}

/* ── Template registry for admin preview ────────────── */
const TEMPLATES = {
  welcome: {
    name: 'Welcome Email',
    description: 'Sent automatically after newsletter signup',
    render: welcomeEmail,
    sampleData: {
      email: 'gamer@example.com',
      unsubscribeUrl: '#'
    }
  },
  flash_deal: {
    name: 'Flash Deal',
    description: 'Promotional email for time-limited deals',
    render: flashDealEmail,
    sampleData: {
      title: 'PlayStation Plus 12 Monate',
      subtitle: 'Nur für kurze Zeit verfügbar',
      price: '39,99 €',
      originalPrice: '59,99 €',
      dealUrl: '#',
      imageUrl: '',
      unsubscribeUrl: '#'
    }
  }
};

/**
 * Convenience helper – look up a template by id, merge vars, and return rendered output.
 * Returns { templateId, subject, html } or null when the id is unknown.
 */
function getTemplate(templateId, vars) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return null;
  const data = { ...tpl.sampleData, ...(vars || {}) };
  const rendered = tpl.render(data);
  return { templateId, subject: rendered.subject, html: rendered.html };
}

module.exports = { welcomeEmail, flashDealEmail, wrap, TEMPLATES, BASE_URL, getTemplate };
