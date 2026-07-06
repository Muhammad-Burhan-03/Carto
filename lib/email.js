/* =========================================================
   Email service.

   Two providers are supported:
   1. SMTP (e.g. Gmail with an App Password) via Nodemailer - works with
      ANY recipient, no domain needed. Recommended for projects without
      a custom domain. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
   2. Resend - simpler setup, but its free/testing tier can only send to
      the email address you signed up with, unless you verify a domain.
      Set RESEND_API_KEY (and optionally EMAIL_FROM).

   SMTP is tried first if configured; Resend is used as a fallback.
   ========================================================= */
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'Carto <onboarding@resend.dev>';

let smtpTransport = null;
function getSmtpTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return smtpTransport;
}

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

async function sendViaSmtp({ to, subject, html }) {
  const transport = getSmtpTransport();
  if (!transport) return null;
  await transport.sendMail({ from: EMAIL_FROM, to, subject, html });
  return { provider: 'smtp' };
}

async function sendViaResend({ to, subject, html }) {
  if (!RESEND_API_KEY) return null;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${text}`);
  }
  return { provider: 'resend', ...(await res.json()) };
}

/**
 * Sends an email via whichever provider is configured (SMTP first, then
 * Resend). Returns { skipped: true } if neither is configured, so callers
 * can fall back to a dev-mode display instead of failing the request.
 */
async function sendEmail({ to, subject, html }) {
  if (getSmtpTransport()) {
    return sendViaSmtp({ to, subject, html });
  }
  if (RESEND_API_KEY) {
    return sendViaResend({ to, subject, html });
  }
  console.warn(`WARNING: No email provider configured (SMTP_* or RESEND_API_KEY) - email to ${to} was not sent. Subject: "${subject}"`);
  return { skipped: true };
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
