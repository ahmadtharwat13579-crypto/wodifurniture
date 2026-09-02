"use strict";

/*
================================================================================
1. Configuration & Constants
   (روابط ومتغيرات ثابتة ولا تتغير خلال تشغيل التطبيق)
================================================================================
*/
const WA = '201556840368';
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
const SHEET = 'https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password';
const GEOAPIFY_API_KEY = '5d919ff1fd3f4004a73ceb1fb508e805';
const cur = 'ج.م.';

/*
================================================================================
2. Global State
   (المتغيرات العامة المستخدمة في ملف الكونفيجوريتور)
================================================================================
*/
let userLat = null, userLng = null, installCost = null;
let LOC = { workshop_lat: 30.061113, workshop_lng: 31.394701, correction_factor: 0, price_per_km: 0, fixed_cost: 0 };
let D = { designs: [], divisions: [], handles: [], colors: [] };
let dataLoaded = false;

let S = {
  sinkType: null,
  design: null,
  selectedColors: [],
  size: null,
  div: null,
  handle: null,
  selectedHandleShapes: []
};

let dt = null;

let isRestoring = false;

/*
================================================================================
3. Helper Functions
   (دوال مساعدة عامة: تنسيقات، حسابات صغيرة، أدوات DOM، إلخ)
================================================================================
*/

// Round to nearest 5
const r5 = n => Math.round(n / 5) * 5;

// Convert number to Arabic numerals with thousands separator (kept as original)
const toAr = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(',', '،');

// Strip trailing size suffix like _45cm from product id
const base = id => (id && typeof id.toString === 'function') ? id.toString().replace(/_\d+[\-\.]?\d*cm$/i, '') : '';

// Safely escape HTML (fallback used in one place)
function escapeHtmlSafe(str) {
  if (typeof str !== 'string') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let toastTimeout;

function showToast(msg, duration = 3500) {
  const t = document.getElementById('toast');
  if (!t) return;

  // إلغاء أي مؤقت سابق لو التوست اتطلب ورا بعض
  clearTimeout(toastTimeout);

  // إعداد النص وشريط التقدم
  t.innerHTML = `
    <span>${msg}</span>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  // إعادة تفعيل كلاس الظهور
  t.classList.remove('show');
  void t.offsetWidth; // إعادة تشغيل الأنيميشن من البداية (Reflow)
  t.classList.add('show');

  // إخفاء التوست بعد انتهاء المدة
  toastTimeout = setTimeout(() => {
    t.classList.remove('show');
  }, duration);
}

// CSV parser (kept for completeness — not used elsewhere in current file but preserved)
function parseCSV(t) {
  const ls = t.trim().split('\n');
  const hs = ls[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
  return ls.slice(1).map(l => {
    const v = l.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
    const o = {};
    hs.forEach((h, i) => o[h] = v[i] || '');
    return o;
  });
}

// Return group id like '4b_wh_cic01' from '4b_wh_cic01_45cm' or leave '4b_fp_cic00' as-is
function divisionBase(id) {
  if (!id) return id;
  const s = String(id);
  const sizeSuffix = /_\d+[\-\.]?\d*cm$/i;
  if (sizeSuffix.test(s)) return s.replace(sizeSuffix, '');
  const parts = s.split('_');
  if (parts.length >= 3) return parts.slice(0, 3).join('_');
  return s;
}

// Haversine distance (km)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// small UI helper: pulse price animation
function pulsePrice(el, newPriceText) {
  if (!el) return;
  const formattedPrice = newPriceText || el.innerHTML;
  
  // التشغيل فقط في حال تغير النص/السعر فعلياً
  if (el.innerHTML !== formattedPrice || newPriceText === undefined) {
    if (newPriceText !== undefined) el.innerHTML = formattedPrice;
    
    el.classList.remove('price-updated', 'price-pulse');
    void el.offsetWidth; // Reflow
    el.classList.add('price-updated');
  }
}

/*
================================================================================
4. Data Loading & Processing
   - loadConfiguratorData: جلب البيانات من SHEET وتخزينها مؤقتاً
   - build: تحويل صفوف الداتا إلى هيكل D.designs / D.divisions / D.handles
================================================================================
*/

function loadConfiguratorData() {

  // 1) اذا في كاش محلي، استخدمه فوراً لتحسين السرعة
  try {
    const cached = sessionStorage.getItem('wodi_configurator_cache');
    if (cached) {
      try {
        const rows = JSON.parse(cached);
        D = build(rows);
        dataLoaded = true;
        rDes(); rSz(); rDiv(); rHnd(); upd();
        
        // إخفاء الـ placeholders فقط للبيانات المحددة بالفعل
        if (S.size) document.getElementById("placeholder-sz")?.classList.add("hidden");
        if (S.design) document.getElementById("placeholder-dc")?.classList.add("hidden");
        if (S.div) document.getElementById("placeholder-div")?.classList.add("hidden");
        if (S.handle || (S.design && S.design.hc === 0)) {
          document.getElementById("placeholder-hc")?.classList.add("hidden");
        }
      } catch (e) {
        console.warn('Failed to parse cached configurator', e);
      }
    }
  } catch (e) {
    console.warn('sessionStorage read failed', e);
  }

  // 2) ثم حاول تحديث البيانات من السيرفر (خلفية) مع retries/timeout
  showConfiguratorLoading();

  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 10000;
  const BASE_DELAY = 700;

  async function attempt(retry = 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(SHEET, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.error('SHEET fetch non-OK', resp.status, txt.slice ? txt.slice(0, 500) : txt);
        throw new Error('SHEET non-OK ' + resp.status);
      }

      let data;
      try {
        data = await resp.json();
      } catch (jsonErr) {
        const txt = await resp.text().catch(() => '');
        console.error('SHEET returned non-JSON (first 500 chars):', txt.slice ? txt.slice(0, 500) : txt);
        throw jsonErr;
      }

      const rows = data && data.configurator;
      const colorRows = data && data.colors;

      const settings = data && data.locationSettings;
      if (settings && settings.workshop_lat) {
        LOC = settings;
      }

      if (rows && rows.length > 0) {
        D = build(rows, colorRows);
        dataLoaded = true;
        hideConfiguratorLoading();
        try { sessionStorage.setItem('wodi_configurator_cache', JSON.stringify(rows)); } catch (e) { console.warn('sessionStorage set failed', e); }
        
        // Restore saved state if available
        if (window.wodi_saved_state) {
          const saved = window.wodi_saved_state;
          if (saved.sinkType) {
            S.sinkType = saved.sinkType;
            document.querySelectorAll('.sink-type-card').forEach(c => {
              c.classList.toggle('selected', c.dataset.type === saved.sinkType);
            });
          }
          if (saved.sizeSize) {
            const sz = D.designs.flatMap(d => d.sizes).find(s => s.size === saved.sizeSize);
            if (sz) S.size = sz;
          }
          if (saved.designId) {
            S.design = D.designs.find(d => d.id === saved.designId);
          }
          if (saved.divId) {
            S.div = D.divisions.find(d => d.id === saved.divId);
          }
          if (saved.handleId) {
            S.handle = D.handles.find(h => h.id === saved.handleId);
          }
          delete window.wodi_saved_state;
        }
        
        rDes(); rSz(); rDiv(); rHnd(); upd();
        
        // إخفاء الـ placeholders فقط للبيانات المحددة بالفعل
        if (S.size) document.getElementById("placeholder-sz")?.classList.add("hidden");
        if (S.design) document.getElementById("placeholder-dc")?.classList.add("hidden");
        if (S.div) document.getElementById("placeholder-div")?.classList.add("hidden");
        if (S.handle || (S.design && S.design.hc === 0)) {
          document.getElementById("placeholder-hc")?.classList.add("hidden");
        }
        
        if (typeof hideConfigLoaderOverlay === 'function') {
          hideConfigLoaderOverlay();
        }

        console.log('Configurator data loaded successfully.');
        return;
      } else {
        hideConfiguratorLoading();
        throw new Error('No configurator rows in response');
      }

    } catch (err) {
      clearTimeout(timer);
      console.warn('loadConfiguratorData attempt failed', retry, err && err.message ? err.message : err);

      if (retry < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, retry);
        await new Promise(res => setTimeout(res, delay));
        return attempt(retry + 1);
      }

      hideConfiguratorLoading();
      if (typeof hideConfigLoaderOverlay === 'function') hideConfigLoaderOverlay();

      if (!dataLoaded) {
        showToast('تعذر تحميل البيانات. تأكد من اتصالك وحاول مرة أخرى.');
        console.error('Final failure loading configurator data:', err);
      } else {
        showToast('البيانات مُعرضة من الكاش المحلي (اتصال الشبكة ضعيف)');
      }
    }
  }

  attempt(0).catch(e => {
    console.error('Unexpected error in loadConfiguratorData:', e);
    hideConfiguratorLoading();
  });
}

// Convert rows to structured data used by UI. Keeps original grouping logic.
// Note: حفظت منطق تحديد الـ type وطرق التجميع كما كان.
function build(rows, colorRows = []) {
  const des = {};
  const divs = [];
  const hnd = [];
  const colors = [];

  if (Array.isArray(colorRows)) {
    colorRows.forEach(r => {
      if (!r) return;
      // دعم القراءة سواء كانت الأسطر عبارة عن Objects أو Arrays من الشيت
      const cId = String(r.clr_id || r.clrId || r.c || r.id || r[0] || '').trim();
      const dName = String(r.display_name || r.displayName || r.name || r.title || r[1] || r[2] || '').trim();
      const fName = String(r.clr_family || r.clr_familty || r.family || '').trim().toLowerCase();
      
      if (cId || dName) {
        colors.push({
          family: fName,
          clr_id: cId,
          id: cId,
          display_name: dName,
          name: dName,
          price: parseFloat(r.added_value || r.extra_price || r.price || 0) || 0
        });
      }
    });
  }

  rows.forEach(r => {
    const id = r.product_name;
    const cat = r.product_category;
    const p = parseFloat(r.price) || 0;
    const nm = r.display_name;
    const sz = r.size;

    if (cat === 'sink_cabinets') {
      const b = base(id);
      if (!des[b]) {
        // تحديد النوع بناءً على المعرف
        let type;
        if (id.includes('_fp_')) {
          type = 'floor-standing';
        } else if (id.includes('_wh_')) {
          type = 'wall-hung';
        } else if (id.includes('_di_')) {
          type = 'drop-in';
        } else if (id.includes('_bw_')) {
          type = 'bowl';
        } else {
          type = 'wall-hung';
        }
        des[b] = { id: b, name: nm, hc: parseInt(r.handle_count) || 0, sizes: [], type: type };
      } else if (nm) des[b].name = nm;
      des[b].sizes.push({ id, size: sz, price: p });

    } else if (cat === 'cabinet_inside_config') {
      // group divisions preserving _wh_/_fp_ but removing size suffix
      const b = divisionBase(id);
      const type = id.includes('_fp_') ? 'floor-standing' : 'wall-hung';
      let g = divs.find(d => d.id === b);
      if (!g) {
        g = { id: b, name: nm || b, type: type, sizes: [] };
        divs.push(g);
      } else if (nm) {
        g.name = nm;
      }
      g.sizes.push({ id: id, size: sz || 'any', price: p });

    } else if (cat === 'handles_&_knobs') {
      hnd.push({ id, name: nm, price: p });
    }
  });

  const result = { designs: Object.values(des), divisions: divs, handles: hnd, colors: colors };
  if (typeof D !== 'undefined') {
    D.colors = colors;
  }
  return result;
}

/*
================================================================================
5. UI Rendering & Configurator Logic
   (رسم وتحديث الواجهة: rDes, rSz, rDiv, rHnd, upd، وإدارة شاشات التحميل)
================================================================================
*/

// Unavailable designs map (كما كان)
const unavailableDesigns = {
  'drop-in': ['4a_wh_sc02'],
  'bowl': ['4a_wh_sc02']
};

function getConfiguratorImageUrl(id, sinkType) {
  if (!id) return '';

  let imgBaseId = id;

  if (typeof id === 'string' && id.includes('_cic')) {
    imgBaseId = divisionBase(id);
  } else {
    imgBaseId = base(id);
  }

  const isDivision =
    typeof id === 'string' && id.includes('_cic');

  const typeCodeMap = {
    'drop-in': 'di',
    'bowl': 'bw'
  };

  let finalImgId = imgBaseId;

  if (!isDivision && sinkType && typeCodeMap[sinkType]) {
    finalImgId = finalImgId.replace(
      /_wh_/,
      '_' + typeCodeMap[sinkType] + '_'
    );
  }

  return GH + encodeURIComponent(finalImgId) + '.webp';
}

// Helper for lock overlay
function mkLockOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "card-overlay";
  overlay.style.pointerEvents = "none"; // لضمان إمكانية النقر على الكارت الموجود تحته
  overlay.innerHTML = `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="2">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V8a4 4 0 118 0v3"/>
    </svg>
  `;
  return overlay;
}

// Build image node for cards and handles
function mkImg(id, cardEl) {
  const w = document.createElement('div'); w.className = 'cimg';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'eager';
  img.decoding = 'async';

  // determine which base id to use for image files
  let imgBaseId = id;
  if (id && typeof id === 'string' && id.includes('_cic')) {
    imgBaseId = divisionBase(id);
  } else {
    imgBaseId = base(id);
  }

  const isDivision = id && typeof id === 'string' && id.includes('_cic');
  const typeCodeMap = { 'drop-in': 'di', 'bowl': 'bw' };
  let finalImgId = imgBaseId;
  if (!isDivision && S.sinkType && typeCodeMap[S.sinkType]) {
    finalImgId = finalImgId.replace(/_wh_/, '_' + typeCodeMap[S.sinkType] + '_');
  }
  const encoded = encodeURIComponent(finalImgId);
  img.src = GH + encoded + '.webp';
  img.onerror = function () {
    if (this.src.endsWith('.webp')) {
      this.src = GH + encoded + '.png';
    } else {
      this.style.display = 'none';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'placeholder');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.5');
      svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
      w.appendChild(svg);
    }
  };
  w.appendChild(img);

  // zoom button unchanged
  const zoomBtn = document.createElement('div');
  zoomBtn.className = 'zoom-btn';
  zoomBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
    </svg>
    `;
  zoomBtn.onclick = function (e) {
    e.stopPropagation();
    openLB(img.src);
  };
  w.appendChild(zoomBtn);

  return w;
}

// Scroll helpers & arrow updates
function scrollCards(id, dir) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollLeft += dir * -160;
  setTimeout(() => updateArrows(id), 300);
}

function updateArrows(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const startBtn = document.getElementById(id + '-start');
  const endBtn = document.getElementById(id + '-end');
  if (!startBtn || !endBtn) return;
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 4) { startBtn.classList.add('hidden'); endBtn.classList.add('hidden'); return; }
  const sl = el.scrollLeft;
  const atStart = (sl >= 0 && sl <= 4) || (sl < 0 && Math.abs(sl) <= 4);
  const atEnd = (sl >= 0 && sl >= max - 4) || (sl < 0 && Math.abs(sl) >= max - 4);
  startBtn.classList.toggle('hidden', atStart);
  endBtn.classList.toggle('hidden', atEnd);
}

