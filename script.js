/* =========================================================
   CARTO - Full eCommerce Frontend Logic
   Uses LocalStorage as a fake database.
   ========================================================= */

/* ---------- DB KEYS ---------- */
const DB = {
  USERS: 'mh_users',
  ADMINS: 'mh_admins',
  PRODUCTS: 'mh_products',
  ORDERS: 'mh_orders',
  TRANSACTIONS: 'mh_transactions',
  PACKAGES: 'mh_packages',
  SESSION: 'mh_session',
  CART: 'mh_cart',
  ADDRESSES: 'mh_addresses'
};

/* ---------- DB HELPERS ---------- */
function dbGet(key, fallback){
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : []);
}
function dbSet(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix='ID'){
  return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random()*900+100);
}

/* ---------- SEED DATA (only runs once) ---------- */
function seedDatabase(){
  if(!localStorage.getItem('mh_seeded')){
    // Packages
    dbSet(DB.PACKAGES, [
      {id:'basic', name:'Basic', price:9.99, period:'month', maxProducts:20,
        features:['List up to 20 products','Basic dashboard analytics','Standard support','5% commission per sale']},
      {id:'standard', name:'Standard', price:24.99, period:'month', maxProducts:100,
        features:['List up to 100 products','Advanced sales analytics','Priority support','3% commission per sale','Featured store badge']},
      {id:'premium', name:'Premium', price:49.99, period:'month', maxProducts:99999,
        features:['Unlimited products','Full analytics suite & charts','24/7 dedicated support','1% commission per sale','Homepage promotion','Custom store branding']}
    ]);

    // Demo admin (pre-activated with standard package + store)
    const demoAdminId = 'admin-demo-001';
    dbSet(DB.ADMINS, [{
      id: demoAdminId, name:'Demo Seller', email:'admin@demo.com', phone:'+92 300 1112223',
      password:'123456', package:'standard', packageActive:true,
      packagePurchasedDate: new Date().toISOString(),
      store:{ name:'TechNest Store', description:'Your one-stop shop for the latest electronics, gadgets and accessories at unbeatable prices.',
        logo:'https://placehold.co/120x120/6C5CE7/fff?text=TN' },
      createdAt: new Date(Date.now() - 90*86400000).toISOString()
    }]);

    // Demo user
    dbSet(DB.USERS, [{
      id:'user-demo-001', name:'Demo User', email:'user@demo.com', phone:'+92 300 5556667',
      password:'123456', createdAt: new Date(Date.now() - 60*86400000).toISOString()
    }]);

    // Demo addresses for demo user
    dbSet(DB.ADDRESSES, [
      {id: uid('ADDR'), userId:'user-demo-001', label:'Home', full:'House 12, Street 5, Gulberg', city:'Lahore', phone:'+92 300 5556667'}
    ]);

    // Seed Products
    const sampleProducts = [
      ['Wireless Bluetooth Headphones','Premium over-ear headphones with active noise cancellation and 30-hour battery life.','Electronics',79.99,15,45,4.6,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
      ['Smart Fitness Watch','Track your health with heart rate monitor, GPS, and 7-day battery life.','Electronics',129.99,20,32,4.4,'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
      ['Men\'s Casual Sneakers','Comfortable everyday sneakers with breathable mesh upper.','Fashion',54.99,10,60,4.3,'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500'],
      ['Women\'s Summer Dress','Lightweight floral dress, perfect for casual outings.','Fashion',39.99,25,38,4.5,'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500'],
      ['Ceramic Coffee Mug Set','Set of 4 elegant ceramic mugs for your morning coffee.','Home',24.99,0,80,4.7,'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500'],
      ['Modern Table Lamp','Minimalist LED table lamp with adjustable brightness.','Home',34.99,12,25,4.2,'https://images.unsplash.com/photo-1543198126-2eb3f4d23226?w=500'],
      ['Organic Face Serum','Vitamin C serum for glowing, hydrated skin.','Beauty',19.99,0,90,4.8,'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500'],
      ['Matte Lipstick Set','Long-lasting matte lipstick set, 6 vibrant shades.','Beauty',16.99,10,70,4.1,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500'],
      ['Yoga Mat Premium','Non-slip eco-friendly yoga mat with carrying strap.','Sports',29.99,5,55,4.6,'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500'],
      ['Adjustable Dumbbell Set','5-50lb adjustable dumbbells, space-saving design.','Sports',199.99,8,15,4.5,'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=500'],
      ['The Art of Programming','Bestselling guide to mastering software engineering fundamentals.','Books',22.99,0,40,4.9,'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500'],
      ['Mystery Novel Collection','Set of 3 thrilling mystery novels from top authors.','Books',18.99,20,33,4.4,'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500'],
      ['Remote Control Car','High-speed RC car with rechargeable battery, ages 6+.','Toys',34.99,15,48,4.3,'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=500'],
      ['Building Blocks Set','500-piece creative building blocks set for kids.','Toys',27.99,0,65,4.7,'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500'],
      ['4K Action Camera','Waterproof action camera with image stabilization.','Electronics',89.99,18,28,4.5,'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500'],
      ['Leather Crossbody Bag','Genuine leather crossbody bag with adjustable strap.','Fashion',64.99,5,22,4.6,'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=500'],
      ['Stainless Steel Cookware Set','10-piece non-stick cookware set for modern kitchens.','Home',119.99,22,18,4.4,'https://images.unsplash.com/photo-1584990347449-a8b0b4f9b6a3?w=500'],
      ['Hair Dryer Pro','Ionic hair dryer with multiple heat settings.','Beauty',45.99,0,42,4.3,'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=500'],
      ['Basketball Official Size','Indoor/outdoor official size basketball.','Sports',24.99,0,75,4.5,'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=500'],
      ['Wireless Charging Pad','Fast wireless charger compatible with all Qi devices.','Electronics',19.99,10,100,4.2,'https://images.unsplash.com/photo-1591290619762-c4a0fe16a497?w=500']
    ];

    const products = sampleProducts.map((p,i)=>({
      id: uid('PRD'),
      sellerId: demoAdminId,
      name:p[0], description:p[1], category:p[2], price:p[3], discount:p[4],
      stock:p[5], rating:p[6], image:p[7],
      sold: Math.floor(Math.random()*30)+2,
      createdAt: new Date(Date.now() - (i*3+5)*86400000).toISOString()
    }));
    dbSet(DB.PRODUCTS, products);

    // Seed some demo orders for the admin dashboard + demo user
    const statuses = ['Delivered','Shipped','Pending','Delivered','Cancelled','Delivered'];
    const orders = [];
    for(let i=0;i<8;i++){
      const prod = products[Math.floor(Math.random()*products.length)];
      const qty = Math.floor(Math.random()*3)+1;
      const finalPrice = prod.price * (1-prod.discount/100);
      orders.push({
        id: uid('ORD'),
        userId:'user-demo-001',
        customerName:'Demo User',
        items:[{productId:prod.id, name:prod.name, image:prod.image, price:finalPrice, qty, sellerId: demoAdminId}],
        total: +(finalPrice*qty + 5).toFixed(2),
        status: statuses[i % statuses.length],
        paymentMethod:'card',
        address:'House 12, Street 5, Gulberg, Lahore',
        createdAt: new Date(Date.now() - (i*4+1)*86400000).toISOString()
      });
    }
    dbSet(DB.ORDERS, orders);
    dbSet(DB.TRANSACTIONS, orders.map(o=>({
      id: uid('TXN'), orderId:o.id, amount:o.total, method:o.paymentMethod, date:o.createdAt, status:'Completed'
    })));

    localStorage.setItem('mh_seeded','true');
  }

  // Ensure all keys exist even if seeded already
  if(!localStorage.getItem(DB.CART)) dbSet(DB.CART, []);
}

/* ---------- SESSION ---------- */
function getSession(){ return dbGet(DB.SESSION, null); }
function setSession(session){ dbSet(DB.SESSION, session); }
function clearSession(){ localStorage.removeItem(DB.SESSION); }

function getCurrentUser(){
  const s = getSession();
  if(!s || s.role !== 'user') return null;
  return dbGet(DB.USERS).find(u=>u.id===s.id) || null;
}
function getCurrentAdmin(){
  const s = getSession();
  if(!s || s.role !== 'admin') return null;
  return dbGet(DB.ADMINS).find(a=>a.id===s.id) || null;
}

/* ---------- TOAST ---------- */
function showToast(msg, type='info'){
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {success:'✅', error:'❌', info:'ℹ️'};
  toast.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(()=>{ toast.style.opacity='0'; toast.style.transform='translateX(120%)'; setTimeout(()=>toast.remove(),300); }, 3000);
}

/* ---------- NAVIGATION ---------- */
let currentView = 'home';
let currentProductId = null;
let currentAdminTab = 'overview';
let currentUserTab = 'profile';

function navigateTo(view, opts={}){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  currentView = view;
  window.scrollTo({top:0, behavior:'smooth'});
  closeAccountDropdown();

  // Guard routes
  const session = getSession();
  if(view==='adminDashboard' && !session){ navigateTo('adminLogin'); return; }
  if(view==='userDashboard' && !session){ navigateTo('userLogin'); return; }
  if(view==='checkout' && !session){ navigateTo('userLogin'); showToast('Please login to checkout','info'); return; }

  // Render content per view
  if(view==='home') renderHome();
  if(view==='products') renderProductListing();
  if(view==='productDetail' && opts.productId){ currentProductId = opts.productId; renderProductDetail(opts.productId); }
  if(view==='cart') renderCart();
  if(view==='checkout') renderCheckout();
  if(view==='orderHistory') renderOrderHistory();
  if(view==='packages') renderPackages();
  if(view==='adminDashboard'){ renderAdminDashboard(); }
  if(view==='userDashboard'){ renderUserDashboard(); }

  updateNavbar();
}

/* ---------- NAVBAR STATE ---------- */
function updateNavbar(){
  const session = getSession();
  const label = document.getElementById('navAccountLabel');
  const dropdown = document.getElementById('accountDropdown');
  const cart = dbGet(DB.CART);
  document.getElementById('cartBadge').textContent = cart.reduce((s,i)=>s+i.qty,0);

  if(!session){
    label.textContent = '👤 Login';
    dropdown.innerHTML = `
      <a onclick="navigateTo('userLogin')">User Login</a>
      <a onclick="navigateTo('userRegister')">User Register</a>
      <a onclick="navigateTo('adminLogin')">Seller Login</a>
    `;
  } else if(session.role==='user'){
    const u = getCurrentUser();
    label.textContent = `👤 ${u ? u.name.split(' ')[0] : 'Account'}`;
    dropdown.innerHTML = `
      <a onclick="navigateTo('userDashboard')">My Dashboard</a>
      <a onclick="navigateTo('orderHistory')">Order History</a>
      <a onclick="logout()">Logout</a>
    `;
  } else if(session.role==='admin'){
    const a = getCurrentAdmin();
    label.textContent = `🏪 ${a ? a.name.split(' ')[0] : 'Seller'}`;
    dropdown.innerHTML = `
      <a onclick="navigateTo('adminDashboard')">Seller Dashboard</a>
      <a onclick="logout()">Logout</a>
    `;
  }
}

function closeAccountDropdown(){
  document.getElementById('accountDropdown').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('navAccountBtn').addEventListener('click', (e)=>{
    e.stopPropagation();
    document.getElementById('accountDropdown').classList.toggle('open');
  });
  document.addEventListener('click', closeAccountDropdown);

  document.getElementById('hamburgerBtn').addEventListener('click', ()=>{
    document.querySelector('.nav-search').style.display =
      document.querySelector('.nav-search').style.display === 'flex' ? 'none' : 'flex';
  });

  // payment method toggle
  document.addEventListener('change', (e)=>{
    if(e.target.name === 'payment'){
      const cardFields = document.getElementById('cardFields');
      cardFields.classList.toggle('show', e.target.value === 'card');
    }
  });

  init();
});

/* ---------- INIT ---------- */
function init(){
  seedDatabase();
  navigateTo('home');
  updateNavbar();
}

/* ---------- LOGOUT ---------- */
function logout(){
  clearSession();
  showToast('Logged out successfully','success');
  navigateTo('home');
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */
function handleUserLogin(e){
  e.preventDefault();
  const email = document.getElementById('userLoginEmail').value.trim().toLowerCase();
  const password = document.getElementById('userLoginPassword').value;
  const users = dbGet(DB.USERS);
  const user = users.find(u=>u.email.toLowerCase()===email && u.password===password);
  if(!user){ showToast('Invalid email or password','error'); return false; }
  setSession({role:'user', id:user.id});
  showToast(`Welcome back, ${user.name.split(' ')[0]}!`,'success');
  navigateTo('home');
  return false;
}

function handleUserRegister(e){
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const users = dbGet(DB.USERS);
  if(users.some(u=>u.email.toLowerCase()===email)){
    showToast('Email already registered','error'); return false;
  }
  const newUser = {id:uid('user'), name, email, phone, password, createdAt:new Date().toISOString()};
  users.push(newUser);
  dbSet(DB.USERS, users);
  setSession({role:'user', id:newUser.id});
  showToast('Account created successfully!','success');
  navigateTo('home');
  return false;
}

function handleAdminLogin(e){
  e.preventDefault();
  const email = document.getElementById('adminLoginEmail').value.trim().toLowerCase();
  const password = document.getElementById('adminLoginPassword').value;
  const admins = dbGet(DB.ADMINS);
  const admin = admins.find(a=>a.email.toLowerCase()===email && a.password===password);
  if(!admin){ showToast('Invalid email or password','error'); return false; }
  setSession({role:'admin', id:admin.id});
  showToast(`Welcome back, ${admin.name.split(' ')[0]}!`,'success');
  if(!admin.packageActive){
    navigateTo('packages');
  } else {
    navigateTo('adminDashboard');
  }
  return false;
}

function handleAdminRegister(e){
  e.preventDefault();
  const name = document.getElementById('adminRegName').value.trim();
  const email = document.getElementById('adminRegEmail').value.trim().toLowerCase();
  const phone = document.getElementById('adminRegPhone').value.trim();
  const password = document.getElementById('adminRegPassword').value;
  const admins = dbGet(DB.ADMINS);
  if(admins.some(a=>a.email.toLowerCase()===email)){
    showToast('Email already registered','error'); return false;
  }
  const newAdmin = {
    id:uid('admin'), name, email, phone, password,
    package:null, packageActive:false, store:null, createdAt:new Date().toISOString()
  };
  admins.push(newAdmin);
  dbSet(DB.ADMINS, admins);
  setSession({role:'admin', id:newAdmin.id});
  showToast('Seller account created! Choose a package to activate.','success');
  navigateTo('packages');
  return false;
}

/* =========================================================
   PACKAGES
   ========================================================= */
function renderPackages(){
  const packages = dbGet(DB.PACKAGES);
  const grid = document.getElementById('packageGrid');
  grid.innerHTML = packages.map((p,i)=>`
    <div class="package-card ${i===1?'featured':''}">
      ${i===1?'<span class="package-badge">MOST POPULAR</span>':''}
      <h3>${p.name}</h3>
      <div class="package-price">$${p.price}<span>/${p.period}</span></div>
      <ul class="package-features">
        ${p.features.map(f=>`<li>${f}</li>`).join('')}
      </ul>
      <button class="btn ${i===1?'btn-primary':'btn-outline'} btn-full" onclick="purchasePackage('${p.id}')">Choose ${p.name}</button>
    </div>
  `).join('');
}

function purchasePackage(packageId){
  const session = getSession();
  if(!session || session.role!=='admin'){ navigateTo('adminLogin'); return; }
  const admins = dbGet(DB.ADMINS);
  const admin = admins.find(a=>a.id===session.id);
  if(!admin) return;

  const pkg = dbGet(DB.PACKAGES).find(p=>p.id===packageId);
  admin.package = packageId;
  admin.packageActive = true;
  admin.packagePurchasedDate = new Date().toISOString();
  if(!admin.store){
    admin.store = {name:'', description:'', logo:'https://placehold.co/120x120/6C5CE7/fff?text=Logo'};
  }
  dbSet(DB.ADMINS, admins);

  // record transaction
  const txns = dbGet(DB.TRANSACTIONS);
  txns.push({id:uid('TXN'), orderId:null, amount:pkg.price, method:'package_purchase',
    description:`${pkg.name} Package Subscription`, date:new Date().toISOString(), status:'Completed'});
  dbSet(DB.TRANSACTIONS, txns);

  showToast(`${pkg.name} package activated! 🎉`,'success');
  navigateTo('adminDashboard');
}

/* =========================================================
   HOME PAGE RENDERING
   ========================================================= */
const CATEGORIES = [
  {name:'Electronics', icon:'📱'},
  {name:'Fashion', icon:'👗'},
  {name:'Home', icon:'🏠', label:'Home & Living'},
  {name:'Beauty', icon:'💄'},
  {name:'Sports', icon:'⚽'},
  {name:'Books', icon:'📚'},
  {name:'Toys', icon:'🧸'}
];

function renderHome(){
  // Category grid
  document.getElementById('categoryGrid').innerHTML = CATEGORIES.map(c=>`
    <div class="category-card" onclick="filterByCategory('${c.name}')">
      <div class="cat-icon">${c.icon}</div>
      <div class="cat-name">${c.label||c.name}</div>
    </div>
  `).join('');

  const products = dbGet(DB.PRODUCTS);
  // Featured = top rated
  const featured = [...products].sort((a,b)=>b.rating-a.rating).slice(0,5);
  document.getElementById('featuredProducts').innerHTML = featured.map(productCardHTML).join('');

  // Trending = most sold
  const trending = [...products].sort((a,b)=>b.sold-a.sold).slice(0,5);
  document.getElementById('trendingProducts').innerHTML = trending.map(productCardHTML).join('');
}

function filterByCategory(cat){
  navigateTo('products');
  setTimeout(()=>{
    document.getElementById('filterCategory').value = cat;
    applyFilters();
  }, 50);
}

/* ---------- PRODUCT CARD TEMPLATE ---------- */
function productCardHTML(p){
  const finalPrice = (p.price * (1 - p.discount/100)).toFixed(2);
  const stockLabel = p.stock === 0 ? 'Out of stock' : (p.stock < 10 ? `Only ${p.stock} left` : '');
  return `
    <div class="product-card" onclick="navigateTo('productDetail', {productId:'${p.id}'})">
      <div class="product-img-wrap">
        ${p.discount > 0 ? `<span class="discount-tag">-${p.discount}%</span>` : ''}
        ${stockLabel ? `<span class="stock-tag">${stockLabel}</span>` : ''}
        <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="product-info">
        <div class="product-cat">${p.category}</div>
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-rating"><span class="stars">${starString(p.rating)}</span> ${p.rating.toFixed(1)} (${p.sold} sold)</div>
        <div class="price-row">
          <span class="price-now">$${finalPrice}</span>
          ${p.discount > 0 ? `<span class="price-old">$${p.price.toFixed(2)}</span>` : ''}
        </div>
        <button class="add-cart-btn" onclick="event.stopPropagation(); addToCart('${p.id}', 1)" ${p.stock===0?'disabled style="opacity:.5;cursor:not-allowed"':''}>
          ${p.stock===0 ? 'Out of Stock' : '🛒 Add to Cart'}
        </button>
      </div>
    </div>
  `;
}

function starString(rating){
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5-full);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   SEARCH
   ========================================================= */
function performSearch(){
  navigateTo('products');
  setTimeout(()=>{ applyFilters(); }, 50);
}
document.addEventListener('DOMContentLoaded', ()=>{
  const navSearch = document.getElementById('navSearchInput');
  navSearch.addEventListener('keydown', (e)=>{ if(e.key==='Enter') performSearch(); });
});

/* =========================================================
   PRODUCT LISTING PAGE (Filter / Sort / Search)
   ========================================================= */
let ratingFilterVal = 0;

function renderProductListing(){
  ratingFilterVal = 0;
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.rf-btn[data-rating="0"]').classList.add('active');
  const navCat = document.getElementById('categoryFilterNav').value;
  if(navCat !== 'all'){ document.getElementById('filterCategory').value = navCat; }
  applyFilters();
}

function setRatingFilter(val){
  ratingFilterVal = val;
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.toggle('active', +b.dataset.rating===val));
  applyFilters();
}

function resetFilters(){
  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterSort').value = 'default';
  document.getElementById('filterPrice').value = 1000;
  document.getElementById('priceRangeVal').textContent = 1000;
  document.getElementById('navSearchInput').value = '';
  setRatingFilter(0);
}

function applyFilters(){
  let products = dbGet(DB.PRODUCTS);
  const category = document.getElementById('filterCategory').value;
  const sort = document.getElementById('filterSort').value;
  const maxPrice = +document.getElementById('filterPrice').value;
  const searchTerm = document.getElementById('navSearchInput').value.trim().toLowerCase();

  document.getElementById('priceRangeVal').textContent = maxPrice;

  if(category !== 'all') products = products.filter(p=>p.category===category);
  products = products.filter(p=> (p.price*(1-p.discount/100)) <= maxPrice );
  if(ratingFilterVal > 0) products = products.filter(p=>p.rating >= ratingFilterVal);
  if(searchTerm){
    products = products.filter(p=>
      p.name.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm) ||
      p.category.toLowerCase().includes(searchTerm)
    );
  }

  if(sort==='priceLow') products.sort((a,b)=>(a.price*(1-a.discount/100))-(b.price*(1-b.discount/100)));
  if(sort==='priceHigh') products.sort((a,b)=>(b.price*(1-b.discount/100))-(a.price*(1-a.discount/100)));
  if(sort==='rating') products.sort((a,b)=>b.rating-a.rating);
  if(sort==='newest') products.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  document.getElementById('listingTitle').textContent = category==='all' ? 'All Products' : category;
  document.getElementById('listingCount').textContent = `${products.length} product${products.length!==1?'s':''}`;

  const grid = document.getElementById('productListingGrid');
  grid.innerHTML = products.length ? products.map(productCardHTML).join('') :
    `<div class="empty-state" style="grid-column:1/-1"><div class="ei">🔍</div><h3>No products found</h3><p>Try adjusting your filters</p></div>`;
}

/* =========================================================
   PRODUCT DETAIL PAGE
   ========================================================= */
let detailQty = 1;

function renderProductDetail(productId){
  const p = dbGet(DB.PRODUCTS).find(pr=>pr.id===productId);
  if(!p){ navigateTo('products'); return; }
  detailQty = 1;
  const finalPrice = (p.price * (1-p.discount/100)).toFixed(2);
  const stockClass = p.stock===0 ? 'out' : (p.stock<10 ? 'low':'');
  const stockText = p.stock===0 ? '✗ Out of Stock' : (p.stock<10 ? `⚠ Only ${p.stock} left in stock` : `✓ In Stock (${p.stock} available)`);

  document.getElementById('productDetailContent').innerHTML = `
    <div class="detail-layout">
      <div class="detail-img"><img src="${p.image}" alt="${escapeHtml(p.name)}"></div>
      <div class="detail-info">
        <div class="product-cat">${p.category}</div>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="detail-meta">
          <span class="stars">${starString(p.rating)}</span>
          <span>${p.rating.toFixed(1)} rating</span>
          <span>•</span>
          <span>${p.sold} sold</span>
        </div>
        <div class="detail-price">
          <span class="price-now">$${finalPrice}</span>
          ${p.discount>0 ? `<span class="price-old">$${p.price.toFixed(2)}</span><span class="discount-tag" style="position:static">-${p.discount}%</span>` : ''}
        </div>
        <p class="detail-desc">${escapeHtml(p.description)}</p>
        <p class="stock-info ${stockClass}">${stockText}</p>
        ${p.stock>0 ? `
        <div class="qty-selector">
          <button onclick="changeDetailQty(-1, ${p.stock})">−</button>
          <span id="detailQtyVal">1</span>
          <button onclick="changeDetailQty(1, ${p.stock})">+</button>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary btn-lg" onclick="addToCart('${p.id}', detailQty)">🛒 Add to Cart</button>
          <button class="btn btn-dark btn-lg" onclick="buyNow('${p.id}')">⚡ Buy Now</button>
        </div>` : `<button class="btn btn-outline btn-lg" disabled>Out of Stock</button>`}
      </div>
    </div>
  `;

  const related = dbGet(DB.PRODUCTS).filter(pr=>pr.category===p.category && pr.id!==p.id).slice(0,5);
  document.getElementById('relatedProducts').innerHTML = related.map(productCardHTML).join('');
}

function changeDetailQty(delta, max){
  detailQty = Math.min(max, Math.max(1, detailQty+delta));
  document.getElementById('detailQtyVal').textContent = detailQty;
}

function buyNow(productId){
  addToCart(productId, detailQty, true);
}

/* =========================================================
   CART SYSTEM
   ========================================================= */
function addToCart(productId, qty=1, redirectCheckout=false){
  const product = dbGet(DB.PRODUCTS).find(p=>p.id===productId);
  if(!product || product.stock===0) return;

  let cart = dbGet(DB.CART);
  const existing = cart.find(c=>c.productId===productId);
  if(existing){
    existing.qty = Math.min(product.stock, existing.qty + qty);
  } else {
    cart.push({productId, qty: Math.min(qty, product.stock)});
  }
  dbSet(DB.CART, cart);
  updateNavbar();
  showToast(`${product.name} added to cart!`,'success');
  if(redirectCheckout) navigateTo('cart');
}

function removeFromCart(productId){
  let cart = dbGet(DB.CART);
  cart = cart.filter(c=>c.productId!==productId);
  dbSet(DB.CART, cart);
  renderCart();
  updateNavbar();
  showToast('Item removed from cart','info');
}

function changeCartQty(productId, delta){
  let cart = dbGet(DB.CART);
  const item = cart.find(c=>c.productId===productId);
  if(!item) return;
  const product = dbGet(DB.PRODUCTS).find(p=>p.id===productId);
  item.qty = Math.max(1, Math.min(product.stock, item.qty + delta));
  dbSet(DB.CART, cart);
  renderCart();
  updateNavbar();
}

function getCartDetails(){
  const cart = dbGet(DB.CART);
  const products = dbGet(DB.PRODUCTS);
  return cart.map(c=>{
    const p = products.find(pr=>pr.id===c.productId);
    if(!p) return null;
    const finalPrice = p.price * (1-p.discount/100);
    return {...c, product:p, finalPrice, lineTotal: finalPrice*c.qty};
  }).filter(Boolean);
}

function renderCart(){
  const details = getCartDetails();
  const container = document.getElementById('cartItemsList');
  const layout = document.getElementById('cartLayout');

  if(details.length===0){
    layout.innerHTML = `<div class="empty-state" style="width:100%"><div class="ei">🛒</div><h3>Your cart is empty</h3><p>Add some products to get started</p>
      <button class="btn btn-primary" style="margin-top:16px" onclick="navigateTo('products')">Start Shopping</button></div>`;
    return;
  }

  // Rebuild layout since it may have been replaced by empty state
  layout.innerHTML = `
    <div class="cart-items" id="cartItemsList"></div>
    <div class="cart-summary panel">
      <h3>Order Summary</h3>
      <div class="summary-row"><span>Subtotal</span><span id="cartSubtotal">$0.00</span></div>
      <div class="summary-row"><span>Discount</span><span id="cartDiscount">-$0.00</span></div>
      <div class="summary-row"><span>Shipping</span><span id="cartShipping">$5.00</span></div>
      <div class="summary-row total-row"><span>Total</span><span id="cartTotal">$0.00</span></div>
      <button class="btn btn-primary btn-full" onclick="goToCheckout()">Proceed to Checkout →</button>
    </div>
  `;

  document.getElementById('cartItemsList').innerHTML = details.map(d=>`
    <div class="cart-item">
      <img src="${d.product.image}" alt="${escapeHtml(d.product.name)}">
      <div class="cart-item-info">
        <h4>${escapeHtml(d.product.name)}</h4>
        <p>${d.product.category} ${d.product.discount>0?`• ${d.product.discount}% off`:''}</p>
        <div class="cart-item-qty">
          <button onclick="changeCartQty('${d.productId}', -1)">−</button>
          <span>${d.qty}</span>
          <button onclick="changeCartQty('${d.productId}', 1)">+</button>
        </div>
      </div>
      <div class="cart-item-price">$${d.lineTotal.toFixed(2)}</div>
      <span class="remove-item" onclick="removeFromCart('${d.productId}')">🗑️</span>
    </div>
  `).join('');

  const subtotal = details.reduce((s,d)=>s+d.product.price*d.qty,0);
  const finalSubtotal = details.reduce((s,d)=>s+d.lineTotal,0);
  const discountAmt = subtotal - finalSubtotal;
  const shipping = 5;
  const total = finalSubtotal + shipping;

  document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cartDiscount').textContent = `-$${discountAmt.toFixed(2)}`;
  document.getElementById('cartShipping').textContent = `$${shipping.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
}

function goToCheckout(){
  const session = getSession();
  if(!session){ navigateTo('userLogin'); showToast('Please login to checkout','info'); return; }
  if(session.role !== 'user'){ showToast('Please login as a customer to checkout','error'); return; }
  navigateTo('checkout');
}

/* =========================================================
   CHECKOUT SYSTEM
   ========================================================= */
function renderCheckout(){
  const details = getCartDetails();
  if(details.length===0){ navigateTo('cart'); return; }

  const user = getCurrentUser();
  if(user){
    document.getElementById('checkoutName').value = user.name;
    document.getElementById('checkoutPhone').value = user.phone || '';
    const addresses = dbGet(DB.ADDRESSES).filter(a=>a.userId===user.id);
    if(addresses.length){
      document.getElementById('checkoutAddress').value = addresses[0].full;
      document.getElementById('checkoutCity').value = addresses[0].city;
    }
  }

  document.getElementById('checkoutItemsSummary').innerHTML = details.map(d=>`
    <div class="checkout-item-row"><span>${escapeHtml(d.product.name)} × ${d.qty}</span><span>$${d.lineTotal.toFixed(2)}</span></div>
  `).join('');

  const finalSubtotal = details.reduce((s,d)=>s+d.lineTotal,0);
  const shipping = 5;
  document.getElementById('checkoutSubtotal').textContent = `$${finalSubtotal.toFixed(2)}`;
  document.getElementById('checkoutShipping').textContent = `$${shipping.toFixed(2)}`;
  document.getElementById('checkoutTotal').textContent = `$${(finalSubtotal+shipping).toFixed(2)}`;

  document.getElementById('cardFields').classList.add('show');
}

function placeOrder(){
  const name = document.getElementById('checkoutName').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();
  const address = document.getElementById('checkoutAddress').value.trim();
  const city = document.getElementById('checkoutCity').value.trim();
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

  if(!name || !phone || !address || !city){
    showToast('Please fill in all required fields','error'); return;
  }
  if(paymentMethod==='card'){
    const cardNum = document.getElementById('cardNumber').value.trim();
    if(cardNum.replace(/\s/g,'').length < 12){
      showToast('Please enter a valid card number','error'); return;
    }
  }

  const details = getCartDetails();
  if(details.length===0){ showToast('Your cart is empty','error'); return; }

  const session = getSession();
  const products = dbGet(DB.PRODUCTS);
  const finalSubtotal = details.reduce((s,d)=>s+d.lineTotal,0);
  const shipping = 5;
  const total = finalSubtotal + shipping;

  const order = {
    id: uid('ORD'),
    userId: session.id,
    customerName: name,
    items: details.map(d=>({productId:d.productId, name:d.product.name, image:d.product.image, price:d.finalPrice, qty:d.qty, sellerId:d.product.sellerId})),
    total: +total.toFixed(2),
    status:'Pending',
    paymentMethod,
    address: `${address}, ${city}`,
    createdAt: new Date().toISOString()
  };

  const orders = dbGet(DB.ORDERS);
  orders.push(order);
  dbSet(DB.ORDERS, orders);

  // Update product stock & sold counts
  details.forEach(d=>{
    const p = products.find(pr=>pr.id===d.productId);
    if(p){ p.stock = Math.max(0, p.stock - d.qty); p.sold = (p.sold||0) + d.qty; }
  });
  dbSet(DB.PRODUCTS, products);

  // Record transaction
  const txns = dbGet(DB.TRANSACTIONS);
  const txn = {id: uid('TXN'), orderId: order.id, amount: order.total, method: paymentMethod, date: order.createdAt, status:'Completed'};
  txns.push(txn);
  dbSet(DB.TRANSACTIONS, txns);

  // Clear cart
  dbSet(DB.CART, []);
  updateNavbar();

  renderReceipt(order, txn);
  navigateTo('receipt');
  showToast('Order placed successfully! 🎉','success');
}

function renderReceipt(order, txn){
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-check">✅</div>
    <h2>Order Confirmed!</h2>
    <p class="receipt-id">Order ID: ${order.id} • Transaction: ${txn.id}</p>
    <div class="receipt-details">
      ${order.items.map(it=>`
        <div class="receipt-row"><span>${escapeHtml(it.name)} × ${it.qty}</span><span>$${(it.price*it.qty).toFixed(2)}</span></div>
      `).join('')}
      <div class="receipt-row" style="border-top:1px dashed var(--border);margin-top:8px;padding-top:10px;"><span>Shipping</span><span>$5.00</span></div>
      <div class="receipt-row" style="font-weight:700;font-size:16px;"><span>Total Paid</span><span>$${order.total.toFixed(2)}</span></div>
    </div>
    <div class="receipt-row"><span>Payment Method</span><span>${paymentLabel(order.paymentMethod)}</span></div>
    <div class="receipt-row"><span>Delivery Address</span><span>${escapeHtml(order.address)}</span></div>
    <div class="receipt-row"><span>Status</span><span class="status-pill status-pending">Pending</span></div>
    <button class="btn btn-primary btn-full" style="margin-top:24px" onclick="navigateTo('orderHistory')">View My Orders</button>
    <button class="btn btn-outline btn-full" style="margin-top:10px" onclick="navigateTo('products')">Continue Shopping</button>
  `;
}

function paymentLabel(method){
  return {card:'💳 Credit/Debit Card', cod:'💵 Cash on Delivery', wallet:'📱 Mobile Wallet', package_purchase:'Package Purchase'}[method] || method;
}

/* =========================================================
   ORDER HISTORY (Standalone page)
   ========================================================= */
function renderOrderHistory(){
  const session = getSession();
  if(!session || session.role !== 'user'){ navigateTo('userLogin'); return; }
  const orders = dbGet(DB.ORDERS).filter(o=>o.userId===session.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tbody = document.querySelector('#orderHistoryTable tbody');

  if(orders.length===0){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-light)">No orders yet</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o=>`
    <tr>
      <td>${o.id}</td>
      <td>${o.items.map(i=>i.name).join(', ').slice(0,40)}${o.items.map(i=>i.name).join(', ').length>40?'...':''}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td><span class="status-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="alert('Order Details:\\n\\n' + JSON.stringify({id:o.id}, null, 2))" style="display:none"></button></td>
    </tr>
  `).join('');
}

function formatDate(iso){
  return new Date(iso).toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'});
}

/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */
function renderAdminDashboard(){
  const admin = getCurrentAdmin();
  if(!admin) return;
  if(!admin.packageActive){ navigateTo('packages'); return; }

  document.getElementById('adminSidebarName').textContent = admin.name;
  document.getElementById('adminAvatar').textContent = admin.name.charAt(0).toUpperCase();
  const pkg = dbGet(DB.PACKAGES).find(p=>p.id===admin.package);
  document.getElementById('adminPkgBadge').textContent = `${pkg ? pkg.name : ''} Plan`;

  switchAdminTab(currentAdminTab);
}

function switchAdminTab(tab){
  currentAdminTab = tab;
  document.querySelectorAll('#adminSidebar .sidebar-link').forEach(l=>l.classList.toggle('active', l.dataset.tab===tab));
  document.querySelectorAll('.dash-tab').forEach(t=>t.classList.remove('active'));
  const tabEl = document.getElementById('admin-tab-'+tab);
  if(tabEl) tabEl.classList.add('active');

  if(tab==='overview') renderAdminOverview();
  if(tab==='store') renderAdminStore();
  if(tab==='products') renderAdminProducts();
  if(tab==='orders') renderAdminOrders();
  if(tab==='analytics') renderAdminAnalytics();
  if(tab==='profile') renderAdminProfile();
}

function getAdminProducts(){
  const admin = getCurrentAdmin();
  return dbGet(DB.PRODUCTS).filter(p=>p.sellerId===admin.id);
}
function getAdminOrders(){
  const admin = getCurrentAdmin();
  const myProductIds = new Set(getAdminProducts().map(p=>p.id));
  return dbGet(DB.ORDERS).filter(o=>o.items.some(it=>myProductIds.has(it.productId)));
}

/* ---------- OVERVIEW TAB ---------- */
let salesChartInst, categoryChartInst, performanceChartInst, spendingChartInst;

function renderAdminOverview(){
  const products = getAdminProducts();
  const orders = getAdminOrders();

  const totalRevenue = orders.reduce((sum,o)=>{
    return sum + o.items.reduce((s,it)=> products.some(p=>p.id===it.productId) ? s + it.price*it.qty : s, 0);
  },0);
  const totalSold = products.reduce((s,p)=>s+(p.sold||0),0);
  const totalStock = products.reduce((s,p)=>s+p.stock,0);

  document.getElementById('statRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
  document.getElementById('statSales').textContent = orders.length;
  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statSold').textContent = totalSold;
  document.getElementById('statStock').textContent = totalStock;

  // Recent orders table
  const recent = [...orders].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
  document.querySelector('#recentOrdersTable tbody').innerHTML = recent.length ? recent.map(o=>`
    <tr>
      <td>${o.id}</td>
      <td>${escapeHtml(o.customerName)}</td>
      <td>${o.items.map(i=>i.name).join(', ').slice(0,30)}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td><span class="status-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-light)">No orders yet</td></tr>`;

  drawSalesChart(orders);
  drawCategoryChart(products);
}

function drawSalesChart(orders){
  const canvas = document.getElementById('salesChart');
  const ctx = canvas.getContext('2d');
  const days = [];
  const data = [];
  for(let i=6;i>=0;i--){
    const d = new Date(Date.now() - i*86400000);
    days.push(d.toLocaleDateString('en-US',{weekday:'short'}));
    const dayTotal = orders.filter(o=>{
      const od = new Date(o.createdAt);
      return od.toDateString()===d.toDateString();
    }).reduce((s,o)=>s+o.total,0);
    data.push(dayTotal);
  }
  drawBarChart(ctx, canvas, days, data, '#6C5CE7');
}

function drawCategoryChart(products){
  const canvas = document.getElementById('categoryChart');
  const ctx = canvas.getContext('2d');
  const catMap = {};
  products.forEach(p=>{ catMap[p.category] = (catMap[p.category]||0) + (p.sold||0); });
  const labels = Object.keys(catMap);
  const values = Object.values(catMap);
  drawPieChart(ctx, canvas, labels, values);
}

/* ---------- Lightweight Canvas Chart Helpers (no external lib) ---------- */
function drawBarChart(ctx, canvas, labels, data, color){
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 220;
  ctx.clearRect(0,0,w,h);
  const max = Math.max(...data, 1);
  const padding = 30;
  const barWidth = (w - padding*2) / data.length * 0.6;
  const gap = (w - padding*2) / data.length;

  ctx.strokeStyle = '#e4e6f1';
  ctx.beginPath(); ctx.moveTo(padding, h-30); ctx.lineTo(w-10, h-30); ctx.stroke();

  data.forEach((val,i)=>{
    const barH = (val/max) * (h - 60);
    const x = padding + i*gap + gap*0.2;
    const y = h - 30 - barH;
    const grad = ctx.createLinearGradient(0,y,0,h-30);
    grad.addColorStop(0, color); grad.addColorStop(1, color+'66');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,barWidth,barH,[6,6,0,0]) : ctx.rect(x,y,barWidth,barH);
    ctx.fill();

    ctx.fillStyle = '#636e72';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x+barWidth/2, h-12);
    if(val>0){
      ctx.fillStyle = '#2d3436';
      ctx.font = 'bold 10px Inter';
      ctx.fillText('$'+val.toFixed(0), x+barWidth/2, y-6);
    }
  });
}

function drawPieChart(ctx, canvas, labels, values){
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 220;
  ctx.clearRect(0,0,w,h);
  const total = values.reduce((a,b)=>a+b,0);
  const colors = ['#6C5CE7','#00d2a8','#ffa53e','#ff5c5c','#4e7df0','#a259ff','#00c896'];

  if(total===0){
    ctx.fillStyle = '#636e72'; ctx.font='13px Inter'; ctx.textAlign='center';
    ctx.fillText('No sales data yet', w/2, h/2);
    return;
  }

  const cx = w/2 - 60, cy = h/2, r = Math.min(h,w)/2 - 30;
  let startAngle = -Math.PI/2;
  values.forEach((val,i)=>{
    const sliceAngle = (val/total) * Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,startAngle,startAngle+sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i%colors.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // legend
  let ly = 20;
  labels.forEach((l,i)=>{
    ctx.fillStyle = colors[i%colors.length];
    ctx.fillRect(w-110, ly, 10, 10);
    ctx.fillStyle = '#2d3436';
    ctx.font = '11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`${l} (${values[i]})`, w-95, ly+9);
    ly += 18;
  });
}

/* ---------- STORE TAB ---------- */
function renderAdminStore(){
  const admin = getCurrentAdmin();
  const store = admin.store || {};
  document.getElementById('storeName').value = store.name || '';
  document.getElementById('storeDescription').value = store.description || '';
  document.getElementById('storeLogoPreview').src = store.logo || 'https://placehold.co/120x120/6C5CE7/fff?text=Logo';
}

function previewStoreLogo(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{ document.getElementById('storeLogoPreview').src = ev.target.result; };
  reader.readAsDataURL(file);
}

function saveStore(e){
  e.preventDefault();
  const admins = dbGet(DB.ADMINS);
  const session = getSession();
  const admin = admins.find(a=>a.id===session.id);
  admin.store = {
    name: document.getElementById('storeName').value.trim(),
    description: document.getElementById('storeDescription').value.trim(),
    logo: document.getElementById('storeLogoPreview').src
  };
  dbSet(DB.ADMINS, admins);
  showToast('Store details saved!','success');
  return false;
}

/* ---------- PRODUCTS TAB ---------- */
function renderAdminProducts(){
  const products = getAdminProducts();
  const tbody = document.querySelector('#adminProductsTable tbody');
  if(products.length===0){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No products yet. Click "+ Add Product" to start.</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p=>`
    <tr>
      <td><img src="${p.image}" alt=""></td>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.category}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td>${p.discount}%</td>
      <td>${p.stock}</td>
      <td>⭐ ${p.rating.toFixed(1)}</td>
      <td class="table-actions">
        <button class="btn btn-sm btn-icon" onclick="openProductModal('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openProductModal(productId=null){
  const admin = getCurrentAdmin();
  const pkg = dbGet(DB.PACKAGES).find(p=>p.id===admin.package);
  const myProducts = getAdminProducts();

  if(!productId && pkg && myProducts.length >= pkg.maxProducts){
    showToast(`Product limit reached for your ${pkg.name} plan. Upgrade to add more.`,'error');
    return;
  }

  document.getElementById('productForm').reset();
  document.getElementById('productImagePreview').src = 'https://placehold.co/150x150/e9ecef/666?text=Product';

  if(productId){
    const p = dbGet(DB.PRODUCTS).find(pr=>pr.id===productId);
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productCategory').value = p.category;
    document.getElementById('productDescription').value = p.description;
    document.getElementById('productPrice').value = p.price;
    document.getElementById('productDiscount').value = p.discount;
    document.getElementById('productStock').value = p.stock;
    document.getElementById('productRating').value = p.rating;
    document.getElementById('productImagePreview').src = p.image;
  } else {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productId').value = '';
  }
  document.getElementById('productModalOverlay').classList.add('open');
}

function closeProductModal(){
  document.getElementById('productModalOverlay').classList.remove('open');
}

function previewProductImage(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{ document.getElementById('productImagePreview').src = ev.target.result; };
  reader.readAsDataURL(file);
}

function saveProduct(e){
  e.preventDefault();
  const admin = getCurrentAdmin();
  const id = document.getElementById('productId').value;
  const products = dbGet(DB.PRODUCTS);

  const productData = {
    name: document.getElementById('productName').value.trim(),
    category: document.getElementById('productCategory').value,
    description: document.getElementById('productDescription').value.trim(),
    price: +document.getElementById('productPrice').value,
    discount: +document.getElementById('productDiscount').value,
    stock: +document.getElementById('productStock').value,
    rating: +document.getElementById('productRating').value,
    image: document.getElementById('productImagePreview').src
  };

  if(id){
    const p = products.find(pr=>pr.id===id);
    Object.assign(p, productData);
    showToast('Product updated successfully!','success');
  } else {
    products.push({
      id: uid('PRD'), sellerId: admin.id, sold:0, createdAt: new Date().toISOString(), ...productData
    });
    showToast('Product added successfully!','success');
  }
  dbSet(DB.PRODUCTS, products);
  closeProductModal();
  renderAdminProducts();
}

function deleteProduct(productId){
  if(!confirm('Are you sure you want to delete this product?')) return;
  let products = dbGet(DB.PRODUCTS);
  products = products.filter(p=>p.id!==productId);
  dbSet(DB.PRODUCTS, products);
  showToast('Product deleted','success');
  renderAdminProducts();
}

/* ---------- ORDERS TAB ---------- */
function renderAdminOrders(){
  const orders = getAdminOrders().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tbody = document.querySelector('#adminOrdersTable tbody');
  if(orders.length===0){
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No orders yet</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o=>`
    <tr>
      <td>${o.id}</td>
      <td>${escapeHtml(o.customerName)}</td>
      <td>${o.items.map(i=>`${i.name} ×${i.qty}`).join(', ').slice(0,40)}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td><span class="status-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td>
        <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
          ${['Pending','Shipped','Delivered','Cancelled'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}

function updateOrderStatus(orderId, newStatus){
  const orders = dbGet(DB.ORDERS);
  const order = orders.find(o=>o.id===orderId);
  if(order){
    order.status = newStatus;
    dbSet(DB.ORDERS, orders);
    showToast(`Order ${orderId} marked as ${newStatus}`,'success');
    renderAdminOrders();
  }
}

/* ---------- ANALYTICS TAB ---------- */
function renderAdminAnalytics(){
  const products = getAdminProducts();
  const sorted = [...products].sort((a,b)=>(b.sold||0)-(a.sold||0)).slice(0,8);

  const canvas = document.getElementById('performanceChart');
  const ctx = canvas.getContext('2d');
  drawBarChart(ctx, canvas, sorted.map(p=>p.name.slice(0,8)), sorted.map(p=>p.sold||0), '#00d2a8');

  const tbody = document.querySelector('#performanceTable tbody');
  tbody.innerHTML = products.length ? products.map(p=>`
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.sold||0}</td>
      <td>${p.stock}</td>
      <td>$${((p.sold||0)*p.price*(1-p.discount/100)).toFixed(2)}</td>
    </tr>
  `).join('') : `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-light)">No products yet</td></tr>`;
}

