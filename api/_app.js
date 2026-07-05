/* =========================================================
   CARTO - Backend API (Express)
   Deployed on Vercel as a serverless function (see
   api/[...slug].js), but this file itself is plain Express
   with zero platform-specific code — it exports the app
   directly so it's portable to any Express-compatible host.
   ========================================================= */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { eq, and, desc, asc, sql as rawSql, ilike, gte, lte, or } from 'drizzle-orm';

import { db } from '../db/index.js';
import {
  users, sellers, packages, categories, brands, products, productImages,
  carts, cartItems, wishlists, wishlistItems, addresses, orders, orderItems,
  payments, reviews, contactMessages, newsletterSubscribers, notifications,
  emailVerifications, passwordResetTokens
} from '../db/schema.js';
import {
  hashPassword, verifyPassword, signToken, requireAuth, requireRole, optionalAuth,
  setAuthCookie, clearAuthCookie
} from '../lib/auth.js';
import { validate } from '../lib/validation.js';
import {
  generateOtp, hashOtp, verifyOtpHash, otpExpiryDate, isExpired, secondsSince,
  RESEND_COOLDOWN_SECONDS, MAX_VERIFY_ATTEMPTS, MAX_RESEND_ATTEMPTS
} from '../lib/otp.js';
import { sendOtpEmail } from '../lib/email.js';

const app = express();
app.set('trust proxy', 1); // required for express-rate-limit to read X-Forwarded-For correctly behind Vercel's proxy
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Defense-in-depth security headers (in addition to vercel.json's headers,
// which don't cover a CSP since that needs to match this app's own asset
// origins - kept here so it travels with the app regardless of host).
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
  );
  next();
});

// Rate limiting for sensitive auth endpoints. Note: Vercel serverless
// functions are stateless between invocations, so this in-memory limiter
// is a best-effort defense (resets on cold start) rather than a hard
// guarantee - the real brute-force protection for OTP/login comes from
// the DB-backed attempt counters and account lockout logic below.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const router = express.Router();

/* Helper: consistent error handling wrapper for async route handlers */
const h = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

/* =========================================================
   OTP / VERIFICATION HELPERS
   ========================================================= */
function tableForRole(role) {
  return role === 'seller' ? sellers : users;
}

async function findAccountByEmail(role, email) {
  const table = tableForRole(role);
  const [account] = await db.select().from(table).where(eq(table.email, email));
  return account;
}

async function createAndSendOtp(accountType, accountId, email, purpose) {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const table = purpose === 'reset' ? passwordResetTokens : emailVerifications;

  const values = purpose === 'reset'
    ? { accountType, accountId, otpHash, expiresAt: otpExpiryDate() }
    : { accountType, accountId, otpHash, expiresAt: otpExpiryDate(), lastSentAt: new Date() };

  await db.insert(table).values(values);

  let emailSent = true;
  try {
    const result = await sendOtpEmail(email, otp, { purpose });
    if (result?.skipped) emailSent = false;
  } catch (err) {
    // Don't fail the whole request if the email provider hiccups - the
    // user can still use "resend" once RESEND_API_KEY / provider recovers.
    console.error('Failed to send OTP email:', err.message);
    emailSent = false;
  }

  // If no email provider is configured yet, surface the OTP directly in
  // the API response so the flow is still testable end-to-end. This only
  // ever triggers when RESEND_API_KEY is unset - never in a real send.
  return { emailSent, devOtp: emailSent ? undefined : otp };
}

/* =========================================================
   AUTH: USERS
   ========================================================= */
router.post('/auth/register', authLimiter, validate('registerUser'), h(async (req, res) => {
  const { name, email, password, phone } = req.validated;
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ name, email, passwordHash, phone, isVerified: false }).returning();
  const [cart] = await db.insert(carts).values({ userId: user.id }).returning();
  await db.insert(wishlists).values({ userId: user.id });

  const { devOtp } = await createAndSendOtp('user', user.id, user.email, 'verify');

  res.status(201).json({
    requiresVerification: true,
    email: user.email,
    role: 'user',
    message: 'Account created. Check your email for a 6-digit verification code.',
    ...(devOtp ? { devOtp, devNote: 'RESEND_API_KEY not configured - showing OTP directly for testing.' } : {})
  });
}));

