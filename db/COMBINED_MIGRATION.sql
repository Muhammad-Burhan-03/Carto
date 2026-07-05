-- Carto: combined migration (schema + seed data + demo products)
-- Paste this whole file into Neon's SQL Editor and click Run.
-- Safe to run once; uses IF NOT EXISTS / ON CONFLICT guards.

-- Carto full-stack schema (3NF) — initial migration

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60) DEFAULT 'Home',
  full_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id);

CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  period VARCHAR(20) DEFAULT 'month',
  max_products INTEGER NOT NULL,
  features JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS sellers_email_idx ON sellers (email);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories (slug);

CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_idx ON brands (slug);

CREATE TABLE IF NOT EXISTS products (
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
);
CREATE INDEX IF NOT EXISTS products_seller_idx ON products (seller_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_name_idx ON products (name);

CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id);

CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS carts_user_idx ON carts (user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_product_idx ON cart_items (cart_id, product_id);

CREATE TABLE IF NOT EXISTS wishlists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user_idx ON wishlists (user_id);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_wishlist_product_idx ON wishlist_items (wishlist_id, product_id);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id INTEGER REFERENCES addresses(id),
  total NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  payment_method VARCHAR(30) DEFAULT 'card',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  seller_id INTEGER REFERENCES sellers(id),
  name VARCHAR(200) NOT NULL,
  image TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_seller_idx ON order_items (seller_id);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Completed',
  transaction_ref VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_user_idx ON reviews (product_id, user_id);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  subscribed_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_email_idx ON newsletter_subscribers (email);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_seller_idx ON notifications (seller_id);
-- Seed baseline reference data. Safe to re-run (uses ON CONFLICT).

INSERT INTO packages (id, name, price, period, max_products, features) VALUES
('basic', 'Basic', 9.99, 'month', 20,
  '["List up to 20 products","Basic dashboard analytics","Standard support","5% commission per sale"]'),
('standard', 'Standard', 24.99, 'month', 100,
  '["List up to 100 products","Advanced sales analytics","Priority support","3% commission per sale","Featured store badge"]'),
('premium', 'Premium', 49.99, 'month', 99999,
  '["Unlimited products","Full analytics suite & charts","24/7 dedicated support","1% commission per sale","Homepage promotion","Custom store branding"]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (name, slug) VALUES
('Electronics', 'electronics'),
('Fashion', 'fashion'),
('Home', 'home'),
('Beauty', 'beauty'),
('Sports', 'sports'),
('Books', 'books'),
('Toys', 'toys')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO brands (name, slug) VALUES
('Generic', 'generic'),
('TechNest', 'technest')
ON CONFLICT (slug) DO NOTHING;

-- Demo seller: password is "123456" (bcrypt hash, 10 rounds)
INSERT INTO sellers (id, name, email, password_hash, phone, package_id, package_active, package_purchased_at, store_name, store_description, store_logo)
VALUES (
  1, 'Demo Seller', 'admin@demo.com',
  '$2a$10$9eGL5PrKYfA1JB9gfXFN4e1DNKWkEYZncggCQK4SCme5BTQpyyQVK',
  '+92 300 1112223', 'standard', true, now(),
  'TechNest Store', 'Your one-stop shop for the latest electronics, gadgets and accessories at unbeatable prices.',
  'https://placehold.co/120x120/6C5CE7/fff?text=TN'
) ON CONFLICT (id) DO NOTHING;
SELECT setval('sellers_id_seq', GREATEST((SELECT MAX(id) FROM sellers), 1));

-- Demo user: password is "123456" (bcrypt hash, 10 rounds)
INSERT INTO users (id, name, email, password_hash, phone)
VALUES (
  1, 'Demo User', 'user@demo.com',
  '$2a$10$9eGL5PrKYfA1JB9gfXFN4e1DNKWkEYZncggCQK4SCme5BTQpyyQVK',
  '+92 300 5556667'
) ON CONFLICT (id) DO NOTHING;
SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1));

