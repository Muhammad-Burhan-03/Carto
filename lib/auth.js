import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'carto_token';
const REMEMBER_ME_EXPIRES_IN = '30d';

function resolveExpiresIn(raw) {
  const cleaned = (raw || '7d').trim().replace(/^["']|["']$/g, '');
  // Accepts plain seconds ("3600") or a timespan like "7d", "12h", "30m".
  const validPattern = /^\d+$|^\d+(ms|s|m|h|d|w|y)$/i;
  if (!validPattern.test(cleaned)) {
    console.warn(`WARNING: expiresIn="${cleaned}" is not a valid timespan (e.g. "7d", "12h"). Falling back to "7d".`);
    return '7d';
  }
  return cleaned;
}

const DEFAULT_JWT_EXPIRES_IN = resolveExpiresIn(process.env.JWT_EXPIRES_IN);

if (!JWT_SECRET) {
  // Fail loudly at import time in production; during local dev without a
  // secret set, routes will still error clearly rather than sign insecurely.
  console.warn('WARNING: JWT_SECRET is not set. Auth routes will fail until it is configured.');
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Signs a JWT. Pass { rememberMe: true } for a long-lived (30d) session
 * instead of the default (JWT_EXPIRES_IN, typically 7d).
 */
export function signToken(payload, { rememberMe = false } = {}) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  const expiresIn = rememberMe ? REMEMBER_ME_EXPIRES_IN : DEFAULT_JWT_EXPIRES_IN;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Sets the JWT as an httpOnly cookie (defense-in-depth against XSS token
 * theft) in addition to returning it in the response body - the frontend
 * still uses Bearer-header auth for its API calls, so this is additive
 * security rather than a full auth-model change.
 */
export function setAuthCookie(res, token, { rememberMe = false } = {}) {
  const maxAge = (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge,
    path: '/'
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  return null;
}

/**
 * Express middleware: requires a valid Bearer token (or auth cookie),
 * attaches `req.auth` as { id, role } where role is 'user' or 'seller'.
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const decoded = verifyToken(token);
    req.auth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Like requireAuth but restricts to a specific role ('user' | 'seller'). */
export function requireRole(role) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.auth.role !== role) {
        return res.status(403).json({ error: `Forbidden: requires ${role} role` });
      }
      next();
    });
  };
}

/** Optional auth: attaches req.auth if a valid token is present, else continues anonymously. */
export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch (err) {
      // ignore invalid token for optional auth
    }
  }
  next();
}
