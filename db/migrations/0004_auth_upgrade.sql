-- Carto: production-grade auth upgrade
-- Adds email verification (OTP) and password reset infrastructure.
-- Safe to run once; uses IF NOT EXISTS guards.

-- Existing accounts (created before this migration) are grandfathered in as
-- verified so demo/existing logins keep working. New signups default to
-- unverified and must complete OTP verification.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
UPDATE users SET is_verified = true WHERE is_verified = false;

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
UPDATE sellers SET is_verified = true WHERE is_verified = false;

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  account_type VARCHAR(10) NOT NULL,
  account_id INTEGER NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMP NOT NULL DEFAULT now(),
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_account_idx ON email_verifications (account_type, account_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  account_type VARCHAR(10) NOT NULL,
  account_id INTEGER NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_account_idx ON password_reset_tokens (account_type, account_id);
