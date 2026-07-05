/* =========================================================
   CARTO - Drizzle ORM Schema (PostgreSQL, 3NF)
   ========================================================= */
import {
  pgTable, serial, text, varchar, integer, numeric, boolean,
  timestamp, jsonb, uniqueIndex, index, primaryKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/* ---------------- USERS ---------------- */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 190 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  phone: varchar('phone', { length: 30 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email)
}));

/* ---------------- ADDRESSES ---------------- */
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 60 }).default('Home'),
  fullAddress: text('full_address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  userIdx: index('addresses_user_idx').on(t.userId)
}));

/* ---------------- PACKAGES (seller subscription plans) ---------------- */
export const packages = pgTable('packages', {
  id: varchar('id', { length: 40 }).primaryKey(),
  name: varchar('name', { length: 60 }).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  period: varchar('period', { length: 20 }).default('month'),
  maxProducts: integer('max_products').notNull(),
  features: jsonb('features').notNull()
});

/* ---------------- SELLERS (admins) ---------------- */
export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 190 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  phone: varchar('phone', { length: 30 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  packageId: varchar('package_id', { length: 40 }).references(() => packages.id),
  packageActive: boolean('package_active').default(false),
  packagePurchasedAt: timestamp('package_purchased_at'),
  storeName: varchar('store_name', { length: 150 }),
  storeDescription: text('store_description'),
  storeLogo: text('store_logo'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  emailIdx: uniqueIndex('sellers_email_idx').on(t.email)
}));

/* ---------------- EMAIL VERIFICATIONS (OTP) ---------------- */
export const emailVerifications = pgTable('email_verifications', {
  id: serial('id').primaryKey(),
  accountType: varchar('account_type', { length: 10 }).notNull(), // 'user' | 'seller'
  accountId: integer('account_id').notNull(),
  otpHash: text('otp_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  resendCount: integer('resend_count').default(0).notNull(),
  lastSentAt: timestamp('last_sent_at').defaultNow().notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  accountIdx: index('email_verifications_account_idx').on(t.accountType, t.accountId)
}));

/* ---------------- PASSWORD RESET TOKENS ---------------- */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  accountType: varchar('account_type', { length: 10 }).notNull(), // 'user' | 'seller'
  accountId: integer('account_id').notNull(),
  otpHash: text('otp_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  accountIdx: index('password_reset_tokens_account_idx').on(t.accountType, t.accountId)
}));

/* ---------------- CATEGORIES ---------------- */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull()
}, (t) => ({
  slugIdx: uniqueIndex('categories_slug_idx').on(t.slug)
}));

/* ---------------- BRANDS ---------------- */
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull()
}, (t) => ({
  slugIdx: uniqueIndex('brands_slug_idx').on(t.slug)
}));

/* ---------------- PRODUCTS ---------------- */
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').references(() => categories.id),
  brandId: integer('brand_id').references(() => brands.id),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  discount: integer('discount').default(0),
  stock: integer('stock').default(0).notNull(),
  sold: integer('sold').default(0),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('0'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  sellerIdx: index('products_seller_idx').on(t.sellerId),
  categoryIdx: index('products_category_idx').on(t.categoryId),
  nameIdx: index('products_name_idx').on(t.name)
}));

/* ---------------- PRODUCT IMAGES (gallery, 1-N) ---------------- */
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').default(0)
}, (t) => ({
  productIdx: index('product_images_product_idx').on(t.productId)
}));

/* ---------------- CARTS / CART ITEMS ---------------- */
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, (t) => ({
  userIdx: uniqueIndex('carts_user_idx').on(t.userId)
}));

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(1).notNull()
}, (t) => ({
  uniqueItem: uniqueIndex('cart_items_cart_product_idx').on(t.cartId, t.productId)
}));

/* ---------------- WISHLISTS / WISHLIST ITEMS ---------------- */
export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, (t) => ({
  userIdx: uniqueIndex('wishlists_user_idx').on(t.userId)
}));

export const wishlistItems = pgTable('wishlist_items', {
  id: serial('id').primaryKey(),
  wishlistId: integer('wishlist_id').notNull().references(() => wishlists.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' })
}, (t) => ({
  uniqueItem: uniqueIndex('wishlist_items_wishlist_product_idx').on(t.wishlistId, t.productId)
}));

/* ---------------- ORDERS / ORDER ITEMS ---------------- */
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addressId: integer('address_id').references(() => addresses.id),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 30 }).default('Pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).default('card'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  userIdx: index('orders_user_idx').on(t.userId),
  statusIdx: index('orders_status_idx').on(t.status)
}));

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  sellerId: integer('seller_id').references(() => sellers.id),
  name: varchar('name', { length: 200 }).notNull(),
  image: text('image'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  quantity: integer('quantity').default(1).notNull()
}, (t) => ({
  orderIdx: index('order_items_order_idx').on(t.orderId),
  sellerIdx: index('order_items_seller_idx').on(t.sellerId)
}));

/* ---------------- PAYMENTS ---------------- */
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  method: varchar('method', { length: 30 }).notNull(),
  status: varchar('status', { length: 30 }).default('Completed').notNull(),
  transactionRef: varchar('transaction_ref', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  orderIdx: index('payments_order_idx').on(t.orderId)
}));

/* ---------------- REVIEWS ---------------- */
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  uniqueReview: uniqueIndex('reviews_product_user_idx').on(t.productId, t.userId),
  productIdx: index('reviews_product_idx').on(t.productId)
}));

/* ---------------- CONTACT MESSAGES ---------------- */
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 190 }).notNull(),
  subject: varchar('subject', { length: 200 }),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/* ---------------- NEWSLETTER ---------------- */
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 190 }).notNull(),
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull()
}, (t) => ({
  emailIdx: uniqueIndex('newsletter_email_idx').on(t.email)
}));

/* ---------------- NOTIFICATIONS ---------------- */
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sellerId: integer('seller_id').references(() => sellers.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 150 }).notNull(),
  message: text('message'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId),
  sellerIdx: index('notifications_seller_idx').on(t.sellerId)
}));

/* ---------------- RELATIONS ---------------- */
export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  reviews: many(reviews)
}));

export const sellersRelations = relations(sellers, ({ one, many }) => ({
  package: one(packages, { fields: [sellers.packageId], references: [packages.id] }),
  products: many(products)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(sellers, { fields: [products.sellerId], references: [sellers.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  images: many(productImages),
  reviews: many(reviews)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  address: one(addresses, { fields: [orders.addressId], references: [addresses.id] }),
  items: many(orderItems),
  payments: many(payments)
}));