INSERT INTO addresses (user_id, label, full_address, city, phone, is_default)
SELECT 1, 'Home', 'House 12, Street 5, Gulberg', 'Lahore', '+92 300 5556667', true
WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = 1);

-- Demo accounts (admin@demo.com and user@demo.com) both use password "123456".
-- Demo product catalog, linked to demo seller (id 1) and categories by slug.
-- Safe to re-run: only inserts if the products table is empty.

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM products) = 0 THEN
    INSERT INTO products (seller_id, category_id, name, description, price, discount, stock, sold, rating, image)
    SELECT 1, c.id, v.name, v.description, v.price, v.discount, v.stock, v.sold, v.rating, v.image
    FROM (VALUES
      ('Wireless Bluetooth Headphones','Premium over-ear headphones with active noise cancellation and 30-hour battery life.','electronics',79.99,15,45,18,4.6,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'),
      ('Smart Fitness Watch','Track your health with heart rate monitor, GPS, and 7-day battery life.','electronics',129.99,20,32,22,4.4,'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'),
      ('Men''s Casual Sneakers','Comfortable everyday sneakers with breathable mesh upper.','fashion',54.99,10,60,31,4.3,'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500'),
      ('Women''s Summer Dress','Lightweight floral dress, perfect for casual outings.','fashion',39.99,25,38,12,4.5,'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500'),
      ('Ceramic Coffee Mug Set','Set of 4 elegant ceramic mugs for your morning coffee.','home',24.99,0,80,40,4.7,'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500'),
      ('Modern Table Lamp','Minimalist LED table lamp with adjustable brightness.','home',34.99,12,25,9,4.2,'https://images.unsplash.com/photo-1543198126-2eb3f4d23226?w=500'),
      ('Organic Face Serum','Vitamin C serum for glowing, hydrated skin.','beauty',19.99,0,90,55,4.8,'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500'),
      ('Matte Lipstick Set','Long-lasting matte lipstick set, 6 vibrant shades.','beauty',16.99,10,70,27,4.1,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500'),
      ('Yoga Mat Premium','Non-slip eco-friendly yoga mat with carrying strap.','sports',29.99,5,55,19,4.6,'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500'),
      ('Adjustable Dumbbell Set','5-50lb adjustable dumbbells, space-saving design.','sports',199.99,8,15,6,4.5,'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=500'),
      ('The Art of Programming','Bestselling guide to mastering software engineering fundamentals.','books',22.99,0,40,33,4.9,'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500'),
      ('Mystery Novel Collection','Set of 3 thrilling mystery novels from top authors.','books',18.99,20,33,14,4.4,'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500'),
      ('Remote Control Car','High-speed RC car with rechargeable battery, ages 6+.','toys',34.99,15,48,21,4.3,'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500'),
      ('Building Blocks Set','500-piece creative building blocks set for kids.','toys',27.99,0,65,37,4.7,'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500'),
      ('4K Action Camera','Waterproof action camera with image stabilization.','electronics',89.99,18,28,15,4.5,'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500'),
      ('Leather Crossbody Bag','Genuine leather crossbody bag with adjustable strap.','fashion',64.99,5,22,8,4.6,'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=500'),
      ('Stainless Steel Cookware Set','10-piece non-stick cookware set for modern kitchens.','home',119.99,22,18,7,4.4,'https://images.unsplash.com/photo-1584990347449-a8b0b4f9b6a3?w=500'),
      ('Hair Dryer Pro','Ionic hair dryer with multiple heat settings.','beauty',45.99,0,42,16,4.3,'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=500'),
      ('Basketball Official Size','Indoor/outdoor official size basketball.','sports',24.99,0,75,44,4.5,'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=500'),
      ('Wireless Charging Pad','Fast wireless charger compatible with all Qi devices.','electronics',19.99,10,100,61,4.2,'https://images.unsplash.com/photo-1591290619762-c4a0fe16a497?w=500')
    ) AS v(name, description, category_slug, price, discount, stock, sold, rating, image)
    JOIN categories c ON c.slug = v.category_slug;
  END IF;
END $$;