/* ===== rDes & createDesignCard ===== */
function createDesignCard(d) {
  const validPrices = d.sizes.map(s => s.price).filter(p => p !== null);
  const minP = validPrices.length ? Math.min(...validPrices) : null;

  const el = document.createElement("div");
  const isAvailable = !S.size || d.sizes.some(s => s.size === S.size.size);

  el.className =
    "design-card" +
    (S.design && S.design.id === d.id ? " selected" : "") +
    (S.size && !isAvailable ? " disabled" : "");

  el.appendChild(mkImg(d.id, el));

  if (!S.size) {
    el.querySelector(".cimg")?.appendChild(mkLockOverlay());
  }

  // ========= المقاسات =========
  const availableSizes = d.sizes.map(s => s.size);
  let sizeText = "";
  if (availableSizes.length) {
    const first = availableSizes[0];
    const last = availableSizes[availableSizes.length - 1];
    const firstMin = first.split("-")[0].trim();
    const lastMax = last.split("-")[1].replace("cm", "").replace("سم", "").trim();
    sizeText = `${firstMin}–${lastMax} سم`;
  }
  // ============================

  const info = document.createElement("div");
  info.className = "cinfo";
  info.innerHTML = `
    <div class="cname">${d.name}</div>

    ${
    !S.size
      ?
      `
      <div class="card-sizes">
        <span class="label">المقاس:</span>
        <span class="value">${sizeText}</span>
      </div>
      `
      :
      `
      <div class="card-sizes">
        ${sizeText}
      </div>
      `
    }

    <div class="cprice">
      يبدأ من ${r5(minP)} EGP
    </div>
  `;
  el.appendChild(info);

  el.onclick = () => {
      // ممنوع اختيار التصميم قبل اختيار عرض الحوض
      if (!S.size) {
        showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار التصميم.');
        document.getElementById('sz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      // إذا كان التصميم غير متاح للمقاس المختار
      if (!isAvailable) {
        showToast('عفواً، هذا التصميم لا يناسب عرض الحوض الذي اخترته.');
        return;
      }

      // إلغاء الاختيار (Unselect) إذا تم الضغط على التصميم المحدد حالياً
      if (S.design && S.design.id === d.id) {
        S.design = null;
      } else {
        S.design = d;

        // اربط المقاس بالـ size object الخاص بالتصميم المختار
        const matchedSize = d.sizes.find(s => s.size === S.size.size);
        if (matchedSize) {
          S.size = matchedSize;
        }
      }

      rDes();
      rDiv();
      rHnd();
      upd();
    };

  // تم إزالة الإضافة التلقائية المباشرة عند إنشاء كارت التصميم

  return el;
}

function rDes() {
  const box = document.getElementById("dc");
  const title = document.getElementById("design-group-title");
  if (!box) return;

  box.innerHTML = "";

  const desc = document.getElementById("design-desc");

  const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
  const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;
  const excluded = unavailableDesigns[S.sinkType] || [];

  // تحديث النص الوصفي فقط (بدون بناء كروت هنا)
  if (desc) {
    if (!S.sinkType) {
      desc.innerHTML = "";
    } else if (!S.size) {
      desc.innerHTML = 'اختر <strong>عرض الحوض</strong> لعرض التصميمات المتوافقة.';
    } else {
      const count = D.designs.filter(d =>
        d.type === effectiveType &&
        !excluded.includes(d.id) &&
        d.sizes.some(s => s.size === S.size.size)
      ).length;
      desc.innerHTML = `تم العثور على <strong>${count}</strong> تصميمات مناسبة.`;
    }
  }

  // بناء الكروت مرة واحدة
  D.designs
    .filter(d => d.type === effectiveType && !excluded.includes(d.id))
    .forEach(d => {
      box.appendChild(createDesignCard(d));
    });

  updateArrows("dc");

  // إخفاء سكشن الألوان بالكامل إذا لم يتم اختيار نوع الحوض
  if (!S.sinkType) return;

  const oldColorSection = document.getElementById('unit-color-section');
  if (oldColorSection) oldColorSection.remove();

  if (!S.sinkType) return;

  const colorContainer = document.createElement('div');
  colorContainer.id = 'unit-color-section';
  colorContainer.style.marginTop = '20px';

  const divider = document.createElement('hr');
  divider.style.border = '0';
  divider.style.borderTop = '1px solid var(--color-border, #eee)';
  divider.style.marginBottom = '16px';
  colorContainer.appendChild(divider);

  if (!S.selectedColors) S.selectedColors = [];

  const colorGroups = [
    { family: 'solid', prefix: 'clr_sld_', defaultTitle: 'لون سادة (مط)', defaultPrice: 0 },
    { family: 'wood', prefix: 'clr_wd_', defaultTitle: 'خشابي', defaultPrice: 800 },
    { family: 'gloss', prefix: 'clr_gls_', defaultTitle: 'لامع', defaultPrice: 1100 }
  ];

  colorGroups.forEach(group => {
    const sheetData = (D.colors || []).find(c => c.family === group.family) || {};
    const titleText = sheetData.name || group.defaultTitle;
    const extraPrice = (sheetData.price !== undefined && sheetData.price !== null) ? sheetData.price : group.defaultPrice;

    // إنشاء حاوية خاصة بكل عائلة ألوان لإخفائها بالكامل لو لم توجد صور
    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'color-group-wrapper';
    groupWrapper.id = `group-wrapper-${group.family}`;

    const subTitle = document.createElement('h4');
    subTitle.className = 'subtitle';
    subTitle.textContent = titleText;
    subTitle.style.marginBottom = '4px';
    groupWrapper.appendChild(subTitle);

    if (extraPrice > 0) {
      const subDesc = document.createElement('p');
      subDesc.style.fontSize = '13px';
      subDesc.style.color = 'var(--color-text-muted, #666)';
      subDesc.style.marginBottom = '12px';
      subDesc.innerHTML = `اختيار هذا النوع يزيد تكلفة الوحدة بمقدار <strong>${extraPrice.toLocaleString('en-US')} ج.م</strong>`;
      groupWrapper.appendChild(subDesc);
    } else {
      subTitle.style.marginBottom = '12px';
    }

    const rowId = `unit-colors-row-${group.family}`;
    const wrapEl = document.createElement('div');
    wrapEl.className = 'cards-row-wrap';
    wrapEl.style.marginBottom = '16px';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'scroll-arrow start hidden';
    startBtn.id = `${rowId}-start`;
    startBtn.setAttribute('aria-label', 'Previous');
    startBtn.onclick = () => scrollCards(rowId, -1);
    startBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';

    const endBtn = document.createElement('button');
    endBtn.type = 'button';
    endBtn.className = 'scroll-arrow end hidden';
    endBtn.id = `${rowId}-end`;
    endBtn.setAttribute('aria-label', 'Next');
    endBtn.onclick = () => scrollCards(rowId, 1);
    endBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';

    const cardsRow = document.createElement('div');
    cardsRow.className = 'cards-row';
    cardsRow.id = rowId;
    cardsRow.onscroll = () => updateArrows(rowId);

    // متابعة حذف الصور غير الموجودة لإخفاء السكشن بالكامل لو أصبحت الكروت 0
    const checkGroupVisibility = () => {
      setTimeout(() => {
        if (cardsRow.children.length === 0) {
          groupWrapper.style.display = 'none';
        } else {
          groupWrapper.style.display = 'block';
        }
        updateArrows(rowId);
      }, 60);
    };

    for (let i = 1; i <= 20; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      const colorId = `${group.prefix}${numStr}`;

      const colorCard = document.createElement('div');
      colorCard.className = 'design-card color-shape-card';
      colorCard.dataset.colorId = colorId;

      const imgContainer = mkImg(colorId, colorCard);
      imgContainer.querySelectorAll('.card-overlay').forEach(el => el.remove());

      if (!S.size) {
        imgContainer.appendChild(mkLockOverlay());
      }

      const img = imgContainer.querySelector('img');
      if (img) {
        const cleanColorId = String(colorId).replace(/\.(png|webp|jpg|jpeg)$/i, '');
        const encoded = encodeURIComponent(cleanColorId);
        
        img.src = `images/conf/clr/${encoded}.png`;
        
        img.onerror = function () {
          if (this.src.endsWith('.png')) {
            this.src = `images/conf/clr/${encoded}.webp`;
          } else {
            // إذا لم توجد الصورة بصيغة png أو webp يتم حذف كارت اللون فوراً
            if (colorCard) colorCard.remove();
            if (typeof checkGroupVisibility === 'function') checkGroupVisibility();
          }
        };
      }

      colorCard.appendChild(imgContainer);

      const zoomBtn = imgContainer.querySelector('.czoom, .zoom-btn, [data-action="zoom"]');
      if (zoomBtn) {
        zoomBtn.onclick = (e) => {
          e.stopPropagation();
          openLB(`images/conf/clr/${encodeURIComponent(colorId)}.webp`);
        };
      }

      if (S.selectedColors && S.selectedColors[0] === colorId) {
        colorCard.classList.add('selected');
      }

      colorCard.onclick = () => {
        if (!S.size) {
          showToast('يرجى اختيار عرض الحوض أولاً.');
          const sizeSection = document.getElementById('size-group-title') || document.getElementById('sz');
          if (sizeSection) {
            sizeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

        const isAlreadySelected = S.selectedColors && S.selectedColors[0] === colorId;
        if (isAlreadySelected) {
          S.selectedColors = [];
        } else {
          S.selectedColors = [colorId];
        }

        // إزالة كلاس المحدد والتظليل/الـ Overlay عن كل كروت الألوان
        document.querySelectorAll('#unit-color-section .design-card').forEach(card => {
          card.classList.remove('selected', 'unselected', 'dimmed', 'has-overlay');
          const overlay = card.querySelector('.card-overlay:not(.lock-overlay)');
          if (overlay) overlay.remove();
        });

        if (!isAlreadySelected) {
          colorCard.classList.add('selected');
        }

        if (typeof updateStepperProgress === 'function') updateStepperProgress();
        if (typeof upd === 'function') upd();
      };

      cardsRow.appendChild(colorCard);
    }

    wrapEl.appendChild(startBtn);
    wrapEl.appendChild(cardsRow);
    wrapEl.appendChild(endBtn);
    groupWrapper.appendChild(wrapEl);
    colorContainer.appendChild(groupWrapper);

    checkGroupVisibility();
  });

  box.parentNode.appendChild(colorContainer);
}

/* ===== rSz ===== */
function rSz() {
  const box = document.getElementById("sz");
  if (!box) return;
  box.innerHTML = "";

  const placeholder = document.getElementById("placeholder-sz");
  const loading = document.getElementById("loading-sz");

  const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
  const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;

  // جمع المقاسات بدون تكرار
  const sizesMap = new Map();
  D.designs
    .filter(d => d.type === effectiveType)
    .forEach(d => {
      d.sizes.forEach(s => {
        if (!sizesMap.has(s.size)) sizesMap.set(s.size, s);
      });
    });

  const sizes = [...sizesMap.values()];
  
  if (sizes.length > 0) {
    // إخفاء الـ placeholder وإظهار قائمة المقاسات
    if (placeholder) placeholder.classList.add("hidden");
    if (loading) loading.classList.add("hidden");
    box.classList.remove("hidden");
  }

  sizes.forEach(s => {
    const b = document.createElement("button");
    b.className =
      "size-btn" +
      (S.size && S.size.size === s.size ? " selected" : "");
    b.textContent = s.size;
    b.onclick = () => {
      S.size = s;
      S.design = null;
      S.div = null;
      S.handle = null;
      rSz();
      rDes();
      rDiv();
      rHnd();
      upd();
    };
    box.appendChild(b);
  });
}

/* ===== Division price helpers ===== */
function sgr(s) {
  if (!s || s === 'any') return 'any';
  const n = s.replace(/\s/g, '');
  if (/40|45|50/.test(n)) return '45';
  if (/55|65/.test(n)) return '65';
  if (/70|80|85/.test(n)) return '85';
  if (/90|100|105/.test(n)) return '100';
  return '85';
}

function dvp(div, sg) {
  if (!div.sizes.length) return 0;
  if (div.sizes[0].size === 'any') return div.sizes[0].price;
  const m = { '45': '45cm', '65': '65cm', '85': '85cm', '100': '85cm' };
  const sfx = m[sg] || '85cm';
  const f = div.sizes.find(s => s.id.endsWith(sfx));
  return f ? f.price : div.sizes[div.sizes.length - 1].price;
}

/* ===== rDiv ===== */
function rDiv() {
  const wall = document.getElementById("vc-wall");
  const floor = document.getElementById("vc-floor");
  const wallWrap = document.getElementById("vc-wall-wrap");
  const floorWrap = document.getElementById("vc-floor-wrap");
  const title = document.getElementById("division-group-title");

  if (!wall || !floor || !wallWrap || !floorWrap) return;

  wall.innerHTML = "";
  floor.innerHTML = "";

  // لم يتم اختيار نوع الحوض
  if (!S.sinkType) {
    S.div = null;
    title.textContent = "ما هي التقسيمة الداخلية المناسبة لك؟";
    wallWrap.classList.add("hidden");
    floorWrap.classList.add("hidden");
    updateArrows("vc-wall");
    updateArrows("vc-floor");
    return;
  }

  const divisionType = S.sinkType === "floor-standing" ? "floor-standing" : "wall-hung";

  if (divisionType === "wall-hung") {
    wallWrap.classList.remove("hidden");
    floorWrap.classList.add("hidden");
  } else {
    floorWrap.classList.remove("hidden");
    wallWrap.classList.add("hidden");
  }

  title.textContent = "ما هي التقسيمة الداخلية المناسبة لك؟";

  D.divisions
    .filter(d => d.type === divisionType)
    .forEach(d => {
      const el = document.createElement("div");
      el.className = "div-card" + (S.div && S.div.id === d.id ? " selected" : "");
      el.appendChild(mkImg(d.id, el));

      if (!S.size) {
        el.querySelector(".cimg")?.appendChild(mkLockOverlay());
      }

      const info = document.createElement("div");
      info.className = "cinfo";
      const sg = S.size ? sgr(S.size.size) : null;
      const divP = sg ? dvp(d, sg) : null;

      info.innerHTML = `
        <div class="cname">${d.name}</div>
        <div class="cprice">
          ${divP != null ? `+ ${divP} EGP` : "—"}
        </div>
      `;
      el.appendChild(info);

      el.onclick = () => {
        // ممنوع اختيار التقسيمة الداخلية قبل اختيار عرض الحوض
        if (!S.size) {
          showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار التقسيمة الداخلية.');
          document.getElementById('sz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // إلغاء الاختيار (Unselect) إذا تم الضغط على الكارت المحدد حالياً
        if (S.div && S.div.id === d.id) {
          S.div = null;
        } else {
          S.div = d;
        }

        rDiv();
        upd();
      };

      if (divisionType === "wall-hung") {
        wall.appendChild(el);
      } else {
        floor.appendChild(el);
      }
    });

  setTimeout(() => {
    updateArrows("vc-wall");
    updateArrows("vc-floor");
  }, 50);
}

/* ===== Loading placeholders & skeletons ===== */
function showSkeleton(containerId, cardClass, count = 4) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = `${cardClass} skeleton`;
    card.innerHTML = `
      <div class="cimg">
        <div class="skel-img"></div>
      </div>
      <div class="cinfo">
        <div class="skel-line w-80"></div>
        <div class="skel-line w-40"></div>
      </div>
    `;
    container.appendChild(card);
  }
}

function showSizeSkeleton(count = 4) {
  const box = document.getElementById("sz");
  if (!box) return;
  box.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const item = document.createElement("div");
    item.className = "size-btn skeleton";
    item.innerHTML = `<span class="skel-text"></span>`;
    box.appendChild(item);
  }
}

function showConfiguratorLoading() {
  // لو العميل لسه م اخترش نوع حوض، متظهرش أي سكيلتون وتطلع بره الدالة فوراً
  if (!S.sinkType) return;

  // في حالة عدم اختيار المقاس، تظل الـ Placeholders في باقي الأقسام مع تحميل المقاسات فقط
  if (!S.size) {
    document.getElementById("loading-sz")?.classList.add("show");
    document.getElementById("sz")?.classList.remove("hidden");
    showSizeSkeleton();
    return;
  }

  document.getElementById("loading-sz")?.classList.add("show");
  document.getElementById("loading-dc")?.classList.add("show");
  document.getElementById("loading-vc-wall")?.classList.add("show");
  document.getElementById("loading-vc-floor")?.classList.add("show");
  document.getElementById("loading-hc")?.classList.add("show");

  document.getElementById("sz")?.classList.remove("hidden");
  document.getElementById("dc")?.classList.remove("hidden");
  document.getElementById("vc-wall")?.classList.remove("hidden");
  document.getElementById("vc-floor")?.classList.remove("hidden");
  document.getElementById("hc")?.classList.remove("hidden");

  document.getElementById("vc-wall-wrap")?.classList.remove("hidden");

  showSizeSkeleton();
  showSkeleton("dc", "design-card", 4);
  showSkeleton("vc-wall", "div-card", 4);
  showSkeleton("vc-floor", "div-card", 4);
  showSkeleton("hc", "handle-card", 4);
}

function hideConfiguratorLoading() {
  document.getElementById("loading-sz")?.classList.remove("show");
  document.getElementById("loading-dc")?.classList.remove("show");
  document.getElementById("loading-vc-wall")?.classList.remove("show");
  document.getElementById("loading-vc-floor")?.classList.remove("show");
  document.getElementById("loading-hc")?.classList.remove("show");
}

function showPlaceholders() {
  document.getElementById("placeholder-sz")?.classList.remove("hidden");
  document.getElementById("placeholder-dc")?.classList.remove("hidden");
  document.getElementById("placeholder-div")?.classList.remove("hidden");
  document.getElementById("placeholder-hc")?.classList.remove("hidden");
}

function hidePlaceholders() {
  document.getElementById("placeholder-sz")?.classList.add("hidden");
  document.getElementById("placeholder-dc")?.classList.add("hidden");
  document.getElementById("placeholder-div")?.classList.add("hidden");
  document.getElementById("placeholder-hc")?.classList.add("hidden");
}

/* ===== rHnd ===== */
function rHnd() {
  const groupEl = document.querySelector('[data-group="hc"]');

  // إخفاء القسم كاملاً إذا لم يحدد العميل نوع الحوض بعد
  if (!S.sinkType) {
    groupEl?.classList.add('hidden');
    return;
  }

  // إظهار السكشن عند اختيار نوع الحوض
  groupEl?.classList.remove('hidden');

  const c = document.getElementById('hc');
  const title = document.getElementById('handle-group-title');
  const desc = document.getElementById('handle-desc');
  if (!c || !title || !desc) return;

  c.innerHTML = '';
  title.textContent = 'اختر نوع المقبض';
  desc.replaceChildren();

  const noH = S.design && S.design.hc === 0;

  if (noH) {
    S.handle = null;
    S.selectedHandleShapes = [];
    desc.innerHTML = 'التصميم المختار لا يدعم استخدام المقابض.';
  }

  D.handles.forEach(h => {
    const el = document.createElement('div');
    
    // إذا كان التصميم لا يدعم المقابض يتم إضافة disabled
    if (noH) {
      el.className = 'handle-card disabled';
    } else {
      el.className = 'handle-card' + (S.handle && S.handle.id === h.id ? ' selected' : '');
    }

    el.appendChild(mkImg(h.id, el));

    // إظهار قفل التحكم إذا لم يتم اختيار عرض الحوض وكانت المقابض متاحة
    if (!S.size && !noH) {
      el.querySelector(".cimg")?.appendChild(mkLockOverlay());
    }

    const info = document.createElement('div');
    info.className = 'cinfo';
    
    const isPriceVisible = !noH && S.design && dataLoaded && h.price !== null;
    const displayPrice = isPriceVisible ? '+ ' + h.price + ' EGP / ضلفة' : '—';

    info.innerHTML = 
      '<div class="cname">' + h.name + '</div>' +
      '<div class="cprice' + (dataLoaded ? '' : ' loading') + '">' +
      (dataLoaded ? displayPrice : '—') +
      '</div>';

    el.appendChild(info);

    // تفعيل التفاعل عند الضغط
    el.onclick = () => {
      // 1. إذا كان التصميم المختار لا يدعم المقابض
      if (noH) {
        showToast('لا يتطلب هذا التصميم تحديد نوع المقبض.');
        return;
      }

      // 2. ممنوع اختيار نوع المقبض قبل اختيار عرض الحوض
      if (!S.size) {
        showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار نوع المقبض.');
        document.getElementById('sz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // 3. إلغاء الاختيار (Unselect) إذا تم الضغط على الكارت المحدد حالياً
      if (S.handle && S.handle.id === h.id) {
        S.handle = null;
        S.selectedHandleShapes = [];
      } else {
        S.handle = h;
        S.selectedHandleShapes = [];
      }

      rHnd();
      upd();
    };

    c.appendChild(el);
  });

  // إضافة قسم اختيار شكل المقبض في حال اختيار مقبض سحابي أو مقبض دائري
  const handleShapesSection = document.getElementById('handle-shapes-section');
  if (handleShapesSection) handleShapesSection.remove();

  if (S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02')) {
    const shapeContainer = document.createElement('div');
    shapeContainer.id = 'handle-shapes-section';
    shapeContainer.style.marginTop = '20px';

    const shapeSubtitle = document.createElement('h4');
    shapeSubtitle.textContent = 'اختر شكل المقبض';
    shapeSubtitle.style.marginBottom = '6px';

    const shapeDesc = document.createElement('p');
    shapeDesc.textContent = 'يرجى اختيار شكلين لمقبض الوحدة مرتبين حسب الأولوية المناسبة لك، وذلك لضمان التوفر في حال عدم توفر الشكل الأول.';
    shapeDesc.style.fontSize = '13px';
    shapeDesc.style.color = 'var(--color-text-muted, #666)';
    shapeDesc.style.marginBottom = '12px';

    const wrapEl = document.createElement('div');
    wrapEl.className = 'cards-row-wrap';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'scroll-arrow start hidden';
    startBtn.id = 'handle-shapes-row-start';
    startBtn.setAttribute('aria-label', 'Previous');
    startBtn.onclick = () => scrollCards('handle-shapes-row', -1);
    startBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';

    const endBtn = document.createElement('button');
    endBtn.type = 'button';
    endBtn.className = 'scroll-arrow end hidden';
    endBtn.id = 'handle-shapes-row-end';
    endBtn.setAttribute('aria-label', 'Next');
    endBtn.onclick = () => scrollCards('handle-shapes-row', 1);
    endBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';

    const cardsRow = document.createElement('div');
    cardsRow.className = 'cards-row';
    cardsRow.id = 'handle-shapes-row';
    cardsRow.onscroll = () => updateArrows('handle-shapes-row');

    if (!S.selectedHandleShapes) S.selectedHandleShapes = [];

    // توليد الأشكال تلقائياً بناءً على الـ id الخاص بالمقبض المختار فقط
    let availableShapes = S.handle.shapes || [];

    // إذا لم تكن الأشكال محددة في الداتا، نولد تسلسل افتراضي للمقبض المختار فقط
    if (!availableShapes.length) {
      for (let i = 1; i <= 20; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        availableShapes.push(`${S.handle.id}_${numStr}`);
      }
    }

    availableShapes.forEach(shapeId => {
      const shapeCard = document.createElement('div');
      shapeCard.className = 'handle-card handle-shape-card';

      const imgContainer = mkImg(shapeId, shapeCard);
      const img = imgContainer.querySelector('img');

      if (img) {
        const encoded = encodeURIComponent(shapeId);
        img.src = `images/conf/hnd/${encoded}.webp`;

        img.onerror = function () {
          if (this.src.endsWith('.webp')) {
            // محاولة التحويل للـ PNG
            this.src = `images/conf/hnd/${encoded}.png`;
          } else {
            // الصورة غير موجودة نهائياً: إخفاء الكارت تماماً وحذفه من الـ DOM
            shapeCard.remove();
            setTimeout(() => updateArrows('handle-shapes-row'), 50);
          }
        };
      }

      shapeCard.appendChild(imgContainer);

      const zoomBtn = imgContainer.querySelector('.czoom, .zoom-btn, [data-action="zoom"]');
      if (zoomBtn) {
        zoomBtn.onclick = (e) => {
          e.stopPropagation();
          openShapeModal(`images/conf/hnd/${encodeURIComponent(shapeId)}.webp`, `images/conf/hnd/${encodeURIComponent(shapeId)}.png`);
        };
      }

      const pIndex = S.selectedHandleShapes.indexOf(shapeId);
      if (pIndex !== -1) {
        shapeCard.classList.add('selected');
        const badge = document.createElement('div');
        badge.className = 'handle-priority-badge';
        badge.textContent = pIndex + 1;
        shapeCard.appendChild(badge);
      }

      shapeCard.onclick = () => {
        const existingIdx = S.selectedHandleShapes.indexOf(shapeId);
        if (existingIdx !== -1) {
          S.selectedHandleShapes.splice(existingIdx, 1);
        } else {
          if (S.selectedHandleShapes.length >= 2) {
            S.selectedHandleShapes.shift();
          }
          S.selectedHandleShapes.push(shapeId);
        }
        rHnd();
        if (typeof updateStepperProgress === 'function') updateStepperProgress();
        if (typeof upd === 'function') upd();
      };

      cardsRow.appendChild(shapeCard);
    });

    wrapEl.appendChild(startBtn);
    wrapEl.appendChild(cardsRow);
    wrapEl.appendChild(endBtn);

    shapeContainer.appendChild(shapeSubtitle);
    shapeContainer.appendChild(shapeDesc);
    shapeContainer.appendChild(wrapEl);
    c.parentNode.appendChild(shapeContainer);

    // تحديث مكان الأسهم بعد بناء العناصر
    setTimeout(() => updateArrows('handle-shapes-row'), 100);
  }

    /* دالة فتح الصورة في النافذة المكبرة */
  function openShapeModal(webpSrc, pngSrc) {
    let modal = document.getElementById('shape-lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'shape-lightbox-modal';
      modal.className = 'shape-lightbox-modal';
      modal.onclick = () => modal.remove();
      document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
      <div class="shape-lightbox-content" onclick="event.stopPropagation()">
        <span class="shape-lightbox-close" onclick="document.getElementById('shape-lightbox-modal').remove()">&times;</span>
        <img src="${webpSrc}" onerror="this.src='${pngSrc}'" alt="Handle Shape" />
      </div>
    `;
  }

  setTimeout(() => updateArrows('hc'), 50);
}


/* ===== calc & upd ===== */
function calc() {
  if (!S.design || !S.size || !S.div) return null;
  const noH = S.design.hc === 0;
  if (!noH && !S.handle) return null;

  let colorExtra = 0;
  if (S.selectedColors && S.selectedColors[0]) {
    const selectedId = S.selectedColors[0];
    let familyKey = 'solid';

    if (selectedId.startsWith('clr_wd_')) familyKey = 'wood';
    else if (selectedId.startsWith('clr_gls_')) familyKey = 'gloss';

    const colorFamilyObj = (D.colors || []).find(c => c.family === familyKey);
    if (colorFamilyObj) {
      colorExtra = colorFamilyObj.price || 0;
    } else {
      if (familyKey === 'wood') colorExtra = 800;
      else if (familyKey === 'gloss') colorExtra = 1100;
    }
  }

  const sg = sgr(S.size.size);
  const installationFee = 200; // البند الثابت للمعاينة والتركيب
  const unitPrice = r5(S.size.price + colorExtra + dvp(S.div, sg) + (noH ? 0 : S.handle.price * S.design.hc));

  // إذا كان العميل لم يحدد موقعه بعد، نعيد سعر الوحدة + التركيب الثابت فقط
  if (installCost === null) return unitPrice + installationFee;

  // إذا حدد موقعه، نضيف سعر التوصيل أيضاً
  return unitPrice + installationFee + installCost;
}

function upd() {
  // إخفاء سكشن الألوان فوراً بأعلى أولوية إذا لم يتم اختيار نوع الحوض
  const colorSecs = document.querySelectorAll('.colors-section, .color-section, .clr-section, #clr, #clr-wrap, #sc-section');
  if (!S || !S.sinkType) {
    colorSecs.forEach(sec => {
      sec.classList.add('hidden');
      sec.style.setProperty('display', 'none', 'important');
    });
  } else {
    colorSecs.forEach(sec => {
      sec.classList.remove('hidden');
      sec.style.removeProperty('display');
    });
  }

  setTimeout(() => { if (typeof updateStickyValue === 'function') updateStickyValue(); }, 0);
  clearTimeout(dt);
  dt = setTimeout(() => {
    // Persist state to localStorage
    try {
      localStorage.setItem('wodi_configurator_state', JSON.stringify({
        sinkType: S.sinkType,
        designId: S.design ? S.design.id : null,
        selectedColors: S.selectedColors || [],
        sizeSize: S.size ? S.size.size : null,
        divId: S.div ? S.div.id : null,
        handleId: S.handle ? S.handle.id : null,
        selectedHandleShapes: S.selectedHandleShapes || []
      }));
    } catch (e) { console.warn('Failed to save state', e); }
    const t = calc();
    const noH = S.design && S.design.hc === 0;
    const sg = S.size ? sgr(S.size.size) : '85';

    const egpTag = '<small style="font-size: 0.75em; font-weight: normal; margin-left: 2px;">EGP</small>';

    // 1. تحديث السعر الإجمالي مع تفعيل الـ Pulse فقط عند تغير القيمة المالية فعلياً
    const totalEl = document.getElementById('total-price');
    const canShowPrice = S.design && S.size;
    if (totalEl) {
      totalEl.innerHTML =
        canShowPrice && t !== null
          ? `${t.toLocaleString('en-US')} ${egpTag}`
          : `— ${egpTag}`;

      const currentNumericPrice = canShowPrice ? t : null;
      const lastPrice = totalEl.dataset.lastTotal !== undefined ? JSON.parse(totalEl.dataset.lastTotal) : undefined;

      // تشغيل الـ Pulse فقط في حال تغير الرقم المالي النهائي
      if (lastPrice !== currentNumericPrice) {
        totalEl.dataset.lastTotal = JSON.stringify(currentNumericPrice);
        pulsePrice(totalEl);
      }
    }

    // 2. تحديث التحذيرات (إن وجدت)
    const warn = document.getElementById('price-warning');
    if (warn) {
      const needsWarn = S.design && !S.size;
      warn.classList.toggle('show', needsWarn);
    }

    const allSelected = S.design && S.size && S.div && (S.design.hc === 0 || S.handle);
    const instWarn = document.getElementById('install-warning');
    if (instWarn) instWarn.classList.toggle('show', allSelected && installCost === null);

    // 3. تحديث بيانات التوصيل
    const siLabel = document.getElementById('si-label');
    const siPrice = document.getElementById('si-price');
    if (siLabel) siLabel.textContent = installCost !== null ? 'محسوبة' : '—';
    if (siPrice) siPrice.innerHTML = installCost !== null ? `${installCost.toLocaleString('en-US')} ${egpTag}` : '—';

    // تحديث النوع وإخفاء سكشن الألوان تماماً إذا لم يتم اختيار نوع الحوض
    const sdTypeEl = document.getElementById('sd-type');
    if (sdTypeEl) {
      const sinkTypeNames = {
        'wall-hung': 'حوض معلق',
        'drop-in': 'حوض ساقط',
        'bowl': 'حوض فوق الكاونتر',
        'floor-standing': 'حوض برجل كاملة'
      };
      sdTypeEl.textContent = S.sinkType ? sinkTypeNames[S.sinkType] : '—';
      if (typeof updateStepperProgress === 'function') updateStepperProgress();
    }

    // التحقق من حالة اختيار نوع الحوض للتحكم بظهور سكشن الألوان
    if (!S.sinkType) {
      document.querySelectorAll('.colors-section, .color-section, .clr-section, #clr, #clr-wrap').forEach(sec => {
        sec.classList.add('hidden');
        sec.style.display = 'none';
      });
    }

    // تحديث تفاصيل الشريط الجانبي
    const sdEl = document.getElementById('sd');
    if (sdEl) sdEl.textContent = S.design ? S.design.name : '—';

    const sdPriceEl = document.getElementById('sd-price');
    if (sdPriceEl) sdPriceEl.innerHTML = S.size ? `${r5(S.size.price).toLocaleString('en-US')} ${egpTag}` : '—';

    // تحديث صف لون الوحدة باستخدام الـ Hardcoding المباشر
    const scEl = document.getElementById('sc');
    if (scEl) {
      const rawVal = (S.selectedColors && S.selectedColors.length > 0 && S.selectedColors[0]) ? String(S.selectedColors[0]) : '';
      
      if (rawVal) {
        const cleanName = rawVal.split('/').pop().replace(/\.[^/.]+$/, "").toLowerCase().trim();
        
        // قاموس الأسماء المباشر (Hardcoded Color Names)
        const colorMap = {
          'wd': 'خشبي',
          'wood': 'خشبي',
          'sld': 'سادة',
          'solid': 'سادة',
          'gls': 'لامع',
          'gloss': 'لامع'
        };

        let translatedName = '';

        // البحث في الكود المكتوب بداخل اسم الصورة
        for (const [code, name] of Object.entries(colorMap)) {
          if (cleanName.includes(`_${code}_`) || cleanName.startsWith(`${code}_`) || cleanName.endsWith(`_${code}`) || cleanName === code) {
            translatedName = name;
            break;
          }
        }

        scEl.textContent = translatedName || cleanName;
      } else {
        scEl.textContent = '—';
      }
    }

    if (scPriceEl) {
      if (matchedColorObj && matchedColorObj.price > 0) {
        scPriceEl.innerHTML = `+${matchedColorObj.price.toLocaleString('en-US')} ${egpTag}`;
      } else {
        scPriceEl.textContent = '';
      }
    }

    const ssEl = document.getElementById('ss');
    if (ssEl) ssEl.textContent = S.size ? S.size.size : '—';

    const ssPrice = document.getElementById('ss-price');
    if (ssPrice) ssPrice.textContent = '';

    const sv = document.getElementById('sv');
    if (sv) sv.textContent = S.div ? S.div.name : '—';

    const svPrice = document.getElementById('sv-price');
    const divPrice = S.div ? dvp(S.div, sg) : 0;
    if (svPrice) svPrice.innerHTML = S.div ? (divPrice > 0 ? `+${divPrice.toLocaleString('en-US')} ${egpTag}` : `+0 ${egpTag}`) : '—';

    const sh = document.getElementById('sh');
    if (sh) sh.textContent = S.handle ? S.handle.name : (noH ? 'بدون مقبض' : '—');

    const shPrice = document.getElementById('sh-price');
    const handlePrice = S.handle && !noH ? S.handle.price * S.design.hc : 0;
    if (shPrice) shPrice.innerHTML = S.handle ? (handlePrice > 0 ? `+${handlePrice.toLocaleString('en-US')} ${egpTag}` : `+0 ${egpTag}`) : (noH ? '—' : '—');

  updateStickyValue();
  }, 300);
}

async function loadConfiguratorState() {
  const rawSaved = localStorage.getItem('wodi_configurator_state');
  
  // التحقق من وجود بيانات سابقة حقيقية وليست فارغة
  let hasValidState = false;
  if (rawSaved) {
    try {
      const parsed = JSON.parse(rawSaved);
      // التأكد أن الكائن يحتوي على قيم غير فارغة (Not Null / Not Empty)
      if (parsed && typeof parsed === 'object') {
        const values = Object.values(parsed);
        hasValidState = values.some(val => {
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
          return val !== null && val !== undefined && val !== '';
        });
      }
    } catch (e) {
      hasValidState = false;
    }
  }

  // إذا لم توجد اختيارات سابقة حقيقية، اخرج فوراً دون إظهار الـ Overlay
  if (!hasValidState && !window.wodi_saved_state) return;

  const loader = document.getElementById('config-loader-overlay');
  let timeoutId = null;

  if (loader) {
    loader.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // إيقاف السكرول

    // مؤقت أقصاه 6 ثوانٍ
    timeoutId = setTimeout(() => {
      hideConfigLoaderOverlay();
      showCustomErrorToast("فشل في استرجاع الاختيارات السابقة");
    }, 6000);
  }

  try {
    const parsed = JSON.parse(rawSaved);

    // تطبيق الاختيارات المخزنة (سواء كانت مقابض أو أي كائن آخر)
  if (parsed) {
        if (Array.isArray(parsed.selectedHandleShapes)) {
          S.selectedHandleShapes = parsed.selectedHandleShapes;
        }
        if (Array.isArray(parsed.selectedColors)) {
          S.selectedColors = parsed.selectedColors;
        }
      }

    if (typeof rHnd === 'function') rHnd();
    if (typeof upd === 'function') upd();
    if (typeof updateStepperProgress === 'function') {
      updateStepperProgress();
    }

    // الانتظار لحين اكتمال رندر ورسم الصور
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          const container = document.getElementById('handle-shapes-container');
          const imgs = container
            ? Array.from(container.querySelectorAll('img'))
            : [];

          if (imgs.length) {
            await Promise.all(
              imgs.map(img => {
                if (img.complete && img.naturalWidth !== 0) {
                  return Promise.resolve();
                }

                return new Promise(res => {
                  img.onload = res;
                  img.onerror = res;
                });
              })
            );
          }

          resolve();
        });
      });
    });

  } catch (e) {
    console.warn('Failed to load state:', e);
  } finally {
    if (typeof isRestoring !== 'undefined') {
      isRestoring = false;
    }
  }
}

  function hideConfigLoaderOverlay() {
    const loader = document.getElementById('config-loader-overlay');
    if (loader && loader.style.display !== 'none') {
      loader.style.transition = 'opacity 0.25s ease';
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
        loader.style.opacity = '1';
      }, 250);
    }
  }
  

  // استرجاع البيانات عند فتح الصفحة
  document.addEventListener('DOMContentLoaded', () => {
    loadConfiguratorState();
  });

/*
================================================================================
6. Geolocation & Location Services
   (جلب الموقع، Reverse Geocoding، حساب المسافات وتكلفة التركيب)
================================================================================
*/

// calcInstall uses LOC & haversine to compute a rounded cost or null if out-of-range
function calcInstall(lat, lng) {
  const dist = haversine(LOC.workshop_lat, LOC.workshop_lng, lat, lng);
  const maxDist = (LOC.max_distance_km !== undefined && LOC.max_distance_km !== null)
    ? parseFloat(LOC.max_distance_km)
    : 25;

  // التحقق من المسافة
  if (dist > maxDist) {
    return null; // نعيد null فقط، والتحكم في عرض الرسالة يكون في دالة requestLocation
  }

  // الحساب إذا كان داخل النطاق
  const adjusted = dist * LOC.correction_factor;
  // أصلحت الحساب هنا بإزالة الـ 4 التي كانت مضافة بدون داعٍ (احتفظت بالصيغة كما في الملف الأصلي المقدم)
  return r5(4 * adjusted * LOC.price_per_km + LOC.fixed_cost);
}

// Reverse geocoding using Nominatim to show neighbourhood & city (best-effort)
async function getAddress(lat, lon, resElement) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    if (data.address) {
      const a = data.address;
    const neighbourhood =
      a.neighbourhood ||
      a.suburb ||
      a.quarter ||
      '';

    const city =
      a.city ||
      a.town ||
      a.state_district ||
      a.state ||
      a.county ||
      '';

    const governorate =
      a.state ||
      a.state_district ||
      '';

    const address = [neighbourhood, city]
      .filter(Boolean)
      .join('، ');

    // Store location address data for the Design Request PDF
    window.userLocationAddress = {
      governorate,
      district: neighbourhood,
      city,
      fullAddress: address
    };

    if (address && resElement) {
      resElement.innerHTML += `<br><small>الموقع: ${address}</small>`;
    }
    }
  } catch (e) {
    console.error("تعذر جلب العنوان", e);
  }
}

function openDesignRequestModal() {

  const isMultiShapeHandle = S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02');
  const selectedShapesCount = (isMultiShapeHandle && Array.isArray(S.selectedHandleShapes)) ? S.selectedHandleShapes.length : 0;
  const hasSelectedTwoShapes = selectedShapesCount >= 2;
  const isHandleIncomplete = S.design && S.design.hc !== 0 && (!S.handle || (isMultiShapeHandle && !hasSelectedTwoShapes));
  const hasSelectedColor = Array.isArray(S.selectedColors) && S.selectedColors.length >= 1;
  const isDesignIncomplete = !S.design || !hasSelectedColor;

  if (!S.sinkType || !S.size || isDesignIncomplete || !S.div || isHandleIncomplete) {
    // تخصيص نص الرسالة بدقة حسب الحالة
    if (S.design && !hasSelectedColor) {
      showToast('يرجى اختيار لون الوحدة أولاً.');
    } else if (isMultiShapeHandle && selectedShapesCount === 1) {
      showToast('لقد اخترت شكلاً واحدًا فقط للمقبض، يرجى اختيار الشكل الثاني.');
    } else if (isMultiShapeHandle && selectedShapesCount === 0) {
      showToast('يرجى اختيار الشكلين الخاصين بالمقبض أولاً');
    } else {
      showToast('يرجى إكمال جميع اختيارات وحدة الحوض أولاً');
    }

    // تحديد أول سكشن غير مكتمل بالترتيب والتمرير إليه
    if (!S.sinkType) {
      const sinkTarget = 
        document.getElementById('sink-types') || 
        document.getElementById('sinkType-group-title') || 
        document.querySelector('[data-group="sink-types"]');
      
      sinkTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!S.size) {
      (document.getElementById('sz') || document.getElementById('sizes'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (isDesignIncomplete) {
      const target = (!S.design) 
        ? (document.getElementById('dc') || document.getElementById('design-cards') || document.getElementById('design-group-title') || document.querySelector('[data-group="design"]')) 
        : (document.getElementById('unit-color-section') || document.getElementById('unit-colors-row'));
        
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!S.div) {
      const divTarget = 
        document.getElementById('div-cards') || 
        document.getElementById('div-group-title') || 
        document.getElementById('division-title') || 
        document.querySelector('.div-card')?.parentElement || 
        document.querySelector('[data-group="div"]');
      
      divTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (isHandleIncomplete) {
      const handleTarget = 
        document.getElementById('handle-shapes-row') || 
        document.getElementById('hc') || 
        document.getElementById('handle-group-title') || 
        document.querySelector('[data-group="hc"]');
      
      handleTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return;
  }
  const modal = document.getElementById('design-request-modal');
  if (!modal) return;

  // Prevent scroll on configurator page
  document.body.style.overflow = 'hidden';

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  // Store config in modal state
  window.drDesignConfig = {
    sinkType: S.sinkType,
    design: S.design,
    size: S.size,
    division: S.div,
    handle: S.handle,
    unitPrice: calc()
  };

  // نوع الحوض الحالي من الـ Configurator
  document.getElementById('dr-sink-type').value =
    S.sinkType === 'wall-hung' ? 'حوض معلق' :
    S.sinkType === 'floor-standing' ? 'حوض برجل كاملة' :
    S.sinkType === 'drop-in' ? 'حوض ساقط' : 'حوض فوق الكاونتر';

  // 1) استرجاع المسودة وبيانات Firebase
  loadDRDraft();

  // 2) ربط مستمعي الحفظ التلقائي للحقول النصية ومرفقات الصور
  const inputIds = [
    'dr-sink-brand',
    'dr-sink-width',
    'dr-sink-code',
    'dr-customer-name',
    'dr-customer-phone'
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.listenerAttached) {
      el.addEventListener('input', saveDRDraft);
      el.dataset.listenerAttached = 'true';
    }
  });

  const fileInputIds = ['dr-sink-image', 'dr-sink-photo', 'dr-sink-sticker'];
  fileInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.listenerAttached) {
      el.addEventListener('change', saveDRDraft);
      el.dataset.listenerAttached = 'true';
    }
  });

  // Show Step 1
  drShowStep(1);
}

window.openDesignRequestModal = openDesignRequestModal;

function closeDesignRequestModal() {
  const modal = document.getElementById('design-request-modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
window.closeDesignRequestModal = closeDesignRequestModal;

function drShowStep(stepNum) {

  // Apply text color to all labels
  document.querySelectorAll('.dr-label').forEach(el => {
    el.style.color = 'var(--color-text-main)';
  });

  document.querySelectorAll('.dr-hint').forEach(el => {
    el.style.color = 'var(--color-text-main)';
    el.style.opacity = '0.6';
  });

  // Hide all step contents
  document.querySelectorAll('.dr-step-content').forEach(el => {
    el.style.display = 'none';
  });

  // Show current step
  const currentStep = document.querySelector(
    `.dr-step-content[data-step="${stepNum}"]`
  );

  if (currentStep) {
    currentStep.style.display = 'block';
  }

  // Update modal stepper using the SAME classes as configurator
  const stepperItems = document.querySelectorAll(
    '#dr-stepper .stepper-item'
  );

  stepperItems.forEach(el => {
    const step = parseInt(el.dataset.step, 10);

    // Current step
    if (step === stepNum) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }

    // Previous steps are completed
    if (step < stepNum) {
      el.classList.add('completed');
    } else {
      el.classList.remove('completed');
    }

    // Make sure this state isn't used in the modal
    el.classList.remove('out-of-range');
  });

  // Update buttons
  const prevBtn = document.getElementById('dr-btn-prev');
  const nextBtn = document.getElementById('dr-btn-next');
  const downloadBtn = document.getElementById('dr-btn-download');
  const whatsappBtn = document.getElementById('dr-btn-whatsapp');
  const closeBtn = document.getElementById('dr-btn-close');

  if (prevBtn) {
    prevBtn.style.display = stepNum > 1 ? 'inline-flex' : 'none';
  }

  if (nextBtn) {
    nextBtn.style.display = stepNum < 3 ? 'inline-flex' : 'none';
  }

  if (downloadBtn) {
    downloadBtn.style.display = stepNum === 3 ? 'inline-flex' : 'none';
  }

  if (whatsappBtn) {
    whatsappBtn.style.display = stepNum === 3 ? 'inline-flex' : 'none';
  }

  if (closeBtn) {
    closeBtn.style.display = stepNum === 1 ? 'inline-flex' : 'none';
  }
}

function drValidateStep(stepNum) {
  if (stepNum === 1) {
    const name = document.getElementById('dr-customer-name').value.trim();
    const phone = document.getElementById('dr-customer-phone').value.trim();
    if (!name) {
      showToast('يرجى ملء الاسم');
      return false;
    }
    if (!phone) {
      showToast('يرجى ملء رقم الهاتف');
      return false;
    }
    return true;
  } else if (stepNum === 2) {
    const brand = document.getElementById('dr-sink-brand').value.trim();
    const width = document.getElementById('dr-sink-width').value.trim();
    const hasImage = document.getElementById('dr-sink-image').files.length > 0 || !!window.drSavedImages?.wall;
    if (!brand) {
      showToast('يرجى ملء علامة الحوض');
      return false;
    }
    if (!width) {
      showToast('يرجى ملء عرض الحوض');
      return false;
    }
    if (!hasImage) {
      showToast('يرجى اختيار صورة واضحة للحيطة');
      return false;
    }
    return true;
  }
  return true;
}

function drNextStep() {
  const activeStep = document.querySelector('#dr-stepper .stepper-item.active');
  if (!activeStep) return;
  
  let currentStep = parseInt(activeStep.dataset.step);

  if (!drValidateStep(currentStep)) return;

  if (currentStep === 1) {
    drShowStep(2);
  } else if (currentStep === 2) {
    drShowStep(3);
    setTimeout(drRenderPreview, 100);
  }
}
window.drNextStep = drNextStep;

function drPrevStep() {
  const activeStep = document.querySelector('#dr-stepper .stepper-item.active');
  if (!activeStep) return;
  
  let currentStep = parseInt(activeStep.dataset.step);

  if (currentStep === 2) {
    drShowStep(1);
  } else if (currentStep === 3) {
    drShowStep(2);
  }
}
window.drPrevStep = drPrevStep;

async function drRenderPreview() {
  const previewEl = document.getElementById('dr-invoice-preview');
  if (!previewEl) return;

  previewEl.innerHTML = '';

  // ----------------------------------------------------------
  // Preview container
  // ----------------------------------------------------------

  const frame = previewEl;

  const zoomControls = document.createElement('div');
  zoomControls.className = 'dr-zoom-controls';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
  zoomOutBtn.className = 'dr-zoom-btn';
  zoomOutBtn.textContent = '−';
  zoomOutBtn.title = 'تصغير';

  const zoomResetBtn = document.createElement('button');
  zoomResetBtn.type = 'button';
  zoomResetBtn.textContent = '100%';
  zoomResetBtn.className = 'dr-zoom-btn';
  zoomResetBtn.title = 'الحجم الأصلي';

  const zoomInBtn = document.createElement('button');
  zoomInBtn.type = 'button';
  zoomInBtn.className = 'dr-zoom-btn';
  zoomInBtn.textContent = '+';
  zoomInBtn.title = 'تكبير';

  zoomControls.appendChild(zoomOutBtn);
  zoomControls.appendChild(zoomResetBtn);
  zoomControls.appendChild(zoomInBtn);

  frame.appendChild(zoomControls);

  // ----------------------------------------------------------
  // Load product-order-summary.html directly
  // No iframe
  // ----------------------------------------------------------

  let response;

  try {
    response = await fetch('product-order-summary.html', {
      cache: 'no-store'
    });
  } catch (error) {
    console.error('Failed to load product-order-summary.html:', error);
    return;
  }

  if (!response.ok) {
    console.error(
      'Failed to load product-order-summary.html:',
      response.status
    );
    return;
  }

  const html = await response.text();

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');

  // ----------------------------------------------------------
  // Load the summary page CSS
  // ----------------------------------------------------------

  const summaryStyles = parsedDoc.querySelectorAll(
    'link[rel="stylesheet"]'
  );

  summaryStyles.forEach(link => {
    const href = link.getAttribute('href');

    if (!href) return;

    const absoluteHref = new URL(
      href,
      new URL('product-order-summary.html', window.location.href)
    ).href;

    // Avoid loading the same stylesheet more than once
    const alreadyLoaded = [
      ...document.querySelectorAll('link[rel="stylesheet"]')
    ].some(existing => existing.href === absoluteHref);

    if (!alreadyLoaded) {
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = absoluteHref;
      document.head.appendChild(styleLink);
    }
  });

  // ----------------------------------------------------------
  // Insert the summary page content directly
  // ----------------------------------------------------------

  const content = document.createElement('div');
  content.className = 'dr-preview-document';

  content.innerHTML = parsedDoc.body.innerHTML;

  content.style.width = '100%';
  content.style.minWidth = '0';
  content.style.maxWidth = '100%';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = 'center';
  content.style.boxSizing = 'border-box';

  frame.appendChild(content);

  setTimeout(() => {
  console.log('=== HORIZONTAL SCROLL DEBUG ===');

  console.log('FRAME:', {
    clientWidth: frame.clientWidth,
    scrollWidth: frame.scrollWidth,
    scrollLeft: frame.scrollLeft
  });

  console.log('CONTENT:', {
    clientWidth: content.clientWidth,
    scrollWidth: content.scrollWidth,
    offsetWidth: content.offsetWidth,
    rectWidth: content.getBoundingClientRect().width,
    rectLeft: content.getBoundingClientRect().left,
    rectRight: content.getBoundingClientRect().right
  });

  const pages = content.querySelectorAll('.page');

  pages.forEach((page, index) => {
    const rect = page.getBoundingClientRect();

    console.log(`PAGE ${index + 1}:`, {
      offsetWidth: page.offsetWidth,
      rectWidth: rect.width,
      left: rect.left,
      right: rect.right,
      marginLeft: getComputedStyle(page).marginLeft,
      marginRight: getComputedStyle(page).marginRight
    });
  });

  console.log('=== END HORIZONTAL DEBUG ===');
}, 1000);

  const pages = content.querySelectorAll('.page');

  if (pages.length) {
    pages[pages.length - 1].style.marginBottom = '0';
  }

  // Start the horizontal scroll centered
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitPreviewToWidth();
    });
  });

  // ----------------------------------------------------------
  // Preview zoom
  // ----------------------------------------------------------

  let previewZoom = 1;

  // ----------------------------------------------------------
  // Center preview pages
  // ----------------------------------------------------------

  content.style.width = '100%';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = 'center';
  content.style.boxSizing = 'border-box';

  function applyPreviewZoom() {
    const pages = content.querySelectorAll('.page');

    if (!pages.length) return;

    pages.forEach(page => {
      page.style.transformOrigin = 'top center';
      page.style.transform = `scale(${previewZoom})`;

      // لا نعتمد على auto margins لتوسيط صفحة A4
      page.style.marginLeft = '0';
      page.style.marginRight = '0';
    });

    zoomResetBtn.textContent =
      `${Math.round(previewZoom * 100)}%`;
  }


  function fitPreviewToWidth() {
    const pages = content.querySelectorAll('.page');

    if (!pages.length) return;

    const availableWidth = frame.clientWidth - 20;
    const pageWidth = pages[0].offsetWidth;

    if (!availableWidth || !pageWidth) return;

    let scale = availableWidth / pageWidth;

    scale = Math.min(1, scale);
    scale = Math.max(0.5, scale);

    previewZoom = scale;

    applyPreviewZoom();

    requestAnimationFrame(() => {
      const maxScroll =
        frame.scrollWidth - frame.clientWidth;

      if (maxScroll > 0) {
        frame.scrollLeft = maxScroll / 2;
      } else {
        frame.scrollLeft = 0;
      }
    });
  }

  zoomInBtn.addEventListener('click', () => {
    previewZoom =
      Math.min(
        2,
        +(previewZoom + 0.1).toFixed(2)
      );

    applyPreviewZoom();
  });

  zoomOutBtn.addEventListener('click', () => {
    previewZoom =
      Math.max(
        0.5,
        +(previewZoom - 0.1).toFixed(2)
      );

    applyPreviewZoom();
  });

  zoomResetBtn.addEventListener('click', () => {
    previewZoom = 1;
    applyPreviewZoom();
  });

  // ----------------------------------------------------------
  // Populate data
  // ----------------------------------------------------------

  try {
    const brand =
      document.getElementById('dr-sink-brand')?.value ||
      'غير متوفر';

    const width =
      document.getElementById('dr-sink-width')?.value ||
      'غير متوفر';

    const code =
      document.getElementById('dr-sink-code')?.value ||
      'غير متوفر';

    const name =
      document.getElementById('dr-customer-name')?.value ||
      'غير متوفر';

    const phone =
      document.getElementById('dr-customer-phone')?.value ||
      'غير متوفر';

    const config = window.drDesignConfig;

    if (!config) {
      console.warn('drDesignConfig is missing');
      return;
    }

    const locationAddress =
      window.userLocationAddress || {};

    const lat = window.userLat;
    const lng = window.userLng;
    const shippingCost = window.installCost;

    // --------------------------------------------------------
    // Handles table
    // --------------------------------------------------------
    const handlesTbody = content.querySelector('#sink-handle-items');

    if (handlesTbody) {
      const h1 = S.selectedHandles && S.selectedHandles[0] ? S.selectedHandles[0] : null;
      const h2 = S.selectedHandles && S.selectedHandles[1] ? S.selectedHandles[1] : null;

      const h1Src = h1 ? await makeSquareImage(`images/conf/handles/${encodeURIComponent(h1)}.webp`) : '';
      const h2Src = h2 ? await makeSquareImage(`images/conf/handles/${encodeURIComponent(h2)}.webp`) : '';

      const h1Html = h1Src
        ? `<img src="${h1Src}" style="width:40px; height:40px; object-fit:contain; background:#ffffff; display:block; margin:0 auto;" />`
        : '—';

      const h2Html = h2Src
        ? `<img src="${h2Src}" style="width:40px; height:40px; object-fit:contain; background:#ffffff; display:block; margin:0 auto;" />`
        : '—';

      handlesTbody.innerHTML = `
        <tr class="item-row">
          <td class="col-section">المقابض</td>
          <td class="col-code">${config.handle ? config.handle.id : '—'}</td>
          <td class="col-priority-1">${h1Html}</td>
          <td class="col-priority-2">${h2Html}</td>
          <td class="col-price">${config.handle ? config.handle.price : 0} ج.م</td>
        </tr>
      `;
    }

    // --------------------------------------------------------
    // Configurator images
    // --------------------------------------------------------

    const designImg =
      content.querySelector('#design-img');

    const divisionImg =
      content.querySelector('#division-img');

    const handleImg =
      content.querySelector('#handle-img');

    if (designImg && config.design?.id) {
      designImg.src = getConfiguratorImageUrl(
        config.design.id,
        config.sinkType
      );
    }

    if (divisionImg && config.division?.id) {
      divisionImg.src = getConfiguratorImageUrl(
        config.division.id,
        config.sinkType
      );
    }

    if (handleImg && config.handle?.id) {
      handleImg.src = getConfiguratorImageUrl(
        config.handle.id,
        config.sinkType
      );
    }

    // --------------------------------------------------------
    // Wall image
    // --------------------------------------------------------

    const wallImageEl =
      content.querySelector('#sink-wall-image');

    const wallImageInput =
      document.getElementById('dr-sink-image');

    const wallImageFile =
      wallImageInput?.files?.[0];

    if (wallImageFile && wallImageEl) {
      const reader = new FileReader();

      reader.onload = e => {
        wallImageEl.src = e.target.result;
      };

      reader.readAsDataURL(wallImageFile);
    } else if (window.drSavedImages?.wall && wallImageEl) {
      wallImageEl.src = window.drSavedImages.wall;
    }

    // --------------------------------------------------------
    // Sink image
    // --------------------------------------------------------

    const sinkImageEl =
      content.querySelector('#sink-image');

    const sinkImageInput =
      document.getElementById('dr-sink-photo');

    const sinkImageFile =
      sinkImageInput?.files?.[0];

    if (sinkImageFile && sinkImageEl) {
      const reader = new FileReader();

      reader.onload = e => {
        sinkImageEl.src = e.target.result;
      };

      reader.readAsDataURL(sinkImageFile);
    } else if (window.drSavedImages?.photo && sinkImageEl) {
      sinkImageEl.src = window.drSavedImages.photo;
    }

    // --------------------------------------------------------
    // Sticker image
    // --------------------------------------------------------

    const stickerImageEl =
      content.querySelector('#sink-label-image');

    const stickerImageInput =
      document.getElementById('dr-sink-sticker');

    const stickerImageFile =
      stickerImageInput?.files?.[0];

    if (stickerImageFile && stickerImageEl) {
      const reader = new FileReader();

      reader.onload = e => {
        stickerImageEl.src = e.target.result;
      };

      reader.readAsDataURL(stickerImageFile);
    } else if (window.drSavedImages?.sticker && stickerImageEl) {
      stickerImageEl.src = window.drSavedImages.sticker;
    }

    // --------------------------------------------------------
    // Sink type
    // --------------------------------------------------------

    const sinkTypeEl =
      content.querySelector('#sink-type');

    if (sinkTypeEl) {
      const sinkTypeNames = {
        'wall-hung': 'حوض معلق',
        'floor-standing': 'حوض برجل كاملة',
        'drop-in': 'حوض ساقط',
        'bowl': 'حوض فوق الكاونتر'
      };

      sinkTypeEl.textContent =
        sinkTypeNames[config.sinkType] ||
        config.sinkType;
    }

    // --------------------------------------------------------
    // Sink specifications
    // --------------------------------------------------------

    const sinkBrandEl =
      content.querySelector('#sink-brand');

    if (sinkBrandEl) {
      sinkBrandEl.textContent = brand;
    }

    const sinkWidthEl =
      content.querySelector('#sink-width');

    if (sinkWidthEl) {
      sinkWidthEl.textContent = width ? `${width} سم` : '';
    }

    const sinkCodeEl =
      content.querySelector('#sink-code');

    if (sinkCodeEl) {
      sinkCodeEl.textContent = code;
    }

    // --------------------------------------------------------
    // Customer information
    // --------------------------------------------------------

    const custNameEl =
      content.querySelector('#customer-name');

    if (custNameEl) {
      custNameEl.textContent = name;
    }

    const custPhoneEl =
      content.querySelector('#customer-phone');

    if (custPhoneEl) {
      custPhoneEl.textContent = phone;
    }

    // --------------------------------------------------------
    // Location information
    // --------------------------------------------------------

    const governorateEl =
      content.querySelector('#shipping-governorate');

    if (governorateEl) {
      governorateEl.textContent =
        locationAddress.governorate ||
        'غير متوفر';
    }

    const districtEl =
      content.querySelector('#shipping-district');

    if (districtEl) {
      districtEl.textContent =
        locationAddress.district ||
        locationAddress.city ||
        'غير متوفر';
    }

    const lngEl =
      content.querySelector('#shipping-lng');

    if (lngEl) {
      lngEl.textContent =
        typeof lng === 'number'
          ? lng.toFixed(6)
          : 'غير متوفر';
    }

    const latEl =
      content.querySelector('#shipping-lat');

    if (latEl) {
      latEl.textContent =
        typeof lat === 'number'
          ? lat.toFixed(6)
          : 'غير متوفر';
    }

    // --------------------------------------------------------
    // Static map
    // --------------------------------------------------------

    const shippingMapEl =
      content.querySelector('#shipping-map-image');

    if (
      shippingMapEl &&
      typeof lat === 'number' &&
      typeof lng === 'number'
    ) {
      const mapUrl =
        buildStaticMapUrl(
          lat,
          lng,
          700,
          350
        );

      if (mapUrl) {
        shippingMapEl.src = mapUrl;
        shippingMapEl.hidden = false;
      }
    }

    // --------------------------------------------------------
    // Design table
    // --------------------------------------------------------

    const designTbody =
      content.querySelector('#sink-design-items');

    if (designTbody) {
      const selectedColorId = S.selectedColors && S.selectedColors[0] ? S.selectedColors[0] : null;
      const colorImgHtml = selectedColorId
        ? `<img src="images/conf/clr/${encodeURIComponent(selectedColorId)}.webp" style="height:36px; object-fit:contain;" onerror="this.src='images/conf/clr/${encodeURIComponent(selectedColorId)}.png'" />`
        : '—';

      designTbody.innerHTML = `
        <tr class="item-row">
          <td class="col-section">التصميم</td>
          <td class="col-name">${config.design.name}</td>
          <td class="col-code">${config.design.id}</td>
          <td class="col-color">${colorImgHtml}</td>
          <td class="col-price">${config.size.price} ج.م</td>
        </tr>
      `;
    }

    // --------------------------------------------------------
    // Division table
    // --------------------------------------------------------

    const divisionTbody =
      content.querySelector('#sink-division-items');

    if (divisionTbody) {
      const sg = sgr(config.size.size);
      const divPrice =
        dvp(config.division, sg);

      divisionTbody.innerHTML = `
        <tr class="item-row">
          <td class="col-section">التقسيمة الداخلية</td>
          <td class="col-name">${config.division.name}</td>
          <td class="col-code">${config.division.id}</td>
          <td class="col-price">${divPrice} ج.م</td>
        </tr>
      `;
    }

    // --------------------------------------------------------
    // Handle table
    // --------------------------------------------------------

    const handleTbody =
      content.querySelector('#sink-handle-items');

    if (handleTbody && config.handle) {
      const p1Shape = S.selectedHandleShapes && S.selectedHandleShapes[0] 
        ? `<img src="images/conf/hnd/${encodeURIComponent(S.selectedHandleShapes[0])}.webp" style="height:36px; object-fit:contain;" onerror="this.src='images/conf/hnd/${encodeURIComponent(S.selectedHandleShapes[0])}.png'" />` 
        : '—';
      const p2Shape = S.selectedHandleShapes && S.selectedHandleShapes[1] 
        ? `<img src="images/conf/hnd/${encodeURIComponent(S.selectedHandleShapes[1])}.webp" style="height:36px; object-fit:contain;" onerror="this.src='images/conf/hnd/${encodeURIComponent(S.selectedHandleShapes[1])}.png'" />` 
        : '—';

      handleTbody.innerHTML = `
        <tr class="item-row">
          <td class="col-section">نوع المقبض</td>
          <td class="col-name">${config.handle.name}</td>
          <td class="col-code">${config.handle.id}</td>
          <td class="col-handle-priority">${p1Shape}</td>
          <td class="col-handle-priority">${p2Shape}</td>
          <td class="col-price">${config.handle.price} ج.م</td>
        </tr>
      `;
    }

    // --------------------------------------------------------
    // Total
    // --------------------------------------------------------

    const totalEl =
      content.querySelector('#order-total');

    if (totalEl) {
      totalEl.textContent =
        `${config.unitPrice} ج.م`;
    }

    // --------------------------------------------------------
    // Order number
    // --------------------------------------------------------

    const orderNumEl =
      content.querySelector('#order-number');

    if (orderNumEl) {
      orderNumEl.textContent =
        `DR-${String(Date.now()).slice(-8)}`;
    }

    // --------------------------------------------------------
    // Initial fit
    // --------------------------------------------------------

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitPreviewToWidth();
      });
    });

  } catch (e) {
    console.warn('Preview error:', e);
  }
}

window.drRenderPreview = drRenderPreview;

const DR_STORAGE_KEY = 'dr_form_draft';

// قراءة ملف كـ Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// دالة مساعدة لتحديث واجهة الحاوية وتنسيق المعاينة
function updateCustomFileUI(inputId, imageBase64, defaultText = 'اضغط لرفع الصورة') {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;

  let wrapper = inputEl.closest('.dr-file-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'dr-file-wrapper';
    inputEl.parentNode.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);
  }

  let contentBox = wrapper.querySelector('.dr-file-content');
  if (!contentBox) {
    contentBox = document.createElement('div');
    contentBox.className = 'dr-file-content';
    wrapper.appendChild(contentBox);
  }

  if (imageBase64) {
    contentBox.innerHTML = `
      <div class="dr-file-preview-box">
        <img src="${imageBase64}" alt="معاينة" />
        <div class="dr-file-preview-info">
          <span>✓ تم حفظ الصورة بنجاح</span>
          <small>اضغط هنا لتغيير الصورة</small>
        </div>
      </div>
    `;
    wrapper.style.borderColor = '#10b981';
    wrapper.style.backgroundColor = '#ecfdf5';
  } else {
    contentBox.innerHTML = `
      <div style="font-size: 13px; color: #6b7280;">
        📁 ${defaultText}
      </div>
    `;
    wrapper.style.borderColor = '#d1d5db';
    wrapper.style.backgroundColor = '#f9fafb';
  }
}

function makeSquareImage(src, targetSize = 300) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');

      // تعبئة الخلفية باللون الأبيض
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);

      // حساب الأبعاد للسنترة مع الحفاظ على النسبة (Aspect Ratio)
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (targetSize - w) / 2;
      const y = (targetSize - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(src); // في حال فشل التحميل يُرجع الرابط الأصلي
    img.src = src;
  });
}

// حفظ المسودة كاملة (بيانات + لوكيشن + صور)
async function saveDRDraft() {
  const wallFile = document.getElementById('dr-sink-image')?.files?.[0];
  const photoFile = document.getElementById('dr-sink-photo')?.files?.[0];
  const stickerFile = document.getElementById('dr-sink-sticker')?.files?.[0];

  const saved = JSON.parse(localStorage.getItem(DR_STORAGE_KEY) || '{}');

  const wallBase64 = wallFile ? await fileToBase64(wallFile) : (saved.wallImage || null);
  const photoBase64 = photoFile ? await fileToBase64(photoFile) : (saved.sinkPhoto || null);
  const stickerBase64 = stickerFile ? await fileToBase64(stickerFile) : (saved.stickerPhoto || null);

  // تحديث واجهة الصناديق فور رفع ملف جديد
  if (wallFile) updateCustomFileUI('dr-sink-image', wallBase64);
  if (photoFile) updateCustomFileUI('dr-sink-photo', photoBase64);
  if (stickerFile) updateCustomFileUI('dr-sink-sticker', stickerBase64);

  // تحديث الكائن في الذاكرة الحية
  window.drSavedImages = {
    wall: wallBase64,
    photo: photoBase64,
    sticker: stickerBase64
  };

  const data = {
    brand: document.getElementById('dr-sink-brand')?.value || '',
    width: document.getElementById('dr-sink-width')?.value || '',
    code: document.getElementById('dr-sink-code')?.value || '',
    name: document.getElementById('dr-customer-name')?.value || '',
    phone: document.getElementById('dr-customer-phone')?.value || '',
    locationAddress: window.userLocationAddress || saved.locationAddress || null,
    userLat: window.userLat || saved.userLat || null,
    userLng: window.userLng || saved.userLng || null,
    wallImage: wallBase64,
    sinkPhoto: photoBase64,
    stickerPhoto: stickerBase64
  };

  try {
    localStorage.setItem(DR_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage quota exceeded (image might be too large):', e);
  }
}

// استرجاع المسودة
function loadDRDraft() {
  // تهيئة واجهات الصناديق بالحالة الافتراضية أولاً
  updateCustomFileUI('dr-sink-image', null, 'اضغط لاختيار صورة الحائط');
  updateCustomFileUI('dr-sink-photo', null, 'اضغط لاختيار صورة الحوض');
  updateCustomFileUI('dr-sink-sticker', null, 'اضغط لاختيار صورة الستيكر');

  const saved = localStorage.getItem(DR_STORAGE_KEY);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);

    if (data.brand) document.getElementById('dr-sink-brand').value = data.brand;
    if (data.width) document.getElementById('dr-sink-width').value = data.width;
    if (data.code) document.getElementById('dr-sink-code').value = data.code;

    // الاسم والهاتف: الأولوية لـ Firebase، ثم المسودة المحفوظة
    document.getElementById('dr-customer-name').value =
      window.currentUser?.displayName || data.name || '';
    document.getElementById('dr-customer-phone').value =
      window.currentUser?.phoneNumber || data.phone || '';

    // استرجاع بيانات الموقع الجغرافي وإظهار الخريطة
    if (data.locationAddress) {
      window.userLocationAddress = data.locationAddress;
      window.userLat = data.userLat;
      window.userLng = data.userLng;
      
      const locResult = document.getElementById('dr-loc-result');
      if (locResult) {
        locResult.textContent = `${data.locationAddress.governorate || ''} - ${data.locationAddress.district || ''}`;
        locResult.style.display = 'block';
      }

      const mapContainer = document.getElementById('dr-mapContainer');
      if (mapContainer && typeof data.userLat === 'number' && typeof data.userLng === 'number') {
        mapContainer.hidden = false;
        if (typeof renderStaticMap === 'function') {
          renderStaticMap(data.userLat, data.userLng);
        } else {
          const mapImg = mapContainer.querySelector('img');
          if (mapImg && typeof buildStaticMapUrl === 'function') {
            mapImg.src = buildStaticMapUrl(data.userLat, data.userLng, 700, 350);
          }
        }
      }
    }

    // حفظ مسارات الصور في الـ window
    window.drSavedImages = {
      wall: data.wallImage || null,
      photo: data.sinkPhoto || null,
      sticker: data.stickerPhoto || null
    };

    // تحديث واجهات رفع الصور بالمعاينة المحفوظة
    if (data.wallImage) updateCustomFileUI('dr-sink-image', data.wallImage);
    if (data.sinkPhoto) updateCustomFileUI('dr-sink-photo', data.sinkPhoto);
    if (data.stickerPhoto) updateCustomFileUI('dr-sink-sticker', data.stickerPhoto);

  } catch (e) {
    console.error('Failed to parse draft data:', e);
  }
}

function drDownloadPdf() {
  const previewEl = document.getElementById('dr-invoice-preview');
  if (!previewEl || !previewEl.querySelector('iframe')) {
    showToast('يرجى مراجعة المعاينة أولاً');
    return;
  }

  const iframe = previewEl.querySelector('iframe');
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  if (!iframeDoc) {
    showToast('فشل تحميل المحتوى');
    return;
  }

  const orderNum = `DR-${String(Date.now()).slice(-8)}`;
  
  try {
    if (typeof html2pdf === 'undefined') {
      showToast('مكتبة PDF غير متاحة');
      return;
    }

    const element = iframeDoc.querySelector('.page') || iframeDoc.body;
    const opt = {
      margin: 10,
      filename: `WODI-Design-Request-${orderNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(element).save();
    showToast('تم تحميل ملخص الطلب');
  } catch (e) {
    console.error('PDF gen error:', e);
    showToast('فشل إنشاء ملف PDF — تأكد من تحميل مكتبة html2pdf');
  }
}
window.drDownloadPdf = drDownloadPdf;

// Location detection for design request modal
function drGetLocation() {
  const btn = document.getElementById('dr-btn-locate');
  const res = document.getElementById('dr-loc-result');
  const mapContainer = document.getElementById('dr-mapContainer');
  const mapImage = document.getElementById('dr-staticMap');

  if (typeof getLocation === 'function') {
    getLocation(btn, res, mapContainer, mapImage);
  }
}

window.drGetLocation = drGetLocation;

function drSendWhatsApp() {
  const config = window.drDesignConfig;
  const brand = document.getElementById('dr-sink-brand').value || 'غير متوفر';
  const width = document.getElementById('dr-sink-width').value || 'غير متوفر';
  const code = document.getElementById('dr-sink-code').value || 'غير متوفر';
  const name = document.getElementById('dr-customer-name').value || 'غير متوفر';

  const message = `السلام عليكم،

أرغب في طلب معاينة وتصميم لوحدة حوض بالمواصفات التالية:

*مواصفات الحوض:*
علامة: ${brand}
العرض: ${width} سم
الكود: ${code}

*مواصفات الوحدة المطلوبة:*
النوع: ${config.sinkType}
التصميم: ${config.design.name}
المقاس: ${config.size.size}
التقسيمة: ${config.division.name}
المقبض: ${config.handle ? config.handle.name : 'بدون'}
السعر المتوقع: ${config.unitPrice} ج.م

الاسم: ${name}

يرجى التواصل معي لتأكيد التفاصيل والمتابعة.

شكراً لكم.`;

  const waUrl = `https://wa.me/201556840368?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
}
window.drSendWhatsApp = drSendWhatsApp;

// Request location UI entry
function requestLocation() {
  const btn = document.getElementById('btn-locate');
  const res = document.getElementById('loc-result');
  const mapContainer = document.getElementById('mapContainer');
  const mapImage = document.getElementById('staticMap');

  if (!navigator.geolocation) {
    if (res) { res.textContent = 'خدمة تحديد الموقع غير متاحة حالياً'; res.className = 'loc-result error show'; }
    if (btn) { btn.disabled = false; btn.innerHTML = 'تحديد موقعي الحالي'; }
    return;
  }

  getLocation(btn, res, mapContainer, mapImage);
}

function buildStaticMapUrl(lat, lng, width = 600, height = 350) {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !GEOAPIFY_API_KEY
  ) {
    return '';
  }

  const params = new URLSearchParams({
    style: 'osm-bright',
    width: String(width),
    height: String(height),
    center: `lonlat:${lng},${lat}`,
    zoom: '15',
    marker: `lonlat:${lng},${lat};type:material;color:#9caf88;size:large`,
    apiKey: GEOAPIFY_API_KEY
  });

  return `https://maps.geoapify.com/v1/staticmap?${params.toString()}`;
}

// Main geolocation routine with UI updates & error handling
function getLocation(btn, res, mapContainer, mapImage) {
  // normalize parameters (accept element or id)
  btn = (typeof btn === 'string') ? document.getElementById(btn) : btn;
  res = (typeof res === 'string') ? document.getElementById(res) : res;
  mapContainer = (typeof mapContainer === 'string') ? document.getElementById(mapContainer) : mapContainer;
  mapImage = (typeof mapImage === 'string') ? document.getElementById(mapImage) : mapImage;

  if (!navigator.geolocation) {
    if (res) { res.textContent = 'خدمة تحديد الموقع غير متاحة حالياً'; res.className = 'loc-result error show'; }
    if (btn) { btn.disabled = false; btn.innerHTML = 'تحديد موقعي الحالي'; }
    return;
  }

  // دالة مساعدة لتمرير البيانات وتحديث الـ Invoice Preview فوراً
  window.dispatchLocationUpdate = function(data) {
    window.dispatchEvent(new CustomEvent('app:location-updated', { detail: data }));
  };

  // early UI: show loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> جارٍ تحديد موقعك...';
  }
  if (res) {
    res.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>يتم تحديد موقعك... الرجاء الانتظار</span></span>';
    res.className = 'loc-result';
    res.style.display = 'block';
  }

  setTimeout(() => {
    if (!navigator.geolocation) {
      if (res) { res.textContent = 'متصفحك لا يدعم تحديد الموقع'; res.className = 'loc-result error show'; }
      if (btn) { btn.disabled = false; btn.innerHTML = 'تحديد موقعي الحالي'; }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          window.userLat = userLat;
          window.userLng = userLng;

          if (mapImage) {
            const mapUrl = buildStaticMapUrl(userLat, userLng, 600, 300);

            if (mapUrl) {
              mapImage.src = mapUrl;
            }
          }

          if (mapContainer) {
            mapContainer.hidden = false;
            mapContainer.style.display = 'block';
          }

          // إطلاق الحدث المخصص لتحديث بيانات الموقع فوراً في السلة والـ Preview
          if (typeof window.dispatchLocationUpdate === 'function') {
            window.dispatchLocationUpdate({ lat: userLat, lng: userLng, shippingCost: installCost });
          }
          if (mapContainer) {
            mapContainer.style.display = 'block';
            mapContainer.hidden = false;
          }

          try {
            installCost = (typeof calcInstall === 'function') ? calcInstall(userLat, userLng) : null;
          } catch (e) {
            console.warn('calcInstall error', e);
            installCost = null;
          }
          window.installCost = installCost;

          // optional: check forbidden keywords via reverse geocode (best-effort)
          let isForbidden = false;
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}&accept-language=ar`;
            const response = await fetch(url);
            if (response && response.ok) {
              const data = await response.json();
              if (data && data.address) {
                const addr = JSON.stringify(data.address);
                const forbiddenKeywords = ['أشمون', 'بشتيل', 'أوسيم', 'أبو زعبل', 'القناطر', 'طنان'];
                isForbidden = forbiddenKeywords.some(keyword => addr.includes(keyword));
              }
            }
          } catch (e) {
            console.warn("تعذر التحقق من اسم المنطقة، سنعتمد على المسافة فقط.", e);
          }

          // handle out-of-range or forbidden
          if (installCost === null || isForbidden) {
            if (res) {
              res.innerHTML = `نعتذر، موقعك خارج نطاق خدمتنا. <button onclick="outOfRangeWA()" style="background:none;border:none;color:#9caf88;cursor:pointer;font-family:'Cairo',sans-serif;font-size:12px;text-decoration:underline;">هل يمكن التنفيذ في منطقتي؟</button>`;
              res.className = 'loc-result show out-of-range';
            }
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" stroke-dasharray="4 2"/></svg> تحديد موقعي الحالي';
            }
            if (typeof upd === 'function') try { upd(); } catch (e) { console.warn(e); }
            return;
          }

          // success: show cost and then fetch + display address details
          if (res) {
            res.innerHTML = 'تم تحديد موقعك — تكلفة التوصيل: ' + (installCost !== null ? installCost + ' EGP' : '—');
            res.className = 'loc-result show';
          }

          if (typeof getAddress === 'function') {
            try { await getAddress(userLat, userLng, res); } catch (e) { console.warn('getAddress failed', e); }
          }

          const expBtn = document.getElementById('export-location');
          if (expBtn) expBtn.disabled = false;

          if (btn) {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> تم تحديد الموقع';
            btn.disabled = false;
          }

          if (typeof completeStep === 'function') {
            try { completeStep('step-location'); } catch (e) { /* ignore */ }
          }
          if (typeof upd === 'function') {
            try { upd(); } catch (e) { console.warn(e); }
          }

        } catch (err) {
          console.error('Error in getLocation success handler', err);
          if (res) { res.textContent = 'حدث خطأ أثناء معالجة الموقع'; res.className = 'loc-result error show'; }
          if (btn) { btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }
        }
      },
      err => {
        let msg = 'لم يتم السماح بالوصول للموقع';
        if (err && err.code === 1) msg = 'يرجى السماح للمتصفح بالوصول لموقعك';
        if (res) { res.textContent = msg; res.className = 'loc-result error show'; }
        if (btn) { btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }
      },
      { timeout: 15000, maximumAge: 60000 }
    );
  }, 500);
}

/*
================================================================================
7. Event Listeners & Initialization
   (تهيئة الأحداث، توحيد مستمعي DOMContentLoaded / load، واستدعاء الدوال الأولية)
================================================================================
*/

function setupScrollArrowButtons() {
  document.querySelectorAll('.scroll-arrow').forEach(function (btn) {
    // avoid duplicate handlers
    btn.replaceWith(btn.cloneNode(true));
  });
  // re-query (cloned elements)
  document.querySelectorAll('.scroll-arrow').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetId = btn.dataset.target;
      const dir = parseInt(btn.dataset.dir || '1', 10);
      const row = document.getElementById(targetId);
      if (!row) return;
      const chunk = row.clientWidth * 0.6;
      row.scrollBy({ left: dir * chunk * -1, behavior: 'smooth' });
    });
  });
}

function setupCardsRowScrollListeners() {
  document.querySelectorAll('.cards-row').forEach(function (row) {
    // avoid adding duplicate listeners
    row.replaceWith(row.cloneNode(true));
  });
  document.querySelectorAll('.cards-row').forEach(function (row) {
    row.addEventListener('scroll', () => {
      // update arrows in the custom logic that handles RTL
      document.querySelectorAll('.scroll-wrap').forEach(function (wrap) {
        const r = wrap.querySelector('.cards-row');
        const startBtn = wrap.querySelector('.scroll-arrow.arr-start');
        const endBtn = wrap.querySelector('.scroll-arrow.arr-end');
        if (!r) return;
        const maxScroll = r.scrollWidth - r.clientWidth;
        if (maxScroll <= 0) {
          if (startBtn) startBtn.classList.add('hidden');
          if (endBtn) endBtn.classList.add('hidden');
          return;
        }
        const current = Math.abs(r.scrollLeft);
        const canScrollRight = current > 10;
        const canScrollLeft = current < (maxScroll - 10);
        if (startBtn) startBtn.classList.toggle('hidden', !canScrollRight);
        if (endBtn) endBtn.classList.toggle('hidden', !canScrollLeft);
      });
    });
  });
}

function setupSinkTypeCards() {
  document.querySelectorAll('.sink-type-card').forEach(card => {
    card.addEventListener('click', function () {
      document.querySelectorAll('.sink-type-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      S.sinkType = this.dataset.type;

      hidePlaceholders();

      S.design = null;
      S.size = null;
      S.div = null;
      S.handle = null;

      if (!dataLoaded) {
        showConfiguratorLoading();
        loadConfiguratorData();
      } else {
        rDes();
        rSz();
        rDiv();
        rHnd();
        upd();
      }
    });
  });

  // initial arrow update
  updateArrows('sink-types');
  const sinkRow = document.getElementById('sink-types');
  if (sinkRow) sinkRow.addEventListener('scroll', () => updateArrows('sink-types'));
}

// Sticky mobile price bar (keeps original logic but avoids duplicates)
function setupStickyPriceBar() {
  (function () {
    const MOBILE_BREAK = 900; // px
    let stickyEl = null;
    let io = null;
    let mutation = null;

    function createSticky() {
      if (stickyEl) return stickyEl;

      const resetIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
      const eyeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

      stickyEl = document.createElement('div');
      stickyEl.className = 'price-sticky';
      stickyEl.innerHTML =
        '<div class="total">' +
        '<span class="lbl">إجمالي الوحدة</span>' +
        '<span class="val" id="sticky-total">— EGP</span>' +
        '</div>' +
        '<div class="sticky-actions">' +
        '<button class="sticky-reset" id="sticky-reset" aria-label="إعادة التعيين" title="إعادة التعيين">' + resetIcon + '</button>' +
        '<button class="sticky-order" id="sticky-order" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">' + eyeIcon + ' <span>تفاصيل السعر</span></button>' +
        '</div>';
      document.body.appendChild(stickyEl);

      const orderBtn = document.getElementById('sticky-order');
      if (orderBtn) {
        orderBtn.addEventListener('click', function () {
          const targetSection = document.getElementById('sbar') || document.querySelector('.price-column.sbar') || document.querySelector('.details-section');
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
      const resetBtn = document.getElementById('sticky-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          if (typeof resetAll === 'function') resetAll();
          else document.querySelector('.btn-reset')?.click();
        });
      }

      // إضافة الانيميشن والحالة الابتدائية (مختفي تحت الشاشة)
      stickyEl.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
      stickyEl.style.transform = 'translateY(100%)';
      stickyEl.style.opacity = '0';
      stickyEl.style.pointerEvents = 'none';
      stickyEl.style.display = 'flex';

      return stickyEl;
    }

    function destroySticky() {
      if (io) { io.disconnect(); io = null; }
      if (mutation) { mutation.disconnect(); mutation = null; }
      if (stickyEl) { stickyEl.remove(); stickyEl = null; }
      document.body.classList.remove('has-sticky-bar');
    }

    function updateStickyValue() {
      const total = typeof calc === 'function' ? calc() : null;
      const formattedPrice = (total !== null && total > 0) 
        ? `${total.toLocaleString('en-US')} <small style="font-size: 0.75em; font-weight: normal; margin-left: 2px;">EGP</small>` 
        : '— EGP';
      
      const el1 = document.getElementById('sticky-price-val');
      const el2 = document.getElementById('sticky-total');
      
      const applyAnimation = (el) => {
        if (!el) return;
        const lastTotal = el.dataset.lastTotal !== undefined ? parseFloat(el.dataset.lastTotal) : null;
        el.innerHTML = formattedPrice;

        // تشغيل الـ Pulse فقط لو تغير الرقم الإجمالي فعلياً
        if (lastTotal !== total) {
          el.dataset.lastTotal = total;
          el.classList.remove('price-updated');
          void el.offsetWidth; // Reflow
          el.classList.add('price-updated');
        }
      };

      applyAnimation(el1);
      applyAnimation(el2);

      const stickyBtn = document.querySelector('.mobile-checkout-cta-btn');
      if (stickyBtn) {
        stickyBtn.textContent = 'طلب التصميم والمعاينة';
        stickyBtn.onclick = () => openSinkOrderModal();
      }
    }
    window.updateStickyValue = updateStickyValue;

    function showSticky() {
      if (!stickyEl) createSticky();
      stickyEl.style.transform = 'translateY(0)';
      stickyEl.style.opacity = '1';
      stickyEl.style.pointerEvents = 'auto';
      document.body.classList.add('has-sticky-bar'); // إضافة الكلاس لرفع التوست فوق الشريط
      updateStickyValue();
    }

    function hideSticky() {
      if (stickyEl) {
        stickyEl.style.transform = 'translateY(100%)';
        stickyEl.style.opacity = '0';
        stickyEl.style.pointerEvents = 'none';
      }
      document.body.classList.remove('has-sticky-bar'); // إزالة الكلاس لتنزيل التوست لمكانه الاصلي
    }

    function isElementPositionedFixedOrSticky(el) {
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return cs.position === 'fixed' || cs.position === 'sticky';
    }

    function setupObservers() {
      const target = document.getElementById('sbar') || document.querySelector('.price-column.sbar');
      if (!target) {
        showSticky();
        return;
      }
      if (isElementPositionedFixedOrSticky(target)) {
        destroySticky();
        return;
      }
      createSticky();
      if (io) io.disconnect();

      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (ent) {
          if (ent.isIntersecting || ent.boundingClientRect.top < 0) {
            hideSticky();
          } else {
            showSticky();
          }
        });
      }, { root: null, threshold: 0 });

      io.observe(target);
    }

    function enableIfMobile() {
      if (window.innerWidth > MOBILE_BREAK) {
        destroySticky();
        return;
      }
      const target = document.getElementById('sbar') || document.querySelector('.price-column.sbar');
      if (target && isElementPositionedFixedOrSticky(target)) {
        destroySticky();
        return;
      }
      setupObservers();
    }

    window.addEventListener('load', () => {
      enableIfMobile();
      if (window.innerWidth <= MOBILE_BREAK) {
        createSticky(); // إنشاء العنصر فورًا حتى لو مخفي، عشان يكون جاهز لأي تحديث لاحق
      }
    });
    window.addEventListener('resize', function () {
      clearTimeout(window._priceStickyResize);
      window._priceStickyResize = setTimeout(enableIfMobile, 120);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(enableIfMobile, 300);
    });

    window.updateStickyValue = updateStickyValue;
  })();
}

// Stepper sticky & visibility management (Accelerated CSS Transform Sync)
function setupStepperSticky() {
  (function () {
    let io = null;
    function setup() {
      const stepperEl = document.getElementById('design-stepper');
      const navbar = document.querySelector('.navbar');
      const targetSection = document.getElementById('sbar') || document.querySelector('.price-column.sbar') || document.querySelector('.details-section');
      
      if (!stepperEl || !targetSection) return;
      if (io) io.disconnect();

      // حساب ارتفاع الـ Navbar الفعلي تلقائياً وتحديثه
      if (navbar) {
        document.documentElement.style.setProperty('--nav-height', `${navbar.offsetHeight}px`);
      }

      // إدارة إخفاء الـ Stepper تماماً عند الوصول لسكشن التفاصيل
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (ent) {
          if (ent.isIntersecting || ent.boundingClientRect.top <= 60) {
            stepperEl.style.opacity = '0';
            stepperEl.style.visibility = 'hidden';
            stepperEl.style.pointerEvents = 'none';
          } else {
            stepperEl.style.opacity = '1';
            stepperEl.style.visibility = 'visible';
            stepperEl.style.pointerEvents = 'auto';
          }
        });
      }, { root: null, threshold: 0 });

      io.observe(targetSection);

      window.addEventListener('scroll', function () {
        if (window.scrollY > 20) {
          stepperEl.classList.add('is-sticky');
        } else {
          stepperEl.classList.remove('is-sticky');
        }
      }, { passive: true });
    }

    if (document.readyState === 'complete') setup();
    else window.addEventListener('load', setup);
    
    window.addEventListener('resize', setup);
  })();
}

// Update stepper progress (With Half-Completed State support)
function updateStepperProgress() {
  const stepDesign = document.getElementById('st-design');
  const stepSinkType = document.getElementById('st-sink-type');
  const stepSize = document.getElementById('st-size');
  const stepPartition = document.getElementById('st-partition');
  const stepHandle = document.getElementById('st-handle');
  const stepLocation = document.getElementById('st-location');

  // --- 1. فحص حالة التصميم والألوان ---
  const hasSelectedDesign = Boolean(typeof S !== 'undefined' && S.design && (S.design.id || S.design.name || S.design.type));
  const hasSelectedColor = Boolean(typeof S !== 'undefined' && Array.isArray(S.selectedColors) && S.selectedColors.length >= 1);

  const isDesignFullyCompleted = hasSelectedDesign && hasSelectedColor;
  const isDesignHalfCompleted = (hasSelectedDesign && !hasSelectedColor) || (!hasSelectedDesign && hasSelectedColor);

  // --- 2. فحص حالة المقابض ---
  const noH = Boolean(typeof S !== 'undefined' && S.design && S.design.hc === 0);
  const isMultiShapeHandle = typeof S !== 'undefined' && S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02');
  
  const handleShapesCount = (isMultiShapeHandle && Array.isArray(S.selectedHandleShapes)) ? S.selectedHandleShapes.length : 0;
  
  const isHandleFullyCompleted = typeof S !== 'undefined' && (
    noH || 
    (isMultiShapeHandle ? handleShapesCount >= 2 : Boolean(S.handle))
  );

  const isHandleHalfCompleted = !isHandleFullyCompleted && isMultiShapeHandle && handleShapesCount > 0;

  // --- 3. باقى الخطوات ---
  const hasSinkType = Boolean(typeof S !== 'undefined' && S.sinkType);
  const hasSize = Boolean(typeof S !== 'undefined' && S.size);
  const hasDiv = Boolean(typeof S !== 'undefined' && S.div);

  const errorMsgElement = document.body.innerText.includes('خارج نطاق خدمتنا');
  const isOutOfRange = (typeof locationError !== 'undefined' && locationError === true) || errorMsgElement;
  const hasLocation = typeof installCost !== 'undefined' && installCost !== null && !isOutOfRange;

  // --- 4. تطبيق الكلاسات للـ UI ---

  if (stepSinkType) {
    if (hasSinkType) stepSinkType.classList.add('completed'); else stepSinkType.classList.remove('completed');
  }

  // تطبيق حالة Half-Completed لخطوة التصميم
  if (stepDesign) {
    stepDesign.classList.remove('completed', 'half-completed');
    if (isDesignFullyCompleted) {
      stepDesign.classList.add('completed');
    } else if (isDesignHalfCompleted) {
      stepDesign.classList.add('half-completed');
    }
  }

  if (stepSize) {
    if (hasSize) stepSize.classList.add('completed'); else stepSize.classList.remove('completed');
  }

  if (stepPartition) {
    if (hasDiv) stepPartition.classList.add('completed'); else stepPartition.classList.remove('completed');
  }

  // تطبيق حالة Half-Completed لخطوة المقبض
  if (stepHandle) {
    stepHandle.classList.remove('completed', 'half-completed');
    if (isHandleFullyCompleted) {
      stepHandle.classList.add('completed');
    } else if (isHandleHalfCompleted) {
      stepHandle.classList.add('half-completed');
    }
  }

  if (stepLocation) {
    if (hasLocation) {
      stepLocation.classList.add('completed');
      stepLocation.classList.remove('out-of-range');
    } else if (isOutOfRange) {
      stepLocation.classList.remove('completed');
      stepLocation.classList.add('out-of-range');
    } else {
      stepLocation.classList.remove('completed', 'out-of-range');
    }
  }

  // --- 5. تحديث الخطوة النشطة Active Step ---
  const allSteps = [stepSinkType, stepSize, stepDesign, stepPartition, stepHandle, stepLocation];
  allSteps.forEach(el => el && el.classList.remove('active'));

  if (!hasSinkType) {
    if (stepSinkType) stepSinkType.classList.add('active');
  } else if (!hasSize) {
    if (stepSize) stepSize.classList.add('active');
  } else if (!isDesignFullyCompleted) {
    if (stepDesign) stepDesign.classList.add('active');
  } else if (!hasDiv) {
    if (stepPartition) stepPartition.classList.add('active');
  } else if (!isHandleFullyCompleted) {
    if (stepHandle) stepHandle.classList.add('active');
  } else if (!hasLocation) {
    if (stepLocation) stepLocation.classList.add('active');
  }
}

/*
================================================================================
Utility: open/close lightbox (kept as-is)
================================================================================
*/
function openLB(s) { document.getElementById('lb-img').src = s; document.getElementById('lb').classList.add('open'); }
function closeLB() { document.getElementById('lb').classList.remove('open'); }

/*
================================================================================
Order / WA actions, Reset, Save
================================================================================
*/

function customWA() {
  window.open(
    'https://wa.me/' + WA + '?text=' +
    encodeURIComponent(
`السلام عليكم،

أرغب في تنفيذ وحدة حوض بتصميم خاص يختلف عن التصميمات المتوفرة في الموقع.

هل يمكن مناقشة الفكرة ومعرفة إمكانية تنفيذها؟

وشكرًا لكم.`
    ),
    '_blank'
  );
}

function outOfRangeWA() {
  window.open(
    'https://wa.me/' + WA + '?text=' +
    encodeURIComponent(
`السلام عليكم،

قمت بتجربة تحديد موقعي في الموقع، وظهر أنه خارج نطاق الخدمة الحالي.

هل يمكن تنفيذ وتركيب وحدة حوض في منطقتي؟

وشكرًا لكم.`
    ),
    '_blank'
  );
}

function resetAll() {
  // 1. إعادة تصفير حالة التطبيق العامة بجميع مصفوفات التحديد
  S.sinkType = null;
  S.design = null;
  S.size = null;
  S.div = null;
  S.handle = null;
  S.selectedColors = [];
  S.selectedHandleShapes = [];

  userLat = null; 
  userLng = null; 
  installCost = null;

  // 2. مسح البيانات المحفوظة في الـ LocalStorage بشكل كامل
  try {
    localStorage.removeItem('wodi_configurator_state');
    localStorage.removeItem('wodi-config');
    localStorage.clear();
  } catch(e) {}
  delete window.wodi_saved_state;

  // 3. إزالة كلاسات الاختيار (active / selected / checked) من جميع كروت وأزرار الألوان في الشاشة
  document.querySelectorAll('.color-card, .color-option, .clr-item, [data-color], [data-color-id]').forEach(el => {
    el.classList.remove('selected', 'active', 'checked');
    if (el.tagName === 'INPUT' && el.type === 'radio') el.checked = false;
  });

  // 3. إعادة تعيين زر تحديد الموقع وحالة التوصيل
  const res = document.getElementById('loc-result');
  if (res) { res.className = 'loc-result'; res.textContent = ''; }
  const btn = document.getElementById('btn-locate');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> تحديد موقعي الحالي';
  }

  // 4. إزالة إشارة الاختيار من كروت نوع الحوض وألوان الوحدة
  document.querySelectorAll('.sink-type-card, .st-card, .sink-card, .color-card, .color-option, .clr-item').forEach(card => card.classList.remove('selected', 'active'));

  // 5. إخفاء سكيلتون التحميل إن وجد
  ['loading-sz', 'loading-dc', 'loading-vc-wall', 'loading-vc-floor', 'loading-hc'].forEach(id => {
    document.getElementById(id)?.classList.remove('show');
  });

  // 6. إظهار الـ Placeholders وإخفاء سكشن الألوان المباشر
  showPlaceholders();
  
  // إخفاء حاوية الألوان الرئيسية ومسح محتواها الداخلي مؤقتاً
  const clrContainer = document.getElementById('clr') || document.getElementById('clr-wrap') || document.querySelector('.colors-section');
  if (clrContainer) {
    clrContainer.classList.add('hidden');
    clrContainer.style.setProperty('display', 'none', 'important');
  }

  // 7. إخفاء أقسام الاختيار الفعلية وسكشن الألوان كاملاً (سواء كان ID أو Class)
  ['sz', 'dc', 'vc-wall', 'vc-floor', 'hc', 'vc-wall-wrap', 'floor-wrap', 'clr', 'clr-wrap', 'clr-section', 'color-section', 'sc-section', 'colors-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });

  // إخفاء أي سكشن يحتوي على كلاس الألوان في حال عدم وجود ID
  document.querySelectorAll('.colors-section, .color-section, .clr-section, #clr, #clr-wrap').forEach(sec => {
    sec.classList.add('hidden');
    sec.style.display = 'none';
  });

  // 8. تحديث الرندر وإعادة رسم الألوان وإجبار نص اللون على التصفير
  rDes(); 
  rSz(); 
  rDiv(); 
  rHnd(); 
  if (typeof rClr === 'function') rClr();

  // إجبار نص السكشن على التصفير المباشر
  const scEl = document.getElementById('sc');
  const scPriceEl = document.getElementById('sc-price');
  if (scEl) scEl.textContent = '—';
  if (scPriceEl) scPriceEl.textContent = '';

  upd();

  // 9. التمرير السلس لأعلى عند سكشن اختيار نوع الحوض
  const sinkSection = document.getElementById('sink-type-section') || document.querySelector('.sink-type-card')?.closest('section');
  if (sinkSection) {
    sinkSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/*
================================================================================
Initialization (single unified DOMContentLoaded handler)
 - wire up buttons, card handlers, arrows, scrolls, sticky behavior
 - load LOCATION_SHEET settings
 - load configurator data once if needed
================================================================================
*/

function initConfigurator() {
  // Restore saved state from localStorage
  try {
    const saved = localStorage.getItem('wodi_configurator_state');
    if (saved) {
      const state = JSON.parse(saved);
      // Will be restored after data loads
      window.wodi_saved_state = state;
    }
  } catch (e) { console.warn('Failed to restore state', e); }

  // Wire locate button
  const locateBtn = document.getElementById('btn-locate');
  if (locateBtn && typeof requestLocation === 'function') {
    try { locateBtn.removeEventListener('click', requestLocation); } catch (e) { /* ignore */ }
    locateBtn.addEventListener('click', requestLocation);
  }

  // hook up arrows and scroll logic ( clones/replacements happen first )
  setupScrollArrowButtons();
  setupCardsRowScrollListeners();

  // ثم ربط كروت نوع الحوض بعد استبدال/تهيئة الـ rows
  setupSinkTypeCards();

  // connect generic click -> update stepper guard (avoid duplicates)
  document.removeEventListener('click', genericClickForStepper);
  document.addEventListener('click', genericClickForStepper);

  // run other UI setups
  setupStickyPriceBar();
  setupStepperSticky();

  // run initial update for arrows on relevant lists
  ['dc', 'vc', 'hc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('scroll', () => updateArrows(id));
    setTimeout(() => updateArrows(id), 150);
  });

  updateArrows('sink-types');

  // Run the initial data fetch (keeps same behavior as original — will be idempotent)
  loadConfiguratorData();
}

// Generic click handler used only to update stepper progress after interactions
function genericClickForStepper(e) {
  if (e.target.closest('.card') || e.target.closest('.option') || e.target.closest('button')) {
    setTimeout(updateStepperProgress, 120);
  }
}

// Ensure we only wire init once
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConfigurator);
} else {
  // already loaded
  setTimeout(initConfigurator, 0);
}

// Wire location & modal interactions
document.addEventListener('DOMContentLoaded', () => {
  const drLocBtn = document.getElementById('dr-btn-locate');
  if (drLocBtn) {
    drLocBtn.onclick = drGetLocation;
  }
  
  // Also add zoom controls to preview
  const addZoomControls = () => {
    const previewEl = document.getElementById('dr-invoice-preview');
    if (previewEl && !previewEl.querySelector('.dr-zoom-controls')) {
      const controls = document.createElement('div');
      controls.className = 'dr-zoom-controls';
      controls.innerHTML = `
        <button class="dr-zoom-btn" onclick="drZoom(1.1)">+</button>
        <button class="dr-zoom-btn" onclick="drZoom(0.9)">−</button>
      `;
      previewEl.appendChild(controls);
    }
  };
  
  setTimeout(addZoomControls, 500);
});

function drZoom(factor) {
  const previewEl = document.getElementById('dr-invoice-preview');
  if (!previewEl) return;
  const iframe = previewEl.querySelector('iframe');
  if (!iframe) return;
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  if (!iframeDoc) return;
  const page = iframeDoc.querySelector('.page');
  if (!page) return;
  const currentScale = parseFloat(page.dataset.scale || 1);
  const newScale = currentScale * factor;
  page.dataset.scale = newScale;
  page.style.transform = `scale(${newScale})`;
  page.style.transformOrigin = 'top center';
}

// expose some internals for debugging (kept as globals in original)
// Expose internals safely without throwing ReferenceErrors
if (typeof calcInstall !== 'undefined') window.calcInstall = calcInstall;
if (typeof calc !== 'undefined') window.calc = calc;
if (typeof updateStepperProgress !== 'undefined') window.updateStepperProgress = updateStepperProgress;
if (typeof loadConfiguratorData !== 'undefined') window.loadConfiguratorData = loadConfiguratorData;
if (typeof loadConfiguratorState !== 'undefined') window.loadConfiguratorState = loadConfiguratorState;
if (typeof isRestoring !== 'undefined') window.isRestoring = isRestoring;
if (typeof resetAll !== 'undefined') window.resetAll = resetAll;
if (typeof openLB !== 'undefined') window.openLB = openLB;
if (typeof closeLB !== 'undefined') window.closeLB = closeLB;
if (typeof orderWA !== 'undefined') window.orderWA = orderWA;
if (typeof customWA !== 'undefined') window.customWA = customWA;
if (typeof outOfRangeWA !== 'undefined') window.outOfRangeWA = outOfRangeWA;

// تعريف دالة التوست لمنع خطأ showCustomErrorToast is not defined
if (typeof showCustomErrorToast !== 'function') {
  window.showCustomErrorToast = function(msg) {
    console.warn("Toast Warning:", msg);
  };
}

/* ===========================
   Order Popup / Summary Integration
   - Append this block at the end of configurator.js
   - Reuses existing getLocation / calc / S state and auth helper window.loginWithGoogle / window.onAuthStateChanged
   =========================== */
(function () {
  'use strict';

  const ORDER_POPUP_KEY = 'wodi_user_profile';
  let orderPayloadCache = null;
  let summaryGenerated = false;
  let previewWindow = null;

  function saveLocalProfile(profile) {
    try {
      localStorage.setItem(ORDER_POPUP_KEY, JSON.stringify(profile || {}));
    } catch (e) { console.warn('saveLocalProfile failed', e); }
  }

  function loadLocalProfile() {
    try {
      const raw = localStorage.getItem(ORDER_POPUP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function getAuthUserSafe() {
    try {
      return (typeof window.currentUser !== 'undefined') ? window.currentUser : null;
    } catch (e) { return null; }
  }

  /* Build modal DOM once */
  function ensureOrderPopup() {
    if (document.getElementById('wodi-order-popup')) return document.getElementById('wodi-order-popup');

    const modal = document.createElement('div');
    modal.id = 'wodi-order-popup';
    modal.className = 'wodi-modal';
    modal.style.display = 'none';
    modal.style.zIndex = '12000';
    modal.innerHTML = `
      <div class="wodi-modal-box" role="dialog" aria-modal="true" style="max-width:820px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="font-weight:800;font-size:18px;">ملخص الطلب</div>
          <button id="wodi-order-popup-close" aria-label="close" style="background:none;border:none;font-size:22px;cursor:pointer;">×</button>
        </div>

        <div class="wodi-modal-body" style="padding:16px; background:#fff; text-align:right;">
          <div id="wodi-auth-area" style="margin-bottom:12px;">
            <div id="wodi-auth-signed" style="display:none;">
              <label style="display:block;font-weight:700;margin-bottom:6px;">العميل</label>
              <input id="wodi-customer-name" type="text" placeholder="اسمك" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #e7e3da;border-radius:4px;">
              <input id="wodi-customer-phone" type="tel" placeholder="رقم التليفون" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #e7e3da;border-radius:4px;">
            </div>
            <div id="wodi-auth-unsigned" style="display:none; margin-bottom:8px;">
              <div style="margin-bottom:8px;color:#666;">سجل دخولك بحساب جوجل لحفظ البيانات وتسريع العملية</div>
              <button id="wodi-login-btn" class="btn-locate" style="display:inline-flex;align-items:center;gap:8px;">سجل الدخول بجوجل</button>
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <div style="font-weight:700;margin-bottom:8px;">العنوان & التوصيل</div>
            <div id="wodi-loc-wrap" style="text-align:right;">
              <div id="wodi-popup-loc-result" class="loc-result" style="display:none;margin-bottom:8px;"></div>
              <div id="wodi-popup-mapContainer" class="map-container" hidden style="margin-bottom:8px;">
                <iframe id="wodi-popup-staticMap" width="100%" height="160" loading="lazy" style="border:1px solid #ccc;border-radius:2px;"></iframe>
              </div>
              <button id="wodi-popup-btn-locate" class="btn-locate" style="display:inline-flex;align-items:center;gap:8px;">تحديد موقعي الحالي</button>
              <div style="margin-top:6px;color:#666;font-size:12px;">نستخدم موقعك لتقدير تكلفة التوصيل والتحقق من تغطية منطقتك</div>
            </div>
          </div>

          <div style="margin-top:6px;">
            <div style="font-weight:700;margin-bottom:8px;">ملاحظات إضافية</div>
            <textarea id="wodi-order-notes" rows="3" style="width:100%;padding:10px;border:1px solid #e7e3da;border-radius:4px;" placeholder="ملاحظات حول الطلب (اختياري)"></textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;padding:12px;border-top:1px solid rgba(0,0,0,0.06);">
          <button id="wodi-order-cancel" class="wodi-btn alt">إلغاء</button>
          <button id="wodi-order-generate" class="wodi-btn">استخراج الملخص</button>
          <button id="wodi-order-sendwa" class="wodi-btn" disabled style="background:#fff;border:1px solid var(--color-primary);color:var(--color-primary);">إرسال عبر WhatsApp</button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // hook close
    modal.querySelector('#wodi-order-popup-close').addEventListener('click', () => closeOrderPopup());
    modal.querySelector('#wodi-order-cancel').addEventListener('click', () => closeOrderPopup());

    // login / input
    const loginBtn = modal.querySelector('#wodi-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', () => {
      if (typeof window.loginWithGoogle === 'function') window.loginWithGoogle();
      else showToast('نظام تسجيل الدخول غير متاح الآن');
    });

    // locate button -> reuse existing getLocation. It accepts element or id.
    modal.querySelector('#wodi-popup-btn-locate').addEventListener('click', function () {
      // call getLocation with elements/ids created inside popup
      try {
        // make elements visible to getLocation flow
        const btn = document.getElementById('wodi-popup-btn-locate');
        const res = document.getElementById('wodi-popup-loc-result');
        const mapContainer = document.getElementById('wodi-popup-mapContainer');
        const mapImage = document.getElementById('wodi-popup-staticMap');
        // call the existing getLocation with these DOM refs (function defined earlier in this file)
        if (typeof getLocation === 'function') {
          getLocation(btn, res, mapContainer, mapImage);
        } else {
          // fallback to requestLocation (uses ids from page, not popup) - unlikely
          if (typeof requestLocation === 'function') requestLocation();
        }
      } catch (e) {
        console.error('popup locate error', e);
      }
    });

    // generate + send button hooks
    modal.querySelector('#wodi-order-generate').addEventListener('click', handlePopupGenerate);
    modal.querySelector('#wodi-order-sendwa').addEventListener('click', handlePopupSendWA);

    // listen to auth state to update UI
    window.onAuthStateChanged((u) => {
      refreshAuthAreaInPopup();
      // when user signs in, persist basic profile
      const cur = getAuthUserSafe();
      if (cur) {
        const p = loadLocalProfile();
        p.uid = cur.uid || p.uid;
        p.name = cur.displayName || p.name || '';
        p.phone = p.phone || cur.phoneNumber || p.phone || '';
        saveLocalProfile(p);
        refreshAuthAreaInPopup();
      }
    });

    return modal;
  }

  function openOrderPopup() {
    const modal = ensureOrderPopup();
    // populate inputs from local or auth
    refreshAuthAreaInPopup();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    // reset summary state
    summaryGenerated = false;
    orderPayloadCache = null;
    setPopupSendState(false);
  }

  function closeOrderPopup() {
    const modal = document.getElementById('wodi-order-popup');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }

  function refreshAuthAreaInPopup() {
    const modal = ensureOrderPopup();
    const signed = modal.querySelector('#wodi-auth-signed');
    const unsigned = modal.querySelector('#wodi-auth-unsigned');
    const nameInput = modal.querySelector('#wodi-customer-name');
    const phoneInput = modal.querySelector('#wodi-customer-phone');

    const stored = loadLocalProfile() || {};
    const current = getAuthUserSafe();

    if (current) {
      // show signed view (editable)
      signed.style.display = 'block';
      unsigned.style.display = 'none';
      nameInput.value = stored.name || current.displayName || '';
      phoneInput.value = stored.phone || current.phoneNumber || '';
    } else {
      signed.style.display = 'none';
      unsigned.style.display = 'block';
    }

    // Save changes live
    nameInput && nameInput.addEventListener('input', () => {
      const p = loadLocalProfile(); p.name = nameInput.value; saveLocalProfile(p);
    });
    phoneInput && phoneInput.addEventListener('input', () => {
      const p = loadLocalProfile(); p.phone = phoneInput.value; saveLocalProfile(p);
    });
  }

  function setPopupSendState(enabled) {
    const modal = ensureOrderPopup();
    const sendBtn = modal.querySelector('#wodi-order-sendwa');
    const genBtn = modal.querySelector('#wodi-order-generate');
    if (sendBtn) sendBtn.disabled = !enabled;
    if (genBtn) {
      genBtn.textContent = enabled ? 'رؤية الملخص' : 'استخراج الملخص';
      genBtn.classList.toggle('wodi-generated', enabled);
    }
  }

  /* Build a payload from configurator S state (unit + price) */
  function buildConfiguratorPayload() {
    // Basic guard: S, calc function exist
    const now = new Date();
    const orderNumber = `WODI-${String(now.getTime()).slice(-8)}`;
    const totalPrice = (typeof calc === 'function') ? calc() : null;
    const notes = document.getElementById('wodi-order-notes')?.value || '';
    const profile = loadLocalProfile();
    const user = getAuthUserSafe() || {};

    const customerName = profile.name || user.displayName || 'غير متوفر';
    const customerPhone = profile.phone || user.phoneNumber || 'غير متوفر';

    // pull unit details from S (sink configuration)
    const unit = {
      sinkType: S.sinkType || null,
      size: S.size ? S.size.size : null,
      design: S.design ? (S.design.name || S.design.id) : null,
      division: S.div ? (S.div.name || S.div.id) : null,
      handle: S.handle ? (S.handle.name || S.handle.id) : null,
    };

    // items array includes the configured unit as single item
    const items = [{
      product_id: unit.design || 'config-unit',
      name: unit.design || 'وحدة حوض مخصصة',
      specs: `${unit.size || ''}`,
      qty: 1,
      unitPrice: (typeof totalPrice === 'number' && !isNaN(totalPrice)) ? totalPrice : 0,
      subtotal: (typeof totalPrice === 'number' && !isNaN(totalPrice)) ? totalPrice : 0
    }];

    // if you want also to include other selected additional products from cart you can extend this
    return {
      number: orderNumber,
      createdAt: now.toISOString(),
      customerName,
      customerPhone,
      items,
      grandTotal: items.reduce((s,i)=>s + (Number(i.subtotal)||0), 0),
      notes
    };
  }

  /* create HTML summary page (opens in new tab) */
  function openSummaryPreviewWindow(payload) {
    try {
      const html = generateOrderHtml(payload);
      const w = window.open('', '_blank');
      if (!w) {
        showToast('تعذّر فتح نافذة المعاينة (منع النوافذ المنبثقة)'); return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      previewWindow = w;
    } catch (e) {
      console.error('openSummaryPreviewWindow error', e);
      showToast('فشل فتح معاينة الفاتورة');
    }
  }

  function generateOrderHtml(p) {
    // Simple HTML - uses inline styles to match your product-order-summary look
    const date = new Date(p.createdAt).toLocaleString('ar-EG', { hour12:false });
    const itemsRows = p.items.map(it => `
      <tr>
        <td style="padding:8px;border:1px solid #000;text-align:right;">${escapeHtml(it.name)}</td>
        <td style="padding:8px;border:1px solid #000;text-align:center;">${escapeHtml(it.specs)}</td>
        <td style="padding:8px;border:1px solid #000;text-align:center;">${it.qty}</td>
        <td style="padding:8px;border:1px solid #000;text-align:center;">${formatPrice(it.unitPrice)}</td>
        <td style="padding:8px;border:1px solid #000;text-align:center;">${formatPrice(it.subtotal)}</td>
      </tr>`).join('');

    return `<!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>ملخص الطلب ${escapeHtml(p.number)}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body { font-family: Arial, Helvetica, "Cairo", sans-serif; direction: rtl; padding:20px; color:#111 }
          .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
          .title { font-size:20px; font-weight:800 }
          table { width:100%; border-collapse:collapse; margin-top:12px; }
          th, td { border:1px solid #000; padding:8px; }
          thead th { background:#f4f4f4; font-weight:700; }
          .totals { text-align:right; margin-top:12px; font-weight:700 }
          .notes { margin-top:8px;color:#666 }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">ملخص الطلب</div>
            <div>رقم الطلب: ${escapeHtml(p.number)}</div>
            <div>التاريخ: ${escapeHtml(date)}</div>
          </div>
          <div style="text-align:left;">
            <div>WODI Furniture</div>
            <div>Whatsapp: +20 15 5684 0368</div>
          </div>
        </div>

        <div style="margin-top:6px;">
          <div style="font-weight:700;margin-bottom:6px;">بيانات العميل</div>
          <div>الاسم: ${escapeHtml(p.customerName)}</div>
          <div>الهاتف: ${escapeHtml(p.customerPhone)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>المواصفات</th>
              <th>الكمية</th>
              <th>سعر الوحدة (EGP)</th>
              <th>الإجمالي (EGP)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="totals">الإجمالي الكلي: ${formatPrice(p.grandTotal)} EGP</div>

        <div class="notes">ملاحظة: ${escapeHtml(p.notes || 'هذه فاتورة مبدئية. التواصل والدفع عبر WhatsApp.')}</div>

      </body>
      </html>`;
  }

  /* Handlers for Generate & Send WA in popup */
  function handlePopupGenerate() {
    const modal = ensureOrderPopup();
    // validate minimal config completeness
    if (!S.sinkType || !S.size || !S.design || !S.div) {
      showToast('الطلب غير مكتمل — اكمل اختيارات الحوض أولاً');
      return;
    }

    const payload = buildConfiguratorPayload();
    orderPayloadCache = payload;
    summaryGenerated = true;
    setPopupSendState(true);

    // open preview window with generated html
    openSummaryPreviewWindow(payload);
  }

  async function handlePopupSendWA() {
    if (!summaryGenerated || !orderPayloadCache) {
      showToast('لا يمكنك الإرسال قبل استخراج الملخص');
      return;
    }

    // Generate PDF client-side is heavy -> we will open preview window (already done) and instruct user to attach PDF.
    // Note: attaching a file automatically to wa.me link from browser isn't possible (needs server).
    // We open wa.me with a message and notify the user to attach the PDF manually.
    const payload = orderPayloadCache;
    const message = [
      `مرحباً، لدي طلب جديد من WODI.`,
      `رقم الطلب: ${payload.number}`,
      `الاسم: ${payload.customerName}`,
      `الهاتف: ${payload.customerPhone}`,
      `الإجمالي: ${formatPrice(payload.grandTotal)} EGP`,
      `الملف المولد: الرجاء إرفاق الفاتورة التي تم إنشاؤها (قم بتنزيلها من صفحة المعاينة).`
    ].join('\n');

    const url = `https://wa.me/${LOC && LOC.WA ? LOC.WA : '201556840368'}?text=${encodeURIComponent(message)}`;
    // open wa
    const w = window.open(url, '_blank');
    if (!w) showToast('تعذّر فتح WhatsApp. تأكد من إعداد المتصفح للسماح بالفتح في نوافذ جديدة.');
    else showToast('تم فتح WhatsApp — أرفق ملف الفاتورة إذا رغبت قبل الإرسال.');
  }

  /* Utility helpers */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* small price format using existing helper in this file */
  function formatPrice(num) {
    if (num == null || isNaN(num)) return '0';
    return Math.round(num).toLocaleString('en-US');
  }

  /* Public hook: open popup (use from configurator & cart) */
  window.openOrderPopup = openOrderPopup;

  /* Auto-create the popup on load so auth state bindings set up early */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureOrderPopup(); refreshAuthAreaInPopup(); });
  } else {
    ensureOrderPopup(); refreshAuthAreaInPopup();
  }

  /* =======
     Notes & limitations (short):
     - This re-uses getLocation/getAddress by calling getLocation(btn,res,mapContainer,mapImage)
     - It uses localStorage to store simple profile (replace with Firestore later)
     - Auto-attaching PDF to WhatsApp is not possible purely client-side via wa.me; server upload + WhatsApp Business API required.
     - The popup's Generate Summary opens a preview window with the filled HTML which the user can print/save as PDF.
     ======= */

})();