router.post('/auth/login', authLimiter, validate('login'), h(async (req, res) => {
  const { email, password, rememberMe } = req.validated;
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
    return res.status(423).json({ error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).` });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.update(users).set({ failedLoginAttempts: attempts, lockedUntil }).where(eq(users.id, user.id));
    if (lockedUntil) return res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      error: 'Email not verified. Please verify your email to continue.',
      requiresVerification: true,
      email: user.email,
      role: 'user'
    });
  }

  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));

  const token = signToken({ id: user.id, role: 'user' }, { rememberMe: !!rememberMe });
  setAuthCookie(res, token, { rememberMe: !!rememberMe });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
}));

router.post('/auth/logout', (req, res) => {
  // Stateless JWT: logout is handled client-side by discarding the token;
  // we also clear the httpOnly cookie copy if one was set.
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get('/auth/me', requireAuth, h(async (req, res) => {
  if (req.auth.role === 'seller') {
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, req.auth.id));
    if (!seller) return res.status(404).json({ error: 'Not found' });
    const { passwordHash, ...safe } = seller;
    return res.json({ role: 'seller', ...safe });
  }
  const [user] = await db.select().from(users).where(eq(users.id, req.auth.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { passwordHash, ...safe } = user;
  res.json({ role: 'user', ...safe });
}));

router.put('/auth/me', requireAuth, validate('updateProfile'), h(async (req, res) => {
  const table = req.auth.role === 'seller' ? sellers : users;
  const [updated] = await db.update(table).set(req.validated).where(eq(table.id, req.auth.id)).returning();
  const { passwordHash, ...safe } = updated;
  res.json(safe);
}));

/* =========================================================
   AUTH: EMAIL VERIFICATION (shared for users + sellers)
   ========================================================= */
router.post('/auth/verify-otp', authLimiter, validate('verifyOtp'), h(async (req, res) => {
  const { email, role, otp } = req.validated;
  const account = await findAccountByEmail(role, email);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.isVerified) return res.status(200).json({ success: true, alreadyVerified: true });

  const [record] = await db.select().from(emailVerifications)
    .where(and(eq(emailVerifications.accountType, role), eq(emailVerifications.accountId, account.id)))
    .orderBy(desc(emailVerifications.createdAt)).limit(1);

  if (!record) return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
  if (record.verifiedAt) return res.status(200).json({ success: true, alreadyVerified: true });
  if (isExpired(record.expiresAt)) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
  if (record.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  const match = await verifyOtpHash(otp, record.otpHash);
  if (!match) {
    await db.update(emailVerifications).set({ attemptCount: record.attemptCount + 1 }).where(eq(emailVerifications.id, record.id));
    return res.status(400).json({ error: 'Incorrect code. Please try again.' });
  }

  await db.update(emailVerifications).set({ verifiedAt: new Date() }).where(eq(emailVerifications.id, record.id));
  const table = tableForRole(role);
  await db.update(table).set({ isVerified: true }).where(eq(table.id, account.id));

  const token = signToken({ id: account.id, role });
  setAuthCookie(res, token, { rememberMe: false });
  const { passwordHash, ...safe } = account;
  res.json({ success: true, token, [role]: { ...safe, isVerified: true } });
}));

router.post('/auth/resend-otp', authLimiter, validate('resendOtp'), h(async (req, res) => {
  const { email, role } = req.validated;
  const account = await findAccountByEmail(role, email);
  // Don't reveal whether the account exists - respond success either way.
  if (!account || account.isVerified) return res.json({ success: true });

  const [lastRecord] = await db.select().from(emailVerifications)
    .where(and(eq(emailVerifications.accountType, role), eq(emailVerifications.accountId, account.id)))
    .orderBy(desc(emailVerifications.createdAt)).limit(1);

  if (lastRecord) {
    const elapsed = secondsSince(lastRecord.lastSentAt);
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({ error: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting another code.` });
    }
    if (lastRecord.resendCount >= MAX_RESEND_ATTEMPTS) {
      return res.status(429).json({ error: 'Resend limit reached. Please try again later or contact support.' });
    }
    await db.update(emailVerifications).set({ resendCount: lastRecord.resendCount + 1 }).where(eq(emailVerifications.id, lastRecord.id));
  }

  const { devOtp } = await createAndSendOtp(role, account.id, account.email, 'verify');
  res.json({ success: true, ...(devOtp ? { devOtp, devNote: 'RESEND_API_KEY not configured - showing OTP directly for testing.' } : {}) });
}));