/* ---------- PROFILE TAB ---------- */
function renderAdminProfile(){
  const admin = getCurrentAdmin();
  const pkg = dbGet(DB.PACKAGES).find(p=>p.id===admin.package);
  document.getElementById('adminProfilePanel').innerHTML = `
    <div class="profile-row"><span>Full Name</span><span>${escapeHtml(admin.name)}</span></div>
    <div class="profile-row"><span>Email</span><span>${escapeHtml(admin.email)}</span></div>
    <div class="profile-row"><span>Phone</span><span>${escapeHtml(admin.phone)}</span></div>
    <div class="profile-row"><span>Store Name</span><span>${admin.store && admin.store.name ? escapeHtml(admin.store.name) : 'Not set'}</span></div>
    <div class="profile-row"><span>Current Plan</span><span>${pkg ? pkg.name : '-'}</span></div>
    <div class="profile-row"><span>Member Since</span><span>${formatDate(admin.createdAt)}</span></div>
    <button class="btn btn-outline btn-full" style="margin-top:16px" onclick="navigateTo('packages')">Change Package</button>
  `;
}

/* =========================================================
   USER DASHBOARD
   ========================================================= */
function renderUserDashboard(){
  const user = getCurrentUser();
  if(!user) return;
  document.getElementById('userSidebarName').textContent = user.name;
  document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
  switchUserTab(currentUserTab);
}

