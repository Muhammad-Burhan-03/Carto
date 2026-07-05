DO $schema_migration$
BEGIN
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60) DEFAULT 'Home',
  full_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  period VARCHAR(20) DEFAULT 'month',
  max_products INTEGER NOT NULL,
  features JSONB NOT NULL
);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS sellers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(30),
  package_id VARCHAR(40) REFERENCES packages(id),
  package_active BOOLEAN DEFAULT false,
  package_purchased_at TIMESTAMP,
  store_name VARCHAR(150),
  store_description TEXT,
  store_logo TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS sellers_email_idx ON sellers (email);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories (slug);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_idx ON brands (slug);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id),
  brand_id INTEGER REFERENCES brands(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  discount INTEGER DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  sold INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  image TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS products_seller_idx ON products (seller_id);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS products_name_idx ON products (name);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS carts_user_idx ON carts (user_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_product_idx ON cart_items (cart_id, product_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS wishlists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user_idx ON wishlists (user_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS wishlist_items (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_wishlist_product_idx ON wishlist_items (wishlist_id, product_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id INTEGER REFERENCES addresses(id),
  total NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  payment_method VARCHAR(30) DEFAULT 'card',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  seller_id INTEGER REFERENCES sellers(id),
  name VARCHAR(200) NOT NULL,
  image TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS order_items_seller_idx ON order_items (seller_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Completed',
  transaction_ref VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_user_idx ON reviews (product_id, user_id);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  subscribed_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE UNIQUE INDEX IF NOT EXISTS newsletter_email_idx ON newsletter_subscribers (email);$stmt$;
  EXECUTE $stmt$CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);$stmt$;
  EXECUTE $stmt$CREATE INDEX IF NOT EXISTS notifications_seller_idx ON notifications (seller_id);$stmt$;
END $schema_migration$;