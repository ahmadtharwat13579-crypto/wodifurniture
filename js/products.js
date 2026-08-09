const API_URL = "https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password";
const WA = '201556840368';
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/products/';

const categoryIcons = {
  'all': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  '4d': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h3"/><path d="M17 6h.01"/><rect x="3" y="2" width="18" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5"/></svg>',
  '4e': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6 8 9"/><path d="m16 7-8 8"/><rect x="4" y="2" width="16" height="20" rx="2"/></svg>',
  '4f': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/><path d="M16 20v-3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/><path d="M20 22V2"/><path d="M4 12h16"/><path d="M4 20h16"/><path d="M4 2v20"/><path d="M4 4h16"/></svg>',
  '4g': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/></svg>'
};

let products = [];
let categories = [];
let categoryMap = {};

function getCategoryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('category') || 'all';
}

let currentCat = getCategoryFromURL();

// نسخة احتياطية سريعة لأسماء الفئات - تستخدم بس للعرض الفوري وقت التحميل
const CATEGORY_NAMES_FALLBACK = {
  '4d': 'وحدات الغسالة',
  '4e': 'وحدات المراية',
  '4f': 'وحدات التخزين',
  '4g': 'وحدات التواليت'
};

// عرض فوري لاسم الفئة من الرابط، قبل ما بيانات الشيت توصل
function showInitialCategoryTitle() {
  const titleEl = document.getElementById('current-category-title');
  const breadcrumbCatEl = document.getElementById('current-breadcrumb-cat');

  const initialName = (currentCat === 'all')
    ? 'جميع المنتجات'
    : (CATEGORY_NAMES_FALLBACK[currentCat] || 'جاري التحميل...');

  if (titleEl) titleEl.textContent = initialName;
  if (breadcrumbCatEl) breadcrumbCatEl.textContent = initialName;
}

showInitialCategoryTitle(); // نفّذها فورًا وقت تحميل الملف

// Lightbox
function openLB(src) {
  const lbImg = document.getElementById('prod-lb-img');
  const lb = document.getElementById('prod-lb');
  if (lbImg && lb) {
    lbImg.src = src;
    lb.style.display = 'flex';
  }
}

function closeLB() {
  const lb = document.getElementById('prod-lb');
  if (lb) lb.style.display = 'none';
}

let searchQuery = "";

// فتح القائمة المنسدلة
function openSearchDropdown() {
  const dropdown = document.getElementById('search-dropdown');
  const backdrop = document.getElementById('search-backdrop');
  if (dropdown && backdrop) {
    dropdown.style.display = 'flex';
    backdrop.style.display = 'block';
  }
}

// قفل القائمة المنسدلة
function closeSearchDropdown() {
  const dropdown = document.getElementById('search-dropdown');
  const backdrop = document.getElementById('search-backdrop');
  if (dropdown) dropdown.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
}

// دالة لتنظيف وتوحيد الحروف العربية لتجاهل الأخطاء الإملائية والهمزات
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    // توحيد الألفات (أ, إ, آ -> ا)
    .replace(/[أإآا]/g, 'ا')
    // توحيد الهاء والتاء المربوطة (ة -> ه)
    .replace(/ة/g, 'ه')
    // توحيد الياء والألف المقصورة (ى -> ي)
    .replace(/ى/g, 'ي')
    // إزالة التشكيل لو موجود
    .replace(/[\u064b-\u065f]/g, '');
}

