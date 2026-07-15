const categoryIcons = {
  all: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,

      "4d": `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h3"/>
      <path d="M17 6h.01"/>
      <rect x="3" y="2" width="18" height="20" rx="2"/>
      <circle cx="12" cy="13" r="5"/>
      <path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5"/>
      </svg>`,

      "4e": `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 6 8 9"/>
      <path d="m16 7-8 8"/>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      </svg>`,

      "4f": `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 12V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>
      <path d="M16 20v-3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/>
      <path d="M20 22V2"/>
      <path d="M4 12h16"/>
      <path d="M4 20h16"/>
      <path d="M4 2v20"/>
      <path d="M4 4h16"/>
      </svg>`, 

      "4g": `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/>
      <path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/>
      </svg>`,

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
    const container = document.getElementById("prod-list");

    // 1. هيكل التحميل (منطقة النصوص فقط)
    let loadingHtml = `
    <div class="loading-box">

        <div id="text1" class="loading-text-item">
            جاري تحميل المنتجات
            <span class="dots">
                <span>.</span><span>.</span><span>.</span>
            </span>
        </div>

        <div id="text2" class="loading-text-item hidden-bottom">
            نعتذر على التأخير، جاري تجهيز القائمة لك
            <span class="dots">
                <span>.</span><span>.</span><span>.</span>
            </span>
        </div>

        <div id="text3" class="loading-text-item hidden-bottom">
            شكراً لصبرك، نحن بصدد عرض أفضل الوحدات لك
            <span class="dots">
                <span>.</span><span>.</span><span>.</span>
            </span>
        </div>

    </div>
    `;

    // 2. هيكل السكليتون (منطقة الكروت)
    let skeletonHtml = '';
    for (let i = 0; i < 5; i++) {
        skeletonHtml += `
            <div class="prod-skeleton">
                <div class="skel-img"></div>
                <div class="skel-body">
                    <div class="skel-line w40"></div>
                    <div class="skel-line w80"></div>
                    <div class="skel-line w60"></div>
                    <div class="skel-line w40"></div>
                </div>
            </div>
        `;
    }

    // 3. دمجهم معاً وتعيينهم للـ container
    container.innerHTML = loadingHtml + skeletonHtml;

    // 4. تشغيل اللوب الخاص بالنصوص فقط
    const texts = ["text1", "text2", "text3"];
    let currentIndex = 0;

    function loopTexts() {
        const current = document.getElementById(texts[currentIndex]);
        const nextIndex = (currentIndex + 1) % texts.length;
        const next = document.getElementById(texts[nextIndex]);

        if(!current || !next) return; // حماية للكود لو تم مسح العناصر

        current.classList.add("slide-up-out");
        
        setTimeout(() => {
            current.classList.remove("slide-up-out", "slide-up-in");
            current.classList.add("hidden-bottom");

            next.classList.remove("hidden-bottom");
            next.classList.add("slide-up-in");
            
            currentIndex = nextIndex;
            setTimeout(loopTexts, 3000);
        }, 400);
    }

    setTimeout(loopTexts, 3000);
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

console.log("Products count before filter:", products.length);
console.log("Sample product visibility:", products[0]?.visible); // لرؤية هل هي صحيحة أم لا
  products

    .filter(p => p.visible)
    .forEach((p, index) => { // أضفنا index هنا للتحكم في تأخير الأنيميشن
        const catId = p.category || '';
        const imgSrc = GH + p.product_id + '.webp';
        const catName = categoryMap[catId]?.display_name || '';
        
        // حساب السعر بأمان
        const basePrice = Math.round(p.base_price || 0);
        const salePrice = p.sale_price && p.sale_price !== '' ? Math.round(p.sale_price) : null;
        const priceText = `${salePrice || basePrice} EGP`;

        // منطق عرض السعر
        let priceHtml = salePrice 
            ? `<div class="prod-price"><span class="old-price">${basePrice} EGP</span><span class="new-price">${salePrice} EGP</span></div>`
            : `<div class="prod-price"><span class="new-price">${basePrice} EGP</span></div>`;

        // مقاسات
        const hasDims = p.width && p.height && p.depth;
        const sizeHtml = hasDims
        ? `
          <div class="prod-size">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2 3 7l9 5 9-5-9-5Z"/>
              <path d="M3 7v10l9 5 9-5V7"/>
              <path d="M12 12v10"/>
            </svg>
            ${p.width} × ${p.depth} × ${p.height} سم
          </div>`
        : '';
        const descHtml = p.description ? `<div class="prod-desc">${p.description}</div>` : '';
        const materialHtml = `
          <div class="prod-spec">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3 3 8l9 5 9-5-9-5Z"/>
              <path d="M3 12l9 5 9-5"/>
              <path d="M3 16l9 5 9-5"/>
            </svg>
              <span>بورديوم مقاوم للرطوبة</span>
          </div>`;

        // البادجات
        const badges = [];
        if (p.featured) badges.push(`<span class="prod-badge featured"><svg viewBox="0 0 24 24"><path d="M12 2l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16.8 6 19.4l1.5-6.5-5-4.3 6.6-.6z"/></svg>الأكثر طلبًا</span>`);
        if (p.new) badges.push(`<span class="prod-badge new"><svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M2 12h20"/></svg>جديد</span>`);

        // دمج الكارت مع الأنيميشن
        html += `
            <div class="prod-card" data-cat="${catId}" style="animation-delay: ${index * 0.1}s;">
                <div class="prod-img-wrap">
                    <img class="prod-img" src="${imgSrc}" alt="${p.display_name}" onerror="this.style.visibility='hidden'">
                    <button class="prod-zoom-btn" onclick="openLB('${imgSrc}')">
                        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
                    </button>
                </div>
                <div class="prod-body">
                    <div class="prod-header">
                        <div class="prod-badges">${badges.join("")}</div>
                        <div class="prod-name">${p.display_name}</div>
                    </div>
                    <span class="prod-cat-tag">${catName}</span>
                    ${sizeHtml}
                    ${materialHtml}
                    ${descHtml}
                    ${priceHtml}
                    <button class="prod-wa-btn" onclick="contactWA('${p.product_id}','${p.display_name}','${priceText}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.054 23.25a.75.75 0 0 0 .916.916l5.392-1.479A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.742-.524-5.287-1.437l-.378-.225-3.924 1.077 1.077-3.924-.225-.378A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                        استفسر الآن
                    </button>
                </div>
            </div>
        `;
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
    products = data.products.map(p => ({
    ...p,
    visible: String(p.visible).trim().toUpperCase() === "TRUE",
    featured: String(p.featured).trim().toUpperCase() === "TRUE",
    new: String(p.new).trim().toUpperCase() === "TRUE"
}));
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