/* =========================================================
   AUTH: FORGOT / RESET PASSWORD (shared for users + sellers)
   ========================================================= */
router.post('/auth/forgot-password', authLimiter, validate('forgotPassword'), h(async (req, res) => {
  const { email, role } = req.validated;
  const account = await findAccountByEmail(role, email);
  // Always respond success - don't leak which emails are registered.
  let devOtp;
  if (account) {
    // Invalidate any unused prior reset codes before issuing a fresh one.
    await db.delete(passwordResetTokens).where(and(
      eq(passwordResetTokens.accountType, role),
      eq(passwordResetTokens.accountId, account.id),
      eq(passwordResetTokens.used, false)
    ));
    const result = await createAndSendOtp(role, account.id, account.email, 'reset');
    devOtp = result.devOtp;
  }
  res.json({
    success: true,
    message: 'If that email is registered, a reset code has been sent.',
    ...(devOtp ? { devOtp, devNote: 'RESEND_API_KEY not configured - showing OTP directly for testing.' } : {})
  });
}));

router.post('/auth/reset-password', authLimiter, validate('resetPassword'), h(async (req, res) => {
  const { email, role, otp, newPassword } = req.validated;
  const account = await findAccountByEmail(role, email);
  if (!account) return res.status(400).json({ error: 'Invalid code or email.' });

  const [record] = await db.select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.accountType, role), eq(passwordResetTokens.accountId, account.id), eq(passwordResetTokens.used, false)))
    .orderBy(desc(passwordResetTokens.createdAt)).limit(1);

  if (!record) return res.status(400).json({ error: 'Invalid or expired code. Please request a new one.' });
  if (isExpired(record.expiresAt)) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
  if (record.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  const match = await verifyOtpHash(otp, record.otpHash);
  if (!match) {
    await db.update(passwordResetTokens).set({ attemptCount: record.attemptCount + 1 }).where(eq(passwordResetTokens.id, record.id));
    return res.status(400).json({ error: 'Incorrect code. Please try again.' });
  }

  const passwordHash = await hashPassword(newPassword);
  const table = tableForRole(role);
  await db.update(table).set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null }).where(eq(table.id, account.id));
  await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, record.id));

  res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
}));

/* =========================================================
   AUTH: SELLERS (ADMIN / MARKETPLACE SELLERS)
   ========================================================= */
router.post('/sellers/register', authLimiter, validate('registerSeller'), h(async (req, res) => {
  const { name, email, password, phone, packageId, storeName, storeDescription, storeLogo } = req.validated;
  const existing = await db.select().from(sellers).where(eq(sellers.email, email));
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(password);
  const [seller] = await db.insert(sellers).values({
    name, email, passwordHash, phone, packageId, isVerified: false,
    packageActive: true, packagePurchasedAt: new Date(),
    storeName, storeDescription, storeLogo
  }).returning();

  const { devOtp } = await createAndSendOtp('seller', seller.id, seller.email, 'verify');

  res.status(201).json({
    requiresVerification: true,
    email: seller.email,
    role: 'seller',
    message: 'Account created. Check your email for a 6-digit verification code.',
    ...(devOtp ? { devOtp, devNote: 'RESEND_API_KEY not configured - showing OTP directly for testing.' } : {})
  });
}));

