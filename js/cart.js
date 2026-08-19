/* ===========================
   Cart Page - cart.js (Cart with popup & PDF open/share)
   =========================== */

(function () {
  'use strict';

  const CONFIG = {
    CART_LOCAL_KEY: 'wodi_cart_local',
    PRODUCTS_CACHE_KEY: 'wodi_products_cache',
    CACHE_TTL_MS: 1000 * 60 * 30,
    GH_IMAGES_BASE: 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/products/',
    TOAST_DURATION_MS: 3000,
    RELATED_PRODUCTS_COUNT: 8,
    MAX_QTY: 99,
    MIN_QTY: 1,
    WA_NUMBER: '201556840368',
    PROFILE_PREFIX: 'wodi_user_profile_'
  };

  const state = {
    isLoggedIn: false,
    currentUser: null,
    cartItems: [], // array of { product_id: '...', qty: 1 }
    allProducts: [],
    categories: [],
    categoryMap: {},
    dom: {},
    lastPdfBlob: null,
    lastPdfUrl: null,
    lastPayload: null
  };

  /* Utilities */
  function formatPrice(num) {
    if (num == null || isNaN(num)) return '';
    return Math.round(num).toLocaleString('en-US');
  }

  function showToast(message, duration = CONFIG.TOAST_DURATION_MS, target = null) {
    // small inline toast near modal or global
    if (target) {
      const el = document.getElementById(target);
      if (el) {
        el.textContent = message;
        el.style.color = 'var(--color-text-main)';
        setTimeout(() => { if (el) el.textContent = ''; }, duration);
        return;
      }
    }
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

    // modal + preview (from cart.html)
    state.dom.orderPreviewModal = document.getElementById('order-preview-modal');
    state.dom.orderInvoicePreview = document.getElementById('order-invoice-preview');
    state.dom.btnDownloadPdf = document.getElementById('btn-generate-popup-pdf');
    state.dom.btnSendWhatsapp = document.getElementById('btn-send-popup-whatsapp');
    state.dom.btnClosePreview = document.getElementById('order-popup-close');
    state.dom.btnCancelPopup = document.getElementById('btn-cancel-popup');

    // modal form fields
    state.dom.modalName = document.getElementById('modal-customer-name');
    state.dom.modalPhone = document.getElementById('modal-customer-phone');
    state.dom.modalAddress = document.getElementById('modal-customer-address');
    state.dom.modalLocateBtn = document.getElementById('modal-btn-locate');
    state.dom.modalLocResult = document.getElementById('modal-loc-result');
    state.dom.modalMapContainer = document.getElementById('modal-mapContainer');
    state.dom.modalStaticMap = document.getElementById('modal-staticMap');
    state.dom.popupToast = document.getElementById('popup-toast');

    // ربط زر تحديد الموقع في الـ modal بنفس نظام الـ configurator
    if (state.dom.modallocatebtn) {
      state.dom.modallocatebtn.addeventlistener('click', function() {
        if (typeof window.getlocation === 'function') {
          window.getlocation(
            state.dom.modallocatebtn,
            state.dom.modallocresult,
            state.dom.modalmapcontainer,
            state.dom.modalstaticmap
          );
        } else if (typeof window.requestlocation === 'function') {
          window.requestlocation();
        } else {
          console.warn('geolocation function not available globally');
        }
      });
    }
  }

  /* Auth handling */
  function setupAuthStateListener() {
    if (window.onAuthStateChanged && typeof window.onAuthStateChanged === 'function') {
      window.onAuthStateChanged((user) => {
        state.isLoggedIn = !!user;
        state.currentUser = user;
        // If modal open, populate fields
        if (state.dom && state.dom.orderPreviewModal && state.dom.orderPreviewModal.style.display === 'flex') {
          populateModalUser();
        }
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


  function updateCounter() {
    const totals = computeCartTotals();
    if (state.dom.countNumber) state.dom.countNumber.textContent = totals.totalQty || 0;
    if (state.dom.cartItemsCount) state.dom.cartItemsCount.textContent = totals.totalQty || 0;
    if (state.dom.cartGrandTotal) state.dom.cartGrandTotal.textContent = formatPrice(totals.grandTotal || 0);
    
    // التحديث المركزي للـ Navbar Badge في جميع الصفحات بدون تعديل التصميم
    const navBadge = document.getElementById('cart-badge');
    if (navBadge) {
      navBadge.textContent = totals.totalQty || 0;
    }
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
  window.removeFromCartGlobal = function (productId) {
    removeFromCartInternal(productId);
  };

  window.updateCartQuantityGlobal = function (productId, qty) {
    updateCartQuantityInternal(productId, qty);
  };

  window.isInCartGlobal = function (productId) {
    return !!findCartItem(productId);
  };

  function findCartItem(productId, isCustom = false, cartItemId = null) {
    if (isCustom && cartItemId) {
      return state.cartItems.find(it => it.is_custom && it.cartItemId === cartItemId);
    }
    if (isCustom) {
      return state.cartItems.find(it => it.is_custom && String(it.product_id) === String(productId));
    }
    return state.cartItems.find(it => !it.is_custom && String(it.product_id) === String(productId));
  }

  function computeCartTotals() {
    let totalQty = 0;
    let grandTotal = 0;
    for (const item of state.cartItems) {
      const p = state.allProducts.find(x => String(x.product_id) === String(item.product_id));
      if (!p && !item.is_custom) continue;
      
      let unit = 0;
      if (item.is_custom) {
        unit = item.unitPrice != null ? Number(item.unitPrice) : (p ? ((p.sale_price != null && p.sale_price !== '') ? Number(p.sale_price) : Number(p.base_price || 0)) : 0);
      } else {
        unit = (p.sale_price != null && p.sale_price !== '') ? Number(p.sale_price) : Number(p.base_price || 0);
      }
      
      const qty = Number(item.qty || 0);
      totalQty += qty;
      grandTotal += unit * qty;
    }
    return { totalQty, grandTotal };
  }

  function addToCartInternal(productId, qty = 1, customData = null) {
    const id = String(productId);
    const isCustom = customData !== null && typeof customData === 'object';
    let cartItemId = id;
    
    if (isCustom && customData.configuration) {
      cartItemId = id + '_' + JSON.stringify(customData.configuration);
    }

    const existing = isCustom 
      ? state.cartItems.find(it => it.is_custom && it.cartItemId === cartItemId)
      : state.cartItems.find(it => !it.is_custom && String(it.product_id) === id);

    if (existing) {
      existing.qty = Math.min(CONFIG.MAX_QTY, Number(existing.qty || 0) + Number(qty || 1));
    } else {
      const newItem = {
        product_id: id,
        qty: Math.max(CONFIG.MIN_QTY, Number(qty || 1)),
        is_custom: isCustom
      };
      if (isCustom) {
        newItem.configuration = customData.configuration;
        newItem.unitPrice = customData.unitPrice;
        newItem.cartItemId = cartItemId;
      }
      state.cartItems.push(newItem);
    }
    saveLocalCart(state.cartItems);
    updateCounter();
    renderCart();
    renderRelatedProducts();
    showToast('تم إضافة المنتج إلى سلة المشتريات');
    return true;
  }

  window.addToCartGlobal = function (productId, qty = 1, customData = null) {
    return addToCartInternal(productId, qty, customData);
  };

  window.addToCart = function (productId, qty = 1, customData = null) {
    if (window.addToCartGlobal) return window.addToCartGlobal(productId, qty, customData);
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
      let product = state.allProducts.find(p => String(p.product_id) === String(line.product_id));
      if (!product && line.is_custom) {
        product = {
          product_id: line.product_id,
          display_name: line.configuration && line.configuration.design ? line.configuration.design.name || 'منتج مخصص' : 'منتج مخصص',
          base_price: line.unitPrice != null ? line.unitPrice : 0,
          isVisible: true
        };
      }
      if (!product) continue;
      const card = createCartProductCard(product, line);
      wrapper.appendChild(card);
    }

    grid.appendChild(wrapper);
    updateCounter();
  }

  function createCartProductCard(product, lineOrQty) {
    const qty = typeof lineOrQty === 'object' && lineOrQty !== null ? lineOrQty.qty : lineOrQty;
    const isCustom = typeof lineOrQty === 'object' && lineOrQty !== null ? lineOrQty.is_custom : false;
    const customConfig = typeof lineOrQty === 'object' && lineOrQty !== null ? lineOrQty.configuration : null;
    const customUnitPrice = typeof lineOrQty === 'object' && lineOrQty !== null ? lineOrQty.unitPrice : null;

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

    if (isCustom && customConfig && customConfig.design) {
      let desId = customConfig.design.id;
      const sinkType = customConfig.sinkType;
      const typeCodeMap = { 'drop-in': 'di', 'bowl': 'bw' };
      if (sinkType && typeCodeMap[sinkType]) {
        desId = desId.replace(/_wh_/, '_' + typeCodeMap[sinkType] + '_');
      }
      const GH_CONF = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
      const encoded = encodeURIComponent(desId);
      img.src = GH_CONF + encoded + '.webp';
      img.onerror = function () {
        if (this.src.endsWith('.webp')) {
          this.src = GH_CONF + encoded + '.png';
        } else {
          this.style.display = 'none';
        }
      };
    } else {
      img.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}_1.webp`; 
      img.onerror = function () { 
        this.src = `${CONFIG.GH_IMAGES_BASE}${product.product_id}.webp`; 
      };
    }

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

    if (isCustom && customConfig) {
      catTag.style.display = 'flex';
      catTag.style.gap = '6px';
      catTag.style.alignItems = 'center';
      catTag.style.flexWrap = 'wrap';

      if (customConfig.design && customConfig.design.name) {
        const designTag = document.createElement('span');
        designTag.className = 'custom-item-chip';
        designTag.textContent = customConfig.design.name;
        catTag.appendChild(designTag);
      }

      if (customConfig.handle && customConfig.handle.name) {
        const handleTag = document.createElement('span');
        handleTag.className = 'custom-item-chip';
        handleTag.textContent = customConfig.handle.name;
        catTag.appendChild(handleTag);
      }
    } else {
      catTag.textContent = state.categoryMap[product.category]?.display_name || '';
    }

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
    const unitPrice = isCustom && customUnitPrice != null ? Number(customUnitPrice) : ((product.sale_price != null && product.sale_price !== '') ? Number(product.sale_price) : Number(product.base_price || 0));
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

    // Quantity controls (مکانها أولاً حسب الاتفاق)
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

    // Delete button (تم تبديل مكانه ليكون بجوار أزرار الكمية وإزالة زر العجلة نهائياً)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shopping-prod-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', 'حذف من سلة المشتريات');
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromCartInternal(product.product_id);
    });

    // Subtotal display
    const subtotalEl = document.createElement('div');
    subtotalEl.className = 'shopping-prod-subtotal';
    const subtotalVal = unitPrice * Number(qty || 1);
    subtotalEl.textContent = `${formatPrice(subtotalVal)} EGP`;

    actionsContainer.appendChild(qtyWrap);
    actionsContainer.appendChild(deleteBtn);

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

  /* Related products (reuse simple card) */
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

  /* createProductCard used for related products */
  function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'prod-card';
    card.dataset.prod = product.product_id;
    card.dataset.cat = product.category || '';
    card.tabIndex = 0;

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

  /* Remove item (public) */
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
        openOrderPopup();
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

    // modal controls
    if (state.dom.btnClosePreview) {
      state.dom.btnClosePreview.addEventListener('click', closeOrderPopup);
    }
    if (state.dom.btnCancelPopup) {
      state.dom.btnCancelPopup.addEventListener('click', closeOrderPopup);
    }

    if (state.dom.btnDownloadPdf) {
      state.dom.btnDownloadPdf.addEventListener('click', async () => {
        try {
          // If already generated, open existing URL; else generate
          if (state.lastPdfUrl) {
            window.open(state.lastPdfUrl, '_blank');
            // change button text to "See summary"
            state.dom.btnDownloadPdf.textContent = 'رؤية الملخص';
            state.dom.btnSendWhatsapp.disabled = !state.lastPdfBlob;
            return;
          }
          await generatePdfAndOpen(); // will open in new tab and set lastPdfBlob/url
          state.dom.btnDownloadPdf.textContent = 'رؤية الملخص';
          state.dom.btnSendWhatsapp.disabled = state.lastPdfBlob ? false : true;
        } catch (err) {
          console.error('PDF generation failed', err);
          showToast('فشل إنشاء ملف PDF');
        }
      });
    }

    if (state.dom.btnSendWhatsapp) {
      state.dom.btnSendWhatsapp.addEventListener('click', async () => {
        try {
          if (!state.lastPdfBlob) {
            showToast('لا يمكن الإرسال عبر WhatsApp قبل استخراج الملخص');
            return;
          }
          await shareOrOpenWhatsAppWithPdf();
        } catch (err) {
          console.error('Failed to prepare WhatsApp', err);
          showToast('فشل تحضير رسالة WhatsApp');
        }
      });
    }

    if (state.dom.modalLocateBtn) {
      state.dom.modalLocateBtn.addEventListener('click', async () => {
        if (typeof getLocation === 'function') {
          getLocation(
            state.dom.modalLocateBtn, 
            state.dom.modalLocResult, 
            state.dom.modalMapContainer, 
            state.dom.modalStaticMap
          );
          
          window.removeEventListener('app:location-updated', window._wodiLocationHandler);
          window._wodiLocationHandler = function(e) {
            const loc = e.detail || {};
            if (state.dom.orderInvoicePreview) {
              const iframe = state.dom.orderInvoicePreview.querySelector('iframe');
              if (iframe) {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                  const govEl = iframeDoc.getElementById('shipping-governorate');
                  const distEl = iframeDoc.getElementById('shipping-district');
                  const lngEl = iframeDoc.getElementById('shipping-lng');
                  const latEl = iframeDoc.getElementById('shipping-lat');
                  const shipCostEl = iframeDoc.getElementById('shipping-cost');
                  const orderTotalEl = iframeDoc.getElementById('order-total');
                  const mapImgEl = iframeDoc.getElementById('shipping-map-image');

                  if (govEl && loc.governorate) govEl.textContent = loc.governorate;
                  if (distEl && loc.district) distEl.textContent = loc.district;
                  if (lngEl && loc.lng) lngEl.textContent = Number(loc.lng).toFixed(4);
                  if (latEl && loc.lat) latEl.textContent = Number(loc.lat).toFixed(4);
                  
                  const cost = 200;
                  if (shipCostEl) shipCostEl.textContent = `${formatPrice(cost)} ج.م`;

                  if (orderTotalEl) {
                    const customItems = state.cartItems.filter(it => it.is_custom);
                    const normalItems = state.cartItems.filter(it => !it.is_custom);
                    
                    let sinkSub = 0;
                    customItems.forEach(it => {
                      const up = it.unitPrice != null ? Number(it.unitPrice) : 0;
                      sinkSub += up * Number(it.qty || 1);
                    });
                    
                    let prodSub = 0;
                    normalItems.forEach(it => {
                      const p = state.allProducts.find(x => String(x.product_id) === String(it.product_id));
                      if (p) {
                        const up = (p.sale_price != null && p.sale_price !== '') ? Number(p.sale_price) : Number(p.base_price || 0);
                        prodSub += up * Number(it.qty || 1);
                      }
                    });

                    const insp = 200;
                    const finalTotal = sinkSub + prodSub + cost + insp;
                    orderTotalEl.textContent = `${formatPrice(finalTotal)} ج.م`;
                  }

                  if (mapImgEl && state.dom.modalStaticMap && state.dom.modalStaticMap.src) {
                    mapImgEl.src = state.dom.modalStaticMap.src;
                  }
                }
              }
            }
          };
          window.addEventListener('app:location-updated', window._wodiLocationHandler, { once: true });

        } else {
          showToast('خدمة تحديد الموقع غير متاحة حالياً', 3000, 'popup-toast');
        }
      });
    }

    // when modal inputs change, clear previous generated PDF and update iframe live without flickering
    ['modal-customer-name','modal-customer-phone','modal-customer-address'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          clearLastGeneratedPdf();
          
          // Live update inside the iframe preview if loaded
          if (state.dom.orderInvoicePreview) {
            const iframe = state.dom.orderInvoicePreview.querySelector('iframe');
            if (iframe) {
              try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) {
                  const modalNameVal = state.dom.modalName ? state.dom.modalName.value.trim() : '';
                  const modalPhoneVal = state.dom.modalPhone ? state.dom.modalPhone.value.trim() : '';
                  const modalAddressVal = state.dom.modalAddress ? state.dom.modalAddress.value.trim() : '';
                  const user = state.currentUser || {};

                  const customerName = modalNameVal || user.displayName || user.name || 'غير متوفر';
                  const customerPhone = modalPhoneVal || user.phoneNumber || user.phone || 'غير متوفر';
                  const customerAddress = modalAddressVal || 'غير متوفر';

                  const custNameEl = doc.getElementById('customer-name');
                  if (custNameEl) custNameEl.textContent = customerName;

                  const custPhoneEl = doc.getElementById('customer-phone');
                  if (custPhoneEl) custPhoneEl.textContent = customerPhone;

                  const custAddressEl = doc.getElementById('customer-address');
                  if (custAddressEl) custAddressEl.textContent = customerAddress;
                }
              } catch (e) {
                // Ignore cross-origin or loading errors safely
              }
            }
          }
        });
      }
    });

    // close modal by backdrop
    if (state.dom.orderPreviewModal) {
      state.dom.orderPreviewModal.addEventListener('click', (ev) => {
        if (ev.target === state.dom.orderPreviewModal) closeOrderPopup();
      });
    }
  }

  /* Load & render cart */
  async function loadAndRenderCart() {
    state.cartItems = getLocalCart() || [];
    updateCounter();
    renderCart();
    renderRelatedProducts();
  }

  /* Build order payload */
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

    // gather customer data from modal (prefer currentUser)
    const user = state.currentUser || {};
    const modalName = (state.dom.modalName && state.dom.modalName.value) ? state.dom.modalName.value.trim() : '';
    const modalPhone = (state.dom.modalPhone && state.dom.modalPhone.value) ? state.dom.modalPhone.value.trim() : '';
    const modalAddress = (state.dom.modalAddress && state.dom.modalAddress.value) ? state.dom.modalAddress.value.trim() : '';

    const customerName = modalName || user.displayName || user.name || 'غير متوفر';
    const customerPhone = modalPhone || user.phoneNumber || user.phone || 'غير متوفر';
    const shippingAddress = modalAddress || '';

    return {
      number: orderNumber,
      createdAt: now.toISOString(),
      customerName,
      customerPhone,
      shippingAddress,
      items,
      grandTotal,
      notes: 'الأسعار لا تشمل الشحن أو الضرائب. التواصل والدفع عبر WhatsApp.',
      installCost: (typeof window.installCost !== 'undefined') ? window.installCost : null
    };
  }

  /* Render invoice using product-order-summary.html loaded natively inside an iframe */
  async function renderOrderPreview(payload) {
    if (!state.dom.orderInvoicePreview) return;

    try {
      state.dom.orderInvoicePreview.innerHTML = '';
      
      const iframe = document.createElement('iframe');
      iframe.src = 'product-order-summary.html';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.background = '#ffffff';

      iframe.onload = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          if (!doc) return;

// حقن CSS ثابت لعمل Zoom Out بنسبة 0.7 للـ Preview وتوسيط الصفحات دون المساس بأبعاد الـ PDF الحقيقية
            const styleTarget = doc.head || doc.documentElement;
            if (styleTarget && !doc.getElementById('iframe-fit-style')) {
              const fitStyle = doc.createElement('style');
              fitStyle.id = 'iframe-fit-style';
              fitStyle.textContent = `
                html, body {
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 20px 0 !important;
                  background: #f0f0f0 !important;
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                  justify-content: flex-start !important;
                  box-sizing: border-box !important;
                  overflow-x: hidden !important;
                }
                .page {
                  margin: 0 auto 5px auto !important;
                  box-shadow: 0 0 10px rgba(0,0,0,0.15) !important;
                  transform: scale(0.55) !important;
                  transform-origin: top center !important;
                  /* تعويض المساحة المفقودة نتيجة الـ scale لتجنب الفراغات الزائدة بين الصفحات */
                  margin-bottom: -480px !important; 
                }
              `;
              styleTarget.appendChild(fitStyle);
            }

          const { number } = payload;

          // Fill basic order & customer info using exact template IDs, prioritizing live input values if available
          const orderNumEl = doc.getElementById('order-number');
          if (orderNumEl) orderNumEl.textContent = number;

          const modalNameVal = state.dom.modalName ? state.dom.modalName.value.trim() : '';
          const modalPhoneVal = state.dom.modalPhone ? state.dom.modalPhone.value.trim() : '';
          const modalAddressVal = state.dom.modalAddress ? state.dom.modalAddress.value.trim() : '';
          const user = state.currentUser || {};

          const activeCustomerName = modalNameVal || payload.customerName || user.displayName || user.name || 'غير متوفر';
          const activeCustomerPhone = modalPhoneVal || payload.customerPhone || user.phoneNumber || user.phone || 'غير متوفر';
          const activeCustomerAddress = modalAddressVal || payload.shippingAddress || 'غير متوفر';

          const custNameEl = doc.getElementById('customer-name');
          if (custNameEl) custNameEl.textContent = activeCustomerName;

          const custPhoneEl = doc.getElementById('customer-phone');
          if (custPhoneEl) custPhoneEl.textContent = activeCustomerPhone;

          const custAddressEl = doc.getElementById('customer-address');
          if (custAddressEl) custAddressEl.textContent = activeCustomerAddress;

          const shippingGovEl = doc.getElementById('shipping-governorate');
          if (shippingGovEl) shippingGovEl.textContent = 'القاهرة';

          const shippingDistEl = doc.getElementById('shipping-district');
          if (shippingDistEl) shippingDistEl.textContent = 'مدينة نصر';

          // Separate custom sink units from normal products based on state
          const customItems = state.cartItems.filter(it => it.is_custom);
          const normalItems = state.cartItems.filter(it => !it.is_custom);

          const sinkSection = doc.querySelector('.sink-unit-table')?.closest('.products-section');
          const normalSection = doc.querySelector('#order-items')?.closest('.products-section');
          const shippingSec = doc.querySelector('.shipping-section');
          const totalsSec = doc.querySelector('.totals-section');

          const page1 = doc.querySelectorAll('.page')[0];
          const page2 = doc.querySelectorAll('.page')[1];

          // التعامل السليم مع الحالات الثلاث لظهور الأقسام والصفحات مع الحفاظ على قسم بيانات العميل في مكانه الصحيح بالأعلى
          if (customItems.length === 0 && normalItems.length > 0) {
            // Case 1: منتجات عادية فقط -> إخفاء وحدة الحوض، وصفحة واحدة فقط
            if (sinkSection) sinkSection.style.display = 'none';
            if (page2) page2.remove();
          } else if (customItems.length > 0 && normalItems.length === 0) {
            // Case 2: Custom Sink Unit فقط -> إخفاء المنتجات والشحن والإجماليات، صفحة واحدة فقط
            if (normalSection) normalSection.style.display = 'none';
            if (shippingSec) shippingSec.style.display = 'none';
            if (totalsSec) shippingSec.style.display = 'none';
            if (page2) page2.remove();
          } else if (customItems.length > 0 && normalItems.length > 0) {
            // Case 3: الاثنين معاً -> نقل المنتجات والشحن والإجماليات للصفحة الثانية إن وجدت أو إظهارها
            if (page2) {
              page2.style.display = 'flex';
              // تأكد من نقل أو بقاء الأقسام الصحيحة بالصفحة الثانية
              if (normalSection && !page2.contains(normalSection)) {
                page2.appendChild(normalSection);
                if (shippingSec) page2.appendChild(shippingSec);
                if (totalsSec) page2.appendChild(totalsSec);
              }
            }
            if (sinkSection && page1) {
              const customerSectionEl = page1.querySelector('.customer-section');
              if (customerSectionEl) {
                page1.insertBefore(sinkSection, customerSectionEl.nextElementSibling);
              } else {
                page1.insertBefore(sinkSection, page1.querySelector('.divider-thick')?.nextSibling || null);
              }
            }
          }

          // تحديث الترقيم الديناميكي الفعلي لجميع الصفحات الموجودة بالـ DOM
          const activePages = doc.querySelectorAll('.page');
          const totalPagesCount = activePages.length;
          activePages.forEach((p, idx) => {
            let footerText = p.querySelector('.page-number-text');
            if (!footerText) {
              footerText = doc.createElement('div');
              footerText.className = 'page-footer';
              footerText.innerHTML = `<span class="page-number-text"></span>`;
              p.appendChild(footerText);
              footerText = footerText.querySelector('.page-number-text');
            }
            footerText.textContent = `صفحة ${idx + 1} من ${totalPagesCount}`;
          });

          const designTbody = doc.getElementById('sink-design-items');
          const divisionTbody = doc.getElementById('sink-division-items');
          const handleTbody = doc.getElementById('sink-handle-items');
          const orderItemsTbody = doc.getElementById('order-items');

          let sinkSubtotalVal = 0;
          let productsSubtotalVal = 0;

          // Populate custom sink unit tables and images if custom items exist
          if (customItems.length > 0) {
            const line = customItems[0];
            const cfg = line.configuration || {};
            const unitPrice = line.unitPrice != null ? Number(line.unitPrice) : 0;
            const subtotal = unitPrice * Number(line.qty || 1);
            sinkSubtotalVal += subtotal;

            // 1. Design Table & Image
            if (designTbody) {
              designTbody.innerHTML = `
                <tr class="item-row">
                  <td class="col-section item-section">التصميم</td>
                  <td class="col-name item-name">${escapeHtml(cfg.design?.name || '—')}</td>
                  <td class="col-code item-code">${escapeHtml(cfg.design?.id || line.product_id)}</td>
                  <td class="col-color item-color">أبيض</td>
                  <td class="col-price item-price">${formatPrice(subtotal)} ج.م</td>
                </tr>
              `;
            }
            const designImgEl = doc.getElementById('design-img');
            if (designImgEl && cfg.design) {
              let desId = cfg.design.id;
              const sinkType = cfg.sinkType;
              const typeCodeMap = { 'drop-in': 'di', 'bowl': 'bw' };
              if (sinkType && typeCodeMap[sinkType]) {
                desId = desId.replace(/_wh_/, '_' + typeCodeMap[sinkType] + '_');
              }
              const GH_CONF = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
              designImgEl.src = GH_CONF + encodeURIComponent(desId) + '.webp';
              designImgEl.onerror = function() {
                this.src = GH_CONF + encodeURIComponent(desId) + '.png';
              };
            }

            // 2. Division Table & Image
            if (divisionTbody) {
              divisionTbody.innerHTML = `
                <tr class="item-row">
                  <td class="col-section item-section">التقسيمة الداخلية</td>
                  <td class="col-name item-name">${escapeHtml(cfg.division?.name || '—')}</td>
                  <td class="col-code item-code">${escapeHtml(cfg.division?.id || '—')}</td>
                  <td class="col-price item-price">0 ج.م</td>
                </tr>
              `;
            }
            const divisionImgEl = doc.getElementById('division-img');
            if (divisionImgEl && cfg.division) {
              const divId = cfg.division.id;
              const GH_CONF = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
              divisionImgEl.src = GH_CONF + encodeURIComponent(divId) + '.webp';
              divisionImgEl.onerror = function() {
                this.src = GH_CONF + encodeURIComponent(divId) + '.png';
              };
            }

            // 3. Handle Table & Image
            if (handleTbody) {
              handleTbody.innerHTML = `
                <tr class="item-row">
                  <td class="col-section item-section">نوع المقبض</td>
                  <td class="col-name item-name">${escapeHtml(cfg.handle?.name || '—')}</td>
                  <td class="col-code item-code">${escapeHtml(cfg.handle?.id || '—')}</td>
                  <td class="col-handle-priority">—</td>
                  <td class="col-handle-priority">—</td>
                  <td class="col-price item-price">0 ج.م</td>
                </tr>
              `;
            }
            const handleImgEl = doc.getElementById('handle-img');
            if (handleImgEl && cfg.handle) {
              const hndId = cfg.handle.id;
              const GH_CONF = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
              handleImgEl.src = GH_CONF + encodeURIComponent(hndId) + '.webp';
              handleImgEl.onerror = function() {
                this.src = GH_CONF + encodeURIComponent(hndId) + '.png';
              };
            }
          }

          // Populate normal products table body if normal items exist
          if (orderItemsTbody) {
            orderItemsTbody.innerHTML = '';
            for (const line of normalItems) {
              const p = state.allProducts.find(x => String(x.product_id) === String(line.product_id));
              if (!p) continue;
              const unitPrice = (p.sale_price != null && p.sale_price !== '') ? Number(p.sale_price) : Number(p.base_price || 0);
              const subtotal = unitPrice * Number(line.qty || 1);
              productsSubtotalVal += subtotal;

              const tr = doc.createElement('tr');
              tr.className = 'item-row';
              tr.innerHTML = `
                <td class="col-name item-name">${escapeHtml(p.display_name)}</td>
                <td class="col-category item-category">${escapeHtml(state.categoryMap[p.category]?.display_name || '')}</td>
                <td class="col-code item-code">${escapeHtml(p.product_id)}</td>
                <td class="col-color item-color">—</td>
                <td class="col-specs item-specs">${(p.width && p.height && p.depth) ? `${p.width}×${p.depth}×${p.height} سم` : '—'}</td>
                <td class="col-qty item-qty">${line.qty}</td>
                <td class="col-price item-price">${formatPrice(subtotal)} ج.م</td>
              `;
              orderItemsTbody.appendChild(tr);
            }
          }

          // Apply the three visibility cases cleanly by hiding/showing entire sections
          if (customItems.length > 0 && normalItems.length === 0) {
            if (sinkSection) sinkSection.style.setProperty('display', 'block', 'important');
            if (normalSection) normalSection.style.setProperty('display', 'none', 'important');
          } else if (customItems.length === 0 && normalItems.length > 0) {
            if (sinkSection) sinkSection.style.setProperty('display', 'none', 'important');
            if (normalSection) normalSection.style.setProperty('display', 'block', 'important');
          } else {
            if (sinkSection) sinkSection.style.setProperty('display', 'block', 'important');
            if (normalSection) normalSection.style.setProperty('display', 'block', 'important');
          }

          // Update subtotals and totals matching exact template IDs
          const sinkSubtotalEl = doc.getElementById('sink-unit-subtotal');
          if (sinkSubtotalEl) sinkSubtotalEl.textContent = `${formatPrice(sinkSubtotalVal)} ج.م`;

          const prodSubtotalTableEl = doc.getElementById('products-subtotal-table');
          if (prodSubtotalTableEl) prodSubtotalTableEl.textContent = `${formatPrice(productsSubtotalVal)} ج.م`;

          const sinkTotalEl = doc.getElementById('sink-unit-total');
          if (sinkTotalEl) sinkTotalEl.textContent = `${formatPrice(sinkSubtotalVal)} ج.م`;

          const prodSubtotalEl = doc.getElementById('products-subtotal');
          if (prodSubtotalEl) prodSubtotalEl.textContent = `${formatPrice(productsSubtotalVal)} ج.م`;

          const shippingCostEl = doc.getElementById('shipping-cost');
          const shippingCostVal = 200;
          if (shippingCostEl) shippingCostEl.textContent = `${formatPrice(shippingCostVal)} ج.م`;

          const inspectionCostEl = doc.getElementById('inspection-cost');
          const inspectionCostVal = 200;
          if (inspectionCostEl) inspectionCostEl.textContent = `${formatPrice(inspectionCostVal)} ج.م`;

          const orderTotalEl = doc.getElementById('order-total');
          if (orderTotalEl) {
            const totalFinal = sinkSubtotalVal + productsSubtotalVal + shippingCostVal + inspectionCostVal;
            orderTotalEl.textContent = `${formatPrice(totalFinal)} ج.م`;
          }
        } catch (innerErr) {
          console.error('Error manipulating iframe document content:', innerErr);
        }
      };

      state.dom.orderInvoicePreview.appendChild(iframe);
      state.lastPayload = payload;
    } catch (err) {
      console.error('Error initializing order preview iframe:', err);
      showToast('حدث خطأ أثناء تحميل قالب الملخص');
    }
  }

  /* Simple HTML escape for content */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Modal open/close and form population */
  function openOrderPopup() {
    if (!state.dom.orderPreviewModal) return;
    state.dom.orderPreviewModal.style.display = 'flex';
    state.dom.orderPreviewModal.setAttribute('aria-hidden', 'false');
    
    // منع الـ Scroll تماماً في الصفحة الخلفية مع الحفاظ على الموضع
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    state.dom.orderPreviewModal.dataset.scrollY = scrollY;

    // populate with current user or stored profile
    populateModalUser();

    // render preview from current cart but don't generate PDF yet
    const payload = buildOrderPayload();
    renderOrderPreview(payload);

    // disable send until PDF generated
    if (state.dom.btnSendWhatsapp) state.dom.btnSendWhatsapp.disabled = true;
    if (state.dom.btnDownloadPdf) state.dom.btnDownloadPdf.textContent = 'استخراج الملخص';

    // clear any previously generated pdf
    clearLastGeneratedPdf();
  }

  function closeOrderPopup() {
    if (!state.dom.orderPreviewModal) return;
    state.dom.orderPreviewModal.style.display = 'none';
    state.dom.orderPreviewModal.setAttribute('aria-hidden', 'true');
    
    // استعادة الـ scroll الطبيعي وموضع الصفحة الخلفية
    const scrolly = parseint(state.dom.orderpreviewmodal.dataset.scrolly || '0', 10);
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollto(0, scrolly);
  }

  function populateModalUser() {
    // if user logged in get saved profile from localStorage or use currentUser
    const user = state.currentUser;
    if (user && user.uid) {
      try {
        const raw = localStorage.getItem(CONFIG.PROFILE_PREFIX + user.uid);
        if (raw) {
          const profile = JSON.parse(raw);
          if (state.dom.modalName) state.dom.modalName.value = profile.name || user.displayName || '';
          if (state.dom.modalPhone) state.dom.modalPhone.value = profile.phone || user.phoneNumber || '';
          if (state.dom.modalAddress) state.dom.modalAddress.value = profile.address || '';
        } else {
          if (state.dom.modalName) state.dom.modalName.value = user.displayName || '';
          if (state.dom.modalPhone) state.dom.modalPhone.value = user.phoneNumber || '';
        }
      } catch (e) {
        if (state.dom.modalName) state.dom.modalName.value = user.displayName || '';
        if (state.dom.modalPhone) state.dom.modalPhone.value = user.phoneNumber || '';
      }
    } else {
      // not logged in: leave fields empty, but keep Google login button elsewhere
      if (state.dom.modalName) state.dom.modalName.value = '';
      if (state.dom.modalPhone) state.dom.modalPhone.value = '';
      if (state.dom.modalAddress) state.dom.modalAddress.value = '';
    }
  }

  function saveProfileIfLogged() {
    const user = state.currentUser;
    if (user && user.uid) {
      const profile = {
        name: state.dom.modalName ? state.dom.modalName.value.trim() : '',
        phone: state.dom.modalPhone ? state.dom.modalPhone.value.trim() : '',
        address: state.dom.modalAddress ? state.dom.modalAddress.value.trim() : ''
      };
      try {
        localStorage.setItem(CONFIG.PROFILE_PREFIX + user.uid, JSON.stringify(profile));
      } catch (e) { console.warn('Failed saving profile', e); }
    }
  }

  function clearLastGeneratedPdf() {
    if (state.lastPdfUrl) {
      try { URL.revokeObjectURL(state.lastPdfUrl); } catch (e) {}
    }
    state.lastPdfBlob = null;
    state.lastPdfUrl = null;
  }

  /* Generate PDF and open in new tab (store blob) */
  async function generatePdfAndOpen() {
    const payload = buildOrderPayload();
    // update preview to match payload
    renderOrderPreview(payload);

    // prepare element to convert
    const element = state.dom.orderInvoicePreview;
    if (!element) throw new Error('Preview element not found');

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `WODI-Order-${payload.number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    return new Promise((resolve, reject) => {
      try {
        const clone = element.cloneNode(true);
        clone.style.background = '#ffffff';
        clone.style.padding = '18px';
        const wrapper = document.createElement('div');
        wrapper.style.direction = 'rtl';
        wrapper.appendChild(clone);

        window.html2pdf().from(wrapper).set(opt).toPdf().get('pdf').then(function (pdf) {
          try {
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            // store in state
            state.lastPdfBlob = blob;
            state.lastPdfUrl = url;
            state.lastPayload = payload;
            // open in new tab
            window.open(url, '_blank');
            resolve({ blob, url });
          } catch (err) {
            reject(err);
          }
        }).catch(err => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }

  /* Try to share file with Web Share API; fallback to wa.me with text */
  async function shareOrOpenWhatsAppWithPdf() {
    if (!state.lastPdfBlob) {
      showToast('الرجاء استخراج الملخص أولاً');
      return;
    }

    // Save profile if logged
    saveProfileIfLogged();

    // Try Web Share API with files (mobile)
    const file = new File([state.lastPdfBlob], `WODI-Order-${state.lastPayload.number}.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `طلب WODI ${state.lastPayload.number}`,
          text: `ملخص طلب رقم ${state.lastPayload.number} — ${formatPrice(state.lastPayload.grandTotal)} EGP`,
          files: [file]
        });
        return;
      } catch (e) {
        console.warn('navigator.share failed', e);
        // fallback below
      }
    }

    // fallback: open wa.me with text and instruct user to attach file manually
    const msgLines = [
      `مرحباً، هذا ملخص طلب جديد من WODI.`,
      `رقم الطلب: ${state.lastPayload.number}`,
      `الاسم: ${state.lastPayload.customerName}`,
      `الهاتف: ${state.lastPayload.customerPhone}`,
      `إجمالي الطلب: ${formatPrice(state.lastPayload.grandTotal)} EGP`,
      `الملف جاهز للتحميل ويفضل إرفاقه مع الرسالة.`,
      `شكراً.`
    ];
    const waUrl = `https://wa.me/${CONFIG.WA_NUMBER}?text=${encodeURIComponent(msgLines.join('\n'))}`;
    const newWindow = window.open(waUrl, '_blank');
    if (!newWindow) {
      showToast('تعذّر فتح WhatsApp، تأكد من إعداد المتصفح للسماح بالفتح في نوافذ جديدة.');
    }
  }

  /* Handler for popup Generate Summary button (opens PDF preview) */
  async function handleGeneratePopupPdf() {
    try {
      // Save profile optionally
      saveProfileIfLogged();

      // generate PDF and open in new tab (if not already generated)
      if (!state.lastPdfUrl) {
        await generatePdfAndOpen();
      } else {
        // already generated: open
        window.open(state.lastPdfUrl, '_blank');
      }

      // enable send button
      if (state.dom.btnSendWhatsapp) state.dom.btnSendWhatsapp.disabled = !state.lastPdfBlob;
      if (state.dom.btnDownloadPdf) state.dom.btnDownloadPdf.textContent = 'رؤية الملخص';

      showToast('تم إنشاء ملف PDF - افتح النافذة الجديدة لمراجعته');
    } catch (e) {
      console.error(e);
      showToast('فشل إنشاء ملف PDF');
    }
  }

  /* Modal opener used by cart generate and configurator (callable externally) */
  window.openOrderPopup = function () {
    openOrderPopup();
  };

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

  // Expose some functions for debugging/other scripts
  window.WODICart = {
    getCart: () => state.cartItems,
    getTotals: computeCartTotals,
    rebuildFromStorage: () => { state.cartItems = getLocalCart() || []; renderCart(); updateCounter(); },
    openOrderPopup: openOrderPopup
  };

  // Attach small global handler for popup generate button id
  // (the cart HTML button has id "btn-generate-popup-pdf")
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-generate-popup-pdf') {
      e.preventDefault();
      handleGeneratePopupPdf();
    }
  });

})();