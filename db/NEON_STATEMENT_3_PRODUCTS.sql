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