// دالة البحث المتقدم المحدثة (تدعم البحث الاستباقي وتوقع الأخطاء الإملائية)
function handleAdvancedSearch(query) {
  openSearchDropdown();
  const rawQuery = query.trim();
  const q = normalizeArabic(rawQuery); // تنظيف كلمة البحث
  
  const suggestionsEl = document.getElementById('search-suggestions-list');
  const productsEl = document.getElementById('search-products-grid');

  if (!rawQuery) {
    suggestionsEl.innerHTML = '<div style="padding: 10px; color: #888; font-size: 13px; text-align: center;">ابحث عن فئة أو منتج...</div>';
    productsEl.innerHTML = '';
    return;
  }

  // 1. فلترة الفئات (بتوقع الأخطاء الإملائية والهمزات)
  const matchedCategories = categories.filter(c => {
    const normalizedCategoryName = normalizeArabic(c.display_name);
    return normalizedCategoryName.includes(q);
  });

  let suggestionsHtml = '';
  matchedCategories.forEach(cat => {
    const iconSvg = categoryIcons[cat.category_id] || categoryIcons['all'];

    suggestionsHtml += `
      <div class="suggestion-item" onclick="filterCat('${cat.category_id}'); closeSearchDropdown();">
        <div class="suggestion-right">
          <span class="suggestion-icon">${iconSvg}</span>
          <span>${cat.display_name}</span>
        </div>
        <svg class="suggestion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;
  });
  
  suggestionsEl.innerHTML = suggestionsHtml || '<div style="padding: 8px; color: #aaa; font-size: 13px;">لا توجد فئات مطابقة</div>';

  // 2. فلترة المنتجات (بتوقع الأخطاء الإملائية والهمزات)
  const matchedProducts = products.filter(p => {
    if (!p.visible) return false;
    const normalizedName = normalizeArabic(p.display_name);
    const normalizedId = normalizeArabic(p.product_id || '');
    return normalizedName.includes(q) || normalizedId.includes(q);
  });

  let productsHtml = '';
  matchedProducts.forEach(p => {
    const basePrice = Math.round(p.base_price || 0).toLocaleString('en-US');
    const salePrice = p.sale_price && p.sale_price !== '' ? Math.round(p.sale_price).toLocaleString('en-US') : null;
    const priceDisplay = salePrice ? salePrice : basePrice;
    const imgSrc = GH + p.product_id + '_1.webp';

    productsHtml += `
      <div class="search-product-card" onclick="location.href='product-detail.html?id=${p.product_id}'">
        <img class="search-product-img" src="${imgSrc}" alt="${p.display_name}" onerror="this.src='${GH + p.product_id}.webp'">
        <div class="search-product-info">
          <div class="search-product-name">${p.display_name}</div>
          <div class="search-product-price">EGP ${priceDisplay}</div>
        </div>
      </div>
    `;
  });

  // حالة "لا توجد نتائج" ذكية ومريحة للعميل
  if (matchedCategories.length === 0 && matchedProducts.length === 0) {
    productsHtml = `
      <div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">
        <p style="margin-bottom: 8px;">عذراً، لم نجد نتائج مطابقة لـ "${rawQuery}"</p>
        <a href="https://wa.me/20YOUR_PHONE_NUMBER" target="_blank" style="color: #2e7d32; font-weight: bold; text-decoration: underline; display: inline-block; margin-top: 5px;">
          مش لاقي اللي بتدور عليه؟ استفسر عبر واتساب
        </a>
      </div>
    `;
  }

  productsEl.innerHTML = productsHtml;
}

function contactWA(productId, name, price) {
  const msg = 'السلام عليكم، أرغب في الاستفسار عن:\n' + name + '\nالسعر: ' + price + ' EGP';
  window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank');
}

function renderIcon(catId) {
  const icon = categoryIcons[catId] || '';
  if (icon.trim().startsWith('<svg')) {
    return icon; // SVG جاهز، يترجع زي ما هو
  }
  return `<img src="${icon}" alt="">`; // مسار صورة، يتلف في img tag
}

function countByCategory(catId) {
  if (catId === 'all') return products.filter(p => p.visible).length;
  return products.filter(p => p.visible && p.category === catId).length;
}

function renderCategories() {
  const container = document.getElementById('cat-scroll');
  if (!container) return;

  let html = `
    <button class="cat-grid-item ${currentCat === 'all' ? 'active' : ''}" data-cat="all" onclick="filterCat('all')">
      <span class="cat-icon">${renderIcon('all')}</span>
      الكل
      <span class="cat-count">(${countByCategory('all')})</span>
    </button>
  `;

  categories.sort((a, b) => a.order - b.order).forEach(cat => {
    const isActive = currentCat === cat.category_id ? 'active' : '';
    html += `
      <button class="cat-grid-item ${isActive}" data-cat="${cat.category_id}" onclick="filterCat('${cat.category_id}')">
        <span class="cat-icon">${renderIcon(cat.category_id)}</span>
        ${cat.display_name}
        <span class="cat-count">(${countByCategory(cat.category_id)})</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function filterCat(cat) {
  currentCat = cat;

  document.querySelectorAll('#cat-scroll .cat-grid-item').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = document.querySelector(`#cat-scroll .cat-grid-item[data-cat="${cat}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  renderProducts();
}

function renderProducts() {
  const container = document.getElementById('prod-list');
  if (!container) return;

  const titleEl = document.getElementById('current-category-title');
  const breadcrumbCatEl = document.getElementById('current-breadcrumb-cat');

  const categoryName = (currentCat === 'all') ? 'جميع المنتجات' : (categoryMap[currentCat]?.display_name || currentCat);

  if (titleEl) titleEl.textContent = categoryName;
  if (breadcrumbCatEl) breadcrumbCatEl.textContent = categoryName;

  let html = '';

  products
    .filter(p => p.visible && (currentCat === 'all' || p.category === currentCat)) // تم إضافة الفلترة هنا
    .forEach((p, index) => {
      const catId = p.category || '';
      const imgSrc = GH + p.product_id + '_1.webp';
      const catName = categoryMap[catId]?.display_name || '';

      const basePrice = Math.round(p.base_price || 0).toLocaleString('en-US');
      const salePrice = p.sale_price && p.sale_price !== '' ? Math.round(p.sale_price).toLocaleString('en-US') : null;
      const priceText = `${salePrice || basePrice} EGP`;

let priceHtml = salePrice
  ? `<div class="prod-price"><span class="new-price">${salePrice} EGP</span><span class="old-price">${basePrice} EGP</span></div>`
  : `<div class="prod-price"><span class="new-price">${basePrice} EGP</span></div>`;

      const hasDims = p.width && p.height && p.depth;
      const sizeHtml = hasDims
        ? `<div class="prod-size">${p.width} × ${p.depth} × ${p.height} سم</div>`
        : '';

      const badges = [];
      if (p.featured) badges.push(`<span class="prod-badge featured">الأكثر طلبًا</span>`);
      if (p.new) badges.push(`<span class="prod-badge new">جديد</span>`);

      html += `
        <div class="prod-card" data-cat="${catId}" onclick="location.href='product-detail.html?id=${p.product_id}'">
          <div class="prod-img-col">
            <div class="prod-img-wrap">
              <img class="prod-img" src="${imgSrc}" alt="${p.display_name}" onerror="this.src='${GH + p.product_id}.webp'">
            </div>
            <div class="prod-dots">
              <span class="active"></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div class="prod-body">
            <div class="prod-header">
              <div class="prod-badges">${badges.join("")}</div>
              <div class="prod-name">${p.display_name}</div>
            </div>
            <div class="prod-cat-tag">${catName}</div>
            ${sizeHtml}
            
            <div class="prod-footer-area">
              ${priceHtml}
              <div class="prod-actions">
                <button class="btn-order" onclick="event.stopPropagation(); contactWA('${p.product_id}','${p.display_name}','${priceText}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  استفسر عبر واتساب
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });

  container.innerHTML = html || '<p class="prod-empty">لا توجد منتجات متاحة حالياً في هذه الفئة.</p>';
}


async function loadData() {
  const container = document.getElementById('prod-list');

  const cached = sessionStorage.getItem('wodi_products_cache');
  if (cached) {
    processData(JSON.parse(cached));
    return; // مفيش داعي لطلب شبكة جديد خالص
  }

  if (container) {
    container.innerHTML = '<p>جاري تحميل المنتجات...</p>';
  }

  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    processData(data);
  } catch (err) {
    // معالجة الخطأ زي ما هي
  }
}

function processData(data) {
  products = data.products.map(p => ({ ...p, /* المعالجة الموجودة */ }));
  categories = data.categories;
  categoryMap = {};
  categories.forEach(c => { categoryMap[c.category_id] = c; });
  renderCategories();
  renderProducts();
}

document.addEventListener('DOMContentLoaded', loadData);

// التقاط الفئة من الرابط (Query Parameter) عند تحميل الصفحة وتفعيلها تلقائياً


