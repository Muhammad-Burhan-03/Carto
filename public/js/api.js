/* =========================================================
   CARTO - API Client
   Thin wrapper around fetch() for talking to the Netlify
   Functions backend. Every function here corresponds to one
   REST endpoint. The JWT auth token is the ONE piece of state
   kept in localStorage (it must survive page reloads to keep
   the user logged in) — everything else (products, cart,
   orders, etc.) now lives in Postgres and is fetched fresh.
   ========================================================= */
const API_BASE = '/api';
const TOKEN_KEY = 'carto_auth_token';
const ROLE_KEY = 'carto_auth_role';

const Api = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getRole() { return localStorage.getItem(ROLE_KEY); },
  setSession(token, role) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
  },
  isLoggedIn() { return !!this.getToken(); },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (networkErr) {
      throw new Error('Network error: could not reach the server. Please try again.');
    }

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { /* non-JSON response */ } }

    if (!res.ok) {
      const message = (data && (data.error || (data.details && data.details.map(d => d.message).join(', ')))) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },

  /* ---------- AUTH ---------- */
  registerUser(payload) { return this.post('/auth/register', payload); },
  loginUser(payload) { return this.post('/auth/login', payload); },
  registerSeller(payload) { return this.post('/sellers/register', payload); },
  loginSeller(payload) { return this.post('/sellers/login', payload); },
  logout() { return this.post('/auth/logout'); },
  verifyOtp(payload) { return this.post('/auth/verify-otp', payload); },
  resendOtp(payload) { return this.post('/auth/resend-otp', payload); },
  forgotPassword(payload) { return this.post('/auth/forgot-password', payload); },
  resetPassword(payload) { return this.post('/auth/reset-password', payload); },
  me() { return this.get('/auth/me'); },
  updateProfile(payload) { return this.put('/auth/me', payload); },
  sellerPublicProfile(id) { return this.get(`/sellers/${id}`); },
  sellerDashboard(id) { return this.get(`/sellers/${id}/dashboard`); },
  purchasePackage(packageId) { return this.put('/sellers/me/package', { packageId }); },
  updateStore(payload) { return this.put('/sellers/me/store', payload); },

  /* ---------- CATALOG ---------- */
  getCategories() { return this.get('/categories'); },
  getBrands() { return this.get('/brands'); },
  getPackages() { return this.get('/packages'); },
  getProducts(params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));
    const query = qs.toString();
    return this.get(`/products${query ? `?${query}` : ''}`);
  },
  getProduct(id) { return this.get(`/products/${id}`); },
  createProduct(payload) { return this.post('/products', payload); },
  updateProduct(id, payload) { return this.put(`/products/${id}`, payload); },
  deleteProduct(id) { return this.del(`/products/${id}`); },

  /* ---------- CART ---------- */
  getCart() { return this.get('/cart'); },
  addToCart(productId, quantity = 1) { return this.post('/cart', { productId, quantity }); },
  updateCartItem(itemId, quantity) { return this.put(`/cart/${itemId}`, { quantity }); },
  removeCartItem(itemId) { return this.del(`/cart/${itemId}`); },
  clearCart() { return this.del('/cart'); },

  /* ---------- WISHLIST ---------- */
  getWishlist() { return this.get('/wishlist'); },
  addToWishlist(productId) { return this.post('/wishlist', { productId }); },
  removeFromWishlist(productId) { return this.del(`/wishlist/${productId}`); },

  /* ---------- ADDRESSES ---------- */
  getAddresses() { return this.get('/addresses'); },
  createAddress(payload) { return this.post('/addresses', payload); },
  updateAddress(id, payload) { return this.put(`/addresses/${id}`, payload); },
  deleteAddress(id) { return this.del(`/addresses/${id}`); },

  /* ---------- CHECKOUT / ORDERS ---------- */
  checkout(payload) { return this.post('/checkout', payload); },
  getOrders() { return this.get('/orders'); },
  getOrder(id) { return this.get(`/orders/${id}`); },
  updateOrderStatus(id, status) { return this.put(`/orders/${id}/status`, { status }); },

  /* ---------- REVIEWS ---------- */
  getReviews(productId) { return this.get(`/reviews/${productId}`); },
  createReview(payload) { return this.post('/reviews', payload); },

  /* ---------- CONTACT / NEWSLETTER ---------- */
  sendContactMessage(payload) { return this.post('/contact', payload); },
  subscribeNewsletter(email) { return this.post('/newsletter', { email }); },

  /* ---------- NOTIFICATIONS ---------- */
  getNotifications() { return this.get('/notifications'); },
  markNotificationRead(id) { return this.put(`/notifications/${id}/read`); }
};
