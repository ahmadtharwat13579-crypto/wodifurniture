"use strict";

/*
================================================================================
Configuration & Constants
================================================================================
*/
const WA = '201556840368';
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
const SHEET = '/api/get-config';
const GEOAPIFY_API_KEY = '5d919ff1fd3f4004a73ceb1fb508e805';
const cur = 'ج.م.';
const DR_STORAGE_KEY = 'dr_form_draft';
const ORDER_POPUP_KEY = 'wodi_user_profile';

/*
================================================================================
Global State
================================================================================
*/
let userLat = null, userLng = null, installCost = null;
let LOC = {
  workshop_lat: 30.061113,
  workshop_lng: 31.394701,
  correction_factor: 1,
  price_per_km: 0,
  fixed_cost: 0
};
let D = { designs: [], divisions: [], handles: [], colors: [] };
let dataLoaded = false;
let configuratorRequestId = 0;

let S = {
  sinkType: null,
  design: null,
  selectedColors: [],
  size: null,
  div: null,
  handle: null,
  selectedHandleShapes: []
};

let toastTimeout;

// Initialization guard
let initDone = false;

// Restoration flow guard: set true in initConfigurator() if saved state exists,
// and set false in applyStateIfReady() after restoration is complete.
let stateRestorePending = false;

/*
================================================================================
Utility Helpers
================================================================================
*/

const toAr = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(',', '،');

