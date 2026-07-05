DO $seed_migration$
BEGIN
  EXECUTE $stmt$INSERT INTO categories (name, slug) VALUES
('Electronics', 'electronics'),
('Fashion', 'fashion'),
('Home', 'home'),
('Beauty', 'beauty'),
('Sports', 'sports'),
('Books', 'books'),
('Toys', 'toys')
ON CONFLICT (slug) DO NOTHING;$stmt$;
  EXECUTE $stmt$INSERT INTO brands (name, slug) VALUES
('Generic', 'generic'),
('TechNest', 'technest')
ON CONFLICT (slug) DO NOTHING;$stmt$;
  EXECUTE $stmt$SELECT setval('sellers_id_seq', GREATEST((SELECT MAX(id) FROM sellers), 1));$stmt$;
  EXECUTE $stmt$SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1));$stmt$;
  EXECUTE $stmt$INSERT INTO addresses (user_id, label, full_address, city, phone, is_default)
SELECT 1, 'Home', 'House 12, Street 5, Gulberg', 'Lahore', '+92 300 5556667', true
WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = 1);$stmt$;
END $seed_migration$;