const categoryIcons = {
  all: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  "4d": `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><circle cx="8" cy="7" r="1" fill="#9caf88" stroke="none"/></svg>`,
  "4e": `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="18" rx="2"/><path d="M9 20h6"/><path d="M12 20v2"/></svg>`,
  "4f": `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="8" rx="1"/><rect x="3" y="13" width="18" height="8" rx="1"/></svg>`,
    "4g": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="4" width="5" height="6" rx="1"/>
    <path d="M9 10h6a2 2 0 0 1 2 2v1"/>
    <path d="M7 11v2a4 4 0 0 0 4 4h3"/>
    <path d="M12 17v3"/>
    <path d="M16 17v3"/>
    <path d="M10 20h8"/>
    <circle cx="6.5" cy="7" r="0.8" fill="#9caf88" stroke="none"/>
    </svg>`
};

const API_URL = "https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password";
const WA = '201556840368';
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/website/images/';


let products = [];
let categories = [];
let categoryMap = {};
let currentCat = 'all';

// Lightbox
function openLB(src) {
  document.getElementById('prod-lb-img').src = src;
  document.getElementById('prod-lb').classList.add('open');
}
function closeLB() {
  document.getElementById('prod-lb').classList.remove('open');
}

function contactWA(productId, name, price) {
  const msg = 'السلام عليكم، أرغب في الاستفسار عن:\n' + name + '\nالسعر: ' + price + ' EGP';
  window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank');
}

function showSkeleton() {
  const container = document.getElementById('prod-list');
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `
      <div class="prod-skeleton">
        <div class="skel-img"></div>
        <div class="skel-body">
          <div class="skel-line w40"></div>
          <div class="skel-line w80"></div>
          <div class="skel-line w60"></div>
          <div class="skel-line w40"></div>
        </div>
      </div>`;
  }
  container.innerHTML = html;
}

function getCategoryIcon(id) {
  return categoryIcons[id] || categoryIcons.all;
}

function renderCategories() {
  const container = document.getElementById('cat-scroll');
  container.innerHTML = `
    <div class="cat-chip active" data-cat="all" onclick="filterCat('all')">
      <div class="cat-icon">${getCategoryIcon('all')}</div>
      <span class="cat-label">الكل</span>
    </div>`;

  categories.sort((a, b) => a.order - b.order).forEach(cat => {
    container.innerHTML += `
      <div class="cat-chip" data-cat="${cat.category_id}" onclick="filterCat('${cat.category_id}')">
        <div class="cat-icon">${getCategoryIcon(cat.category_id)}</div>
        <span class="cat-label">${cat.display_name}</span>
      </div>`;
  });
}

function renderProducts() {
  const container = document.getElementById('prod-list');
  let html = '';

  products.forEach(p => {
    const catId = p.category || '';
    const imgSrc = GH + p.product_id + '.webp';
    const catName = categoryMap[catId]?.display_name || '';
    const price = p.sale_price && p.sale_price !== '' ? p.sale_price : p.base_price;
    const priceText = price ? Math.round(price) + ' EGP' : '—';

    // مقاس — يظهر فقط لو في بيانات
    const hasDims = p.width && p.height && p.depth;
    const sizeHtml = hasDims
      ? `<div class="prod-size">${p.width} × ${p.depth} × ${p.height} سم</div>`
      : '';

    const descHtml = p.description
      ? `<div class="prod-desc">${p.description}</div>`
      : '';

    html += `
      <div class="prod-card" data-cat="${catId}">
        <div class="prod-img-wrap">
          <img class="prod-img" src="${imgSrc}" alt="${p.display_name}"
            onerror="this.style.visibility='hidden'">
          <button class="prod-zoom-btn" onclick="openLB('${imgSrc}')">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          </button>
        </div>
        <div class="prod-body">
          <span class="prod-cat-tag">${catName}</span>
          <div class="prod-name">${p.display_name}</div>
          ${sizeHtml}
          ${descHtml}
          <div class="prod-price">${priceText}</div>
          <button class="prod-wa-btn" onclick="contactWA('${p.product_id}','${p.display_name}','${priceText}')">
            استفسر الآن
          </button>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

function filterCat(cat) {
  currentCat = cat;
  document.querySelectorAll('.cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === cat);
  });
  document.querySelectorAll('.prod-card').forEach(card => {
    card.classList.toggle('hidden', cat !== 'all' && card.dataset.cat !== cat);
  });
}

async function loadData() {
  showSkeleton();
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    products = data.products;
    categories = data.categories;
    categoryMap = {};
    categories.forEach(c => { categoryMap[c.category_id] = c; });
    renderCategories();
    renderProducts();
  } catch (err) {
    console.error(err);
    document.getElementById('prod-list').innerHTML =
      '<p style="color:rgba(255,255,255,0.5);text-align:center;padding:40px">تعذّر تحميل المنتجات، يرجى المحاولة لاحقاً.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadData);