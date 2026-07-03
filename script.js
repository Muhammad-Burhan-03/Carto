/* =========================================================
   CARTO - Full eCommerce Frontend Logic
   Talks to the real backend (Netlify Functions + Postgres)
   via the Api client in js/api.js. The only browser storage
   used now is localStorage for the JWT auth token (required
   so a logged-in session survives a page reload) — every
   other piece of data (products, cart, orders, addresses...)
   is fetched live from the server on demand.
   ========================================================= */

/* ---------- SESSION ---------- */
function getSession() {
  const token = Api.getToken();
  const role = Api.getRole();
  if (!token || !role) return null;
  return { token, role };
}
function clearSession() { Api.clearSession(); }

let currentUserCache = null;
let currentAdminCache = null;

async function getCurrentUser() {
  const session = getSession();
  if (!session || session.role !== 'user') return null;
  if (currentUserCache) return currentUserCache;
  try { currentUserCache = await Api.me(); return currentUserCache; }
  catch { clearSession(); return null; }
}
async function getCurrentAdmin() {
  const session = getSession();
  if (!session || session.role !== 'seller') return null;
  if (currentAdminCache) return currentAdminCache;
  try { currentAdminCache = await Api.me(); return currentAdminCache; }
  catch { clearSession(); return null; }
}
function invalidateProfileCache() { currentUserCache = null; currentAdminCache = null; }

/* ---------- TOAST ---------- */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000);
}
function apiErrorMessage(err) { return (err && err.message) ? err.message : 'Something went wrong. Please try again.'; }

/* ---------- NAVIGATION ---------- */
let currentView = 'home';
let currentProductId = null;
let currentAdminTab = 'overview';
let currentUserTab = 'profile';

async function navigateTo(view, opts = {}) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  currentView = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeAccountDropdown();

  const session = getSession();
  if (view === 'adminDashboard' && !session) { navigateTo('adminLogin'); return; }
  if (view === 'userDashboard' && !session) { navigateTo('userLogin'); return; }
  if (view === 'checkout' && !session) { navigateTo('userLogin'); showToast('Please login to checkout', 'info'); return; }

  try {
    if (view === 'home') await renderHome();
    else if (view === 'products') await renderProductListing();
    else if (view === 'productDetail' && opts.productId) { currentProductId = opts.productId; await renderProductDetail(opts.productId); }
    else if (view === 'cart') await renderCart();
    else if (view === 'checkout') await renderCheckout();
    else if (view === 'orderHistory') await renderOrderHistory();
    else if (view === 'packages') await renderPackages();
    else if (view === 'adminDashboard') await renderAdminDashboard();
    else if (view === 'userDashboard') await renderUserDashboard();
  } catch (err) {
    showToast(apiErrorMessage(err), 'error');
  }

  await updateNavbar();
}

/* ---------- NAVBAR STATE ---------- */
async function updateNavbar() {
  const session = getSession();
  const label = document.getElementById('navAccountLabel');
  const dropdown = document.getElementById('accountDropdown');

  try {
    if (session && session.role === 'user') {
      const { items } = await Api.getCart();
      document.getElementById('cartBadge').textContent = items.reduce((s, i) => s + i.quantity, 0);
    } else {
      document.getElementById('cartBadge').textContent = 0;
    }
  } catch { document.getElementById('cartBadge').textContent = 0; }

  if (!session) {
    label.textContent = '👤 Login';
    dropdown.innerHTML = `
      <a onclick="navigateTo('userLogin')">User Login</a>
      <a onclick="navigateTo('userRegister')">User Register</a>
      <a onclick="navigateTo('adminLogin')">Seller Login</a>
    `;
  } else if (session.role === 'user') {
    const u = await getCurrentUser();
    label.textContent = `👤 ${u ? u.name.split(' ')[0] : 'Account'}`;
    dropdown.innerHTML = `
      <a onclick="navigateTo('userDashboard')">My Dashboard</a>
      <a onclick="navigateTo('orderHistory')">Order History</a>
      <a onclick="logout()">Logout</a>
    `;
  } else if (session.role === 'seller') {
    const a = await getCurrentAdmin();
    label.textContent = `🏪 ${a ? a.name.split(' ')[0] : 'Seller'}`;
    dropdown.innerHTML = `
      <a onclick="navigateTo('adminDashboard')">Seller Dashboard</a>
      <a onclick="logout()">Logout</a>
    `;
  }
}

function closeAccountDropdown() { document.getElementById('accountDropdown').classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('navAccountBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('accountDropdown').classList.toggle('open');
  });
  document.addEventListener('click', closeAccountDropdown);

  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.querySelector('.nav-search').style.display =
      document.querySelector('.nav-search').style.display === 'flex' ? 'none' : 'flex';
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'payment') {
      document.getElementById('cardFields').classList.toggle('show', e.target.value === 'card');
    }
  });

  const navSearch = document.getElementById('navSearchInput');
  navSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

  document.getElementById('productModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'productModalOverlay') closeProductModal();
  });
  document.getElementById('addressModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'addressModalOverlay') closeAddressModal();
  });

  init();
});

