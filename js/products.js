/* منتجات - products.js (مُحدّث)
   - يقرأ حقل availability من بيانات الشيت
   - يعرض مؤشر الحالة (متاح/غير متاح) مع دائرة ملونة
   - يضيف روابط wishlist.html و cart.html للأيقونات
   - يستخدم DOM-safe rendering عبر createElement
*/

(function () {
  'use strict';

  /* ===========================
     Configuration & Constants
     =========================== */
  const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password",
    WA_NUMBER: '201556840368',
    GH_IMAGES_BASE: 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/products/',
    CACHE_KEY: 'wodi_products_cache',
    CACHE_TTL_MS: 1000 * 60 * 30,
    DEBOUNCE_MS: 220,
    CATEGORY_NAMES_FALLBACK: {
      '4d': 'وحدات الغسالة',
      '4e': 'وحدات المراية',
      '4f': 'وحدات التخزين',
      '4g': 'وحدات التواليت'
    }
  };

  /* (categoryIcons ... كما كانت) */
  const categoryIcons = {
    'all': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    '4d': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h3"/><path d="M17 6h.01"/><rect x="3" y="2" width="18" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5"/></svg>',
    '4e': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6 8 9"/><path d="m16 7-8 8"/><rect x="4" y="2" width="16" height="20" rx="2"/></svg>',
    '4f': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/><path d="M16 20v-3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/><path d="M20 22V2"/><path d="M4 12h16"/><path d="M4 20h16"/><path d="M4 2v20"/><path d="M4 4h16"/></svg>',
    '4g': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/></svg>'
  };

  /* ===========================
     State & Helpers
     =========================== */
  const state = {
    products: [],
    categories: [],
    categoryMap: {},
    counts: {},
    currentCat: getCategoryFromURL(),
    currentPage: 1,
    productsPerPage: 6,
    dom: {}
  };

  function getCategoryFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('category') || 'all';
    } catch (e) {
      return 'all';
    }
  }

  function normalizeArabic(text) {
    if (!text) return '';
    return String(text).toLowerCase().trim()
      .replace(/\u0640/g, '')
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[\u064b-\u065f]/g, '');
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  function formatPrice(num) {
    if (num == null || isNaN(num)) return '';
    return Math.round(num).toLocaleString('en-US');
  }

  function safeImageFallback(imgEl, fallbackSrc) {
    try { if (!imgEl) return; imgEl.onerror = null; imgEl.src = fallbackSrc; } catch {}
  }

  function openSearchDropdown() {
    const dd = state.dom.searchDropdown, b = state.dom.searchBackdrop;
    if (dd) dd.style.display = 'flex';
    if (b) b.style.display = 'block';
  }
  function closeSearchDropdown() {
    const dd = state.dom.searchDropdown, b = state.dom.searchBackdrop;
    if (dd) dd.style.display = 'none';
    if (b) b.style.display = 'none';
  }

  /* ===========================
     Data load & process
     =========================== */

  function loadCache() {
    try {
      const raw = sessionStorage.getItem(CONFIG.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.timestamp || !parsed.data) return null;
      if ((Date.now() - parsed.timestamp) > CONFIG.CACHE_TTL_MS) { sessionStorage.removeItem(CONFIG.CACHE_KEY); return null; }
      return parsed.data;
    } catch (e) { return null; }
  }
  function saveCache(data) {
    try { sessionStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); } catch (e) {}
  }

  async function fetchData() {
    const res = await fetch(CONFIG.API_URL, { cache: 'no-cache' });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Failed: ${res.status} ${res.statusText} ${txt}`);
    }
    return res.json();
  }

  function processData(raw) {
    const productsRaw = Array.isArray(raw.products) ? raw.products : [];
    const catsRaw = Array.isArray(raw.categories) ? raw.categories : [];
    state.products = [];
    state.categories = catsRaw.slice();
    state.categoryMap = {};
    state.counts = {};
    state.categories.forEach(c => { state.categoryMap[c.category_id] = c; state.counts[c.category_id] = 0; });
    state.counts.all = 0;

    for (const p of productsRaw) {
      try {
        const product_id = String(p.product_id || '').trim();
        const display_name = String(p.display_name || '').trim();
        const category = String(p.category || '').trim();
        const base_price = p.base_price != null ? Number(p.base_price) : 0;
        const sale_price = (p.sale_price !== undefined && p.sale_price !== '') ? Number(p.sale_price) : null;
        const visible = (p.visible === undefined) ? true : Boolean(p.visible);

        // availability: accept boolean true/false or string "TRUE"/"FALSE"
        let isAvailable = false;
        if (p.availability === true || p.availability === 'TRUE' || String(p.availability).toLowerCase() === 'true') isAvailable = true;

        const normalizedName = normalizeArabic(display_name);
        const normalizedId = normalizeArabic(product_id);

        const processed = Object.assign({}, p, {
          product_id,
          display_name,
          category,
          base_price,
          sale_price,
          priceNumber: sale_price != null ? sale_price : base_price,
          isVisible: visible,
          normalizedName,
          normalizedId,
          isFeatured: Boolean(p.featured),
          isNew: Boolean(p.new),
          isAvailable
        });

        if (processed.isVisible) { state.counts.all += 1; if (processed.category) state.counts[processed.category] = (state.counts[processed.category] || 0) + 1; }
        state.products.push(processed);
      } catch (err) {
        console.warn('Skipping malformed product', p, err);
      }
    }

    saveCache({ products: state.products, categories: state.categories });
  }

  /* ===========================
     Rendering
     =========================== */

  function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function renderCategories() {
    const container = state.dom.catScroll; if (!container) return;
    clearChildren(container);

    const createBtn = (id, label, count) => {
      const btn = document.createElement('button');
      btn.className = 'cat-grid-item' + (state.currentCat === id ? ' active' : '');
      btn.type = 'button';
      btn.dataset.cat = id;
      const icon = document.createElement('span'); icon.className = 'cat-icon'; icon.innerHTML = categoryIcons[id] || categoryIcons.all;
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(label));
      const cnt = document.createElement('span'); cnt.className = 'cat-count'; cnt.textContent = `(${count || 0})`;
      btn.appendChild(cnt);
      return btn;
    };

    container.appendChild(createBtn('all', 'الكل', state.counts.all));
    state.categories.sort((a,b) => (Number(a.order)||0)-(Number(b.order)||0)).forEach(cat => {
      container.appendChild(createBtn(cat.category_id, cat.display_name || cat.category_id, state.counts[cat.category_id] || 0));
    });

    initCategoryScroll();

  }

  function updateCategoryHeader() {
    const titleEl = state.dom.currentCategoryTitle, bc = state.dom.currentBreadcrumbCat;
    const catName = (state.currentCat === 'all') ? 'جميع المنتجات' : (state.categoryMap[state.currentCat]?.display_name || CONFIG.CATEGORY_NAMES_FALLBACK[state.currentCat] || state.currentCat);
    if (titleEl) titleEl.textContent = catName;
    if (bc) bc.textContent = catName;
  }

function renderProducts() {
  const container = state.dom.prodList;
  if (!container) return;

  clearChildren(container);

  const filtered = state.products
    .filter(p =>
      p.isVisible &&
      (state.currentCat === 'all' || p.category === state.currentCat)
    )
    .sort((a, b) => {
      const featuredA = a.isFeatured ? 1 : 0;
      const featuredB = b.isFeatured ? 1 : 0;

      if (featuredB !== featuredA) {
        return featuredB - featuredA;
      }

      const newA = a.isNew ? 1 : 0;
      const newB = b.isNew ? 1 : 0;

      return newB - newA;
    });


  if (filtered.length === 0) {
    const e = document.createElement('p');
    e.className = 'prod-empty';
    e.textContent = 'لا توجد منتجات متاحة حالياً في هذه الفئة.';
    container.appendChild(e);
    return;
  }

  const totalPages = Math.ceil(filtered.length / state.productsPerPage);

  // التأكد إن الصفحة الحالية ما خرجتش عن النطاق
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  const startIndex =
    (state.currentPage - 1) * state.productsPerPage;

  const endIndex =
    startIndex + state.productsPerPage;

  const paginatedProducts = filtered.slice(startIndex, endIndex);

  const productsWrapper = document.createElement('div');
  productsWrapper.className = 'products-wrapper';

  for (let i = 0; i < paginatedProducts.length; i++) {
    const p = paginatedProducts[i];

    const card = document.createElement('article');
    card.className = 'prod-card';
    card.dataset.prod = p.product_id;
    card.dataset.cat = p.category || '';
    card.tabIndex = 0;

    // IMAGE COLUMN
    const imgCol = document.createElement('div');
    imgCol.className = 'prod-img-col';

    // BADGES
    const badgesRow = document.createElement('div');
    badgesRow.className = 'prod-badges-row';

    if (p.isFeatured) {
      const b = document.createElement('span');
      b.className = 'prod-badge featured';
      b.textContent = 'الأكثر مبيعاً';
      badgesRow.appendChild(b);
    }

    if (p.isNew) {
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
    img.alt = p.display_name || '';
    img.loading = 'lazy';
    img.src = `${CONFIG.GH_IMAGES_BASE}${p.product_id}_1.webp`;

    img.onerror = function () {
      safeImageFallback(
        this,
        `${CONFIG.GH_IMAGES_BASE}${p.product_id}.webp`
      );
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
    nameEl.textContent = p.display_name;

    const catTag = document.createElement('div');
    catTag.className = 'prod-cat-tag';
    catTag.textContent =
      state.categoryMap[p.category]?.display_name || '';

    const head = document.createElement('div');
    head.className = 'prod-head';
    head.appendChild(nameEl);

    let sizeEl = null;

    if (p.width && p.height && p.depth) {
      sizeEl = document.createElement('div');
      sizeEl.className = 'prod-size';
      sizeEl.textContent =
        `${p.width} × ${p.depth} × ${p.height} سم`;
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
      p.sale_price != null
        ? p.sale_price
        : p.base_price
    );

    newPrice.appendChild(currency);
    newPrice.appendChild(value);

    priceArea.appendChild(newPrice);

    if (p.sale_price != null && p.sale_price !== '') {
      const old = document.createElement('span');
      old.className = 'old-price';
      old.textContent = `${formatPrice(p.base_price)} EGP`;
      priceArea.appendChild(old);
    }

    // ACTIONS
    const actions = document.createElement('div');
    actions.className = 'prod-actions';

    const avail = document.createElement('div');
    avail.className = 'prod-availability';

    const dot = document.createElement('span');
    dot.className =
      'avail-dot ' +
      (p.isAvailable ? 'available' : 'unavailable');

    const txt = document.createElement('span');
    txt.className = 'avail-text';
    txt.textContent =
      p.isAvailable ? 'متاح' : 'غير متاح';

    avail.appendChild(dot);
    avail.appendChild(txt);

    const cartLink = document.createElement('a');
    cartLink.className = 'prod-cart-btn';
    cartLink.href = 'cart.html';
    cartLink.setAttribute(
      'aria-label',
      'اذهب إلى السلة'
    );
    cartLink.title =
      'أضف إلى السلة / انتقل إلى السلة';

    cartLink.innerHTML =
      '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

    // تغيير بسيط: اجعل أيقونة السلة تنفّذ إضافة للسلة قبل الانتقال إلى صفحة السلة
    cartLink.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (window.addToCart && typeof window.addToCart === 'function') {
        window.addToCart(p.product_id, 1);
      }
      // ثم اذهب إلى صفحة السلة
      window.location.href = 'cart.html';
    });
    
    const wishLink = document.createElement('button');
    wishLink.className = 'prod-wishlist-btn';
    wishLink.type = 'button';
    wishLink.setAttribute(
      'aria-label',
      'القائمة المفضلة'
    );
    wishLink.title = 'قائمة الرغبات';

    wishLink.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5 5 0 0 0-7.07 0L12 6.3l-1.73-1.7a5 5 0 0 0-7.07 7.07L12 21.3l8.8-8.8a5 5 0 0 0 0-7.9z"></path></svg>';

    wishLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(p.product_id, wishLink);
    });

    const actionButtons = document.createElement('div');
    actionButtons.className =
      'prod-action-buttons';

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
        `product-detail.html?id=${encodeURIComponent(
          p.product_id
        )}`;
    });

    productsWrapper.appendChild(card);
  }

  container.appendChild(productsWrapper);

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = state.dom.prodList;
  if (!container) return;

  const oldPagination = container.querySelector('.products-pagination');
  if (oldPagination) oldPagination.remove();

  const oldInfo = container.querySelector('.products-page-info');
  if (oldInfo) oldInfo.remove();

  const filtered = state.products.filter(
    p =>
      p.isVisible &&
      (state.currentCat === 'all' || p.category === state.currentCat)
  );

  const totalProducts = filtered.length;

  const startIndex =
    (state.currentPage - 1) * state.productsPerPage + 1;

  const endIndex = Math.min(
    state.currentPage * state.productsPerPage,
    totalProducts
  );

  const info = document.createElement('div');
  info.className = 'products-page-info';
  info.textContent = `عرض ${startIndex}–${endIndex} من ${totalProducts} منتج`;

  container.appendChild(info);

  if (totalPages <= 1) return;

  const pagination = document.createElement('nav');
  pagination.className = 'products-pagination';
  pagination.setAttribute('aria-label', 'صفحات المنتجات');

  const createButton = (label, page, disabled = false, extraClass = '') => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className =
      `pagination-btn ${extraClass}`.trim();

    button.textContent = label;
    button.disabled = disabled;

    if (page === state.currentPage) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }

    button.addEventListener('click', () => {
      if (page === state.currentPage) return;

      state.currentPage = page;
      renderProducts();

      container.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });

    return button;
  };

  // Previous
  pagination.appendChild(
    createButton(
      '‹',
      state.currentPage - 1,
      state.currentPage === 1,
      'pagination-prev'
    )
  );

  // Page numbers
  for (let page = 1; page <= totalPages; page++) {
    pagination.appendChild(
      createButton(
        String(page),
        page,
        false
      )
    );
  }

  // Next
  pagination.appendChild(
    createButton(
      '›',
      state.currentPage + 1,
      state.currentPage === totalPages,
      'pagination-next'
    )
  );

  container.appendChild(pagination);
}

  /* ===========================
     Interaction handlers
     =========================== */

  function initCategoryScroll() {
    const container = document.getElementById('cat-scroll');
    const rightArrow = document.getElementById('cat-arrow-right');
    const leftArrow = document.getElementById('cat-arrow-left');

    if (!container || !rightArrow || !leftArrow) return;

    const updateArrows = () => {
      const maxScroll = container.scrollWidth - container.clientWidth;

      const atStart = Math.abs(container.scrollLeft) < 2;
      const atEnd = Math.abs(Math.abs(container.scrollLeft) - maxScroll) < 2;

      rightArrow.classList.toggle('hidden', atStart);
      leftArrow.classList.toggle('hidden', atEnd);
    };

    rightArrow.addEventListener('click', () => {
      container.scrollBy({
        left: 300,
        behavior: 'smooth'
      });
    });

    leftArrow.addEventListener('click', () => {
      container.scrollBy({
        left: -300,
        behavior: 'smooth'
      });
    });

    container.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);

    updateArrows();
  }

  function filterCat(catId) {
    state.currentCat = catId || 'all';
    state.dom.catScroll.querySelectorAll('.cat-grid-item').forEach(btn => btn.classList.toggle('active', btn.dataset.cat === state.currentCat));
    updateCategoryHeader();
    renderProducts();
    closeSearchDropdown();
  }

  function contactWA(productId) {
    const p = state.products.find(x => x.product_id === productId);
    const name = p ? p.display_name : productId;
    const priceText = p ? `${formatPrice(p.priceNumber)} EGP` : '';
    const msg = `السلام عليكم، أرغب في الاستفسار عن:\n${name}\nالسعر: ${priceText}`;
    window.open(`https://wa.me/${CONFIG.WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  }


  // Wishlist integration
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

  function updateWishlistButtonStates() {
    document.querySelectorAll('.prod-wishlist-btn').forEach(btn => {
      const card = btn.closest('.prod-card');
      if (!card) return;
      const productId = card.dataset.prod;
      const isInWishlist = window.isInWishlist && window.isInWishlist(productId);

      if (isInWishlist) {
        btn.classList.add('active');
        btn.querySelector('svg').style.fill = 'currentColor';
      } else {
        btn.classList.remove('active');
        btn.querySelector('svg').style.fill = 'none';
      }
    });
  }


  /* ===========================
     Init & lifecycle
     =========================== */

  function cacheDOM() {
    state.dom.prodList = document.getElementById('prod-list');
    state.dom.catScroll = document.getElementById('cat-scroll');
    state.dom.currentCategoryTitle = document.getElementById('current-category-title');
    state.dom.currentBreadcrumbCat = document.getElementById('current-breadcrumb-cat');
    state.dom.productSearchInput = document.getElementById('product-search-input');
    state.dom.searchDropdown = document.getElementById('search-dropdown');
    state.dom.searchBackdrop = document.getElementById('search-backdrop');
    state.dom.searchSuggestionsList = document.getElementById('search-suggestions-list');
    state.dom.searchProductsGrid = document.getElementById('search-products-grid');
    state.dom.prodLb = document.getElementById('prod-lb');
    state.dom.prodLbImg = document.getElementById('prod-lb-img');
  }

  function setupEventHandlers() {
    // categories delegation
    state.dom.catScroll.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.cat-grid-item');
      if (!btn) return;
      filterCat(btn.dataset.cat);
    });

    // search input with debounce
    if (state.dom.productSearchInput) {
      const deb = debounce((e) => { renderSearchResults(e.target.value || ''); if (e.target.value.trim()) openSearchDropdown(); }, CONFIG.DEBOUNCE_MS);
      state.dom.productSearchInput.addEventListener('input', deb);
      state.dom.productSearchInput.addEventListener('focus', openSearchDropdown);
    }

    // suggestion clicks delegated
    if (state.dom.searchSuggestionsList) {
      state.dom.searchSuggestionsList.addEventListener('click', (ev) => {
        const item = ev.target.closest('.suggestion-item'); if (!item) return;
        const cat = item.dataset.cat; if (cat) { filterCat(cat); closeSearchDropdown(); }
      });
    }

    // search products click -> detail
    if (state.dom.searchProductsGrid) {
      state.dom.searchProductsGrid.addEventListener('click', (ev) => {
        const card = ev.target.closest('.search-product-card'); if (!card) return;
        window.location.href = `product-detail.html?id=${encodeURIComponent(card.dataset.prod)}`;
      });
    }

    // search backdrop click
    if (state.dom.searchBackdrop) state.dom.searchBackdrop.addEventListener('click', closeSearchDropdown);

    // lightbox close handlers
    if (state.dom.prodLb) {
      state.dom.prodLb.addEventListener('click', (ev) => {
        const closeBtn = ev.target.closest('.product-lightbox-close');
        if (closeBtn || ev.target === state.dom.prodLb) closeLB();
      });
    }

    // global escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { closeSearchDropdown(); closeLB(); }
    });
  }

  async function loadAndRender() {
    const container = state.dom.prodList;
    if (container) container.innerHTML = '<p>جاري تحميل المنتجات...</p>';

    const cached = loadCache();
    if (cached && cached.products && cached.categories) {
      state.products = cached.products;
      state.categories = cached.categories;
      state.categoryMap = {}; state.categories.forEach(c=>state.categoryMap[c.category_id] = c);
      state.counts = { all: 0 }; state.products.forEach(p=>{ if (p.isVisible) { state.counts.all +=1; if (p.category) state.counts[p.category] = (state.counts[p.category]||0)+1; }});
      renderCategories(); updateCategoryHeader(); renderProducts(); updateWishlistButtonStates();

      // background refresh (non-blocking)
      fetchData().then(raw => { try { processData(raw); renderCategories(); updateCategoryHeader(); renderProducts(); updateWishlistButtonStates(); } catch(e){} }).catch(()=>{});
      return;
    }

    try {
      const raw = await fetchData();
      processData(raw);
      renderCategories(); updateCategoryHeader(); renderProducts(); updateWishlistButtonStates();
    } catch (err) {
      console.error('Failed to load products:', err);
      if (container) container.innerHTML = '<p>فشل تحميل المنتجات. حاول إعادة التحميل لاحقًا.</p>';
    }
  }

  function renderSearchResults(query) {
    // reuse previous implementation (keeps suggestion + results rendering)
    // for brevity here, call existing function if present (in your original code it's implemented)
    // but ensure it's present; re-using earlier implementation from your codebase.
    // If not present, the previous renderSearchResults function in file will be used.
    if (typeof window.renderSearchResultsFallback === 'function') {
      window.renderSearchResultsFallback(query);
    } else {
      // minimal fallback: clear and show hint
      if (state.dom.searchSuggestionsList) { state.dom.searchSuggestionsList.innerHTML = '<div style="padding:10px;color:#888;text-align:center;">ابحث عن فئة أو منتج...</div>'; }
      if (state.dom.searchProductsGrid) { state.dom.searchProductsGrid.innerHTML = ''; }
    }
  }

  function init() {
    cacheDOM();
    showInitialCategoryTitle();
    setupEventHandlers();
    loadAndRender();
  }

  function showInitialCategoryTitle() {
    const titleEl = state.dom.currentCategoryTitle, bc = state.dom.currentBreadcrumbCat;
    const name = (state.currentCat === 'all') ? 'جميع المنتجات' : (CONFIG.CATEGORY_NAMES_FALLBACK[state.currentCat] || 'جاري التحميل...');
    if (titleEl) titleEl.textContent = name;
    if (bc) bc.textContent = name;
  }

  // start
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Compatibility API: allow other scripts to call addToCart even if cart module not yet loaded.
  // Products.js: ضع هذا بعد تعريف window.WODIProducts أو في نفس مكان expose API.
  window.addToCart = function (productId, qty = 1) {
    if (window.addToCartGlobal && typeof window.addToCartGlobal === 'function') {
      return window.addToCartGlobal(productId, qty);
    }
    // إذا لم توجد واجهة cart بعد، يمكن تخزين id مؤقتًا أو فتح صفحة السلة
    return null;
  };
 
  // expose limited API
  window.WODIProducts = { filterCat: (c)=>filterCat(c), openLB: (s,a)=>openLB(s,a), closeLB: ()=>closeLB() };

  // Lightbox helpers kept (openLB/closeLB)
  function openLB(src, alt) {
    const lb = state.dom.prodLb, img = state.dom.prodLbImg;
    if (lb && img) { img.src = src || ''; img.alt = alt || ''; lb.style.display = 'flex'; lb.setAttribute('aria-hidden','false'); }
  }
  function closeLB() { const lb = state.dom.prodLb; if (lb) { lb.style.display = 'none'; lb.setAttribute('aria-hidden','true'); } }

})();