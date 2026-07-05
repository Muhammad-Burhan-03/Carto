import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_RESEND_ATTEMPTS = 5;

/** Generates a cryptographically random 6-digit numeric OTP. */
export function generateOtp() {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(OTP_LENGTH, '0');
}

export function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

export function verifyOtpHash(otp, hash) {
  return bcrypt.compare(otp, hash);
}

export function otpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export function isExpired(expiresAt) {
  return new Date(expiresAt).getTime() < Date.now();
}

export function secondsSince(date) {
  return (Date.now() - new Date(date).getTime()) / 1000;
}

export {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFY_ATTEMPTS,
  MAX_RESEND_ATTEMPTS
};
