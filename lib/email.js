/* =========================================================
   Email service (Resend).
   Uses Resend's plain HTTP API via fetch - no SDK dependency,
   consistent with the rest of this project's minimal-dependency
   approach. Get a free API key at https://resend.com.
   ========================================================= */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Carto <onboarding@resend.dev>';

function baseTemplate({ title, bodyHtml }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:800;color:#6C5CE7;">Carto</span>
    </div>
    <h2 style="font-size:18px;margin:0 0 16px;">${title}</h2>
    ${bodyHtml}
    <p style="margin-top:32px;font-size:12px;color:#888;">If you didn't request this, you can safely ignore this email.</p>
  </div>`;
}

/**
 * Sends an email via Resend. Throws on failure so callers can decide how
 * to handle it (e.g. still let signup succeed but surface a warning).
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn(`WARNING: RESEND_API_KEY not set - email to ${to} was not sent. Subject: "${subject}"`);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${text}`);
  }
  return res.json();
}

export function sendOtpEmail(to, otp, { purpose = 'verify' } = {}) {
  const isReset = purpose === 'reset';
  const title = isReset ? 'Reset your password' : 'Verify your email';
  const intro = isReset
    ? 'Use the code below to reset your Carto password. It expires in 10 minutes.'
    : 'Use the code below to verify your email and activate your Carto account. It expires in 10 minutes.';
  const html = baseTemplate({
    title,
    bodyHtml: `
      <p style="font-size:14px;color:#444;">${intro}</p>
      <div style="background:#f5f4ff;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#6C5CE7;">${otp}</span>
      </div>
      <p style="font-size:13px;color:#888;">Never share this code with anyone. Carto staff will never ask for it.</p>
    `
  });
  return sendEmail({ to, subject: isReset ? 'Your Carto password reset code' : 'Your Carto verification code', html });
}

export { sendEmail };