function switchUserTab(tab){
  currentUserTab = tab;
  document.querySelectorAll('#view-userDashboard .sidebar-link').forEach(l=>l.classList.toggle('active', l.dataset.tab===tab));
  document.querySelectorAll('#view-userDashboard .dash-tab').forEach(t=>t.classList.remove('active'));
  const tabEl = document.getElementById('user-tab-'+tab);
  if(tabEl) tabEl.classList.add('active');

  if(tab==='profile') renderUserProfile();
  if(tab==='address') renderAddressBook();
  if(tab==='orders') renderUserOrdersTab();
  if(tab==='spending') renderUserSpending();
}

/* ---------- PROFILE TAB ---------- */
function renderUserProfile(){
  const user = getCurrentUser();
  const orders = dbGet(DB.ORDERS).filter(o=>o.userId===user.id);
  document.getElementById('userProfilePanel').innerHTML = `
    <div class="profile-row"><span>Full Name</span><span>${escapeHtml(user.name)}</span></div>
    <div class="profile-row"><span>Email</span><span>${escapeHtml(user.email)}</span></div>
    <div class="profile-row"><span>Phone</span><span>${escapeHtml(user.phone)}</span></div>
    <div class="profile-row"><span>Total Orders</span><span>${orders.length}</span></div>
    <div class="profile-row"><span>Member Since</span><span>${formatDate(user.createdAt)}</span></div>
  `;
}