router.post('/sellers/login', authLimiter, validate('login'), h(async (req, res) => {
  const { email, password, rememberMe } = req.validated;
  const [seller] = await db.select().from(sellers).where(eq(sellers.email, email));
  if (!seller) return res.status(401).json({ error: 'Invalid email or password' });

  if (seller.lockedUntil && new Date(seller.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(seller.lockedUntil) - new Date()) / 60000);
    return res.status(423).json({ error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).` });
  }

  const ok = await verifyPassword(password, seller.passwordHash);
  if (!ok) {
    const attempts = (seller.failedLoginAttempts || 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.update(sellers).set({ failedLoginAttempts: attempts, lockedUntil }).where(eq(sellers.id, seller.id));
    if (lockedUntil) return res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!seller.isVerified) {
    return res.status(403).json({
      error: 'Email not verified. Please verify your email to continue.',
      requiresVerification: true,
      email: seller.email,
      role: 'seller'
    });
  }

  await db.update(sellers).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(sellers.id, seller.id));

  const token = signToken({ id: seller.id, role: 'seller' }, { rememberMe: !!rememberMe });
  setAuthCookie(res, token, { rememberMe: !!rememberMe });
  const { passwordHash, ...safe } = seller;
  res.json({ token, seller: safe });
}));

router.get('/sellers/:id', h(async (req, res) => {
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, Number(req.params.id)));
  if (!seller) return res.status(404).json({ error: 'Seller not found' });
  const { passwordHash, email, ...publicProfile } = seller;
  res.json(publicProfile);
}));

router.put('/sellers/me/package', requireRole('seller'), h(async (req, res) => {
  const { packageId } = req.body;
  const [pkg] = await db.select().from(packages).where(eq(packages.id, String(packageId)));
  if (!pkg) return res.status(400).json({ error: 'Invalid package id' });

  const [updated] = await db.update(sellers).set({
    packageId: pkg.id, packageActive: true, packagePurchasedAt: new Date()
  }).where(eq(sellers.id, req.auth.id)).returning();

  const { passwordHash, ...safe } = updated;
  res.json(safe);
}));

router.put('/sellers/me/store', requireRole('seller'), h(async (req, res) => {
  const { storeName, storeDescription, storeLogo } = req.body;
  const [updated] = await db.update(sellers).set({ storeName, storeDescription, storeLogo }).where(eq(sellers.id, req.auth.id)).returning();
  const { passwordHash, ...safe } = updated;
  res.json(safe);
}));

router.get('/sellers/:id/dashboard', requireRole('seller'), h(async (req, res) => {
  const sellerId = Number(req.params.id);
  if (req.auth.id !== sellerId) return res.status(403).json({ error: 'Forbidden' });

  const myProducts = await db.select().from(products).where(eq(products.sellerId, sellerId));
  const productIds = myProducts.map(p => p.id);

  let myOrderItems = [];
  if (productIds.length) {
    myOrderItems = await db.select().from(orderItems).where(eq(orderItems.sellerId, sellerId));
  }

  const totalRevenue = myOrderItems.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);
  res.json({
    productCount: myProducts.length,
    totalSold: myProducts.reduce((s, p) => s + (p.sold || 0), 0),
    totalRevenue,
    orderItemCount: myOrderItems.length,
    products: myProducts
  });
}));

/* =========================================================
   HEALTH CHECK
   ========================================================= */
router.get('/health', async (req, res) => {
  try {
    await db.select().from(packages).limit(1);
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unreachable', message: err.message });
  }
});

/* =========================================================
   CATEGORIES / BRANDS
   ========================================================= */
router.get('/categories', h(async (req, res) => {
  res.json(await db.select().from(categories));
}));

router.get('/brands', h(async (req, res) => {
  res.json(await db.select().from(brands));
}));

/* =========================================================
   PRODUCTS (list, search, filter, detail)
   ========================================================= */
router.get('/products', h(async (req, res) => {
  const { category, brand, q, minPrice, maxPrice, sort, page = '1', limit = '24' } = req.query;
  const conditions = [];

  if (category) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, String(category)));
    if (cat) conditions.push(eq(products.categoryId, cat.id));
  }
  if (brand) {
    const [b] = await db.select().from(brands).where(eq(brands.slug, String(brand)));
    if (b) conditions.push(eq(products.brandId, b.id));
  }
  if (q) conditions.push(ilike(products.name, `%${q}%`));
  if (minPrice) conditions.push(gte(products.price, String(minPrice)));
  if (maxPrice) conditions.push(lte(products.price, String(maxPrice)));

  let query = db.select({
    id: products.id, sellerId: products.sellerId, categoryId: products.categoryId, brandId: products.brandId,
    name: products.name, description: products.description, price: products.price, discount: products.discount,
    stock: products.stock, sold: products.sold, rating: products.rating, image: products.image, createdAt: products.createdAt,
    category: categories.name, categorySlug: categories.slug
  }).from(products).leftJoin(categories, eq(products.categoryId, categories.id));
  if (conditions.length) query = query.where(and(...conditions));

  const sortMap = {
    'price-asc': asc(products.price),
    'price-desc': desc(products.price),
    'rating': desc(products.rating),
    'newest': desc(products.createdAt),
    'bestselling': desc(products.sold)
  };
  query = query.orderBy(sortMap[sort] || desc(products.createdAt));

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
  query = query.limit(limitNum).offset((pageNum - 1) * limitNum);

  const results = await query;
  res.json({ page: pageNum, limit: limitNum, count: results.length, products: results });
}));

router.get('/products/:id', h(async (req, res) => {
  const [row] = await db.select({
    product: products, categoryName: categories.name, categorySlug: categories.slug
  }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(eq(products.id, Number(req.params.id)));
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const product = { ...row.product, category: row.categoryName, categorySlug: row.categorySlug };

  const images = await db.select().from(productImages).where(eq(productImages.productId, product.id));
  const relatedProducts = product.categoryId
    ? await db.select().from(products).where(and(eq(products.categoryId, product.categoryId), rawSql`${products.id} != ${product.id}`)).limit(6)
    : [];
  const productReviews = await db.select().from(reviews).where(eq(reviews.productId, product.id)).orderBy(desc(reviews.createdAt));

  res.json({ ...product, images, related: relatedProducts, reviews: productReviews });
}));

router.post('/products', requireRole('seller'), validate('product'), h(async (req, res) => {
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, req.auth.id));
  const [pkg] = seller?.packageId ? await db.select().from(packages).where(eq(packages.id, seller.packageId)) : [null];
  if (pkg) {
    const [{ count }] = await db.select({ count: rawSql`count(*)::int` }).from(products).where(eq(products.sellerId, req.auth.id));
    if (count >= pkg.maxProducts) {
      return res.status(403).json({ error: `Product limit reached for your ${pkg.name} plan (${pkg.maxProducts} max)` });
    }
  }
  const { category, ...rest } = req.validated;
  let categoryId;
  if (category) {
    const slug = category.toLowerCase();
    const [cat] = await db.select().from(categories).where(or(eq(categories.slug, slug), eq(categories.name, category)));
    categoryId = cat?.id;
  }
  const [product] = await db.insert(products).values({ ...rest, categoryId, sellerId: req.auth.id }).returning();
  res.status(201).json(product);
}));

router.put('/products/:id', requireRole('seller'), validate('product'), h(async (req, res) => {
  const [existing] = await db.select().from(products).where(eq(products.id, Number(req.params.id)));
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (existing.sellerId !== req.auth.id) return res.status(403).json({ error: 'Forbidden' });

  const { category, ...rest } = req.validated;
  let categoryId = existing.categoryId;
  if (category) {
    const slug = category.toLowerCase();
    const [cat] = await db.select().from(categories).where(or(eq(categories.slug, slug), eq(categories.name, category)));
    categoryId = cat?.id ?? categoryId;
  }
  const [updated] = await db.update(products).set({ ...rest, categoryId }).where(eq(products.id, existing.id)).returning();
  res.json(updated);
}));

router.delete('/products/:id', requireRole('seller'), h(async (req, res) => {
  const [existing] = await db.select().from(products).where(eq(products.id, Number(req.params.id)));
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (existing.sellerId !== req.auth.id) return res.status(403).json({ error: 'Forbidden' });

  await db.delete(products).where(eq(products.id, existing.id));
  res.json({ success: true });
}));

/* =========================================================
   CART
   ========================================================= */
async function getOrCreateCart(userId) {
  let [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
  if (!cart) [cart] = await db.insert(carts).values({ userId }).returning();
  return cart;
}

router.get('/cart', requireRole('user'), h(async (req, res) => {
  const cart = await getOrCreateCart(req.auth.id);
  const items = await db.select({
    id: cartItems.id, quantity: cartItems.quantity, product: products
  }).from(cartItems).innerJoin(products, eq(cartItems.productId, products.id)).where(eq(cartItems.cartId, cart.id));
  res.json({ items });
}));

router.post('/cart', requireRole('user'), validate('cartItem'), h(async (req, res) => {
  const { productId, quantity = 1 } = req.validated;
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const cart = await getOrCreateCart(req.auth.id);
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)));

  if (existing) {
    const [updated] = await db.update(cartItems).set({ quantity: existing.quantity + quantity }).where(eq(cartItems.id, existing.id)).returning();
    return res.json(updated);
  }
  const [item] = await db.insert(cartItems).values({ cartId: cart.id, productId, quantity }).returning();
  res.status(201).json(item);
}));

router.put('/cart/:itemId', requireRole('user'), h(async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'quantity must be a positive integer' });

  const cart = await getOrCreateCart(req.auth.id);
  const [item] = await db.select().from(cartItems).where(and(eq(cartItems.id, Number(req.params.itemId)), eq(cartItems.cartId, cart.id)));
  if (!item) return res.status(404).json({ error: 'Cart item not found' });

  const [updated] = await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, item.id)).returning();
  res.json(updated);
}));

router.delete('/cart/:itemId', requireRole('user'), h(async (req, res) => {
  const cart = await getOrCreateCart(req.auth.id);
  await db.delete(cartItems).where(and(eq(cartItems.id, Number(req.params.itemId)), eq(cartItems.cartId, cart.id)));
  res.json({ success: true });
}));

router.delete('/cart', requireRole('user'), h(async (req, res) => {
  const cart = await getOrCreateCart(req.auth.id);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  res.json({ success: true });
}));

/* =========================================================
   WISHLIST
   ========================================================= */
async function getOrCreateWishlist(userId) {
  let [wl] = await db.select().from(wishlists).where(eq(wishlists.userId, userId));
  if (!wl) [wl] = await db.insert(wishlists).values({ userId }).returning();
  return wl;
}

router.get('/wishlist', requireRole('user'), h(async (req, res) => {
  const wl = await getOrCreateWishlist(req.auth.id);
  const items = await db.select({
    id: wishlistItems.id, product: products
  }).from(wishlistItems).innerJoin(products, eq(wishlistItems.productId, products.id)).where(eq(wishlistItems.wishlistId, wl.id));
  res.json({ items });
}));

router.post('/wishlist', requireRole('user'), validate('wishlistItem'), h(async (req, res) => {
  const { productId } = req.validated;
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const wl = await getOrCreateWishlist(req.auth.id);
  const [existing] = await db.select().from(wishlistItems).where(and(eq(wishlistItems.wishlistId, wl.id), eq(wishlistItems.productId, productId)));
  if (existing) return res.status(200).json(existing);

  const [item] = await db.insert(wishlistItems).values({ wishlistId: wl.id, productId }).returning();
  res.status(201).json(item);
}));

router.delete('/wishlist/:productId', requireRole('user'), h(async (req, res) => {
  const wl = await getOrCreateWishlist(req.auth.id);
  await db.delete(wishlistItems).where(and(eq(wishlistItems.wishlistId, wl.id), eq(wishlistItems.productId, Number(req.params.productId))));
  res.json({ success: true });
}));

/* =========================================================
   ADDRESSES
   ========================================================= */
router.get('/addresses', requireRole('user'), h(async (req, res) => {
  res.json(await db.select().from(addresses).where(eq(addresses.userId, req.auth.id)));
}));

router.post('/addresses', requireRole('user'), validate('address'), h(async (req, res) => {
  const [address] = await db.insert(addresses).values({ ...req.validated, userId: req.auth.id }).returning();
  res.status(201).json(address);
}));

router.put('/addresses/:id', requireRole('user'), validate('address'), h(async (req, res) => {
  const [existing] = await db.select().from(addresses).where(eq(addresses.id, Number(req.params.id)));
  if (!existing || existing.userId !== req.auth.id) return res.status(404).json({ error: 'Address not found' });
  const [updated] = await db.update(addresses).set(req.validated).where(eq(addresses.id, existing.id)).returning();
  res.json(updated);
}));

router.delete('/addresses/:id', requireRole('user'), h(async (req, res) => {
  const [existing] = await db.select().from(addresses).where(eq(addresses.id, Number(req.params.id)));
  if (!existing || existing.userId !== req.auth.id) return res.status(404).json({ error: 'Address not found' });
  await db.delete(addresses).where(eq(addresses.id, existing.id));
  res.json({ success: true });
}));

/* =========================================================
   CHECKOUT / ORDERS / PAYMENTS
   ========================================================= */
router.post('/checkout', requireRole('user'), validate('checkout'), h(async (req, res) => {
  const { addressId, paymentMethod } = req.validated;

  const [address] = await db.select().from(addresses).where(and(eq(addresses.id, addressId), eq(addresses.userId, req.auth.id)));
  if (!address) return res.status(404).json({ error: 'Address not found' });

  const cart = await getOrCreateCart(req.auth.id);
  const items = await db.select({
    id: cartItems.id, quantity: cartItems.quantity, product: products
  }).from(cartItems).innerJoin(products, eq(cartItems.productId, products.id)).where(eq(cartItems.cartId, cart.id));

  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });

  for (const it of items) {
    if (it.product.stock < it.quantity) {
      return res.status(409).json({ error: `Insufficient stock for "${it.product.name}"` });
    }
  }

  const shipping = 5;
  const subtotal = items.reduce((sum, it) => sum + Number(it.product.price) * (1 - (it.product.discount || 0) / 100) * it.quantity, 0);
  const total = +(subtotal + shipping).toFixed(2);

  const [order] = await db.insert(orders).values({
    userId: req.auth.id, addressId, total, status: 'Pending', paymentMethod
  }).returning();

  for (const it of items) {
    const finalPrice = +(Number(it.product.price) * (1 - (it.product.discount || 0) / 100)).toFixed(2);
    await db.insert(orderItems).values({
      orderId: order.id, productId: it.product.id, sellerId: it.product.sellerId,
      name: it.product.name, image: it.product.image, price: finalPrice, quantity: it.quantity
    });
    await db.update(products).set({
      stock: it.product.stock - it.quantity,
      sold: (it.product.sold || 0) + it.quantity
    }).where(eq(products.id, it.product.id));

    await db.insert(notifications).values({
      sellerId: it.product.sellerId,
      title: 'New order received',
      message: `${it.quantity}x "${it.product.name}" was just ordered.`
    });
  }

  await db.insert(payments).values({
    orderId: order.id, amount: total, method: paymentMethod, status: 'Completed'
  });

  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  await db.insert(notifications).values({
    userId: req.auth.id, title: 'Order placed', message: `Your order #${order.id} has been placed successfully.`
  });

  res.status(201).json({ order, itemCount: items.length });
}));

