import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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

export function signToken(payload) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: requires a valid Bearer token, attaches `req.auth`
 * as { id, role } where role is 'user' or 'seller'.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
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
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch (err) {
      // ignore invalid token for optional auth
    }
  }
  next();
}