/* ---------- INIT ---------- */
function init() { navigateTo('home'); }

/* ---------- LOGOUT ---------- */
async function logout() {
  try { await Api.logout(); } catch { /* stateless JWT - ignore network errors on logout */ }
  clearSession();
  invalidateProfileCache();
  showToast('Logged out successfully', 'success');
  navigateTo('home');
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */
async function handleUserLogin(e) {
  e.preventDefault();
  const email = document.getElementById('userLoginEmail').value.trim().toLowerCase();
  const password = document.getElementById('userLoginPassword').value;
  try {
    const { token, user } = await Api.loginUser({ email, password });
    Api.setSession(token, 'user');
    invalidateProfileCache();
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
    navigateTo('home');
  } catch (err) { showToast(apiErrorMessage(err), 'error'); }
  return false;
}

async function handleUserRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  try {
    const { token, user } = await Api.registerUser({ name, email, phone, password });
    Api.setSession(token, 'user');
    invalidateProfileCache();
    showToast('Account created successfully!', 'success');
    navigateTo('home');
  } catch (err) { showToast(apiErrorMessage(err), 'error'); }
  return false;
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminLoginEmail').value.trim().toLowerCase();
  const password = document.getElementById('adminLoginPassword').value;
  try {
    const { token, seller } = await Api.loginSeller({ email, password });
    Api.setSession(token, 'seller');
    invalidateProfileCache();
    showToast(`Welcome back, ${seller.name.split(' ')[0]}!`, 'success');
    if (!seller.packageActive) navigateTo('packages'); else navigateTo('adminDashboard');
  } catch (err) { showToast(apiErrorMessage(err), 'error'); }
  return false;
}

async function handleAdminRegister(e) {
  e.preventDefault();
  const name = document.getElementById('adminRegName').value.trim();
  const email = document.getElementById('adminRegEmail').value.trim().toLowerCase();
  const phone = document.getElementById('adminRegPhone').value.trim();
  const password = document.getElementById('adminRegPassword').value;
  try {
    // Every seller needs a package row to satisfy the FK, so default to
    // Basic at signup; they immediately land on the Packages page to
    // confirm or upgrade their plan.
    const { token, seller } = await Api.registerSeller({
      name, email, phone, password, packageId: 'basic', storeName: `${name}'s Store`
    });
    Api.setSession(token, 'seller');
    invalidateProfileCache();
    showToast('Seller account created! Choose a package to activate.', 'success');
    navigateTo('packages');
  } catch (err) { showToast(apiErrorMessage(err), 'error'); }
  return false;
}

/* =========================================================
   PACKAGES
   ========================================================= */
async function renderPackages() {
  const pkgs = await Api.getPackages();
  const grid = document.getElementById('packageGrid');
  grid.innerHTML = pkgs.map((p, i) => `
    <div class="package-card ${i === 1 ? 'featured' : ''}">
      ${i === 1 ? '<span class="package-badge">MOST POPULAR</span>' : ''}
      <h3>${p.name}</h3>
      <div class="package-price">$${p.price}<span>/${p.period}</span></div>
      <ul class="package-features">${p.features.map(f => `<li>${f}</li>`).join('')}</ul>
      <button class="btn ${i === 1 ? 'btn-primary' : 'btn-outline'} btn-full" onclick="purchasePackage('${p.id}')">Choose ${p.name}</button>
    </div>
  `).join('');
}