router.get('/orders', requireAuth, h(async (req, res) => {
  if (req.auth.role === 'seller') {
    const items = await db.select({
      orderItem: orderItems, order: orders
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(eq(orderItems.sellerId, req.auth.id)).orderBy(desc(orders.createdAt));
    return res.json(items);
  }
  const myOrders = await db.select().from(orders).where(eq(orders.userId, req.auth.id)).orderBy(desc(orders.createdAt));
  res.json(myOrders);
}));

router.get('/orders/:id', requireAuth, h(async (req, res) => {
  const [order] = await db.select().from(orders).where(eq(orders.id, Number(req.params.id)));
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (req.auth.role === 'user' && order.userId !== req.auth.id) return res.status(403).json({ error: 'Forbidden' });
  if (req.auth.role === 'seller' && !items.some(it => it.sellerId === req.auth.id)) return res.status(403).json({ error: 'Forbidden' });

  res.json({ ...order, items });
}));

router.put('/orders/:id/status', requireRole('seller'), h(async (req, res) => {
  const { status } = req.body;
  const allowed = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, Number(req.params.id)));
  if (!items.some(it => it.sellerId === req.auth.id)) return res.status(403).json({ error: 'Forbidden' });

  const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, Number(req.params.id))).returning();
  await db.insert(notifications).values({
    userId: updated.userId, title: 'Order status updated', message: `Your order #${updated.id} is now "${status}".`
  });
  res.json(updated);
}));