/* ---------- ADDRESS BOOK TAB ---------- */
function renderAddressBook(){
  const user = getCurrentUser();
  const addresses = dbGet(DB.ADDRESSES).filter(a=>a.userId===user.id);
  const grid = document.getElementById('addressGrid');
  if(addresses.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="ei">📍</div><h3>No saved addresses</h3><p>Add an address for faster checkout</p></div>`;
    return;
  }
  grid.innerHTML = addresses.map(a=>`
    <div class="address-card">
      <span class="remove-addr" onclick="removeAddress('${a.id}')">🗑️ Remove</span>
      <h4>${escapeHtml(a.label)}</h4>
      <p>${escapeHtml(a.full)}</p>
      <p>${escapeHtml(a.city)}</p>
      <p>📞 ${escapeHtml(a.phone)}</p>
    </div>
  `).join('');
}

function openAddressModal(){
  document.getElementById('addressForm').reset();
  document.getElementById('addressModalOverlay').classList.add('open');
}
function closeAddressModal(){
  document.getElementById('addressModalOverlay').classList.remove('open');
}
function saveAddress(e){
  e.preventDefault();
  const user = getCurrentUser();
  const addresses = dbGet(DB.ADDRESSES);
  addresses.push({
    id: uid('ADDR'), userId: user.id,
    label: document.getElementById('addrLabel').value.trim(),
    full: document.getElementById('addrFull').value.trim(),
    city: document.getElementById('addrCity').value.trim(),
    phone: document.getElementById('addrPhone').value.trim()
  });
  dbSet(DB.ADDRESSES, addresses);
  closeAddressModal();
  renderAddressBook();
  showToast('Address saved!','success');
}
function removeAddress(addrId){
  let addresses = dbGet(DB.ADDRESSES);
  addresses = addresses.filter(a=>a.id!==addrId);
  dbSet(DB.ADDRESSES, addresses);
  renderAddressBook();
  showToast('Address removed','info');
}

/* ---------- ORDERS TAB (inside dashboard) ---------- */
function renderUserOrdersTab(){
  const user = getCurrentUser();
  const orders = dbGet(DB.ORDERS).filter(o=>o.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tbody = document.querySelector('#userOrdersTable tbody');
  if(orders.length===0){
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-light)">No orders yet</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o=>`
    <tr>
      <td>${o.id}</td>
      <td>${o.items.map(i=>i.name).join(', ').slice(0,40)}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td><span class="status-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>
  `).join('');
}

/* ---------- SPENDING TAB ---------- */
function renderUserSpending(){
  const user = getCurrentUser();
  const orders = dbGet(DB.ORDERS).filter(o=>o.userId===user.id);
  const totalSpent = orders.reduce((s,o)=>s+o.total,0);

  document.getElementById('userTotalSpending').textContent = `$${totalSpent.toFixed(2)}`;
  document.getElementById('userTotalOrders').textContent = orders.length;
  document.getElementById('userMemberSince').textContent = new Date(user.createdAt).getFullYear();

  const canvas = document.getElementById('spendingChart');
  const ctx = canvas.getContext('2d');
  const days = [];
  const data = [];
  for(let i=6;i>=0;i--){
    const d = new Date(Date.now() - i*86400000);
    days.push(d.toLocaleDateString('en-US',{weekday:'short'}));
    const dayTotal = orders.filter(o=>new Date(o.createdAt).toDateString()===d.toDateString()).reduce((s,o)=>s+o.total,0);
    data.push(dayTotal);
  }
  drawBarChart(ctx, canvas, days, data, '#00c896');
}

/* =========================================================
   MODAL OVERLAY CLICK-OUTSIDE-TO-CLOSE
   ========================================================= */
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('productModalOverlay').addEventListener('click', (e)=>{
    if(e.target.id === 'productModalOverlay') closeProductModal();
  });
  document.getElementById('addressModalOverlay').addEventListener('click', (e)=>{
    if(e.target.id === 'addressModalOverlay') closeAddressModal();
  });
});
