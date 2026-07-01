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
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Ke8y1u.eXAMPLEHASHREPLACEME01',
  '+92 300 1112223', 'standard', true, now(),
  'TechNest Store', 'Your one-stop shop for the latest electronics, gadgets and accessories at unbeatable prices.',
  'https://placehold.co/120x120/6C5CE7/fff?text=TN'
) ON CONFLICT (id) DO NOTHING;
SELECT setval('sellers_id_seq', GREATEST((SELECT MAX(id) FROM sellers), 1));

-- Demo user: password is "123456" (bcrypt hash, 10 rounds)
INSERT INTO users (id, name, email, password_hash, phone)
VALUES (
  1, 'Demo User', 'user@demo.com',
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Ke8y1u.eXAMPLEHASHREPLACEME02',
  '+92 300 5556667'
) ON CONFLICT (id) DO NOTHING;
SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1));

INSERT INTO addresses (user_id, label, full_address, city, phone, is_default)
SELECT 1, 'Home', 'House 12, Street 5, Gulberg', 'Lahore', '+92 300 5556667', true
WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = 1);

-- NOTE: The bcrypt hashes above are placeholders. Run `node db/hash-demo-passwords.js`
-- after migrating to set real bcrypt hashes for the demo accounts (both use "123456").