function escapeHtmlSafe(str) {
  if (typeof str !== 'string') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

window.showToast = function(msg, duration = 3500) {
  const t = document.getElementById('toast');
  if (!t) return;

  clearTimeout(toastTimeout);

  t.innerHTML = `
    <span>${msg}</span>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');

  toastTimeout = setTimeout(() => {
    t.classList.remove('show');
  }, duration);
}


window.drOrdersLoaded = false;

window.drStartOrdersPolling = drStartOrdersPolling;
window.drStopOrdersPolling = drStopOrdersPolling;

window.drCancelOrder = drCancelOrder;

// تحديد الكلاس الملون بناءً على الحالة من الشيت
function getStatusClass(status) {
  switch (status) {
    case 'تم تأكيد الطلب':
      return 'status-accepted';

    case 'قيد التنفيذ':
      return 'status-assembly';

    case 'جاهز للتسليم':
      return 'status-transit';

    case 'تم التسليم':
      return 'status-completed';

    case 'ملغي':
      return 'status-cancelled';

    case 'بانتظار المراجعة':
    default:
      return 'status-review';
  }
}

// تصدير الدوال للنطاق العام
window.drOpenOrdersDrawer = drOpenOrdersDrawer;
window.drCloseOrdersDrawer = drCloseOrdersDrawer;
window.drLoadUserOrders = drLoadUserOrders;

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

function pulsePrice(el, newPriceText) {
  if (!el) return;
  const formattedPrice = newPriceText || el.innerHTML;
  
  if (el.innerHTML !== formattedPrice || newPriceText === undefined) {
    if (newPriceText !== undefined) el.innerHTML = formattedPrice;
    
    el.classList.remove('price-updated', 'price-pulse');
    void el.offsetWidth;
    el.classList.add('price-updated');
  }
}

/*
================================================================================
Data Loading & Processing
================================================================================
*/

/*
================================================================================
State Persistence
================================================================================
*/

// loadConfiguratorState() removed — replaced by applyStateIfReady()

/*
================================================================================
UI Rendering
================================================================================
*/

const unavailableDesigns = {
  'drop-in': ['4a_wh_sc02'],
  'bowl': ['4a_wh_sc02']
};

/*
================================================================================
Pricing & Calculations
================================================================================
*/

let updateTimeout = null;

window.buildDesignConfig = buildDesignConfig;

function upd() {
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

  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    saveConfiguratorState();
    
    const t = calc();
    const noH = isNoHandle();
    const sg = S.size ? sgr(S.size.size) : '85';

    const egpTag = '<small style="font-size: 0.75em; font-weight: normal; margin-left: 2px;">EGP</small>';

    const totalEl = document.getElementById('total-price');
    const canShowPrice = S.design && S.size;
    if (totalEl) {
      totalEl.innerHTML =
        canShowPrice && t !== null
          ? `${t.toLocaleString('en-US')} ${egpTag}`
          : `— ${egpTag}`;

      const currentNumericPrice = canShowPrice && t !== null ? t : null;
      const lastPrice = totalEl.dataset.lastTotal !== undefined ? JSON.parse(totalEl.dataset.lastTotal) : undefined;

      totalEl.dataset.lastTotal = JSON.stringify(currentNumericPrice);

      // تطبيق الـ pulse فقط إذا كان هناك سعر رقمي حقيقي وتغيرت قيمته
      if (currentNumericPrice !== null && lastPrice !== currentNumericPrice) {
        pulsePrice(totalEl);
      }
    }

    const warn = document.getElementById('price-warning');
    if (warn) {
      const needsWarn = S.design && !S.size;
      warn.classList.toggle('show', needsWarn);
    }

    const allSelected = S.design && S.size && S.div && (S.design.hc === 0 || S.handle);
    const instWarn = document.getElementById('install-warning');
    if (instWarn) instWarn.classList.toggle('show', allSelected && installCost === null);

    const siLabel = document.getElementById('si-label');
    const siPrice = document.getElementById('si-price');
    if (siLabel) siLabel.textContent = installCost !== null ? 'محسوبة' : '—';
    if (siPrice) siPrice.innerHTML = installCost !== null ? `${installCost.toLocaleString('en-US')} ${egpTag}` : '—';

    const sdTypeEl = document.getElementById('sd-type');
    if (sdTypeEl) {
      const sinkTypeNames = {
        'wall-hung': 'حوض معلق',
        'drop-in': 'حوض ساقط',
        'bowl': 'حوض فوق الكاونتر',
        'floor-standing': 'حوض برجل كاملة'
      };
      sdTypeEl.textContent = S.sinkType ? sinkTypeNames[S.sinkType] : '—';
      // Only update stepper if NOT in restoration mode
      if (!stateRestorePending && typeof updateStepperProgress === 'function') updateStepperProgress();
    }

    if (!S.sinkType) {
      const unitColorSec = document.getElementById('unit-color-section');
      if (unitColorSec) unitColorSec.remove();
      
      document.querySelectorAll('.colors-section, .color-section, .clr-section, #clr, #clr-wrap, #unit-color-section').forEach(sec => {
        sec.classList.add('hidden');
        sec.style.display = 'none';
      });
    }

    const sdEl = document.getElementById('sd');
    if (sdEl) sdEl.textContent = S.design ? S.design.name : '—';

    const sdPriceEl = document.getElementById('sd-price');
    if (sdPriceEl) sdPriceEl.innerHTML = S.size ? `${r5(S.size.price).toLocaleString('en-US')} ${egpTag}` : '—';

    const scEl = document.getElementById('sc');
    if (scEl) {
      const rawVal = (S.selectedColors && S.selectedColors.length > 0 && S.selectedColors[0]) ? String(S.selectedColors[0]) : '';
      
      if (rawVal) {
        const cleanName = rawVal.split('/').pop().replace(/\.[^/.]+$/, "").toLowerCase().trim();
        
        const colorMap = {
          'wd': 'خشبي',
          'wood': 'خشبي',
          'sld': 'سادة',
          'solid': 'سادة',
          'gls': 'لامع',
          'gloss': 'لامع'
        };

        let translatedName = '';

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

    const scPriceEl = document.getElementById('sc-price');
    if (scPriceEl) {
      const matchedColorObj = (typeof S !== 'undefined' && S.selectedColors && S.selectedColors.length > 0) ? S.selectedColors[0] : null;
      const colorId = typeof matchedColorObj === 'string' ? matchedColorObj : null;
      const matchedDColor = colorId && D.colors ? D.colors.find(c => colorId.startsWith(`clr_${c.clr_id}_`)) : null;
      const colorPrice = matchedDColor ? (matchedDColor['added-value'] ?? matchedDColor.price ?? 0) : 0;
      scPriceEl.innerHTML = !colorId ? '' : colorPrice > 0 ? `+${colorPrice.toLocaleString('en-US')} ${egpTag}` : `+0 ${egpTag}`;
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
    const handlePrice = S.handle && S.design && !noH ? S.handle.price * S.design.hc : 0;
    if (shPrice) shPrice.innerHTML = S.handle ? (handlePrice > 0 ? `+${handlePrice.toLocaleString('en-US')} ${egpTag}` : `+0 ${egpTag}`) : (noH ? '—' : '—');

    updateStickyValue();
  }, 100);
}

/*
================================================================================
Stepper & Progress
================================================================================
*/

/*
================================================================================
Scroll & Sticky UI
================================================================================
*/

/*
================================================================================
Location & Shipping
================================================================================
*/

function calcInstall(lat, lng) {
  const dist = haversine(LOC.workshop_lat, LOC.workshop_lng, lat, lng);
  const maxDist = (LOC.max_distance_km !== undefined && LOC.max_distance_km !== null)
    ? parseFloat(LOC.max_distance_km)
    : 25;

  if (dist > maxDist) {
    return null;
  }

  const adjusted = dist * LOC.correction_factor;
  return r5(4 * adjusted * LOC.price_per_km + LOC.fixed_cost);
}

async function getAddress(lat, lon, resElement) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.address) {
      const a = data.address;
      const neighbourhood = a.neighbourhood || a.suburb || a.quarter || '';
      const city = a.city || a.town || a.state_district || a.state || a.county || '';
      const governorate = a.state || a.state_district || '';
      const address = [neighbourhood, city].filter(Boolean).join('، ');

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

function getLocation(btn, res, mapContainer, mapImage) {
  btn = (typeof btn === 'string') ? document.getElementById(btn) : btn;
  res = (typeof res === 'string') ? document.getElementById(res) : res;
  mapContainer = (typeof mapContainer === 'string') ? document.getElementById(mapContainer) : mapContainer;
  mapImage = (typeof mapImage === 'string') ? document.getElementById(mapImage) : mapImage;

  if (!navigator.geolocation) {
    if (res) { res.textContent = 'خدمة تحديد الموقع غير متاحة حالياً'; res.className = 'loc-result error show'; }
    if (btn) { btn.disabled = false; btn.innerHTML = 'تحديد موقعي الحالي'; }
    return;
  }

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
          window.drIsManualLocation = false;

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

          try {
            installCost = (typeof calcInstall === 'function') ? calcInstall(userLat, userLng) : null;
          } catch (e) {
            console.warn('calcInstall error', e);
            installCost = null;
          }
          window.installCost = installCost;

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

          // إخفاء حقل العنوان اليدوي ورابط التحديد اليدوي عند نجاح تحديد الموقع تلقائياً
          const manualGroup = document.getElementById('dr-manual-address-group');
          if (manualGroup) manualGroup.style.display = 'none';
          const manualLink = document.getElementById('dr-toggle-manual-address');
          if (manualLink) manualLink.style.display = 'none';

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
          if (res) { res.textContent = 'حدث خطأ أثناء معالجة الموقع. يرجى أدخال العنوان يدوياً.'; res.className = 'loc-result error show'; }
          if (btn) { btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }
          const manualGroup = document.getElementById('dr-manual-address-group');
          if (manualGroup) manualGroup.style.display = 'block';
        }
      },
      err => {
        let msg = 'تعذر تحديد الموقع تلقائياً. يرجى كتابة العنوان يدوياً بالأسفل.';
        if (err && err.code === 1) msg = 'تم رفض الإذن. يرجى كتابة العنوان يدوياً بالأسفل.';
        if (res) { res.textContent = msg; res.className = 'loc-result error show'; }
        if (btn) { btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }
        
        // إظهار حقل إدخال العنوان اليدوي تلقائياً عند الفشل
        const manualGroup = document.getElementById('dr-manual-address-group');
        if (manualGroup) manualGroup.style.display = 'block';
      },
      { timeout: 15000, maximumAge: 60000 }
    );
  }, 500);
}

function requestLocation() {
  const btn = document.getElementById('dr-btn-locate');
  const res = document.getElementById('dr-loc-result');
  const mapContainer = document.getElementById('dr-mapContainer');
  const mapImage = document.getElementById('dr-staticMap');

  if (!navigator.geolocation) {
    if (res) {
      res.textContent = 'خدمة تحديد الموقع غير متاحة حالياً';
      res.className = 'loc-result error show';
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'تحديد موقعي الحالي';
    }

    return;
  }

  getLocation(btn, res, mapContainer, mapImage);
}

/*
================================================================================
Design Request Modal
================================================================================
*/


window.customWA = customWA;

window.outOfRangeWA = outOfRangeWA;

function resetAll() {
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

  try {
    // احفظ الـ values المهمة قبل الـ clear
    const pendingOrder = localStorage.getItem('pendingOrder');
    const reopenModal = localStorage.getItem('reopenOrderModal');
    const scrollPosition = localStorage.getItem('scrollPosition');
    const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');

    localStorage.removeItem('wodi_configurator_state');
    localStorage.removeItem('wodi-config');
    localStorage.removeItem(DR_STORAGE_KEY);

    if (scrollPosition) localStorage.setItem('scrollPosition', scrollPosition);
    if (redirectAfterLogin) localStorage.setItem('redirectAfterLogin', redirectAfterLogin);
  } catch(e) {}
  delete window.wodi_saved_state;

  document.querySelectorAll('.color-card, .color-option, .clr-item, [data-color], [data-color-id]').forEach(el => {
    el.classList.remove('selected', 'active', 'checked');
    if (el.tagName === 'INPUT' && el.type === 'radio') el.checked = false;
  });

  const res = document.getElementById('loc-result');
  if (res) { res.className = 'loc-result'; res.textContent = ''; }
  const btn = document.getElementById('btn-locate');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> تحديد موقعي الحالي';
  }

  document.querySelectorAll('.sink-type-card, .st-card, .sink-card, .color-card, .color-option, .clr-item').forEach(card => card.classList.remove('selected', 'active'));

  ['loading-sz', 'loading-dc', 'loading-vc-wall', 'loading-vc-floor', 'loading-hc'].forEach(id => {
    document.getElementById(id)?.classList.remove('show');
  });

  showPlaceholders();
  
  const clrContainer = document.getElementById('clr') || document.getElementById('clr-wrap') || document.querySelector('.colors-section');
  if (clrContainer) {
    clrContainer.classList.add('hidden');
    clrContainer.style.setProperty('display', 'none', 'important');
  }

  ['sz', 'dc', 'vc-wall', 'vc-floor', 'hc', 'vc-wall-wrap', 'vc-floor-wrap', 'floor-wrap', 'clr', 'clr-wrap', 'clr-section', 'color-section', 'sc-section', 'colors-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
      el.style.removeProperty('display');
    }
  });

  document.querySelectorAll('.colors-section, .color-section, .clr-section, #clr, #clr-wrap').forEach(sec => {
    sec.classList.add('hidden');
    sec.style.display = 'none';
  });

  rDes(); 
  rSz(); 
  rDiv(); 
  rHnd(); 
  if (typeof rClr === 'function') rClr();

  const scEl = document.getElementById('sc');
  const scPriceEl = document.getElementById('sc-price');
  if (scEl) scEl.textContent = '—';
  if (scPriceEl) scPriceEl.textContent = '';

  upd();

  const sinkSection = document.getElementById('sink-type-section') || document.querySelector('.sink-type-card')?.closest('section');
  if (sinkSection) {
    sinkSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.resetAll = resetAll;

/*
================================================================================
Event Binding & Initialization
================================================================================
*/

function initConfigurator() {
  if (initDone) return;
  initDone = true;

  // Check for saved state early, before any rendering
  try {
    const saved = localStorage.getItem('wodi_configurator_state');
    if (saved) {
      const state = JSON.parse(saved);

      if (state && state.sinkType) {
        stateRestorePending = true;

        const overlay = document.getElementById('config-loader-overlay');

        if (overlay) {
          overlay.style.display = 'flex';
        }

        // Fallback: لا نترك شاشة الاستعادة عالقة للأبد
        window.configRestoreTimeout = setTimeout(() => {
          if (stateRestorePending) {
            console.warn('Saved state restoration timed out.');
            skipSavedConfiguratorState();
          }
        }, 10000);
      }
    }
    // Clear any stale window-level saved state to prevent double restoration
    delete window.wodi_saved_state;
  } catch (e) { 
    console.warn('Failed to read saved state', e); 
  }

  const locateBtn = document.getElementById('btn-locate');
  if (locateBtn && typeof requestLocation === 'function') {
    if (locateBtn.dataset.setupDone) {
      locateBtn.removeEventListener('click', requestLocation);
    }
    locateBtn.addEventListener('click', requestLocation);
    locateBtn.dataset.setupDone = 'true';
  }

  setupScrollArrowButtons();
  setupCardsRowScrollListeners();
  setupSinkTypeCards();

  document.removeEventListener('click', genericClickForStepper);
  document.addEventListener('click', genericClickForStepper);

  setupStickyPriceBar();
  setupStepperSticky();

  ['dc', 'vc', 'hc'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.scrollListenerSetup) {
      el.dataset.scrollListenerSetup = 'true';
      el.addEventListener('scroll', () => updateArrows(id));
    }
    setTimeout(() => updateArrows(id), 150);
  });

  updateArrows('sink-types');

  // Load configurator data, which will trigger applyStateIfReady() when complete
  loadConfiguratorData();
  
  // Only render initial views if NOT restoring saved state
  if (!stateRestorePending) {
    rDes(); rSz(); rDiv(); rHnd(); upd();
  }
}



function onDOMReady() {
  initConfigurator();
  
  // Setup design request modal location button
  const drLocBtn = document.getElementById('dr-btn-locate');
  if (drLocBtn) {
    drLocBtn.onclick = drGetLocation;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
  setTimeout(onDOMReady, 0);
}

/*
================================================================================
Global Exports
================================================================================
*/

window.calc = calc;
window.updateStepperProgress = updateStepperProgress;
window.loadConfiguratorData = loadConfiguratorData;
window.openLB = openLB;
window.closeLB = closeLB;
window.customWA = customWA;
window.outOfRangeWA = outOfRangeWA;
window.resetAll = resetAll;
window.calcInstall = calcInstall;

if (typeof showCustomErrorToast !== 'function') {
  window.showCustomErrorToast = function(msg) {
    console.warn("Toast Warning:", msg);
  };
}