/* =========================================================
   REVIEWS
   ========================================================= */
router.get('/reviews/:productId', h(async (req, res) => {
  res.json(await db.select().from(reviews).where(eq(reviews.productId, Number(req.params.productId))).orderBy(desc(reviews.createdAt)));
}));

router.post('/reviews', requireRole('user'), validate('review'), h(async (req, res) => {
  const { productId, rating, comment } = req.validated;
  const [existing] = await db.select().from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.userId, req.auth.id)));
  if (existing) return res.status(409).json({ error: 'You already reviewed this product' });

  const [review] = await db.insert(reviews).values({ productId, userId: req.auth.id, rating, comment }).returning();

  const agg = await db.select({ avg: rawSql`avg(${reviews.rating})::numeric(3,2)` }).from(reviews).where(eq(reviews.productId, productId));
  await db.update(products).set({ rating: agg[0]?.avg || rating }).where(eq(products.id, productId));

  res.status(201).json(review);
}));

/* =========================================================
   CONTACT / NEWSLETTER
   ========================================================= */
router.post('/contact', validate('contact'), h(async (req, res) => {
  const [msg] = await db.insert(contactMessages).values(req.validated).returning();
  res.status(201).json({ success: true, id: msg.id });
}));

router.post('/newsletter', validate('newsletter'), h(async (req, res) => {
  const { email } = req.validated;
  const [existing] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
  if (existing) return res.status(200).json({ success: true, alreadySubscribed: true });
  await db.insert(newsletterSubscribers).values({ email });
  res.status(201).json({ success: true });
}));

/* =========================================================
   NOTIFICATIONS
   ========================================================= */
router.get('/notifications', requireAuth, h(async (req, res) => {
  const col = req.auth.role === 'seller' ? notifications.sellerId : notifications.userId;
  res.json(await db.select().from(notifications).where(eq(col, req.auth.id)).orderBy(desc(notifications.createdAt)));
}));

router.put('/notifications/:id/read', requireAuth, h(async (req, res) => {
  const [updated] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, Number(req.params.id))).returning();
  res.json(updated);
}));

/* =========================================================
   PACKAGES (seller subscription plans)
   ========================================================= */
router.get('/packages', h(async (req, res) => {
  res.json(await db.select().from(packages));
}));

/* =========================================================
   Mount + export
   ========================================================= */
app.use('/api', router);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