async function purchasePackage(packageId) {
  const session = getSession();
  if (!session || session.role !== 'seller') { navigateTo('adminLogin'); return; }
  try {
    const seller = await Api.purchasePackage(packageId);
    invalidateProfileCache();
    showToast(`${seller.packageId} package activated! 🎉`, 'success');
    navigateTo('adminDashboard');
  } catch (err) { showToast(apiErrorMessage(err), 'error'); }
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

async function renderHome(){
  document.getElementById('categoryGrid').innerHTML = CATEGORIES.map(c=>`
    <div class="category-card" onclick="filterByCategory('${c.name}')">
      <div class="cat-icon">${c.icon}</div>
      <div class="cat-name">${c.label||c.name}</div>
    </div>
  `).join('');

  const [{products: featured}, {products: trending}] = await Promise.all([
    Api.getProducts({ sort: 'rating', limit: 5 }),
    Api.getProducts({ sort: 'bestselling', limit: 5 })
  ]);
  document.getElementById('featuredProducts').innerHTML = featured.map(productCardHTML).join('');
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
  const price = Number(p.price), discount = Number(p.discount)||0, rating = Number(p.rating)||0;
  const finalPrice = (price * (1 - discount/100)).toFixed(2);
  const stockLabel = p.stock === 0 ? 'Out of stock' : (p.stock < 10 ? `Only ${p.stock} left` : '');
  return `
    <div class="product-card" onclick="navigateTo('productDetail', {productId:${p.id}})">
      <div class="product-img-wrap">
        ${discount > 0 ? `<span class="discount-tag">-${discount}%</span>` : ''}
        ${stockLabel ? `<span class="stock-tag">${stockLabel}</span>` : ''}
        <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="product-info">
        <div class="product-cat">${escapeHtml(p.category||'')}</div>
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-rating"><span class="stars">${starString(rating)}</span> ${rating.toFixed(1)} (${p.sold||0} sold)</div>
        <div class="price-row">
          <span class="price-now">$${finalPrice}</span>
          ${discount > 0 ? `<span class="price-old">$${price.toFixed(2)}</span>` : ''}
        </div>
        <button class="add-cart-btn" onclick="event.stopPropagation(); addToCart(${p.id}, 1)" ${p.stock===0?'disabled style="opacity:.5;cursor:not-allowed"':''}>
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
  div.textContent = str==null ? '' : String(str);
  return div.innerHTML;
}

/* =========================================================
   SEARCH
   ========================================================= */
function performSearch(){
  navigateTo('products');
  setTimeout(()=>{ applyFilters(); }, 50);
}

/* =========================================================
   PRODUCT LISTING PAGE (Filter / Sort / Search)
   ========================================================= */
let ratingFilterVal = 0;

async function renderProductListing(){
  ratingFilterVal = 0;
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.rf-btn[data-rating="0"]').classList.add('active');
  const navCat = document.getElementById('categoryFilterNav').value;
  if(navCat !== 'all'){ document.getElementById('filterCategory').value = navCat; }
  await applyFilters();
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

const SORT_MAP = { priceLow:'price-asc', priceHigh:'price-desc', rating:'rating', newest:'newest' };

async function applyFilters(){
  const category = document.getElementById('filterCategory').value;
  const sortUi = document.getElementById('filterSort').value;
  const maxPrice = +document.getElementById('filterPrice').value;
  const searchTerm = document.getElementById('navSearchInput').value.trim();

  document.getElementById('priceRangeVal').textContent = maxPrice;

  let products;
  try {
    const res = await Api.getProducts({
      category: category !== 'all' ? category.toLowerCase() : undefined,
      q: searchTerm || undefined,
      maxPrice,
      sort: SORT_MAP[sortUi],
      limit: 100
    });
    products = res.products;
  } catch (err) {
    showToast(apiErrorMessage(err), 'error');
    products = [];
  }

  if(ratingFilterVal > 0) products = products.filter(p=>Number(p.rating) >= ratingFilterVal);

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
let currentDetailProduct = null;

async function renderProductDetail(productId){
  let p;
  try { p = await Api.getProduct(productId); }
  catch { navigateTo('products'); return; }

  currentDetailProduct = p;
  detailQty = 1;
  const price = Number(p.price), discount = Number(p.discount)||0, rating = Number(p.rating)||0;
  const finalPrice = (price * (1-discount/100)).toFixed(2);
  const stockClass = p.stock===0 ? 'out' : (p.stock<10 ? 'low':'');
  const stockText = p.stock===0 ? '✗ Out of Stock' : (p.stock<10 ? `⚠ Only ${p.stock} left in stock` : `✓ In Stock (${p.stock} available)`);

  document.getElementById('productDetailContent').innerHTML = `
    <div class="detail-layout">
      <div class="detail-img"><img src="${p.image}" alt="${escapeHtml(p.name)}"></div>
      <div class="detail-info">
        <div class="product-cat">${escapeHtml(p.category||'')}</div>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="detail-meta">
          <span class="stars">${starString(rating)}</span>
          <span>${rating.toFixed(1)} rating</span>
          <span>•</span>
          <span>${p.sold||0} sold</span>
        </div>
        <div class="detail-price">
          <span class="price-now">$${finalPrice}</span>
          ${discount>0 ? `<span class="price-old">$${price.toFixed(2)}</span><span class="discount-tag" style="position:static">-${discount}%</span>` : ''}
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
          <button class="btn btn-primary btn-lg" onclick="addToCart(${p.id}, detailQty)">🛒 Add to Cart</button>
          <button class="btn btn-dark btn-lg" onclick="buyNow(${p.id})">⚡ Buy Now</button>
        </div>` : `<button class="btn btn-outline btn-lg" disabled>Out of Stock</button>`}
      </div>
    </div>
  `;

  document.getElementById('relatedProducts').innerHTML = (p.related||[]).map(productCardHTML).join('');
}

function changeDetailQty(delta, max){
  detailQty = Math.min(max, Math.max(1, detailQty+delta));
  document.getElementById('detailQtyVal').textContent = detailQty;
}

function buyNow(productId){
  addToCart(productId, detailQty, true);
}

/* =========================================================
   CART OPERATIONS
   ========================================================= */
async function addToCart(productId, quantity = 1, redirectToCheckout = false){
  const session = getSession();
  if(!session || session.role !== 'user'){
    showToast('Please login to add items to your cart', 'info');
    navigateTo('userLogin');
    return;
  }
  try{
    await Api.addToCart(productId, quantity);
    showToast('Added to cart!', 'success');
    await updateNavbar();
    if(redirectToCheckout) navigateTo('cart');
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function renderCart(){
  const { items } = await Api.getCart();
  const list = document.getElementById('cartItemsList');

  if(!items.length){
    list.innerHTML = `<div class="empty-state"><div class="ei">🛒</div><h3>Your cart is empty</h3><p>Add some products to get started</p><button class="btn btn-primary" onclick="navigateTo('products')">Browse Products</button></div>`;
    setCartTotals(0, 0);
    return;
  }

  let subtotal = 0, discountTotal = 0;
  list.innerHTML = items.map(it=>{
    const p = it.product;
    const price = Number(p.price), discount = Number(p.discount)||0;
    const lineFinal = price * (1-discount/100) * it.quantity;
    subtotal += price * it.quantity;
    discountTotal += (price - price*(1-discount/100)) * it.quantity;
    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${escapeHtml(p.name)}">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(p.name)}</div>
          <div class="cart-item-price">$${(price*(1-discount/100)).toFixed(2)} each</div>
          <div class="qty-selector">
            <button onclick="updateCartQty(${it.id}, ${it.quantity-1})">−</button>
            <span>${it.quantity}</span>
            <button onclick="updateCartQty(${it.id}, ${it.quantity+1})">+</button>
          </div>
        </div>
        <div class="cart-item-total">$${lineFinal.toFixed(2)}</div>
        <button class="cart-item-remove" onclick="removeCartItem(${it.id})" title="Remove">🗑</button>
      </div>
    `;
  }).join('');

  setCartTotals(subtotal, discountTotal);
}

function setCartTotals(subtotal, discount){
  const shipping = subtotal > 0 ? 5 : 0;
  document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cartDiscount').textContent = `-$${discount.toFixed(2)}`;
  document.getElementById('cartShipping').textContent = `$${shipping.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `$${(subtotal-discount+shipping).toFixed(2)}`;
}

async function updateCartQty(itemId, newQty){
  if(newQty < 1){ return removeCartItem(itemId); }
  try{ await Api.updateCartItem(itemId, newQty); await renderCart(); await updateNavbar(); }
  catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function removeCartItem(itemId){
  try{ await Api.removeCartItem(itemId); await renderCart(); await updateNavbar(); showToast('Item removed', 'info'); }
  catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

function goToCheckout(){
  navigateTo('checkout');
}

/* =========================================================
   CHECKOUT / PLACE ORDER
   ========================================================= */
let checkoutCartSnapshot = null;
let selectedAddressId = null;

async function renderCheckout(){
  const [{ items }, user, addresses] = await Promise.all([Api.getCart(), getCurrentUser(), Api.getAddresses()]);
  checkoutCartSnapshot = items;

  if(!items.length){ navigateTo('cart'); return; }

  if(user){
    document.getElementById('checkoutName').value = user.name;
    document.getElementById('checkoutPhone').value = user.phone || '';
  }

  const defaultAddr = addresses.find(a=>a.isDefault) || addresses[0];
  if(defaultAddr){
    selectedAddressId = defaultAddr.id;
    document.getElementById('checkoutAddress').value = defaultAddr.fullAddress;
    document.getElementById('checkoutCity').value = defaultAddr.city;
  } else {
    selectedAddressId = null;
  }

  let subtotal = 0;
  document.getElementById('checkoutItemsSummary').innerHTML = items.map(it=>{
    const p = it.product;
    const price = Number(p.price)*(1-(Number(p.discount)||0)/100);
    subtotal += price * it.quantity;
    return `<div class="summary-row"><span>${escapeHtml(p.name)} × ${it.quantity}</span><span>$${(price*it.quantity).toFixed(2)}</span></div>`;
  }).join('');

  const shipping = 5;
  document.getElementById('checkoutSubtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('checkoutShipping').textContent = `$${shipping.toFixed(2)}`;
  document.getElementById('checkoutTotal').textContent = `$${(subtotal+shipping).toFixed(2)}`;
}

async function placeOrder(){
  const addressFull = document.getElementById('checkoutAddress').value.trim();
  const city = document.getElementById('checkoutCity').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();
  const name = document.getElementById('checkoutName').value.trim();
  if(!addressFull || !city || !phone || !name){
    showToast('Please fill in all customer & shipping details', 'error');
    return;
  }
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';

  try{
    let addressId = selectedAddressId;
    // If the user edited the address fields (or has none saved yet), save
    // a fresh address so the order can reference it via FK.
    const addresses = await Api.getAddresses();
    const match = addresses.find(a=>a.fullAddress===addressFull && a.city===city);
    if(match){ addressId = match.id; }
    else {
      const created = await Api.createAddress({ label:'Checkout', fullAddress: addressFull, city, phone, isDefault: addresses.length===0 });
      addressId = created.id;
    }

    const { order } = await Api.checkout({ addressId, paymentMethod });
    showToast('Order placed successfully! 🎉', 'success');
    await renderReceipt(order.id);
    navigateTo('receipt');
    await updateNavbar();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function renderReceipt(orderId){
  const order = await Api.getOrder(orderId);
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-icon">✅</div>
    <h1>Order Placed Successfully!</h1>
    <p class="receipt-sub">Thank you for shopping with Carto</p>
    <div class="receipt-details">
      <div class="summary-row"><span>Order ID</span><span>#${order.id}</span></div>
      <div class="summary-row"><span>Status</span><span>${order.status}</span></div>
      <div class="summary-row"><span>Payment Method</span><span>${order.paymentMethod}</span></div>
      <div class="summary-row total-row"><span>Total Paid</span><span>$${Number(order.total).toFixed(2)}</span></div>
    </div>
    <div class="receipt-items">
      ${order.items.map(it=>`<div class="summary-row"><span>${escapeHtml(it.name)} × ${it.quantity}</span><span>$${(Number(it.price)*it.quantity).toFixed(2)}</span></div>`).join('')}
    </div>
    <div class="receipt-actions">
      <button class="btn btn-primary" onclick="navigateTo('orderHistory')">View Order History</button>
      <button class="btn btn-outline" onclick="navigateTo('products')">Continue Shopping</button>
    </div>
  `;
}

/* =========================================================
   ORDER HISTORY (user-facing)
   ========================================================= */
async function renderOrderHistory(){
  const orders = await Api.getOrders();
  const tbody = document.querySelector('#orderHistoryTable tbody');
  if(!orders.length){
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ei">📦</div><h3>No orders yet</h3></div></td></tr>`;
    return;
  }
  const rows = await Promise.all(orders.map(async o=>{
    const full = await Api.getOrder(o.id);
    return `<tr>
      <td>#${o.id}</td>
      <td>${full.items.length} item(s)</td>
      <td>$${Number(o.total).toFixed(2)}</td>
      <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      <td><button class="btn-link" onclick="navigateTo('receipt'); renderReceipt(${o.id})">View</button></td>
    </tr>`;
  }));
  tbody.innerHTML = rows.join('');
}

/* =========================================================
   ADMIN (SELLER) DASHBOARD
   ========================================================= */
async function switchAdminTab(tab){
  currentAdminTab = tab;
  document.querySelectorAll('#adminSidebar .sidebar-link[data-tab]').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab));
  document.querySelectorAll('#view-adminDashboard .dash-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('admin-tab-'+tab).classList.add('active');

  try{
    if(tab==='overview') await renderAdminOverview();
    else if(tab==='store') await renderAdminStore();
    else if(tab==='products') await renderAdminProducts();
    else if(tab==='orders') await renderAdminOrders();
    else if(tab==='analytics') await renderAdminAnalytics();
    else if(tab==='profile') await renderAdminProfile();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function renderAdminDashboard(){
  const seller = await getCurrentAdmin();
  if(!seller) return;
  document.getElementById('adminSidebarName').textContent = seller.name;
  document.getElementById('adminAvatar').textContent = seller.name.charAt(0).toUpperCase();
  document.getElementById('adminPkgBadge').textContent = `${(seller.packageId||'basic').charAt(0).toUpperCase()+(seller.packageId||'basic').slice(1)} Plan`;
  await switchAdminTab(currentAdminTab || 'overview');
}

async function renderAdminOverview(){
  const seller = await getCurrentAdmin();
  const dash = await Api.sellerDashboard(seller.id);
  const orders = await Api.getOrders(); // seller role -> returns {orderItem, order} rows

  document.getElementById('statRevenue').textContent = `$${dash.totalRevenue.toFixed(2)}`;
  document.getElementById('statSales').textContent = dash.orderItemCount;
  document.getElementById('statProducts').textContent = dash.productCount;
  document.getElementById('statOrders').textContent = new Set(orders.map(o=>o.order.id)).size;
  document.getElementById('statSold').textContent = dash.totalSold;
  document.getElementById('statStock').textContent = dash.products.reduce((s,p)=>s+p.stock,0);

  const recent = orders.slice(0,8);
  const tbody = document.querySelector('#recentOrdersTable tbody');
  tbody.innerHTML = recent.length ? recent.map(r=>`
    <tr>
      <td>#${r.order.id}</td>
      <td>User #${r.order.userId}</td>
      <td>${escapeHtml(r.orderItem.name)}</td>
      <td>$${(Number(r.orderItem.price)*r.orderItem.quantity).toFixed(2)}</td>
      <td><span class="status-badge status-${r.order.status.toLowerCase()}">${r.order.status}</span></td>
      <td>${new Date(r.order.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join('') : `<tr><td colspan="6">No orders yet</td></tr>`;

  drawSalesChart(dash.products);
  drawCategoryChart(dash.products);
}

async function renderAdminStore(){
  const seller = await getCurrentAdmin();
  document.getElementById('storeName').value = seller.storeName || '';
  document.getElementById('storeDescription').value = seller.storeDescription || '';
  document.getElementById('storeLogoPreview').src = seller.storeLogo || 'https://placehold.co/120x120/6C5CE7/fff?text=Logo';
}

function previewStoreLogo(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById('storeLogoPreview').src = ev.target.result; };
  reader.readAsDataURL(file);
}

async function saveStore(e){
  e.preventDefault();
  try{
    await Api.updateStore({
      storeName: document.getElementById('storeName').value.trim(),
      storeDescription: document.getElementById('storeDescription').value.trim(),
      storeLogo: document.getElementById('storeLogoPreview').src
    });
    invalidateProfileCache();
    showToast('Store details saved!', 'success');
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
  return false;
}

async function renderAdminProducts(){
  const seller = await getCurrentAdmin();
  const { products: myProducts } = await Api.getProducts({ limit: 200 });
  const mine = myProducts.filter(p=>p.sellerId === seller.id);
  const tbody = document.querySelector('#adminProductsTable tbody');
  tbody.innerHTML = mine.length ? mine.map(p=>`
    <tr>
      <td><img src="${p.image}" class="table-thumb" alt=""></td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category||'-')}</td>
      <td>$${Number(p.price).toFixed(2)}</td>
      <td>${p.discount||0}%</td>
      <td>${p.stock}</td>
      <td>${Number(p.rating).toFixed(1)} ★</td>
      <td>
        <button class="btn-link" onclick='openProductModal(${JSON.stringify(p)})'>Edit</button>
        <button class="btn-link danger" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8">No products yet. Click "+ Add Product" to get started.</td></tr>`;
}

async function renderAdminOrders(){
  const rows = await Api.getOrders();
  const tbody = document.querySelector('#adminOrdersTable tbody');
  tbody.innerHTML = rows.length ? rows.map(r=>`
    <tr>
      <td>#${r.order.id}</td>
      <td>User #${r.order.userId}</td>
      <td>${escapeHtml(r.orderItem.name)} × ${r.orderItem.quantity}</td>
      <td>$${(Number(r.orderItem.price)*r.orderItem.quantity).toFixed(2)}</td>
      <td><span class="status-badge status-${r.order.status.toLowerCase()}">${r.order.status}</span></td>
      <td>${new Date(r.order.createdAt).toLocaleDateString()}</td>
      <td>
        <select onchange="updateOrderStatus(${r.order.id}, this.value)">
          ${['Pending','Shipped','Delivered','Cancelled'].map(s=>`<option value="${s}" ${s===r.order.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="7">No orders yet</td></tr>`;
}

async function updateOrderStatus(orderId, status){
  try{ await Api.updateOrderStatus(orderId, status); showToast('Order status updated', 'success'); await renderAdminOrders(); }
  catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function renderAdminAnalytics(){
  const seller = await getCurrentAdmin();
  const dash = await Api.sellerDashboard(seller.id);
  const tbody = document.querySelector('#performanceTable tbody');
  tbody.innerHTML = dash.products.length ? dash.products.map(p=>`
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.sold||0}</td>
      <td>${p.stock}</td>
      <td>$${((p.sold||0)*Number(p.price)).toFixed(2)}</td>
    </tr>
  `).join('') : `<tr><td colspan="4">No product data yet</td></tr>`;
  drawPerformanceChart(dash.products);
}

async function renderAdminProfile(){
  const seller = await getCurrentAdmin();
  document.getElementById('adminProfilePanel').innerHTML = `
    <div class="profile-field"><label>Name</label><input type="text" id="adminProfileName" value="${escapeHtml(seller.name)}"></div>
    <div class="profile-field"><label>Email</label><input type="text" value="${escapeHtml(seller.email)}" disabled></div>
    <div class="profile-field"><label>Phone</label><input type="text" id="adminProfilePhone" value="${escapeHtml(seller.phone||'')}"></div>
    <div class="profile-field"><label>Plan</label><input type="text" value="${seller.packageId}" disabled></div>
    <button class="btn btn-primary" onclick="saveAdminProfile()">Save Changes</button>
    <button class="btn btn-outline" onclick="navigateTo('packages')" style="margin-left:8px">Change Plan</button>
  `;
}

async function saveAdminProfile(){
  try{
    await Api.updateProfile({
      name: document.getElementById('adminProfileName').value.trim(),
      phone: document.getElementById('adminProfilePhone').value.trim()
    });
    invalidateProfileCache();
    showToast('Profile updated', 'success');
    await renderAdminDashboard();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

/* =========================================================
   PRODUCT MODAL (Add / Edit)
   ========================================================= */
function openProductModal(product){
  const overlay = document.getElementById('productModalOverlay');
  const form = document.getElementById('productForm');
  form.reset();
  if(product){
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category || 'Electronics';
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDiscount').value = product.discount || 0;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productRating').value = product.rating || 4.5;
    document.getElementById('productImagePreview').src = product.image || 'https://placehold.co/150x150/e9ecef/666?text=Product';
  } else {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productId').value = '';
    document.getElementById('productImagePreview').src = 'https://placehold.co/150x150/e9ecef/666?text=Product';
  }
  overlay.classList.add('open');
}
function closeProductModal(){ document.getElementById('productModalOverlay').classList.remove('open'); }

function previewProductImage(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById('productImagePreview').src = ev.target.result; };
  reader.readAsDataURL(file);
}

async function saveProduct(e){
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const payload = {
    name: document.getElementById('productName').value.trim(),
    category: document.getElementById('productCategory').value,
    description: document.getElementById('productDescription').value.trim(),
    price: parseFloat(document.getElementById('productPrice').value),
    discount: parseInt(document.getElementById('productDiscount').value) || 0,
    stock: parseInt(document.getElementById('productStock').value),
    rating: parseFloat(document.getElementById('productRating').value) || 4.5,
    image: document.getElementById('productImagePreview').src
  };
  try{
    if(id){ await Api.updateProduct(id, payload); showToast('Product updated!', 'success'); }
    else { await Api.createProduct(payload); showToast('Product added!', 'success'); }
    closeProductModal();
    await renderAdminProducts();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
  return false;
}

async function deleteProduct(id){
  if(!confirm('Delete this product? This cannot be undone.')) return;
  try{ await Api.deleteProduct(id); showToast('Product deleted', 'info'); await renderAdminProducts(); }
  catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

/* =========================================================
   USER DASHBOARD
   ========================================================= */
async function switchUserTab(tab){
  currentUserTab = tab;
  document.querySelectorAll('#view-userDashboard .sidebar-link[data-tab]').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab));
  document.querySelectorAll('#view-userDashboard .dash-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('user-tab-'+tab).classList.add('active');

  try{
    if(tab==='profile') await renderUserProfile();
    else if(tab==='address') await renderUserAddresses();
    else if(tab==='orders') await renderUserOrdersTab();
    else if(tab==='spending') await renderUserSpending();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function renderUserDashboard(){
  const user = await getCurrentUser();
  if(!user) return;
  document.getElementById('userSidebarName').textContent = user.name;
  document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
  await switchUserTab(currentUserTab || 'profile');
}

async function renderUserProfile(){
  const user = await getCurrentUser();
  document.getElementById('userProfilePanel').innerHTML = `
    <div class="profile-field"><label>Name</label><input type="text" id="userProfileName" value="${escapeHtml(user.name)}"></div>
    <div class="profile-field"><label>Email</label><input type="text" value="${escapeHtml(user.email)}" disabled></div>
    <div class="profile-field"><label>Phone</label><input type="text" id="userProfilePhone" value="${escapeHtml(user.phone||'')}"></div>
    <button class="btn btn-primary" onclick="saveUserProfile()">Save Changes</button>
  `;
}

async function saveUserProfile(){
  try{
    await Api.updateProfile({
      name: document.getElementById('userProfileName').value.trim(),
      phone: document.getElementById('userProfilePhone').value.trim()
    });
    invalidateProfileCache();
    showToast('Profile updated', 'success');
    await renderUserDashboard();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

async function renderUserAddresses(){
  const list = await Api.getAddresses();
  const grid = document.getElementById('addressGrid');
  grid.innerHTML = list.length ? list.map(a=>`
    <div class="address-card ${a.isDefault?'default':''}">
      ${a.isDefault?'<span class="default-badge">Default</span>':''}
      <div class="addr-label">${escapeHtml(a.label||'Address')}</div>
      <div class="addr-text">${escapeHtml(a.fullAddress)}, ${escapeHtml(a.city)}</div>
      <div class="addr-phone">${escapeHtml(a.phone||'')}</div>
      <div class="addr-actions">
        <button class="btn-link" onclick='openAddressModal(${JSON.stringify(a)})'>Edit</button>
        <button class="btn-link danger" onclick="deleteAddress(${a.id})">Delete</button>
      </div>
    </div>
  `).join('') : `<div class="empty-state"><div class="ei">📍</div><h3>No addresses saved</h3></div>`;
}

async function renderUserOrdersTab(){
  const orders = await Api.getOrders();
  const tbody = document.querySelector('#userOrdersTable tbody');
  if(!orders.length){ tbody.innerHTML = `<tr><td colspan="5">No orders yet</td></tr>`; return; }
  const rows = await Promise.all(orders.map(async o=>{
    const full = await Api.getOrder(o.id);
    return `<tr>
      <td>#${o.id}</td>
      <td>${full.items.length} item(s)</td>
      <td>$${Number(o.total).toFixed(2)}</td>
      <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
    </tr>`;
  }));
  tbody.innerHTML = rows.join('');
}

async function renderUserSpending(){
  const [orders, user] = await Promise.all([Api.getOrders(), getCurrentUser()]);
  const total = orders.reduce((s,o)=>s+Number(o.total),0);
  document.getElementById('userTotalSpending').textContent = `$${total.toFixed(2)}`;
  document.getElementById('userTotalOrders').textContent = orders.length;
  document.getElementById('userMemberSince').textContent = user ? new Date(user.createdAt).toLocaleDateString(undefined,{month:'short',year:'numeric'}) : '-';
  drawSpendingChart(orders);
}

/* =========================================================
   ADDRESS MODAL
   ========================================================= */
let editingAddressId = null;
function openAddressModal(addr){
  editingAddressId = addr ? addr.id : null;
  document.getElementById('addressForm').reset();
  if(addr){
    document.getElementById('addrLabel').value = addr.label || '';
    document.getElementById('addrFull').value = addr.fullAddress;
    document.getElementById('addrCity').value = addr.city;
    document.getElementById('addrPhone').value = addr.phone || '';
  }
  document.getElementById('addressModalOverlay').classList.add('open');
}
function closeAddressModal(){ document.getElementById('addressModalOverlay').classList.remove('open'); }

async function saveAddress(e){
  e.preventDefault();
  const payload = {
    label: document.getElementById('addrLabel').value.trim(),
    fullAddress: document.getElementById('addrFull').value.trim(),
    city: document.getElementById('addrCity').value.trim(),
    phone: document.getElementById('addrPhone').value.trim()
  };
  try{
    if(editingAddressId) await Api.updateAddress(editingAddressId, payload);
    else await Api.createAddress(payload);
    showToast('Address saved!', 'success');
    closeAddressModal();
    await renderUserAddresses();
  } catch(err){ showToast(apiErrorMessage(err), 'error'); }
  return false;
}

async function deleteAddress(id){
  if(!confirm('Delete this address?')) return;
  try{ await Api.deleteAddress(id); showToast('Address deleted', 'info'); await renderUserAddresses(); }
  catch(err){ showToast(apiErrorMessage(err), 'error'); }
}

/* =========================================================
   LIGHTWEIGHT CANVAS CHARTS (no external chart library)
   ========================================================= */
function setupCanvas(canvas){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = (canvas.height || 220) * dpr;
  ctx.scale(dpr, dpr);
  return ctx;
}

function drawBarChart(canvasId, labels, values, color = '#6C5CE7'){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = setupCanvas(canvas);
  const W = canvas.getBoundingClientRect().width, H = canvas.height / (window.devicePixelRatio||1);
  ctx.clearRect(0,0,W,H);
  if(!values.length){ ctx.fillStyle = '#999'; ctx.fillText('No data yet', W/2-30, H/2); return; }

  const max = Math.max(...values, 1);
  const padding = 30, barGap = 12;
  const barW = (W - padding*2) / values.length - barGap;

  values.forEach((v,i)=>{
    const barH = (v/max) * (H - 50);
    const x = padding + i*(barW+barGap);
    const y = H - 30 - barH;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(labels[i]).slice(0,8), x+barW/2, H-12);
    ctx.fillText(v.toFixed(v<10?1:0), x+barW/2, y-6);
  });
}

function drawPieChart(canvasId, labels, values){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = setupCanvas(canvas);
  const W = canvas.getBoundingClientRect().width, H = canvas.height / (window.devicePixelRatio||1);
  ctx.clearRect(0,0,W,H);
  const total = values.reduce((a,b)=>a+b,0);
  if(!total){ ctx.fillStyle = '#999'; ctx.fillText('No data yet', W/2-30, H/2); return; }

  const colors = ['#6C5CE7','#00B894','#FDCB6E','#E17055','#0984E3','#D63031','#00CEC9'];
  const cx = 80, cy = H/2, r = 60;
  let start = -Math.PI/2;
  values.forEach((v,i)=>{
    const angle = (v/total) * Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.closePath();
    ctx.fillStyle = colors[i%colors.length];
    ctx.fill();
    start += angle;
  });

  let legendY = 20;
  labels.forEach((l,i)=>{
    ctx.fillStyle = colors[i%colors.length];
    ctx.fillRect(170, legendY, 12, 12);
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${l} (${values[i]})`, 188, legendY+11);
    legendY += 20;
  });
}

function drawSalesChart(products){
  const top = [...products].sort((a,b)=>(b.sold||0)-(a.sold||0)).slice(0,6);
  drawBarChart('salesChart', top.map(p=>p.name), top.map(p=>p.sold||0), '#6C5CE7');
}
function drawCategoryChart(products){
  const byCat = {};
  products.forEach(p=>{ const c = p.category || 'Other'; byCat[c] = (byCat[c]||0) + (p.sold||0); });
  const labels = Object.keys(byCat), values = Object.values(byCat);
  drawPieChart('categoryChart', labels, values);
}
function drawPerformanceChart(products){
  const top = [...products].sort((a,b)=>((b.sold||0)*Number(b.price))-((a.sold||0)*Number(a.price))).slice(0,8);
  drawBarChart('performanceChart', top.map(p=>p.name), top.map(p=>(p.sold||0)*Number(p.price)), '#00B894');
}
function drawSpendingChart(orders){
  const byMonth = {};
  orders.forEach(o=>{
    const d = new Date(o.createdAt);
    const key = d.toLocaleDateString(undefined,{month:'short'});
    byMonth[key] = (byMonth[key]||0) + Number(o.total);
  });
  drawBarChart('spendingChart', Object.keys(byMonth), Object.values(byMonth), '#0984E3');
}
