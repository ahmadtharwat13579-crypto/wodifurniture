/* ===========================
   Cart Page - cart.js (Cart with quantities & PDF summary)
   =========================== */

(function () {
  'use strict';

  const CONFIG = {
    CART_LOCAL_KEY: 'wodi_cart_local', // kept same key (was WISHLIST_LOCAL_KEY before)
    PRODUCTS_CACHE_KEY: 'wodi_products_cache',
    CACHE_TTL_MS: 1000 * 60 * 30,
    GH_IMAGES_BASE: 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/products/',
    TOAST_DURATION_MS: 3000,
    RELATED_PRODUCTS_COUNT: 8,
    MAX_QTY: 99,
    MIN_QTY: 1,
    WA_NUMBER: '201556840368'
  };

  const state = {
    isLoggedIn: false,
    currentUser: null,
    cartItems: [], // array of { product_id: '...', qty: 1 }
    allProducts: [],
    categories: [],
    categoryMap: {},
    dom: {}
  };

  /* Utilities */
  function formatPrice(num) {
    if (num == null || isNaN(num)) return '';
    return Math.round(num).toLocaleString('en-US');
  }

  function showToast(message, duration = CONFIG.TOAST_DURATION_MS) {
    const existing = document.querySelector('.toast.show');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* Local storage for cart (stores array of {product_id, qty}) */
  function getLocalCart() {
    try {
      const raw = localStorage.getItem(CONFIG.CART_LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalCart(items) {
    try {
      localStorage.setItem(CONFIG.CART_LOCAL_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  function loadProductsCache() {
    try {
      const raw = sessionStorage.getItem(CONFIG.PRODUCTS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.timestamp || !parsed.data) return null;
      if ((Date.now() - parsed.timestamp) > CONFIG.CACHE_TTL_MS) {
        sessionStorage.removeItem(CONFIG.PRODUCTS_CACHE_KEY);
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function getRandomProducts(allProducts, count = CONFIG.RELATED_PRODUCTS_COUNT) {
    const visible = allProducts.filter(p => p.isVisible);
    if (visible.length === 0) return [];
    const shuffled = [...visible].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, visible.length));
  }

  /* Cache DOM elements */
  function cacheDOM() {
    state.dom.notLoggedInSection = document.getElementById('shopping-not-logged-in');
    state.dom.loggedInSection = document.getElementById('shopping-logged-in');
    state.dom.emptyState = document.getElementById('shopping-empty-state');
    state.dom.productsGrid = document.getElementById('cart-products-grid'); // matches cart.html
    state.dom.countNumber = document.getElementById('shopping-count');
    state.dom.googleLoginBtn = document.getElementById('btn-google-login-shopping');
    state.dom.relatedSection = document.getElementById('related-products-section');
    state.dom.relatedCarousel = document.getElementById('related-products-carousel');

    // summary + buttons
    state.dom.cartItemsCount = document.getElementById('cart-items-count');
    state.dom.cartGrandTotal = document.getElementById('cart-grand-total');
    state.dom.btnGenerate = document.getElementById('btn-generate-summary');
    state.dom.btnClear = document.getElementById('btn-clear-cart');

    // modal + preview
    state.dom.orderPreviewModal = document.getElementById('order-preview-modal');
    state.dom.orderInvoicePreview = document.getElementById('order-invoice-preview');
    state.dom.btnDownloadPdf = document.getElementById('btn-download-pdf');
    state.dom.btnSendWhatsapp = document.getElementById('btn-send-whatsapp');
    state.dom.btnClosePreview = document.getElementById('btn-close-preview');
  }

  /* Auth handling */
  function setupAuthStateListener() {
    if (window.onAuthStateChanged && typeof window.onAuthStateChanged === 'function') {
      window.onAuthStateChanged((user) => {
        state.isLoggedIn = !!user;
        state.currentUser = user;
        handleAuthStateChange();
      });
    } else {
      console.warn('Auth system not loaded yet');
      setTimeout(setupAuthStateListener, 500);
    }
  }

  function handleAuthStateChange() {
    if (state.isLoggedIn && state.currentUser) {
      showLoggedInState();
      loadAndRenderCart();
    } else {
      showNotLoggedInState();
    }
  }

  function showNotLoggedInState() {
    if (state.dom.notLoggedInSection) state.dom.notLoggedInSection.style.display = 'flex';
    if (state.dom.loggedInSection) state.dom.loggedInSection.classList.add('hidden');
    if (state.dom.relatedSection) state.dom.relatedSection.classList.remove('hidden');
  }

  function showLoggedInState() {
    if (state.dom.notLoggedInSection) state.dom.notLoggedInSection.style.display = 'none';
    if (state.dom.loggedInSection) state.dom.loggedInSection.classList.remove('hidden');
  }

  /* Cart helpers */
  function findCartItem(productId) {
    return state.cartItems.find(it => String(it.product_id) === String(productId));
  }

  function computeCartTotals() {
    let totalQty = 0;
    let grandTotal = 0;
    for (const item of state.cartItems) {
      const p = state.allProducts.find(x => String(x.product_id) === String(item.product_id));
      if (!p) continue;
      const unit = (p.sale_price != null && p.sale_price !== '') ? Number(p.sale_price) : Number(p.base_price || 0);
      const qty = Number(item.qty || 0);
      totalQty += qty;
      grandTotal += unit * qty;
    }
    return { totalQty, grandTotal };
  }

  function updateCounter() {
    if (state.dom.countNumber) {
      const totals = computeCartTotals();
      state.dom.countNumber.textContent = totals.totalQty || 0;
    }
    if (state.dom.cartItemsCount) {
      const totals = computeCartTotals();
      state.dom.cartItemsCount.textContent = totals.totalQty || 0;
    }
    if (state.dom.cartGrandTotal) {
      const totals = computeCartTotals();
      state.dom.cartGrandTotal.textContent = formatPrice(totals.grandTotal || 0);
    }
  }

  /* Cart CRUD (global API) */
  function addToCartInternal(productId, qty = 1) {
    const id = String(productId);
    const existing = findCartItem(id);
    if (existing) {
      existing.qty = Math.min(CONFIG.MAX_QTY, Number(existing.qty || 0) + Number(qty || 1));
    } else {
      state.cartItems.push({ product_id: id, qty: Math.max(CONFIG.MIN_QTY, Number(qty || 1)) });
    }
    saveLocalCart(state.cartItems);
    updateCounter();
    renderCart();
    renderRelatedProducts();
    showToast('تم إضافة المنتج إلى سلة المشتريات');
  }

  function removeFromCartInternal(productId) {
    const id = String(productId);
    state.cartItems = state.cartItems.filter(it => String(it.product_id) !== id);
    saveLocalCart(state.cartItems);
    updateCounter();
    renderCart();
    renderRelatedProducts();
    showToast('تم حذف المنتج من سلة المشتريات');
  }

  function updateCartQuantityInternal(productId, qty) {
    const id = String(productId);
    const existing = findCartItem(id);
    let q = Number(qty);
    if (isNaN(q)) q = CONFIG.MIN_QTY;
    q = Math.max(CONFIG.MIN_QTY, Math.min(CONFIG.MAX_QTY, q));
    if (existing) {
      existing.qty = q;
    } else {
      state.cartItems.push({ product_id: id, qty: q });
    }
    saveLocalCart(state.cartItems);
    updateCounter();
    renderCart();
  }

  // Expose global API for other scripts (products.js)
  window.addToCartGlobal = function (productId, qty = 1) {
    addToCartInternal(productId, qty);
  };

  window.removeFromCartGlobal = function (productId) {
    removeFromCartInternal(productId);
  };

  window.updateCartQuantityGlobal = function (productId, qty) {
    updateCartQuantityInternal(productId, qty);
  };

  window.isInCartGlobal = function (productId) {
    return !!findCartItem(productId);
  };

  // Also expose a friendly addToCart proxy (products.js may call window.addToCart)
  window.addToCart = function (productId, qty = 1) {
    if (window.addToCartGlobal) return window.addToCartGlobal(productId, qty);
    return null;
  };

  /* Render cart */
  function clearChildren(el) {
    while (el && el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderCart() {
    const grid = state.dom.productsGrid;
    const empty = state.dom.emptyState;

    if (!grid || !empty) return;

    if (state.cartItems.length === 0) {
      empty.style.display = 'flex';
      grid.style.display = 'none';
      updateCounter();
      return;
    }

    empty.style.display = 'none';
    grid.style.display = 'flex';
    clearChildren(grid);

    const wrapper = document.createElement('div');
    wrapper.className = 'shopping-ikea-wrapper';

    for (const line of state.cartItems) {
      const product = state.allProducts.find(p => String(p.product_id) === String(line.product_id));
      if (!product) continue;
      const card = createCartProductCard(product, line.qty);
      wrapper.appendChild(card);
    }

    grid.appendChild(wrapper);
    updateCounter();
  }

  function createCartProductCard(product, qty) {
    const card = document.createElement('article');
    card.className = 'shopping-prod-card';
    card.dataset.prod = product.product_id;
    card.tabIndex = 0;

    const imgCol = document.createElement('div');
    imgCol.className = 'shopping-prod-img-col';

    const badgesRow = document.createElement('div');
    badgesRow.className = 'shopping-prod-badges-row';

    if (product.isFeatured) {
      const badge = document.createElement('span');
      badge.className = 'shopping-prod-badge featured';
      badge.textContent = 'الأكثر مبيعاً';
      badgesRow.appendChild(badge);
    }

    if (product.isNew) {
      const badge = document.createElement('span');
      badge.className = 'shopping-prod-badge new';
      badge.textContent = 'جديد';
      badgesRow.appendChild(badge);
    }

    imgCol.appendChild(badgesRow);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'shopping-prod-img-wrap';

    const img = document.createElement('img');
    img.className = 'shopping-prod-img';
    img.alt = product.display_name || '';
    img.loading = 'lazy';
    img.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}_1.webp`;
    img.onerror = function () {
      this.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}.webp`;
    };

    imgWrap.appendChild(img);
    imgCol.appendChild(imgWrap);

    const body = document.createElement('div');
    body.className = 'shopping-prod-body';

    const head = document.createElement('div');
    head.className = 'shopping-prod-head';

    const name = document.createElement('div');
    name.className = 'shopping-prod-name';
    name.textContent = product.display_name;
    head.appendChild(name);

    const catTag = document.createElement('div');
    catTag.className = 'shopping-prod-cat-tag';
    catTag.textContent = state.categoryMap[product.category]?.display_name || '';

    const footerArea = document.createElement('div');
    footerArea.className = 'shopping-prod-footer-area';

    const priceArea = document.createElement('div');
    priceArea.className = 'shopping-prod-price';

    const newPrice = document.createElement('div');
    newPrice.className = 'shopping-new-price';

    const currency = document.createElement('span');
    currency.className = 'shopping-price-currency';
    currency.textContent = 'EGP';

    const value = document.createElement('span');
    value.className = 'shopping-price-value';
    const unitPrice = (product.sale_price != null && product.sale_price !== '') ? Number(product.sale_price) : Number(product.base_price || 0);
    value.textContent = formatPrice(unitPrice);

    newPrice.appendChild(currency);
    newPrice.appendChild(value);
    priceArea.appendChild(newPrice);

    if (product.sale_price != null && product.sale_price !== '') {
      const oldPrice = document.createElement('span');
      oldPrice.className = 'shopping-old-price';
      oldPrice.textContent = `${formatPrice(product.base_price)} EGP`;
      priceArea.appendChild(oldPrice);
    }

    // ACTIONS + Qty controls
    const actions = document.createElement('div');
    actions.className = 'shopping-prod-actions';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'shopping-prod-actions-container';

    // Go to cart button (keeps UX consistent)
    const cartBtn = document.createElement('a');
    cartBtn.className = 'shopping-prod-cart-btn';
    cartBtn.href = 'cart.html';
    cartBtn.setAttribute('aria-label', 'اذهب إلى السلة');
    cartBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

    // Delete button (remove line)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shopping-prod-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'حذف من سلة المشتريات');
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromCartInternal(product.product_id);
    });

    // Quantity controls
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'cart-qty-wrap';

    const btnMinus = document.createElement('button');
    btnMinus.className = 'cart-qty-btn';
    btnMinus.type = 'button';
    btnMinus.title = 'نقص';
    btnMinus.textContent = '-';

    const qtyInput = document.createElement('input');
    qtyInput.className = 'cart-qty-input';
    qtyInput.type = 'number';
    qtyInput.min = CONFIG.MIN_QTY;
    qtyInput.max = CONFIG.MAX_QTY;
    qtyInput.value = Number(qty || 1);

    const btnPlus = document.createElement('button');
    btnPlus.className = 'cart-qty-btn';
    btnPlus.type = 'button';
    btnPlus.title = 'زيادة';
    btnPlus.textContent = '+';

    btnMinus.addEventListener('click', (ev) => {
      ev.stopPropagation();
      let v = Number(qtyInput.value || 1);
      if (v > CONFIG.MIN_QTY) {
        v = v - 1;
        qtyInput.value = v;
        updateCartQuantityInternal(product.product_id, v);
      }
    });

    btnPlus.addEventListener('click', (ev) => {
      ev.stopPropagation();
      let v = Number(qtyInput.value || 1);
      if (v < CONFIG.MAX_QTY) {
        v = v + 1;
        qtyInput.value = v;
        updateCartQuantityInternal(product.product_id, v);
      }
    });

    qtyInput.addEventListener('change', (ev) => {
      ev.stopPropagation();
      let v = Number(qtyInput.value || 1);
      if (isNaN(v) || v < CONFIG.MIN_QTY) v = CONFIG.MIN_QTY;
      if (v > CONFIG.MAX_QTY) v = CONFIG.MAX_QTY;
      qtyInput.value = v;
      updateCartQuantityInternal(product.product_id, v);
    });

    qtyWrap.appendChild(btnMinus);
    qtyWrap.appendChild(qtyInput);
    qtyWrap.appendChild(btnPlus);

    // Subtotal display
    const subtotalEl = document.createElement('div');
    subtotalEl.className = 'shopping-prod-subtotal';
    const subtotalVal = unitPrice * Number(qty || 1);
    subtotalEl.textContent = `${formatPrice(subtotalVal)} EGP`;

    // update subtotal whenever quantity changes (render will refresh, but keep handler to update quickly)
    // we update via updateCartQuantityInternal which calls renderCart().

    actionsContainer.appendChild(cartBtn);
    actionsContainer.appendChild(deleteBtn);
    actionsContainer.appendChild(qtyWrap);

    actions.appendChild(actionsContainer);

    body.appendChild(head);
    body.appendChild(catTag);
    body.appendChild(footerArea);
    footerArea.appendChild(priceArea);
    footerArea.appendChild(actions);

    // place subtotal aligned to left in footer area
    footerArea.appendChild(subtotalEl);

    card.appendChild(body);
    card.appendChild(imgCol);

    card.addEventListener('click', (e) => {
      const insideAction = e.target.closest('.shopping-prod-actions, .shopping-prod-cart-btn, .shopping-prod-delete-btn, .cart-qty-btn, .cart-qty-input');
      if (insideAction) return;
      window.location.href = `product-detail.html?id=${encodeURIComponent(product.product_id)}`;
    });

    return card;
  }

  /* Related products (reuse existing createProductCard) */
  function renderRelatedProducts() {
    if (!state.dom.relatedSection || !state.dom.relatedCarousel) return;

    const relatedProducts = getRandomProducts(state.allProducts, 6);

    if (relatedProducts.length === 0) {
      state.dom.relatedSection.classList.add('hidden');
      return;
    }

    state.dom.relatedSection.classList.remove('hidden');
    clearChildren(state.dom.relatedCarousel);

    const productsWrapper = document.createElement('div');
    productsWrapper.className = 'ikea-products-wrapper';

    for (const product of relatedProducts) {
      // Reuse same card markup used in products (createProductCard function might exist in another file; but to be safe, create a small simple card here)
      const card = createProductCard(product);
      productsWrapper.appendChild(card);
    }

    state.dom.relatedCarousel.appendChild(productsWrapper);

    const seeMoreWrap = document.createElement('div');
    seeMoreWrap.className = 'related-see-more-wrap';

    const seeMoreBtn = document.createElement('a');
    seeMoreBtn.className = 'related-see-more-btn';
    seeMoreBtn.href = 'products.html';
    seeMoreBtn.textContent = 'عرض المزيد';

    seeMoreWrap.appendChild(seeMoreBtn);
    state.dom.relatedCarousel.appendChild(seeMoreWrap);
  }

  /* createProductCard: similar to products.js card but minimal to avoid duplication conflicts */
  function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'prod-card';
    card.dataset.prod = product.product_id;
    card.dataset.cat = product.category || '';
    card.tabIndex = 0;

    // IMAGE COLUMN
    const imgCol = document.createElement('div');
    imgCol.className = 'prod-img-col';

    const badgesRow = document.createElement('div');
    badgesRow.className = 'prod-badges-row';

    if (product.isFeatured) {
      const b = document.createElement('span');
      b.className = 'prod-badge featured';
      b.textContent = 'الأكثر مبيعاً';
      badgesRow.appendChild(b);
    }

    if (product.isNew) {
      const b = document.createElement('span');
      b.className = 'prod-badge new';
      b.textContent = 'جديد';
      badgesRow.appendChild(b);
    }

    imgCol.appendChild(badgesRow);

    const wrap = document.createElement('div');
    wrap.className = 'prod-img-wrap';

    const img = document.createElement('img');
    img.className = 'prod-img';
    img.alt = product.display_name || '';
    img.loading = 'lazy';
    img.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}_1.webp`;
    img.onerror = function () {
      this.onerror = null;
      this.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}.webp`;
    };

    wrap.appendChild(img);
    imgCol.appendChild(wrap);

    // BODY
    const body = document.createElement('div');
    body.className = 'prod-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'prod-name';
    nameEl.textContent = product.display_name;

    const catTag = document.createElement('div');
    catTag.className = 'prod-cat-tag';
    catTag.textContent = state.categoryMap[product.category]?.display_name || '';

    const head = document.createElement('div');
    head.className = 'prod-head';
    head.appendChild(nameEl);

    // PRICE
    const footerArea = document.createElement('div');
    footerArea.className = 'prod-footer-area';

    const priceArea = document.createElement('div');
    priceArea.className = 'prod-price';

    const newPrice = document.createElement('div');
    newPrice.className = 'new-price';

    const currency = document.createElement('span');
    currency.className = 'price-currency';
    currency.textContent = 'EGP';

    const value = document.createElement('span');
    value.className = 'price-value';
    value.textContent = formatPrice(product.sale_price != null ? product.sale_price : product.base_price);

    newPrice.appendChild(currency);
    newPrice.appendChild(value);

    priceArea.appendChild(newPrice);

    if (product.sale_price != null && product.sale_price !== '') {
      const old = document.createElement('span');
      old.className = 'old-price';
      old.textContent = `${formatPrice(product.base_price)} EGP`;
      priceArea.appendChild(old);
    }

    const actions = document.createElement('div');
    actions.className = 'prod-actions';

    const avail = document.createElement('div');
    avail.className = 'prod-availability';

    const dot = document.createElement('span');
    dot.className = 'avail-dot ' + (product.isAvailable ? 'available' : 'unavailable');

    const txt = document.createElement('span');
    txt.className = 'avail-text';
    txt.textContent = product.isAvailable ? 'متاح' : 'غير متاح';

    avail.appendChild(dot);
    avail.appendChild(txt);

    const cartLink = document.createElement('a');
    cartLink.className = 'prod-cart-btn';
    cartLink.href = 'cart.html';
    cartLink.setAttribute('aria-label', 'اذهب إلى السلة');
    cartLink.title = 'أضف إلى السلة / انتقل إلى السلة';
    cartLink.innerHTML = '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

    cartLink.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (window.addToCart && typeof window.addToCart === 'function') {
        window.addToCart(product.product_id, 1);
      }
      // Navigate to cart
      window.location.href = 'cart.html';
    });

    const wishLink = document.createElement('button');
    wishLink.className = 'prod-wishlist-btn';
    wishLink.type = 'button';
    wishLink.setAttribute('aria-label', 'القائمة سلة المشتريات');
    wishLink.title = 'قائمة الرغبات';
    wishLink.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5 5 0 0 0-7.07 0L12 6.3l-1.73-1.7a5 5 0 0 0-7.07 7.07L12 21.3l8.8-8.8a5 5 0 0 0 0-7.9z"></path></svg>';

    wishLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // toggleWishlist logic in products.js handles wishlist separately; here we don't alter wishlist behavior
      if (typeof window.toggleWishlist === 'function') {
        window.toggleWishlist(product.product_id, wishLink);
      }
    });

    const actionButtons = document.createElement('div');
    actionButtons.className = 'prod-action-buttons';

    actionButtons.appendChild(cartLink);
    actionButtons.appendChild(wishLink);

    actions.appendChild(avail);
    actions.appendChild(actionButtons);

    footerArea.appendChild(priceArea);
    footerArea.appendChild(actions);

    // ASSEMBLE
    body.appendChild(head);
    body.appendChild(catTag);
    body.appendChild(footerArea);

    card.appendChild(body);
    card.appendChild(imgCol);

    card.addEventListener('click', ev => {
      const insideAction = ev.target.closest('.prod-actions, .prod-cart-btn, .prod-wishlist-btn');
      if (insideAction) return;
      window.location.href = `product-detail.html?id=${encodeURIComponent(product.product_id)}`;
    });

    return card;
  }

  /* Remove item */
  function removeFromCart(productId) {
    removeFromCartInternal(productId);
  }

  /* Load products */
  async function loadProducts() {
    const cached = loadProductsCache();
    if (cached && cached.products && cached.categories) {
      state.allProducts = cached.products;
      state.categories = cached.categories;
      state.categoryMap = {};
      state.categories.forEach(c => state.categoryMap[c.category_id] = c);
      return;
    }

    try {
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password',
        { cache: 'no-cache' }
      );

      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const data = await response.json();
      const productsRaw = Array.isArray(data.products) ? data.products : [];
      const catsRaw = Array.isArray(data.categories) ? data.categories : [];

      state.allProducts = productsRaw.map(p => ({
        ...p,
        product_id: String(p.product_id || '').trim(),
        display_name: String(p.display_name || '').trim(),
        category: String(p.category || '').trim(),
        base_price: p.base_price != null ? Number(p.base_price) : 0,
        sale_price: (p.sale_price !== undefined && p.sale_price !== '') ? Number(p.sale_price) : null,
        isVisible: p.visible !== false,
        isFeatured: Boolean(p.featured),
        isNew: Boolean(p.new)
      }));

      state.categories = catsRaw;
      state.categoryMap = {};
      state.categories.forEach(c => state.categoryMap[c.category_id] = c);

      // cache products in sessionStorage for performance
      try {
        sessionStorage.setItem(CONFIG.PRODUCTS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: { products: state.allProducts, categories: state.categories } }));
      } catch (e) {}
    } catch (e) {
      console.error('Error loading products:', e);
    }
  }

  /* Event handlers */
  function setupEventHandlers() {
    if (state.dom.googleLoginBtn) {
      state.dom.googleLoginBtn.addEventListener('click', () => {
        if (window.loginWithGoogle) {
          window.loginWithGoogle();
        }
      });
    }

    if (state.dom.btnGenerate) {
      state.dom.btnGenerate.addEventListener('click', () => {
        handleGenerateSummary();
      });
    }

    if (state.dom.btnClear) {
      state.dom.btnClear.addEventListener('click', () => {
        if (!confirm('هل تود تفريغ السلة؟')) return;
        state.cartItems = [];
        saveLocalCart(state.cartItems);
        renderCart();
        updateCounter();
        showToast('تم تفريغ السلة');
      });
    }

    // modal buttons
    if (state.dom.btnClosePreview) {
      state.dom.btnClosePreview.addEventListener('click', closePreviewModal);
    }

    if (state.dom.btnDownloadPdf) {
      state.dom.btnDownloadPdf.addEventListener('click', async () => {
        try {
          await generatePdfAndDownload(); // ensure PDF generation and download
        } catch (err) {
          console.error('PDF generation failed', err);
          showToast('فشل إنشاء ملف PDF');
        }
      });
    }

    if (state.dom.btnSendWhatsapp) {
      state.dom.btnSendWhatsapp.addEventListener('click', async () => {
        try {
          await sendOrderViaWhatsApp();
        } catch (err) {
          console.error('Failed to prepare WhatsApp', err);
          showToast('فشل تحضير رسالة WhatsApp');
        }
      });
    }

    // close modal on backdrop click
    if (state.dom.orderPreviewModal) {
      state.dom.orderPreviewModal.addEventListener('click', (ev) => {
        if (ev.target === state.dom.orderPreviewModal) {
          closePreviewModal();
        }
      });
    }
  }

  /* Load & render cart */
  async function loadAndRenderCart() {
    // load cart from localStorage
    state.cartItems = getLocalCart() || [];
    updateCounter();
    renderCart();
    renderRelatedProducts();
  }

  /* Generate Order Payload */
  function buildOrderPayload() {
    const items = [];
    let grandTotal = 0;
    for (const it of state.cartItems) {
      const p = state.allProducts.find(x => String(x.product_id) === String(it.product_id));
      if (!p) continue;
      const unitPrice = (p.sale_price != null && p.sale_price !== '') ? Number(p.sale_price) : Number(p.base_price || 0);
      const subtotal = unitPrice * Number(it.qty || 0);
      grandTotal += subtotal;
      items.push({
        product_id: p.product_id,
        name: p.display_name,
        specs: (p.width && p.height && p.depth) ? `${p.width} × ${p.depth} × ${p.height} سم` : '',
        qty: Number(it.qty || 0),
        unitPrice,
        subtotal
      });
    }

    const now = new Date();
    const orderNumber = `WODI-${String(now.getTime()).slice(-8)}`;

    const user = state.currentUser || {};
    const customerName = user.displayName || (user.name) || 'غير متوفر';
    const customerPhone = user.phoneNumber || user.phone || 'غير متوفر';

    return {
      number: orderNumber,
      createdAt: now.toISOString(),
      customerName,
      customerPhone,
      items,
      grandTotal,
      notes: 'الأسعار لا تشمل الشحن أو الضرائب. التواصل والدفع عبر WhatsApp.'
    };
  }

  /* Render invoice as HTML inside preview modal
     We create an HTML structure (rtl) that resembles your PDF template.
  */
  function renderOrderPreview(payload) {
    if (!state.dom.orderInvoicePreview) return;
    const { number, createdAt, customerName, customerPhone, items, grandTotal, notes } = payload;

    const date = new Date(createdAt);
    const formattedDate = date.toLocaleString('ar-EG', { hour12: false });

    const container = document.createElement('div');
    container.style.direction = 'rtl';
    container.style.fontFamily = "Cairo, sans-serif";
    container.style.padding = '12px';
    container.style.color = 'var(--color-text-main, #333028)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '12px';

    const left = document.createElement('div');
    left.style.textAlign = 'left';
    left.innerHTML = `<div style="font-weight:800;">WODI Furniture</div><div style="color:#666;font-size:13px;">ملخص الطلب</div>`;

    const right = document.createElement('div');
    right.style.textAlign = 'right';
    right.innerHTML = `<div style="font-weight:800;">رقم الطلب: ${number}</div><div style="color:#666;font-size:13px;">التاريخ: ${formattedDate}</div>`;

    header.appendChild(right);
    header.appendChild(left);

    container.appendChild(header);

    // Customer block
    const cust = document.createElement('div');
    cust.style.marginBottom = '12px';
    cust.innerHTML = `<div style="font-weight:700; margin-bottom:6px;">بيانات العميل</div>
      <div>الاسم: ${customerName}</div>
      <div>الهاتف: ${customerPhone}</div>`;
    container.appendChild(cust);

    // Table header
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginBottom = '12px';
    table.innerHTML = `
      <thead>
        <tr style="background:var(--color-bg-alt,#f8f9fa);">
          <th style="padding:8px; text-align:right; border:1px solid var(--color-border)">المنتج</th>
          <th style="padding:8px; text-align:center; border:1px solid var(--color-border)">المواصفات</th>
          <th style="padding:8px; text-align:center; border:1px solid var(--color-border)">الكمية</th>
          <th style="padding:8px; text-align:center; border:1px solid var(--color-border)">سعر الوحدة (EGP)</th>
          <th style="padding:8px; text-align:center; border:1px solid var(--color-border)">الإجمالي (EGP)</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    for (const row of items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px; border:1px solid var(--color-border); vertical-align:top;">${escapeHtml(row.name)}</td>
        <td style="padding:8px; border:1px solid var(--color-border); vertical-align:top;">${escapeHtml(row.specs)}</td>
        <td style="padding:8px; border:1px solid var(--color-border); text-align:center;">${row.qty}</td>
        <td style="padding:8px; border:1px solid var(--color-border); text-align:center;">${formatPrice(row.unitPrice)}</td>
        <td style="padding:8px; border:1px solid var(--color-border); text-align:center;">${formatPrice(row.subtotal)}</td>
      `;
      tbody.appendChild(tr);
    }

    container.appendChild(table);

    // totals
    const totalsDiv = document.createElement('div');
    totalsDiv.style.display = 'flex';
    totalsDiv.style.justifyContent = 'flex-end';
    totalsDiv.style.gap = '16px';
    totalsDiv.style.marginBottom = '12px';
    totalsDiv.innerHTML = `<div style="text-align:right;">
        <div style="font-weight:700;">الإجمالي الكلي: ${formatPrice(grandTotal)} EGP</div>
        <div style="color:#666; font-size:12px; margin-top:6px;">${escapeHtml(notes)}</div>
      </div>`;
    container.appendChild(totalsDiv);

    // footer note
    const footerNote = document.createElement('div');
    footerNote.style.marginTop = '8px';
    footerNote.style.color = '#666';
    footerNote.style.fontSize = '12px';
    footerNote.innerHTML = 'ملاحظة: هذه فاتورة مبدئية. التواصل والدفع يتم عبر WhatsApp.';
    container.appendChild(footerNote);

    // inject
    state.dom.orderInvoicePreview.innerHTML = '';
    state.dom.orderInvoicePreview.appendChild(container);
  }

  /* Simple HTML escape for content */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Preview modal open/close */
  function openPreviewModal() {
    if (!state.dom.orderPreviewModal) return;
    state.dom.orderPreviewModal.style.display = 'flex';
    state.dom.orderPreviewModal.setAttribute('aria-hidden', 'false');
  }

  function closePreviewModal() {
    if (!state.dom.orderPreviewModal) return;
    state.dom.orderPreviewModal.style.display = 'none';
    state.dom.orderPreviewModal.setAttribute('aria-hidden', 'true');
  }

  /* Generate PDF and trigger download (returns Promise) */
  async function generatePdfAndDownload() {
    if (!state.dom.orderInvoicePreview) throw new Error('Preview not ready');
    const payload = buildOrderPayload();
    // Ensure preview matches the payload (redraw)
    renderOrderPreview(payload);

    const element = state.dom.orderInvoicePreview;
    // options for html2pdf
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `WODI-Order-${payload.number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Use html2pdf sequence to get jsPDF object then output blob
    return new Promise((resolve, reject) => {
      try {
        // create a cloned element to avoid layout shifts
        const clone = element.cloneNode(true);
        clone.style.background = '#ffffff';
        clone.style.padding = '18px';
        // create a wrapper
        const wrapper = document.createElement('div');
        wrapper.style.direction = 'rtl';
        wrapper.appendChild(clone);

        // call html2pdf
        window.html2pdf().from(wrapper).set(opt).toPdf().get('pdf').then(function (pdf) {
          try {
            const blob = pdf.output('blob');
            // trigger download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `WODI-Order-${payload.number}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            resolve(blob);
          } catch (err) {
            reject(err);
          }
        }).catch(err => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /* Prepare and open WhatsApp message (after ensuring PDF is generated/downloaded) */
  async function sendOrderViaWhatsApp() {
    if (!state.dom.orderInvoicePreview) throw new Error('Preview not ready');

    // Ensure cart not empty
    if (!state.cartItems || state.cartItems.length === 0) {
      showToast('السلة فارغة');
      return;
    }

    const payload = buildOrderPayload();
    // generate PDF and download first (so user has file ready)
    try {
      await generatePdfAndDownload();
    } catch (err) {
      console.error('PDF generation failed before WhatsApp', err);
      showToast('فشل إنشاء ملف PDF');
      // still proceed to open WhatsApp message if you wish; but per pipeline we require pdf ready
      return;
    }

    // Build short message (do not put whole PDF in message)
    const msgLines = [
      `مرحباً، هذا ملخص طلب جديد من WODI.`,
      `رقم الطلب: ${payload.number}`,
      `الاسم: ${payload.customerName}`,
      `الهاتف: ${payload.customerPhone}`,
      `إجمالي الطلب: ${formatPrice(payload.grandTotal)} EGP`,
      `لقد تم إنشاء فاتورة PDF جاهزة للتحميل — الرجاء إرفاقها مع الرسالة عند الإرسال.`,
      `شكراً.`
    ];
    const msg = msgLines.join('\n');
    const encoded = encodeURIComponent(msg);

    // Open wa.me with WODI number
    const waUrl = `https://wa.me/${CONFIG.WA_NUMBER}?text=${encoded}`;
    const w = window.open(waUrl, '_blank');
    if (!w) {
      showToast('تعذّر فتح WhatsApp، تأكد من إعداد المتصفح للسماح بالفتح في نوافذ جديدة.');
    }
  }

  /* Handler for Generate Summary button */
  function handleGenerateSummary() {
    if (!state.cartItems || state.cartItems.length === 0) {
      showToast('السلة فارغة');
      return;
    }

    const payload = buildOrderPayload();
    renderOrderPreview(payload);
    openPreviewModal();
  }

  /* Initialization */
  async function init() {
    cacheDOM();
    setupEventHandlers();
    await loadProducts();

    // Always render related products, regardless of login state
    renderRelatedProducts();

    setupAuthStateListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose helper functions (for debugging / other scripts)
  window.WODICart = {
    getCart: () => state.cartItems,
    getTotals: computeCartTotals,
    rebuildFromStorage: () => { state.cartItems = getLocalCart() || []; renderCart(); updateCounter(); }
  };

})();