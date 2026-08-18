/* ===========================
   Wishlist Page - wishlist.js
   =========================== */

(function () {
  'use strict';

  const CONFIG = {
    WISHLIST_LOCAL_KEY: 'wodi_wishlist_local',
    PRODUCTS_CACHE_KEY: 'wodi_products_cache',
    CACHE_TTL_MS: 1000 * 60 * 30,
    GH_IMAGES_BASE: 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/products/',
    TOAST_DURATION_MS: 3000,
    RELATED_PRODUCTS_COUNT: 8
  };

  const state = {
    isLoggedIn: false,
    currentUser: null,
    wishlistItems: [],
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

  function getLocalWishlist() {
    try {
      const stored = localStorage.getItem(CONFIG.WISHLIST_LOCAL_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalWishlist(items) {
    try {
      localStorage.setItem(CONFIG.WISHLIST_LOCAL_KEY, JSON.stringify(items));
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

  function cacheDOM() {
    state.dom.notLoggedInSection = document.getElementById('shopping-not-logged-in');
    state.dom.loggedInSection = document.getElementById('shopping-logged-in');
    state.dom.emptyState = document.getElementById('shopping-empty-state');
    state.dom.productsGrid = document.getElementById('shopping-products-grid');
    state.dom.countNumber = document.getElementById('shopping-count');
    state.dom.googleLoginBtn = document.getElementById('btn-google-login-shopping');
    state.dom.relatedSection = document.getElementById('related-products-section');
    state.dom.relatedCarousel = document.getElementById('related-products-carousel');
    state.dom.relatedArrowRight = document.getElementById('related-arrow-right');
    state.dom.relatedArrowLeft = document.getElementById('related-arrow-left');
  }

  /* Auth Handling */
  function setupAuthStateListener() {
    // Check if window.onAuthStateChanged exists (from auth.js)
    if (window.onAuthStateChanged && typeof window.onAuthStateChanged === 'function') {
      window.onAuthStateChanged((user) => {
        state.isLoggedIn = !!user;
        state.currentUser = user;
        handleAuthStateChange();
      });
    } else {
      console.warn('Auth system not loaded yet');
      // Retry after a delay
      setTimeout(setupAuthStateListener, 500);
    }
  }

  function handleAuthStateChange() {
    if (state.isLoggedIn && state.currentUser) {
      showLoggedInState();
      loadAndRenderWishlist();
    } else {
      showNotLoggedInState();
    }
  }

  /* UI State */
  function showNotLoggedInState() {
    if (state.dom.notLoggedInSection) state.dom.notLoggedInSection.style.display = 'flex';
    if (state.dom.loggedInSection) state.dom.loggedInSection.classList.add('hidden');
    // Show related products even when not logged in
    if (state.dom.relatedSection) state.dom.relatedSection.classList.remove('hidden');
  }

  function showLoggedInState() {
    if (state.dom.notLoggedInSection) state.dom.notLoggedInSection.style.display = 'none';
    if (state.dom.loggedInSection) state.dom.loggedInSection.classList.remove('hidden');
  }

  function updateCounter() {
    if (state.dom.countNumber) {
      state.dom.countNumber.textContent = state.wishlistItems.length;
    }
  }

  /* Wishlist Loading */
  async function loadAndRenderWishlist() {
    state.wishlistItems = getLocalWishlist();
    updateCounter();
    renderWishlist();
    renderRelatedProducts();
  }

  /* Rendering */
  function clearChildren(el) {
    while (el && el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderWishlist() {
    const grid = state.dom.productsGrid;
    const empty = state.dom.emptyState;

    if (!grid || !empty) return;

    if (state.wishlistItems.length === 0) {
      empty.style.display = 'flex';
      grid.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    grid.style.display = 'flex';
    clearChildren(grid);

    const wrapper = document.createElement('div');
    wrapper.className = 'shopping-ikea-wrapper';

    for (const itemId of state.wishlistItems) {
      const product = state.allProducts.find(p => p.product_id === itemId);
      if (!product) continue;
      const card = createWishlistProductCard(product);
      wrapper.appendChild(card);
    }

    grid.appendChild(wrapper);
  }

  function createWishlistProductCard(product) {
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
    value.textContent = formatPrice(product.sale_price != null ? product.sale_price : product.base_price);

    newPrice.appendChild(currency);
    newPrice.appendChild(value);
    priceArea.appendChild(newPrice);

    if (product.sale_price != null && product.sale_price !== '') {
      const oldPrice = document.createElement('span');
      oldPrice.className = 'shopping-old-price';
      oldPrice.textContent = `${formatPrice(product.base_price)} EGP`;
      priceArea.appendChild(oldPrice);
    }

    const actions = document.createElement('div');
    actions.className = 'shopping-prod-actions';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'shopping-prod-actions-container';

    const cartBtn = document.createElement('a');
    cartBtn.className = 'shopping-prod-cart-btn';
    cartBtn.href = 'cart.html';
    cartBtn.setAttribute('aria-label', 'اذهب إلى السلة');
    cartBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shopping-prod-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'حذف من المفضلة');
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromWishlist(product.product_id);
    });

    actionsContainer.appendChild(cartBtn);
    actionsContainer.appendChild(deleteBtn);
    actions.appendChild(actionsContainer);

    body.appendChild(head);
    body.appendChild(catTag);
    body.appendChild(footerArea);
    footerArea.appendChild(priceArea);
    footerArea.appendChild(actions);

    card.appendChild(body);
    card.appendChild(imgCol);

    card.addEventListener('click', (e) => {
      const insideAction = e.target.closest('.shopping-prod-actions, .shopping-prod-cart-btn, .shopping-prod-delete-btn');
      if (insideAction) return;
      window.location.href = `product-detail.html?id=${encodeURIComponent(product.product_id)}`;
    });

    return card;
  }

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

  function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'prod-card';
    card.dataset.prod = product.product_id;
    card.dataset.cat = product.category || '';
    card.tabIndex = 0;

    // IMAGE COLUMN
    const imgCol = document.createElement('div');
    imgCol.className = 'prod-img-col';

    // BADGES
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

    // IMAGE
    const wrap = document.createElement('div');
    wrap.className = 'prod-img-wrap';

    const img = document.createElement('img');
    img.className = 'prod-img';
    img.alt = product.display_name || '';
    img.loading = 'lazy';
    img.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}_1.webp`;

    img.onerror = function () {
      this.onerror = null; // يمنع حلقة لانهائية لو الصورة البديلة كمان فشلت
      this.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}.webp`;
    };

    wrap.appendChild(img);
    imgCol.appendChild(wrap);

    // IMAGE FOOTER / DOTS
    const imgFooter = document.createElement('div');
    imgFooter.className = 'prod-img-footer';

    const dots = document.createElement('div');
    dots.className = 'prod-dots';

    const s1 = document.createElement('span');
    s1.className = 'active';

    dots.appendChild(s1);
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));

    imgFooter.appendChild(dots);
    imgCol.appendChild(imgFooter);

    // BODY
    const body = document.createElement('div');
    body.className = 'prod-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'prod-name';
    nameEl.textContent = product.display_name;

    const catTag = document.createElement('div');
    catTag.className = 'prod-cat-tag';
    catTag.textContent =
      state.categoryMap[product.category]?.display_name || '';

    const head = document.createElement('div');
    head.className = 'prod-head';
    head.appendChild(nameEl);

    let sizeEl = null;

    if (product.width && product.height && product.depth) {
      sizeEl = document.createElement('div');
      sizeEl.className = 'prod-size';
      sizeEl.textContent =
        `${product.width} × ${product.depth} × ${product.height} سم`;
    }

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
    value.textContent = formatPrice(
      product.sale_price != null ? product.sale_price : product.base_price
    );

    newPrice.appendChild(currency);
    newPrice.appendChild(value);

    priceArea.appendChild(newPrice);

    if (product.sale_price != null && product.sale_price !== '') {
      const old = document.createElement('span');
      old.className = 'old-price';
      old.textContent = `${formatPrice(product.base_price)} EGP`;
      priceArea.appendChild(old);
    }

    // ACTIONS
    const actions = document.createElement('div');
    actions.className = 'prod-actions';

    const avail = document.createElement('div');
    avail.className = 'prod-availability';

    const dot = document.createElement('span');
    dot.className =
      'avail-dot ' + (product.isAvailable ? 'available' : 'unavailable');

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
    cartLink.innerHTML =
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

    const wishLink = document.createElement('button');
    wishLink.className = 'prod-wishlist-btn';
    wishLink.type = 'button';
    wishLink.setAttribute('aria-label', 'القائمة المفضلة');
    wishLink.title = 'قائمة الرغبات';
    wishLink.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5 5 0 0 0-7.07 0L12 6.3l-1.73-1.7a5 5 0 0 0-7.07 7.07L12 21.3l8.8-8.8a5 5 0 0 0 0-7.9z"></path></svg>';

    wishLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(product.product_id, wishLink);
    });

    const actionButtons = document.createElement('div');
    actionButtons.className = 'prod-action-buttons';

    actionButtons.appendChild(cartLink);
    actionButtons.appendChild(wishLink);

    actions.appendChild(avail);
    actions.appendChild(actionButtons);

    footerArea.appendChild(priceArea);
    footerArea.appendChild(actions);

    // ASSEMBLE BODY
    body.appendChild(head);
    body.appendChild(catTag);

    if (sizeEl) {
      body.appendChild(sizeEl);
    }

    body.appendChild(footerArea);

    // ASSEMBLE CARD
    card.appendChild(body);
    card.appendChild(imgCol);

    card.addEventListener('click', ev => {
      const insideAction = ev.target.closest(
        '.prod-actions, .prod-cart-btn, .prod-wishlist-btn'
      );

      if (insideAction) return;

      window.location.href =
        `product-detail.html?id=${encodeURIComponent(product.product_id)}`;
    });

    return card;
  }

  // Add toggleWishlist function (from products.js)
  function toggleWishlist(productId, wishBtn) {
    if (!wishBtn) return;

    const isInWishlist = window.isInWishlist && window.isInWishlist(productId);

    if (isInWishlist) {
      window.removeFromWishlistGlobal && window.removeFromWishlistGlobal(productId);
      wishBtn.classList.remove('active');
      wishBtn.querySelector('svg').style.fill = 'none';
    } else {
      window.addToWishlist && window.addToWishlist(productId);
      wishBtn.classList.add('active');
      wishBtn.querySelector('svg').style.fill = 'currentColor';
    }
  }


  /* Wishlist Management */
  function removeFromWishlist(productId) {
    state.wishlistItems = state.wishlistItems.filter(id => id !== productId);
    saveLocalWishlist(state.wishlistItems);
    updateCounter();
    renderWishlist();
    renderRelatedProducts();
    showToast('تم حذف المنتج من المفضلة');
  }

  /* Products Loading */
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
    } catch (e) {
      console.error('Error loading products:', e);
    }
  }

  /* Event Handlers */
  function setupEventHandlers() {
    if (state.dom.googleLoginBtn) {
      state.dom.googleLoginBtn.addEventListener('click', () => {
        if (window.loginWithGoogle) {
          window.loginWithGoogle();
        }
      });
    }
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

  // Global API
  window.addToWishlist = function (productId) {
    if (!state.wishlistItems.includes(productId)) {
      state.wishlistItems.push(productId);
      saveLocalWishlist(state.wishlistItems);
      showToast('تم إضافة المنتج إلى المفضلة');
    }
  };

  window.removeFromWishlistGlobal = function (productId) {
    removeFromWishlist(productId);
  };

  window.isInWishlist = function (productId) {
    return state.wishlistItems.includes(productId);
  };

})();