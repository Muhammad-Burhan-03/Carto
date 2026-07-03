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
   CART
   ========================================================= */
async function addToCart(productId, qty=1, redirectToCheckout=false){
  const session = getSession();
  if(!session || session.role !== 'user'){ navigateTo('userLogin'); showToast('Please login to add items to cart','info'); return; }
  try {
    await Api.addToCart(productId, qty);
    showToast('Added to cart!','success');
    await updateNavbar();
    if(redirectToCheckout) navigateTo('checkout');
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
}

async function renderCart(){
  const { items } = await Api.getCart();
  const list = document.getElementById('cartItemsList');
  const summaryPanel = document.querySelector('.cart-summary');

  if(!items.length){
    list.innerHTML = `<div class="empty-state"><div class="ei">🛒</div><h3>Your cart is empty</h3><p>Add some products to get started</p><button class="btn btn-primary" onclick="navigateTo('products')">Browse Products</button></div>`;
    if(summaryPanel) summaryPanel.style.display = 'none';
    document.getElementById('cartSubtotal').textContent = '$0.00';
    document.getElementById('cartDiscount').textContent = '-$0.00';
    document.getElementById('cartTotal').textContent = '$0.00';
    return;
  }
  if(summaryPanel) summaryPanel.style.display = '';

  let subtotal = 0, discountTotal = 0;
  list.innerHTML = items.map(it=>{
    const p = it.product;
    const price = Number(p.price), discount = Number(p.discount)||0;
    const lineFinal = price*(1-discount/100)*it.quantity;
    subtotal += price*it.quantity;
    discountTotal += (price*it.quantity) - lineFinal;
    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${escapeHtml(p.name)}">
        <div class="cart-item-info">
          <h4>${escapeHtml(p.name)}</h4>
          <p>${discount>0 ? `$${(price*(1-discount/100)).toFixed(2)} each (was $${price.toFixed(2)})` : `$${price.toFixed(2)} each`}</p>
          <div class="cart-item-qty">
            <button onclick="updateCartQty(${it.id}, ${it.quantity-1}, ${p.stock})">−</button>
            <span>${it.quantity}</span>
            <button onclick="updateCartQty(${it.id}, ${it.quantity+1}, ${p.stock})">+</button>
          </div>
        </div>
        <div class="cart-item-price">$${lineFinal.toFixed(2)}</div>
        <span class="remove-item" onclick="removeCartItem(${it.id})" title="Remove">✕</span>
      </div>
    `;
  }).join('');

  const shipping = 5;
  const total = subtotal - discountTotal + shipping;
  document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cartDiscount').textContent = `-$${discountTotal.toFixed(2)}`;
  document.getElementById('cartShipping').textContent = `$${shipping.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
}

async function updateCartQty(itemId, newQty, maxStock){
  if(newQty < 1){ return removeCartItem(itemId); }
  if(newQty > maxStock){ showToast(`Only ${maxStock} in stock`,'error'); return; }
  try { await Api.updateCartItem(itemId, newQty); await renderCart(); await updateNavbar(); }
  catch(err){ showToast(apiErrorMessage(err),'error'); }
}

async function removeCartItem(itemId){
  try { await Api.removeCartItem(itemId); showToast('Item removed','info'); await renderCart(); await updateNavbar(); }
  catch(err){ showToast(apiErrorMessage(err),'error'); }
}

function goToCheckout(){
  navigateTo('checkout');
}

/* =========================================================
   WISHLIST
   ========================================================= */
async function toggleWishlist(productId){
  const session = getSession();
  if(!session || session.role!=='user'){ navigateTo('userLogin'); return; }
  try { await Api.addToWishlist(productId); showToast('Added to wishlist ❤️','success'); }
  catch(err){ showToast(apiErrorMessage(err),'error'); }
}

/* =========================================================
   ADDRESSES (used by the Address Book tab in the user dashboard)
   ========================================================= */
let editingAddressId = null;

function openAddressModal(address=null){
  editingAddressId = address ? address.id : null;
  document.getElementById('addrLabel').value = address ? address.label : 'Home';
  document.getElementById('addrFull').value = address ? address.fullAddress : '';
  document.getElementById('addrCity').value = address ? address.city : '';
  document.getElementById('addrPhone').value = address ? (address.phone||'') : '';
  document.getElementById('addressModalOverlay').classList.add('open');
}
function closeAddressModal(){ document.getElementById('addressModalOverlay').classList.remove('open'); }

async function saveAddress(e){
  e.preventDefault();
  const payload = {
    label: document.getElementById('addrLabel').value.trim() || 'Home',
    fullAddress: document.getElementById('addrFull').value.trim(),
    city: document.getElementById('addrCity').value.trim(),
    phone: document.getElementById('addrPhone').value.trim()
  };
  try {
    if(editingAddressId) await Api.updateAddress(editingAddressId, payload);
    else await Api.createAddress(payload);
    showToast('Address saved','success');
    closeAddressModal();
    if(currentView==='userDashboard') await renderAddressBook();
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
  return false;
}

async function deleteAddress(id){
  try {
    await Api.deleteAddress(id);
    showToast('Address deleted','info');
    if(currentView==='userDashboard') await renderAddressBook();
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
}

async function renderAddressBook(){
  const list = await Api.getAddresses();
  const grid = document.getElementById('addressGrid');
  if(!list.length){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="ei">📍</div><h3>No saved addresses</h3><p>Add an address to speed up checkout</p></div>`;
    return;
  }
  grid.innerHTML = list.map(a=>`
    <div class="panel address-card">
      <h4>${escapeHtml(a.label)} ${a.isDefault ? '<span class="badge-pkg">Default</span>' : ''}</h4>
      <p>${escapeHtml(a.fullAddress)}</p>
      <p>${escapeHtml(a.city)}</p>
      <p>${escapeHtml(a.phone||'')}</p>
      <div class="detail-actions" style="margin-top:10px">
        <button class="btn btn-sm btn-outline" onclick='openAddressModal(${JSON.stringify(a)})'>Edit</button>
        <button class="btn btn-sm btn-outline" onclick="deleteAddress(${a.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

/* =========================================================
   CHECKOUT
   Uses a simple freeform address form (matching the existing
   UI) rather than an address-picker; the entered address is
   saved to the user's address book and used for the order.
   ========================================================= */
async function renderCheckout(){
  const { items } = await Api.getCart();
  if(!items.length){ showToast('Your cart is empty','info'); navigateTo('cart'); return; }

  let subtotal = 0;
  const rows = items.map(it=>{
    const p = it.product, price = Number(p.price), discount = Number(p.discount)||0;
    const lineFinal = price*(1-discount/100)*it.quantity;
    subtotal += lineFinal;
    return `<div class="checkout-item-row"><span>${escapeHtml(p.name)} × ${it.quantity}</span><span>$${lineFinal.toFixed(2)}</span></div>`;
  }).join('');

  const shipping = 5, total = subtotal + shipping;
  document.getElementById('checkoutItemsSummary').innerHTML = rows;
  document.getElementById('checkoutSubtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('checkoutShipping').textContent = `$${shipping.toFixed(2)}`;
  document.getElementById('checkoutTotal').textContent = `$${total.toFixed(2)}`;

  // Prefill from profile + most recent/default saved address, if any.
  try {
    const user = await getCurrentUser();
    if(user){
      document.getElementById('checkoutName').value = user.name || '';
      document.getElementById('checkoutPhone').value = user.phone || '';
    }
    const addresses = await Api.getAddresses();
    const def = addresses.find(a=>a.isDefault) || addresses[0];
    if(def){
      document.getElementById('checkoutAddress').value = def.fullAddress;
      document.getElementById('checkoutCity').value = def.city;
      if(!document.getElementById('checkoutPhone').value) document.getElementById('checkoutPhone').value = def.phone || '';
    }
  } catch { /* prefill is best-effort */ }

  document.getElementById('cardFields').classList.toggle('show', document.querySelector('input[name="payment"]:checked')?.value === 'card');
}

async function placeOrder(){
  const name = document.getElementById('checkoutName').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();
  const fullAddressRaw = document.getElementById('checkoutAddress').value.trim();
  const city = document.getElementById('checkoutCity').value.trim();
  const zip = document.getElementById('checkoutZip').value.trim();

  if(!name || !phone || !fullAddressRaw || !city){
    showToast('Please fill in all required delivery details','error');
    return false;
  }

  const paymentRadio = document.querySelector('input[name="payment"]:checked');
  const paymentMethod = paymentRadio ? paymentRadio.value : 'cod';
  const fullAddress = zip ? `${fullAddressRaw}, ${zip}` : fullAddressRaw;

  try {
    // Persist this address to the user's address book, then check out
    // against it. This keeps the simple single-page checkout UX while
    // still using normalized, reusable address records server-side.
    const address = await Api.createAddress({ label: 'Delivery', fullAddress, city, phone });
    const { order } = await Api.checkout({ addressId: address.id, paymentMethod });
    await updateNavbar();
    renderReceipt(order);
    navigateTo('receipt');
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
  return false;
}

function renderReceipt(order){
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-check">✅</div>
    <h2>Order Placed Successfully!</h2>
    <div class="receipt-id">Thank you for your purchase. Your order has been received.</div>
    <div class="receipt-details">
      <div class="receipt-row"><span>Order ID</span><span>#${order.id}</span></div>
      <div class="receipt-row"><span>Status</span><span>${order.status}</span></div>
      <div class="receipt-row"><span>Payment Method</span><span>${order.paymentMethod}</span></div>
      <div class="receipt-row" style="font-weight:700;font-size:15px"><span>Total Paid</span><span>$${Number(order.total).toFixed(2)}</span></div>
    </div>
    <div class="detail-actions" style="justify-content:center">
      <button class="btn btn-outline" onclick="navigateTo('orderHistory')">View Orders</button>
      <button class="btn btn-primary" onclick="navigateTo('products')">Continue Shopping</button>
    </div>
  `;
}

/* =========================================================
   ORDER HISTORY (USER)
   ========================================================= */
async function renderOrderHistory(){
  const ordersList = await Api.getOrders();
  const tbody = document.querySelector('#orderHistoryTable tbody');
  if(!ordersList.length){
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ei">📦</div><h3>No orders yet</h3></div></td></tr>`;
    return;
  }
  const rowsHtml = await Promise.all(ordersList.map(async o=>{
    const full = await Api.getOrder(o.id).catch(()=>({items:[]}));
    const itemCount = full.items ? full.items.reduce((s,it)=>s+it.quantity,0) : '-';
    return `
      <tr>
        <td>#${o.id}</td>
        <td>${itemCount}</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td><button class="btn btn-sm btn-outline" onclick="viewOrderDetail(${o.id})">View</button></td>
      </tr>
    `;
  }));
  tbody.innerHTML = rowsHtml.join('');
}

async function viewOrderDetail(orderId){
  try {
    const order = await Api.getOrder(orderId);
    const lines = order.items.map(it=>`${it.name} x${it.quantity} - $${Number(it.price).toFixed(2)}`).join('\n');
    alert(`Order #${order.id}\nStatus: ${order.status}\nTotal: $${Number(order.total).toFixed(2)}\n\nItems:\n${lines}`);
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
}

/* =========================================================
   ADMIN (SELLER) DASHBOARD
   ========================================================= */
async function renderAdminDashboard(){
  const admin = await getCurrentAdmin();
  if(!admin) return;

  document.getElementById('adminAvatar').textContent = admin.name.charAt(0).toUpperCase();
  document.getElementById('adminSidebarName').textContent = admin.name;
  document.getElementById('adminPkgBadge').textContent = `${(admin.packageId||'basic').charAt(0).toUpperCase()}${(admin.packageId||'basic').slice(1)} Plan`;

  switchAdminTab(currentAdminTab || 'overview');
}

function switchAdminTab(tab){
  currentAdminTab = tab;
  document.querySelectorAll('#adminSidebar .sidebar-link[data-tab]').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab));
  document.querySelectorAll('.dash-view#view-adminDashboard .dash-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('admin-tab-'+tab).classList.add('active');

  if(tab==='overview') renderAdminOverview();
  else if(tab==='store') renderAdminStore();
  else if(tab==='products') renderAdminProducts();
  else if(tab==='orders') renderAdminOrders();
  else if(tab==='analytics') renderAdminAnalytics();
  else if(tab==='profile') renderAdminProfile();
}

async function renderAdminOverview(){
  const admin = await getCurrentAdmin();
  const dash = await Api.sellerDashboard(admin.id);
  const orders = await Api.getOrders(); // seller role -> returns {orderItem, order} rows for this seller

  document.getElementById('statRevenue').textContent = `$${dash.totalRevenue.toFixed(2)}`;
  document.getElementById('statSales').textContent = dash.orderItemCount;
  document.getElementById('statProducts').textContent = dash.productCount;
  document.getElementById('statOrders').textContent = new Set(orders.map(o=>o.order.id)).size;
  document.getElementById('statSold').textContent = dash.totalSold;
  document.getElementById('statStock').textContent = dash.products.reduce((s,p)=>s+p.stock,0);

  drawSalesChart(orders);
  drawCategoryChart(dash.products);

  const recent = orders.slice(0, 8);
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
  `).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="ei">🧾</div><h3>No orders yet</h3></div></td></tr>`;
}

async function renderAdminStore(){
  const admin = await getCurrentAdmin();
  document.getElementById('storeName').value = admin.storeName || '';
  document.getElementById('storeDescription').value = admin.storeDescription || '';
  document.getElementById('storeLogoPreview').src = admin.storeLogo || 'https://placehold.co/120x120/6C5CE7/fff?text=Logo';
}

function previewStoreLogo(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('storeLogoPreview').src = reader.result; };
  reader.readAsDataURL(file);
}

async function saveStore(e){
  e.preventDefault();
  const payload = {
    storeName: document.getElementById('storeName').value.trim(),
    storeDescription: document.getElementById('storeDescription').value.trim(),
    storeLogo: document.getElementById('storeLogoPreview').src
  };
  try {
    await Api.updateStore(payload);
    invalidateProfileCache();
    showToast('Store details saved','success');
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
  return false;
}

async function renderAdminProducts(){
  const admin = await getCurrentAdmin();
  const dash = await Api.sellerDashboard(admin.id);
  const tbody = document.querySelector('#adminProductsTable tbody');
  if(!dash.products.length){
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ei">📦</div><h3>No products yet</h3><p>Add your first product to start selling</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = dash.products.map(p=>`
    <tr>
      <td><img src="${p.image}" style="width:44px;height:44px;border-radius:8px;object-fit:cover"></td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.category||'-')}</td>
      <td>$${Number(p.price).toFixed(2)}</td>
      <td>${p.discount||0}%</td>
      <td>${p.stock}</td>
      <td>${Number(p.rating||0).toFixed(1)} ⭐</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick='openProductModal(${JSON.stringify(p)})'>Edit</button>
        <button class="btn btn-sm btn-outline" onclick="deleteProductAdmin(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

let editingProductId = null;

function openProductModal(product=null){
  editingProductId = product ? product.id : null;
  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('productId').value = product ? product.id : '';
  document.getElementById('productName').value = product ? product.name : '';
  document.getElementById('productCategory').value = product ? (product.category || 'Electronics') : 'Electronics';
  document.getElementById('productDescription').value = product ? (product.description||'') : '';
  document.getElementById('productPrice').value = product ? product.price : '';
  document.getElementById('productDiscount').value = product ? (product.discount||0) : 0;
  document.getElementById('productStock').value = product ? product.stock : '';
  document.getElementById('productRating').value = product ? (product.rating||4.5) : 4.5;
  document.getElementById('productImagePreview').src = product ? product.image : 'https://placehold.co/150x150/e9ecef/666?text=Product';
  document.getElementById('productModalOverlay').classList.add('open');
}
function closeProductModal(){ document.getElementById('productModalOverlay').classList.remove('open'); }

function previewProductImage(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('productImagePreview').src = reader.result; };
  reader.readAsDataURL(file);
}

async function saveProduct(e){
  e.preventDefault();
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
  try {
    if(editingProductId) await Api.updateProduct(editingProductId, payload);
    else await Api.createProduct(payload);
    showToast('Product saved','success');
    closeProductModal();
    await renderAdminProducts();
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
  return false;
}

async function deleteProductAdmin(id){
  if(!confirm('Delete this product? This cannot be undone.')) return;
  try { await Api.deleteProduct(id); showToast('Product deleted','info'); await renderAdminProducts(); }
  catch(err){ showToast(apiErrorMessage(err),'error'); }
}

async function renderAdminOrders(){
  const orders = await Api.getOrders();
  const tbody = document.querySelector('#adminOrdersTable tbody');
  if(!orders.length){
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="ei">🧾</div><h3>No orders yet</h3></div></td></tr>`;
    return;
  }
  const statuses = ['Pending','Shipped','Delivered','Cancelled'];
  tbody.innerHTML = orders.map(r=>`
    <tr>
      <td>#${r.order.id}</td>
      <td>User #${r.order.userId}</td>
      <td>${escapeHtml(r.orderItem.name)} × ${r.orderItem.quantity}</td>
      <td>$${(Number(r.orderItem.price)*r.orderItem.quantity).toFixed(2)}</td>
      <td><span class="status-badge status-${r.order.status.toLowerCase()}">${r.order.status}</span></td>
      <td>${new Date(r.order.createdAt).toLocaleDateString()}</td>
      <td>
        <select onchange="updateAdminOrderStatus(${r.order.id}, this.value)">
          ${statuses.map(s=>`<option value="${s}" ${s===r.order.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}

async function updateAdminOrderStatus(orderId, status){
  try { await Api.updateOrderStatus(orderId, status); showToast('Order status updated','success'); await renderAdminOrders(); }
  catch(err){ showToast(apiErrorMessage(err),'error'); }
}

async function renderAdminAnalytics(){
  const admin = await getCurrentAdmin();
  const dash = await Api.sellerDashboard(admin.id);
  drawPerformanceChart(dash.products);

  const tbody = document.querySelector('#performanceTable tbody');
  tbody.innerHTML = dash.products.length ? dash.products.map(p=>`
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.sold||0}</td>
      <td>${p.stock}</td>
      <td>$${((p.sold||0)*Number(p.price)).toFixed(2)}</td>
    </tr>
  `).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="ei">📈</div><h3>No data yet</h3></div></td></tr>`;
}

async function renderAdminProfile(){
  const admin = await getCurrentAdmin();
  document.getElementById('adminProfilePanel').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Name</label><input type="text" id="adminProfileName" value="${escapeHtml(admin.name)}"></div>
      <div class="form-group"><label>Phone</label><input type="text" id="adminProfilePhone" value="${escapeHtml(admin.phone||'')}"></div>
    </div>
    <div class="form-group"><label>Email</label><input type="email" value="${escapeHtml(admin.email)}" disabled></div>
    <div class="form-group"><label>Current Package</label><input type="text" value="${escapeHtml(admin.packageId||'basic')}" disabled></div>
    <button class="btn btn-primary" onclick="saveAdminProfile()">Save Changes</button>
    <button class="btn btn-outline" onclick="navigateTo('packages')">Change Package</button>
  `;
}

async function saveAdminProfile(){
  try {
    await Api.updateProfile({
      name: document.getElementById('adminProfileName').value.trim(),
      phone: document.getElementById('adminProfilePhone').value.trim()
    });
    invalidateProfileCache();
    showToast('Profile updated','success');
    await updateNavbar();
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
}

/* =========================================================
   USER DASHBOARD
   ========================================================= */
async function renderUserDashboard(){
  const user = await getCurrentUser();
  if(!user) return;

  document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('userSidebarName').textContent = user.name;

  switchUserTab(currentUserTab || 'profile');
}

function switchUserTab(tab){
  currentUserTab = tab;
  document.querySelectorAll('#view-userDashboard .sidebar-link[data-tab]').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab));
  document.querySelectorAll('#view-userDashboard .dash-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('user-tab-'+tab).classList.add('active');

  if(tab==='profile') renderUserProfile();
  else if(tab==='address') renderAddressBook();
  else if(tab==='orders') renderUserOrdersTab();
  else if(tab==='spending') renderUserSpending();
}

async function renderUserProfile(){
  const user = await getCurrentUser();
  document.getElementById('userProfilePanel').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Name</label><input type="text" id="userProfileName" value="${escapeHtml(user.name)}"></div>
      <div class="form-group"><label>Phone</label><input type="text" id="userProfilePhone" value="${escapeHtml(user.phone||'')}"></div>
    </div>
    <div class="form-group"><label>Email</label><input type="email" value="${escapeHtml(user.email)}" disabled></div>
    <button class="btn btn-primary" onclick="saveUserProfile()">Save Changes</button>
  `;
  document.getElementById('userMemberSince').textContent = new Date(user.createdAt).getFullYear();
}

async function saveUserProfile(){
  try {
    await Api.updateProfile({
      name: document.getElementById('userProfileName').value.trim(),
      phone: document.getElementById('userProfilePhone').value.trim()
    });
    invalidateProfileCache();
    showToast('Profile updated','success');
    await updateNavbar();
  } catch(err){ showToast(apiErrorMessage(err),'error'); }
}

async function renderUserOrdersTab(){
  const ordersList = await Api.getOrders();
  const tbody = document.querySelector('#userOrdersTable tbody');
  if(!ordersList.length){
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="ei">📦</div><h3>No orders yet</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = ordersList.map(o=>`
    <tr>
      <td>#${o.id}</td>
      <td>-</td>
      <td>$${Number(o.total).toFixed(2)}</td>
      <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function renderUserSpending(){
  const user = await getCurrentUser();
  const ordersList = await Api.getOrders();
  const total = ordersList.reduce((s,o)=>s+Number(o.total),0);
  document.getElementById('userTotalSpending').textContent = `$${total.toFixed(2)}`;
  document.getElementById('userTotalOrders').textContent = ordersList.length;
  document.getElementById('userMemberSince').textContent = new Date(user.createdAt).getFullYear();
  drawSpendingChart(ordersList);
}

/* =========================================================
   CANVAS CHARTS (lightweight, no external chart library)
   ========================================================= */
function setupCanvas(id){
  const canvas = document.getElementById(id);
  if(!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.parentElement.clientWidth || 400;
  const height = canvas.height || 220;
  canvas.width = width*dpr;
  canvas.height = height*dpr;
  canvas.style.width = width+'px';
  canvas.style.height = height+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,width,height);
  return { ctx, width, height };
}

function drawBarChart(canvasId, labels, values, color='#6C5CE7'){
  const setup = setupCanvas(canvasId);
  if(!setup) return;
  const { ctx, width, height } = setup;
  const padding = 30;
  const max = Math.max(1, ...values);
  const barW = (width - padding*2) / (labels.length || 1) * 0.6;
  const gap = (width - padding*2) / (labels.length || 1);

  ctx.strokeStyle = '#e9ecef';
  ctx.beginPath(); ctx.moveTo(padding, height-padding); ctx.lineTo(width-10, height-padding); ctx.stroke();

  values.forEach((v,i)=>{
    const barH = ((height-padding*2) * v) / max;
    const x = padding + i*gap + (gap-barW)/2;
    const y = height - padding - barH;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,barW,barH,4) : ctx.rect(x,y,barW,barH);
    ctx.fill();

    ctx.fillStyle = '#495057';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(labels[i]).slice(0,8), x+barW/2, height-padding+14);
  });
}

function drawPieChart(canvasId, labels, values){
  const setup = setupCanvas(canvasId);
  if(!setup) return;
  const { ctx, width, height } = setup;
  const total = values.reduce((s,v)=>s+v,0);
  const colors = ['#6C5CE7','#00B894','#FDCB6E','#E17055','#0984E3','#D63031','#00CEC9'];
  const cx = width/2 - 40, cy = height/2, r = Math.min(cy,cx)-10;

  if(total === 0){
    ctx.fillStyle = '#adb5bd'; ctx.font = '13px sans-serif'; ctx.textAlign='center';
    ctx.fillText('No data yet', width/2, height/2);
    return;
  }

  let start = -Math.PI/2;
  values.forEach((v,i)=>{
    const slice = (v/total) * Math.PI*2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+slice); ctx.closePath(); ctx.fill();
    start += slice;
  });

  labels.forEach((l,i)=>{
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(width-90, 14+i*18, 10, 10);
    ctx.fillStyle = '#495057'; ctx.font='11px sans-serif'; ctx.textAlign='left';
    ctx.fillText(String(l).slice(0,12), width-75, 23+i*18);
  });
}

function drawLineChart(canvasId, labels, values, color='#00B894'){
  const setup = setupCanvas(canvasId);
  if(!setup) return;
  const { ctx, width, height } = setup;
  const padding = 30;
  const max = Math.max(1, ...values);
  const stepX = (width - padding*2) / Math.max(1, labels.length-1);

  ctx.strokeStyle = '#e9ecef';
  ctx.beginPath(); ctx.moveTo(padding, height-padding); ctx.lineTo(width-10, height-padding); ctx.stroke();

  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  values.forEach((v,i)=>{
    const x = padding + i*stepX;
    const y = height - padding - ((height-padding*2)*v)/max;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle = color;
  values.forEach((v,i)=>{
    const x = padding + i*stepX;
    const y = height - padding - ((height-padding*2)*v)/max;
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  });
}

function drawSalesChart(orderRows){
  const byDay = {};
  orderRows.forEach(r=>{
    const day = new Date(r.order.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    byDay[day] = (byDay[day]||0) + Number(r.orderItem.price)*r.orderItem.quantity;
  });
  const labels = Object.keys(byDay).slice(-7);
  drawBarChart('salesChart', labels.length?labels:['No data'], labels.length?labels.map(l=>byDay[l]):[0]);
}

function drawCategoryChart(products){
  const byCat = {};
  products.forEach(p=>{ const c = p.category || 'Uncategorized'; byCat[c] = (byCat[c]||0) + (p.sold||0); });
  const labels = Object.keys(byCat);
  drawPieChart('categoryChart', labels.length?labels:['No sales yet'], labels.length?labels.map(l=>byCat[l]):[1]);
}

function drawPerformanceChart(products){
  const top = [...products].sort((a,b)=>(b.sold||0)-(a.sold||0)).slice(0,8);
  drawBarChart('performanceChart', top.map(p=>p.name), top.map(p=>p.sold||0), '#0984E3');
}

function drawSpendingChart(ordersList){
  const byMonth = {};
  ordersList.forEach(o=>{
    const m = new Date(o.createdAt).toLocaleDateString('en-US',{month:'short'});
    byMonth[m] = (byMonth[m]||0) + Number(o.total);
  });
  const labels = Object.keys(byMonth);
  drawLineChart('spendingChart', labels.length?labels:['No data'], labels.length?labels.map(l=>byMonth[l]):[0]);
}
