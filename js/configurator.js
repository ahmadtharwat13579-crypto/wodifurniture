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

const r5 = n => Math.round(n / 5) * 5;

const toAr = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(',', '،');

const base = id => (id && typeof id.toString === 'function') ? id.toString().replace(/_\d+[\-\.]?\d*cm$/i, '') : '';

function escapeHtmlSafe(str) {
  if (typeof str !== 'string') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(msg, duration = 3500) {
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

document.addEventListener('DOMContentLoaded', function () {
  const phoneInput = document.getElementById('dr-customer-phone');
  
  if (phoneInput) {
    new Cleave(phoneInput, {
      blocks: [4, 4, 3],
      delimiter: ' ',
      numericOnly: true
    });

    phoneInput.addEventListener('input', function () {
      const val = phoneInput.value.replace(/\D/g, '');
      if (val.startsWith('2')) {
        phoneInput.value = '';
        showToast('أدخل رقمك بدون مفتاح الدولة — ابدأ بـ 01');
      }
    });
  }
});

// مثال داخل دالة إرسال النموذج
function getPhoneValue() {
  const rawValue = document.getElementById('dr-customer-phone').value;
  const cleanPhone = rawValue.replace(/\s+/g, ''); // تحويل "010 1234 5678" إلى "01012345678"
  return cleanPhone;
}

// 1. قائمة أحياء القاهرة والجيزة
const EGYPT_DISTRICTS = {
  "Cairo": [
    "التجمع الخامس", "التجمع الأول", "التجمع الثالث", "القاهرة الجديدة", 
    "مدينتي", "الشروق", "العاصمة الإدارية", "مدينة نصر", "مصر الجديدة", 
    "المعادي", "المقطم", "الزهراء", "الزمالك", "جاردن سيتي", "وسط البلد", 
    "الرحاب", "العباسية", "عين شمس", "الزيتون", "حدائق القبة", 
    "حلوان", "المعصرة", "المعادي الجديدة", "الهضبة الوسطى"
  ],
  "Giza": [
    "الشيخ زايد", "6 أكتوبر - الأحياء", "6 أكتوبر - التوسعات الشمالية", 
    "حدائق الأهرام", "الهرم", "فيصل", "المهندسين", "الدقي", "العجوزة", 
    "حدائق أكتوبر", "أكتوبر الجديد", "الجيزة", "المنيب", "البحر الأعظم", 
    "الوراق", "إمبابة", "الحوامدية"
  ]
};

function drOnGovChange() {
  const govSelect = document.getElementById('dr-select-gov');
  const districtSelect = document.getElementById('dr-select-district');

  if (!govSelect || !districtSelect) return;

  const selectedGov = govSelect.value;

  // إعادة ضبط الحي عند تغيير المحافظة
  districtSelect.innerHTML = '<option value="" selected>اختر المنطقة...</option>';

  if (!selectedGov) {
    districtSelect.innerHTML = '<option value="" selected>اختر المحافظة أولاً...</option>';
    districtSelect.disabled = true;

    return;
  }

  districtSelect.disabled = false;

  if (EGYPT_DISTRICTS[selectedGov]) {
    EGYPT_DISTRICTS[selectedGov].forEach(function(district) {
      const option = document.createElement('option');
      option.value = district;
      option.textContent = district;
      districtSelect.appendChild(option);
    });
  }
}

async function drGeocodeManualDistrict(governorate, district) {
  const governorateName =
    governorate === 'Cairo' ? 'القاهرة' :
    governorate === 'Giza' ? 'الجيزة' :
    governorate;

  const queries = [
    `${district}, ${governorateName}, مصر`,
    `${district}, ${governorateName}, Egypt`,
    `${district}, مصر`
  ];

  for (const query of queries) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?format=json` +
        `&limit=1` +
        `&accept-language=ar` +
        `&countrycodes=eg` +
        `&q=${encodeURIComponent(query)}`;

      const response = await fetch(url);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            lat,
            lng,
            displayName: data[0].display_name || ''
          };
        }
      }
    } catch (error) {
      console.warn('Manual district geocoding failed:', error);
    }
  }

  return null;
}

async function drOnDistrictChange() {
  const govSelect = document.getElementById('dr-select-gov');
  const districtSelect = document.getElementById('dr-select-district');
  const res = document.getElementById('dr-loc-result');

  if (!govSelect || !districtSelect) return;

  const governorate = govSelect.value;
  const district = districtSelect.value;

  if (!governorate || !district) {
    return;
  }

  // إلغاء أي موقع GPS سابق والاعتماد على الاختيار اليدوي
  window.drIsManualLocation = true;

  window.userLat = null;
  window.userLng = null;
  window.installCost = null;

  if (typeof userLat !== 'undefined') {
    userLat = null;
  }

  if (typeof userLng !== 'undefined') {
    userLng = null;
  }

  if (typeof installCost !== 'undefined') {
    installCost = null;
  }

  if (res) {
    res.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px">
        <svg class="spin" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span>جارٍ تحديد المنطقة وحساب تكلفة التوصيل...</span>
      </span>
    `;
    res.className = 'loc-result';
    res.style.display = 'block';
  }

  const result = await drGeocodeManualDistrict(governorate, district);

  if (!result) {
    window.drIsManualLocation = false;

    if (res) {
      res.innerHTML = `
        تعذر تحديد المنطقة تلقائيًا.
        يرجى اختيار منطقة أخرى أو استخدام تحديد الموقع الحالي.
      `;
      res.className = 'loc-result error show';
    }

    return;
  }

  let calculatedCost = null;

  try {
    if (typeof calcInstall === 'function') {
      calculatedCost = calcInstall(result.lat, result.lng);
    }
  } catch (error) {
    console.warn('calcInstall error for manual location:', error);
  }

  if (calculatedCost === null) {
    window.drIsManualLocation = false;

    if (res) {
      res.innerHTML = `
        هذه المنطقة خارج نطاق خدمتنا.
        <button
          onclick="outOfRangeWA()"
          style="background:none;border:none;color:#9caf88;cursor:pointer;font-family:'Cairo',sans-serif;font-size:12px;text-decoration:underline;"
        >
          هل يمكن التنفيذ في منطقتي؟
        </button>
      `;
      res.className = 'loc-result show out-of-range';
    }

    return;
  }

  // حفظ بيانات الموقع التقريبي
  window.userLat = result.lat;
  window.userLng = result.lng;
  window.installCost = calculatedCost;

  if (typeof installCost !== 'undefined') {
    installCost = calculatedCost;
  }

  window.drIsManualLocation = true;

  // الحفاظ على نفس شكل بيانات الموقع المستخدمة في باقي النظام
  window.userLocationAddress = {
    governorate: governorate === 'Cairo' ? 'القاهرة' : 'الجيزة',
    district: district,
    city: governorate === 'Cairo' ? 'القاهرة' : 'الجيزة',
    fullAddress: `${district}، ${governorate === 'Cairo' ? 'القاهرة' : 'الجيزة'}`
  };

  // لا نظهر الخريطة في حالة الموقع اليدوي،
  // لأن الإحداثيات هنا تقريبية وليست موقع العميل الفعلي.
  const mapContainer = document.getElementById('dr-mapContainer');

  if (mapContainer) {
    mapContainer.hidden = true;
    mapContainer.style.display = 'none';
  }

  const expBtn = document.getElementById('export-location');

  if (expBtn) {
    expBtn.disabled = false;
  }

  if (res) {
    res.innerHTML = `
      <div>تم تحديد المنطقة — تكلفة التوصيل:</div>

      <div style="font-size: 15px; font-weight: 600; margin-top: 2px;">
        ${Number(calculatedCost).toLocaleString('en-US')} EGP
      </div>

      <div style="font-size: 10px; font-weight: 400; margin-top: 1px;">
        (تقريبية)
        <span
          class="info-tooltip"
          role="button"
          tabindex="0"
          aria-label="معلومات عن التكلفة التقريبية"
          data-tooltip="تم تقدير التكلفة بناءً على المحافظة والحي المختارين. لتحديد التكلفة بدقة أكبر، يُفضل استخدام تحديد الموقع تلقائيًا."
        >i</span>
      </div>
    `;
    res.className = 'loc-result show';
  }

  if (typeof completeStep === 'function') {
    try {
      completeStep('step-location');
    } catch (e) {
      console.warn(e);
    }
  }

  if (typeof upd === 'function') {
    try {
      upd();
    } catch (e) {
      console.warn(e);
    }
  }
}

// 3. الاستماع للضغط على قائمة الأحياء لو كانت معطلة لإظهار التوست
document.addEventListener('DOMContentLoaded', function() {
  const districtWrapper = document.getElementById('dr-district-wrapper');
  const govSelect = document.getElementById('dr-select-gov');
  const districtSelect = document.getElementById('dr-select-district');

  if (districtWrapper) {
    districtWrapper.addEventListener('click', function(e) {
      if (!govSelect || !govSelect.value || (districtSelect && districtSelect.disabled)) {
        if (typeof showToast === 'function') {
          showToast('يرجى اختيار المحافظة أولاً');
        } else if (typeof drShowToast === 'function') {
          drShowToast('يرجى اختيار المحافظة أولاً');
        } else {
          alert('يرجى اختيار المحافظة أولاً');
        }
      }
    }, true); // true هنا تضمن التقاط الضغطة في مرحلة الـ Capture
  }
});

function formatOrderDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

window.drOrdersLoaded = false;

async function drOpenOrdersDrawer(options = {}) {
  const drawer = document.getElementById('drOrdersDrawer');
  const backdrop = document.getElementById('drDrawerOverlay');
  const bodyContainer = document.getElementById('drOrdersContainer');

  const focusOrderNum = options.focusOrderNum || null;
  const showLoading = options.showLoading === true;

  if (drawer && backdrop) {

    const sidebarTab = document.querySelector('.dr-sidebar-tab');

    if (sidebarTab) {
      sidebarTab.classList.add('drawer-opening');
    }

    setTimeout(() => {

      drawer.classList.add('open');
      backdrop.classList.add('open');

      if (sidebarTab) {
        sidebarTab.classList.remove('drawer-opening');
        sidebarTab.classList.add('drawer-hidden');
      }

    }, 180);
  }

  if (!window.currentUser) {
    if (bodyContainer) {
      const loginTemplate =
        document.getElementById('dr-orders-login-template');

      if (loginTemplate) {
        bodyContainer.replaceChildren(
          loginTemplate.content.cloneNode(true)
        );
      }
    }
    return;
  }

  // عند فتح الدرج بعد إرسال طلب جديد، نعرض skeleton فورًا
  if (showLoading && bodyContainer) {
    bodyContainer.innerHTML = `
      <div class="dr-orders-loading-new">
        <div class="dr-order-skeleton">
          <div class="dr-skeleton-line dr-skeleton-date"></div>
          <div class="dr-skeleton-line dr-skeleton-title"></div>
          <div class="dr-skeleton-line dr-skeleton-price"></div>

          <div class="dr-skeleton-steps">
            <div class="dr-skeleton-step"></div>
            <div class="dr-skeleton-step"></div>
            <div class="dr-skeleton-step"></div>
            <div class="dr-skeleton-step"></div>
          </div>
        </div>

        <div class="dr-orders-loading-message">
          جاري تحميل بيانات طلبك، قد يستغرق الأمر بضع ثوانٍ...
        </div>
      </div>
    `;
  }

  // إجبار تحميل البيانات من جديد بعد إرسال الطلب
  window.drOrdersLoaded = false;

  await drLoadUserOrders();

  window.drOrdersLoaded = true;

  // محاولة الوصول تلقائيًا للطلب الذي تم إرساله
  if (focusOrderNum && bodyContainer) {
    const orderCards = bodyContainer.querySelectorAll('.dr-order-card');

    orderCards.forEach(card => {
      const orderId = card.querySelector('.dr-order-id');

      if (orderId && orderId.textContent.trim() === String(focusOrderNum)) {
        requestAnimationFrame(() => {
          card.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          card.classList.add('dr-order-card-new');

          setTimeout(() => {
            card.classList.remove('dr-order-card-new');
          }, 2500);
        });
      }
    });
  }
}

// إغلاق الـ Side Drawer
function drCloseOrdersDrawer() {

  const drawer = document.getElementById('drOrdersDrawer');
  const backdrop = document.getElementById('drDrawerOverlay');
  const sidebarTab = document.querySelector('.dr-sidebar-tab');

  if (drawer) {
    drawer.classList.remove('open');
  }

  if (backdrop) {
    backdrop.classList.remove('open');
  }

  setTimeout(() => {

    if (sidebarTab) {
      sidebarTab.classList.remove('drawer-hidden');
      sidebarTab.classList.add('drawer-closing');

      requestAnimationFrame(() => {
        sidebarTab.classList.remove('drawer-closing');
      });
    }

  }, 230);

  document.body.style.overflow = '';

}

// جلب الطلبات الخاصة بالعميل من Google Apps Script
async function drLoadUserOrders(options = {}) {
  const silent = options.silent === true;
  const bodyContainer = document.getElementById('drOrdersContainer');
  if (!bodyContainer) return;

  if (!silent) {
      const loadingTemplate =
          document.getElementById('dr-orders-loading-template');

      if (loadingTemplate) {
          bodyContainer.replaceChildren(
              loadingTemplate.content.cloneNode(true)
          );
      }
  }

  try {
    const userEmail = window.currentUser ? window.currentUser.email : '';
    if (!userEmail) {
      bodyContainer.innerHTML = `
        <div class="dr-orders-empty">
          <div class="placeholder-title">تعذر تحديد البريد</div>
          <div class="placeholder-text">يرجى إعادة تسجيل الدخول لمتابعة طلباتك</div>
        </div>
      `;
      return;
    }

    const response = await fetch(`/api/get-config?action=getUserOrders&email=${encodeURIComponent(userEmail)}`);
    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      const emptyTemplate =
    document.getElementById('dr-orders-empty-template');

    if (emptyTemplate) {
      bodyContainer.replaceChildren(
        emptyTemplate.content.cloneNode(true)
      );
    }
      return;
    }

    bodyContainer.innerHTML = data.orders.map(order => `
      <div class="dr-order-card">
        <div class="dr-order-card-header">
          <span class="dr-order-date">${formatOrderDate(order.date)}</span>
          <span class="dr-order-id">${order.orderNum}</span>
        </div>
        <div class="dr-order-details">
          <div class="dr-order-detail">
            <span class="dr-order-detail-label">التصميم</span>
            <span class="dr-order-detail-value">${order.designName || 'تصميم وحدة'}</span>
          </div>

          <div class="dr-order-detail">
            <span class="dr-order-detail-label">إجمالي الطلب</span>
          <span class="dr-order-detail-value">
            ${Number(order.unitPrice).toLocaleString('en-US')} ج.م
            ${order.locationMethod === 'يدوي'
              ? `<span class="dr-approximate-price">
                  تقريبي
                  <span
                    class="info-tooltip"
                    role="button"
                    tabindex="0"
                    aria-label="معلومات عن التكلفة التقريبية"
                    data-tooltip="تم تقدير تكلفة النقل بناءً على المحافظة والحي المختارين. التكلفة النهائية قد تزيد أو تقل قليلًا بعد تحديد الموقع بدقة."
                  >i</span>
                </span>`
              : ''}
          </span>
          </div>
        </div>

        ${order.status === 'ملغي' ? `
          <div class="dr-order-cancelled-status">
            <div class="dr-order-cancelled-icon">×</div>
            <span>تم إلغاء الطلب</span>
          </div>
        ` : `
          <div class="dr-order-status-stepper">

            ${(() => {
              const steps = [
                {
                  status: 'بانتظار المراجعة',
                  title: 'بانتظار المراجعة',
                  description: 'تم استلام طلبك وجارٍ مراجعته'
                },
                {
                  status: 'تم تأكيد الطلب',
                  title: 'تم تأكيد الطلب',
                  description: 'تم تأكيد طلبك وبدء التجهيز'
                },
                {
                  status: 'قيد التنفيذ',
                  title: 'قيد التنفيذ',
                  description: 'يتم تجهيز طلبك حاليًا'
                },
                {
                  status: 'جاهز للتسليم',
                  title: 'جاهز للتسليم',
                  description: 'طلبك جاهز للتسليم والتنسيق معك'
                },
                {
                  status: 'تم التسليم',
                  title: 'تم التسليم',
                  description: 'تم تسليم طلبك بنجاح'
                }
              ];
              const currentIndex = steps.findIndex(
                step => step.status === order.status
              );

              return steps.map((step, index) => {
                const isCompleted = currentIndex > index;
                const isActive = currentIndex === index;
                return `
                  <div class="dr-status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">

                    <div class="dr-status-step-marker">
                      ${isCompleted ? '✓' : ''}
                    </div>
                    <div class="dr-status-step-content">
                      <div class="dr-status-step-title">
                        ${step.title}
                      </div>

                      ${isActive ? `
                        <div class="dr-status-step-description">
                          ${step.description}
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('');
            })()}
          </div>
        `}

        <div class="dr-order-card-actions">
          <button
            type="button"
            onclick="drViewSummary('${order.orderNum}', this)"
            class="dr-order-summary-btn"
          >
            عرض الملخص
          </button>

          <button
            type="button"
            onclick="${order.status === 'بانتظار المراجعة'
              ? `drCancelOrder('${order.orderNum}')`
              : `showToast('لا يمكن إلغاء الطلب الآن. تواصل معنا عبر واتساب.')`}"
            class="dr-order-cancel-btn ${order.status !== 'بانتظار المراجعة' ? 'unavailable' : ''}"
          >
            إلغاء الطلب
          </button>
        </div>

        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading user orders:', err);
    bodyContainer.innerHTML = '<div class="dr-orders-empty">تعذر جلب البيانات. حاول مرة أخرى.</div>';
  }
}

let drOrdersPollingInterval = null;

function drStartOrdersPolling() {
    if (drOrdersPollingInterval) {
        return;
    }

    drOrdersPollingInterval = setInterval(async () => {

        if (!window.currentUser) {
            drStopOrdersPolling();
            return;
        }

        try {
            await drLoadUserOrders({ silent: true });
            window.drOrdersLoaded = true;
        } catch (error) {
            console.error('Error refreshing user orders:', error);
        }

    }, 30000);
}

function drStopOrdersPolling() {
    if (drOrdersPollingInterval) {
        clearInterval(drOrdersPollingInterval);
        drOrdersPollingInterval = null;
    }
}

window.drStartOrdersPolling = drStartOrdersPolling;
window.drStopOrdersPolling = drStopOrdersPolling;

async function drCancelOrder(orderNum) {
  if (!confirm('هل أنت متأكد من إلغاء الطلب؟')) return;
  try {

    const resp = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancelOrder',
        orderNum,
        email: window.currentUser?.email || ''
      })
    });

    const data = await resp.json();

    if (data.success) {
      showToast('تم إلغاء الطلب بنجاح');
      await drLoadUserOrders();
      window.drOrdersLoaded = true;
    } else {
      showToast('تعذر إلغاء الطلب');
    }
  } catch (e) {
    showToast('حدث خطأ — حاول مرة أخرى');
  }
}

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

function divisionBase(id) {
  if (!id) return id;
  const s = String(id);
  const sizeSuffix = /_\d+[\-\.]?\d*cm$/i;
  if (sizeSuffix.test(s)) return s.replace(sizeSuffix, '');
  const parts = s.split('_');
  if (parts.length >= 3) return parts.slice(0, 3).join('_');
  return s;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function loadConfiguratorData() {
  // Check for cached data first
  try {
    const cached = sessionStorage.getItem('wodi_configurator_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const rows = Array.isArray(parsed) ? parsed : parsed.rows;
        const colorRows = parsed.colorRows || [];
        D = build(rows, colorRows);
        dataLoaded = true;
        
        // If state restoration is pending, apply it now
        if (stateRestorePending) {
          applyStateIfReady();
        }
      } catch (e) {
        console.warn('Failed to parse cached configurator', e);
      }
    }
  } catch (e) {
    console.warn('sessionStorage read failed', e);
  }

  if (!dataLoaded) showConfiguratorLoading();

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
      console.log('colorRows:', colorRows);
      const settings = data && data.locationSettings;

      if (settings && settings.workshop_lat) {
        LOC = settings;
      }

      if (rows && rows.length > 0) {
        D = build(rows, colorRows);
        dataLoaded = true;
        hideConfiguratorLoading();
        try { 
          sessionStorage.setItem('wodi_configurator_cache', JSON.stringify({ rows, colorRows, settings })); 
        } catch (e) { 
          console.warn('sessionStorage set failed', e); 
        }
        
        // Apply pending state restoration only after data is loaded
        applyStateIfReady();

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

function build(rows, colorRows = []) {
  const des = {};
  const divs = [];
  const hnd = [];
  const colors = [];

  if (Array.isArray(colorRows)) {
    colorRows.forEach(r => {
      if (!r) return;
      const cId = String(r.clr_id || r.clrId || r.c || r.id || r[0] || '').trim();
      const dName = String(r.display_name || r.displayName || r.name || r.title || r[1] || r[2] || '').trim();
            const fName = String(r.clr_family || r.family || '').trim().toLowerCase();
      
      if (cId || dName) {
        colors.push({
          family: fName,
          clr_id: cId,
          id: cId,
          display_name: dName,
          name: dName,
          'added-value': parseFloat(r['added-value'] || r.added_value || r.extra_price || r.price || 0) || 0,
          price: parseFloat(r['added-value'] || r.added_value || r.extra_price || r.price || 0) || 0
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
State Persistence
================================================================================
*/

// loadConfiguratorState() removed — replaced by applyStateIfReady()

function applyStateIfReady() {
  if (!dataLoaded || !stateRestorePending) return;

  try {
    const rawSaved = localStorage.getItem('wodi_configurator_state');
    if (!rawSaved) {
      stateRestorePending = false;
      return;
    }

    const parsed = JSON.parse(rawSaved);

    if (parsed) {
      // Restore sink type and update UI
      if (parsed.sinkType) {
        S.sinkType = parsed.sinkType;
        document.querySelectorAll('.sink-type-card').forEach(c => {
          c.classList.toggle('selected', c.dataset.type === parsed.sinkType);
        });
      }
      
      // Restore size (must be done before design to validate availability)
      if (parsed.sizeSize) {
        const sz = D.designs.flatMap(d => d.sizes).find(s => s.size === parsed.sizeSize);
        if (sz) S.size = sz;
      }
      
      // Restore design (depends on size)
      if (parsed.designId) {
        S.design = D.designs.find(d => d.id === parsed.designId);
      }
      
      // Restore division
      if (parsed.divId) {
        S.div = D.divisions.find(d => d.id === parsed.divId);
      }
      
      // Restore handle
      if (parsed.handleId) {
        S.handle = D.handles.find(h => h.id === parsed.handleId);
      }
      
      // Restore handle shapes and colors (optional)
      if (Array.isArray(parsed.selectedHandleShapes)) {
        S.selectedHandleShapes = parsed.selectedHandleShapes;
      }
      if (Array.isArray(parsed.selectedColors)) {
        S.selectedColors = parsed.selectedColors;
      }
    }

    // Render all dependent views with restored state
    rDes(); 
    rSz(); 
    rDiv(); 
    rHnd(); 
    upd();
    
    if (typeof updateStepperProgress === 'function') {
      updateStepperProgress();
    }
    
    // Hide placeholders for restored selections
    if (S.size) document.getElementById("placeholder-sz")?.classList.add("hidden");
    if (S.design) document.getElementById("placeholder-dc")?.classList.add("hidden");
    if (S.div) document.getElementById("placeholder-div")?.classList.add("hidden");
    if (S.handle || (S.design && S.design.hc === 0)) {
      document.getElementById("placeholder-hc")?.classList.add("hidden");
    }

    stateRestorePending = false;
    setTimeout(() => hideConfigLoaderOverlay(), 600);
  } catch (e) {
    console.warn('Failed to apply saved state:', e);
    stateRestorePending = false;
    setTimeout(() => hideConfigLoaderOverlay(), 600);
  }
}

function saveConfiguratorState() {
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
  } catch (e) { 
    console.warn('Failed to save state', e); 
  }
}

/*
================================================================================
UI Rendering
================================================================================
*/

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

  const isDivision = typeof id === 'string' && id.includes('_cic');
  const typeCodeMap = {
    'drop-in': 'di',
    'bowl': 'bw'
  };

  let finalImgId = imgBaseId;

  if (!isDivision && sinkType && typeCodeMap[sinkType]) {
    finalImgId = finalImgId.replace(/_wh_/, '_' + typeCodeMap[sinkType] + '_');
  }

  return GH + encodeURIComponent(finalImgId) + '.webp';
}

function mkLockOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "card-overlay";
  overlay.style.pointerEvents = "none";
  overlay.innerHTML = `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="2">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V8a4 4 0 118 0v3"/>
    </svg>
  `;
  return overlay;
}

function mkImg(id, cardEl) {
  const w = document.createElement('div'); 
  w.className = 'cimg';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'eager';
  img.decoding = 'async';

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

function createDesignCard(d) {
  const validPrices = d.sizes.map(s => s.price).filter(p => p !== null);
  const minP = validPrices.length ? Math.min(...validPrices) : null;

  const el = document.createElement("div");
  const isAvailable = !S.size || d.sizes.some(s => s.size === S.size.size);

  el.className =
    "design-card" +
    (S.design && S.design.id === d.id ? " selected" : "");
  el.dataset.id = d.id;

  el.appendChild(mkImg(d.id, el));

  if (!S.size) {
    el.querySelector(".cimg")?.appendChild(mkLockOverlay());
  }

  const availableSizes = d.sizes.map(s => s.size);
  let sizeText = "";
  if (availableSizes.length) {
    const first = availableSizes[0];
    const last = availableSizes[availableSizes.length - 1];
    const firstMin = first.split("-")[0].trim();
    const lastMax = last.split("-")[1].replace("cm", "").replace("سم", "").trim();
    sizeText = `${firstMin}–${lastMax} سم`;
  }

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
      if (!S.size) {
        showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار التصميم.');
        document.getElementById('sz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      if (!isAvailable) {
        showToast('عفواً، هذا التصميم لا يناسب عرض الحوض الذي اخترته.');
        return;
      }

      if (S.design && S.design.id === d.id) {
        S.design = null;
      } else {
        S.design = d;

        const matchedSize = d.sizes.find(s => s.size === S.size.size);
        if (matchedSize) {
          S.size = matchedSize;
        }
      }

      document.querySelectorAll('#dc .design-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === (S.design?.id || ''));
        card.classList.toggle('disabled', S.size ? !D.designs.find(dd => dd.id === card.dataset.id)?.sizes.some(s => s.size === S.size.size) : false);
      });
      rDiv();
      rHnd();
      upd();
    };

  return el;
}

function rDes() {
  const box = document.getElementById("dc");
  if (!box) return;

  box.innerHTML = "";

  // إيجاد العنصر عبر الـ ID أو البحث داخل السكشن لضمان عدم إرجاع null
  const desc = document.getElementById("step-desc") || document.querySelector(".design-step-desc");

  const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
  const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;
  const excluded = unavailableDesigns[S.sinkType] || [];

  const totalCount = D.designs.filter(d => d.type === effectiveType && !excluded.includes(d.id)).length;

  if (desc) {
    desc.style.fontSize = '13px';
    desc.style.color = 'var(--color-text-muted, #666)';
    desc.style.marginBottom = '12px';

    if (!S.sinkType) {
      desc.innerHTML = "";
    } else if (!S.size) {
      desc.innerHTML = 'اختر <strong>عرض الحوض</strong> لعرض التصميمات المتوافقة.';
    } else {
      const currentSizeVal = (typeof S.size === 'object' && S.size !== null) ? S.size.size : S.size;

      const availableCount = D.designs.filter(d =>
        d.type === effectiveType &&
        !excluded.includes(d.id) &&
        d.sizes.some(s => s.size === currentSizeVal)
      ).length;

    if  (availableCount === totalCount) {
        desc.innerHTML = `جميع التصميمات متوافقة مع عرض الحوض`;
      } else {
        desc.innerHTML = `يوجد <strong>${availableCount}</strong> تصميمات متوافقة مع عرض الحوض`;
      }
    }
  }

  // Store card elements for later styling
  const cardElements = [];

  D.designs
    .filter(d => d.type === effectiveType && !excluded.includes(d.id))
    .forEach(d => {
      const card = createDesignCard(d);
      cardElements.push({ card, design: d });
      box.appendChild(card);
    });

  // Apply disabled overlay ONLY to genuinely incompatible designs, and do not apply if a design is selected
  cardElements.forEach(({ card, design }) => {
    const isAvailable = !S.size || design.sizes.some(s => s.size === S.size.size);
    if (!isAvailable) {
      card.classList.add('disabled');
    } else if (!S.design) {
      card.classList.remove('disabled');
    }
  });

  updateArrows("dc");

  if (!S.sinkType) return;

  const oldColorSection = document.getElementById('unit-color-section');
  if (oldColorSection) oldColorSection.remove();

  const colorContainer = document.createElement('div');
  colorContainer.id = 'unit-color-section';
  colorContainer.style.marginTop = '20px';

  const divider = document.createElement('hr');
  divider.style.border = '0';
  divider.style.borderTop = '1px solid var(--color-border, #eee)';
  divider.style.marginBottom = '16px';
  colorContainer.appendChild(divider);

  // إضافة عنوان قسم ألوان الوحدة بنفس كلاس وتنسيق العناوين الرئيسية
  const sectionTitleHeader = document.createElement('div');
  sectionTitleHeader.className = 'step-header';
  sectionTitleHeader.style.marginBottom = '12px';
  
  const sectionTitle = document.createElement('span');
  sectionTitle.className = 'step-title';
  sectionTitle.textContent = 'لون الوحدة';
  
  sectionTitleHeader.appendChild(sectionTitle);
  colorContainer.appendChild(sectionTitleHeader);

  if (!S.selectedColors) S.selectedColors = [];

  const colorGroups = [
    { family: 'solid', prefix: 'clr_sld_', defaultTitle: 'سادة (مط)', defaultPrice: 0 },
    { family: 'wood', prefix: 'clr_wd_', defaultTitle: 'خشابي', defaultPrice: 800 },
    { family: 'gloss', prefix: 'clr_gls_', defaultTitle: 'لامع', defaultPrice: 1100 }
  ];

  colorGroups.forEach(group => {
    const sheetData = (D.colors || []).find(c => c.family === group.family) || {};
    const titleText = sheetData.name || group.defaultTitle;
    const extraPrice = (sheetData.price !== undefined && sheetData.price !== null) ? sheetData.price : group.defaultPrice;

    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'color-group-wrapper';
    groupWrapper.id = `group-wrapper-${group.family}`;

    const subTitle = document.createElement('h4');
    subTitle.className = 'sub-title';
    subTitle.textContent = titleText;
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

    const availableColors = (D.colors || []).filter(c => c.family === group.family || (c.id && c.id.startsWith(group.prefix)));

    const defaultAvailableIds = {
      solid: ['clr_sld_01', 'clr_sld_02', 'clr_sld_03'],
      wood: ['clr_wd_01', 'clr_wd_02'],
      gloss: []
    };

    const colorItems = (defaultAvailableIds[group.family] || []).map(id => ({ id: id }));

    colorItems.forEach(cItem => {
      const colorId = cItem.id;

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
        
        img.src = GH + `clr/${encoded}.webp`;
        
        img.onerror = function () {
          if (colorCard) colorCard.remove();
          if (typeof checkGroupVisibility === 'function') checkGroupVisibility();
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
      colorCard.classList.remove('disabled');

      colorCard.onclick = () => {
        if (!S.size) {
          showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار لون الوحدة.');
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

        document.querySelectorAll('#unit-color-section .design-card').forEach(card => {
          card.classList.remove('selected');
        });

        if (!isAlreadySelected) {
          colorCard.classList.add('selected');
        }

        if (typeof updateStepperProgress === 'function') updateStepperProgress();
        if (typeof upd === 'function') upd();
      };

      cardsRow.appendChild(colorCard);
    });

    wrapEl.appendChild(startBtn);
    wrapEl.appendChild(cardsRow);
    wrapEl.appendChild(endBtn);
    groupWrapper.appendChild(wrapEl);
    colorContainer.appendChild(groupWrapper);

    checkGroupVisibility();
  });

  box.parentNode.appendChild(colorContainer);
}

function rSz() {
  const box = document.getElementById("sz");
  if (!box) return;
  box.innerHTML = "";

  const placeholder = document.getElementById("placeholder-sz");
  const loading = document.getElementById("loading-sz");

  const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
  const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;

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

function rDiv() {
  const wall = document.getElementById("vc-wall");
  const floor = document.getElementById("vc-floor");
  const wallWrap = document.getElementById("vc-wall-wrap");
  const floorWrap = document.getElementById("vc-floor-wrap");
  const title = document.getElementById("division-group-title");

  if (!wall || !floor || !wallWrap || !floorWrap) return;

  wall.innerHTML = "";
  floor.innerHTML = "";

  if (!S.sinkType) {
    S.div = null;
    if (title) title.textContent = "ما هي التقسيمة الداخلية المناسبة لك؟";
    wallWrap.classList.add("hidden");
    floorWrap.classList.add("hidden");
    updateArrows("vc-wall");
    updateArrows("vc-floor");
    return;
  }

  const divisionType = S.sinkType === "floor-standing" ? "floor-standing" : "wall-hung";

  if (divisionType === "floor-standing") {
    floorWrap.classList.remove("hidden");
    wallWrap.classList.add("hidden");
  } else {
    wallWrap.classList.remove("hidden");
    floorWrap.classList.add("hidden");
  }

  if (title) title.textContent = "ما هي التقسيمة الداخلية المناسبة لك؟";

  D.divisions
    .filter(d => d.type === divisionType)
    .forEach(d => {
      const el = document.createElement("div");
      el.className = "div-card" + (S.div && S.div.id === d.id ? " selected" : "");
      el.dataset.id = d.id;
      el.classList.remove("disabled");
      
      const imgContainer = mkImg(d.id, el);
      const img = imgContainer.querySelector('img');
      if (img) {
        const cleanId = String(d.id).replace(/\.(png|webp|jpg|jpeg)$/i, '');
        const encoded = encodeURIComponent(cleanId);
        img.src = GH + `${encoded}.webp`;
        img.onerror = function () {
          if (this.src.endsWith('.webp')) {
            this.src = GH + `${encoded}.png`;
          } else {
            this.style.display = 'none';
          }
        };
      }

      el.appendChild(imgContainer);

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
        if (!S.size) {
          showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار التقسيمة الداخلية.');
          document.getElementById('sz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        if (S.div && S.div.id === d.id) {
          S.div = null;
        } else {
          S.div = d;
        }

        document.querySelectorAll('#vc-wall .div-card, #vc-floor .div-card').forEach(card => {
          card.classList.toggle('selected', card.dataset.id === (S.div?.id || ''));
        });
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
  if (!S.sinkType) return;

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

function isNoHandle() {
  return Boolean(S.design && S.design.hc === 0);
}

function rHnd() {
  const groupEl = document.querySelector('[data-group="hc"]');

  if (!S.sinkType) {
    groupEl?.classList.add('hidden');
    return;
  }

  groupEl?.classList.remove('hidden');

  const c = document.getElementById('hc');
  const title = document.getElementById('handle-group-title');
  const desc = document.getElementById('handle-desc');
  if (!c || !title || !desc) return;

  c.innerHTML = '';
  title.textContent = 'اختر نوع المقبض';
  desc.replaceChildren();

  const noH = isNoHandle();

  desc.style.fontSize = '13px';
  desc.style.color = 'var(--color-text-muted, #666)';
  desc.style.marginBottom = '12px';

  if (noH) {
    S.handle = null;
    S.selectedHandleShapes = [];
    desc.innerHTML = '<strong>ملحوظة:</strong> لا يتطلب هذا التصميم تحديد نوع المقبض.';
  }

  D.handles.forEach(h => {
    const el = document.createElement('div');
    
    if (noH) {
      el.className = 'handle-card disabled';
    } else {
      el.className = 'handle-card' + (S.handle && S.handle.id === h.id ? ' selected' : '');
    }
    el.dataset.id = h.id;

    el.appendChild(mkImg(h.id, el));

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

    el.onclick = () => {
      if (noH) {
        showToast('لا يتطلب هذا التصميم تحديد نوع المقبض.');
        return;
      }

      if (!S.size) {
        showToast('يرجى اختيار عرض الحوض أولاً لتتمكن من اختيار نوع المقبض.');
        document.getElementById('sz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (S.handle && S.handle.id === h.id) {
        S.handle = null;
        S.selectedHandleShapes = [];
      } else {
        S.handle = h;
        S.selectedHandleShapes = [];
      }

      document.querySelectorAll('#hc .handle-card').forEach(card => {
        card.classList.remove('selected');
        if (S.handle && card.dataset.id === S.handle.id) {
          card.classList.add('selected');
        }
      });
      const shapesRow = document.getElementById('handle-shapes-row');
      if (shapesRow) {
        if (S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02')) {
          shapesRow.style.display = 'block';
        } else {
          shapesRow.style.display = 'none';
        }
      }
      upd();
    };

    c.appendChild(el);
  });

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

    let availableShapes = S.handle.shapes || [];

    if (!availableShapes.length) {
      const maxShapesMap = {
        '4c_h&k01': 7,
        '4c_h&k02': 3
      };
      const maxCount = maxShapesMap[S.handle.id] || 7;
      for (let i = 1; i <= maxCount; i++) {
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
        img.src = GH + `hnd/${encoded}.webp`;

        img.onerror = function () {
          shapeCard.remove();
          setTimeout(() => updateArrows('handle-shapes-row'), 50);
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
        
        const savedScrollLeft = cardsRow.scrollLeft;
        
        // Update selection states in-place to avoid re-rendering and resetting scroll
        document.querySelectorAll('#handle-shapes-row .handle-shape-card').forEach(c => {
          c.classList.remove('selected');
          c.querySelector('.handle-priority-badge')?.remove();
        });

        // إدارة كلاس التعتيم بناءً على وصول العميل للشكلين المختارين
        if (S.selectedHandleShapes.length >= 2) {
          cardsRow.classList.add('has-max-shapes');
        } else {
          cardsRow.classList.remove('has-max-shapes');
        }

        S.selectedHandleShapes.forEach((id, idx) => {
          const cardToSelect = Array.from(document.querySelectorAll('#handle-shapes-row .handle-shape-card'))
            .find(c => c.querySelector('img')?.src.includes(encodeURIComponent(id)));
          if (cardToSelect) {
            cardToSelect.classList.add('selected');
            const badge = document.createElement('div');
            badge.className = 'handle-priority-badge';
            badge.textContent = idx + 1;
            cardToSelect.appendChild(badge);
          }
        });
        
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

    setTimeout(() => updateArrows('handle-shapes-row'), 100);
  }

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

/*
================================================================================
Pricing & Calculations
================================================================================
*/

function calc() {
  if (!S.design || !S.size || !S.div) return null;
  const noH = isNoHandle();
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
  const installationFee = 200;
  const unitPrice = r5(S.size.price + colorExtra + dvp(S.div, sg) + (noH ? 0 : S.handle.price * S.design.hc));

  if (installCost === null) return unitPrice + installationFee;

  return unitPrice + installationFee + installCost;
}

let updateTimeout = null;

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
    const handlePrice = S.handle && !noH ? S.handle.price * S.design.hc : 0;
    if (shPrice) shPrice.innerHTML = S.handle ? (handlePrice > 0 ? `+${handlePrice.toLocaleString('en-US')} ${egpTag}` : `+0 ${egpTag}`) : (noH ? '—' : '—');

    updateStickyValue();
  }, 100);
}

function hideConfigLoaderOverlay() {
  const overlay = document.getElementById('config-loader-overlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
  overlay.style.opacity = '0';
  overlay.style.visibility = 'hidden';
  setTimeout(() => overlay.remove(), 300);
}

/*
================================================================================
Stepper & Progress
================================================================================
*/

function updateStepperProgress() {
  // Do not update stepper progress during restoration
  if (stateRestorePending) return;

  const stepDesign = document.getElementById('st-design');
  const stepSinkType = document.getElementById('st-sink-type');
  const stepSize = document.getElementById('st-size');
  const stepPartition = document.getElementById('st-partition');
  const stepHandle = document.getElementById('st-handle');
  const stepLocation = document.getElementById('st-location');

  // Reset all stepper steps to initial state
  const allSteps = [stepSinkType, stepSize, stepDesign, stepPartition, stepHandle, stepLocation];
  allSteps.forEach(el => {
    if (el) {
      el.classList.remove('completed', 'half-completed', 'active', 'out-of-range');
    }
  });

  const hasSelectedDesign = Boolean(typeof S !== 'undefined' && S.design && (S.design.id || S.design.name || S.design.type));
  const hasSelectedColor = Boolean(typeof S !== 'undefined' && Array.isArray(S.selectedColors) && S.selectedColors.length >= 1);

  const isDesignFullyCompleted = hasSelectedDesign && hasSelectedColor;
  const isDesignHalfCompleted = (hasSelectedDesign && !hasSelectedColor) || (!hasSelectedDesign && hasSelectedColor);

  const noH = Boolean(typeof S !== 'undefined' && S.design && S.design.hc === 0);
  const isMultiShapeHandle = typeof S !== 'undefined' && S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02');
  
  const handleShapesCount = (isMultiShapeHandle && Array.isArray(S.selectedHandleShapes)) ? S.selectedHandleShapes.length : 0;
  
  const isHandleFullyCompleted = typeof S !== 'undefined' && (
    noH || 
    (isMultiShapeHandle ? handleShapesCount >= 2 : Boolean(S.handle))
  );

  const isHandleHalfCompleted = !isHandleFullyCompleted && isMultiShapeHandle && handleShapesCount > 0;

  const hasSinkType = Boolean(typeof S !== 'undefined' && S.sinkType);
  const hasSize = Boolean(typeof S !== 'undefined' && S.size);
  const hasDiv = Boolean(typeof S !== 'undefined' && S.div);

  const errorMsgElement = document.body.innerText.includes('خارج نطاق خدمتنا');
  const isOutOfRange = (typeof locationError !== 'undefined' && locationError === true) || errorMsgElement;
  const hasLocation = typeof installCost !== 'undefined' && installCost !== null && !isOutOfRange;

  if (stepSinkType) {
    if (hasSinkType) stepSinkType.classList.add('completed'); else stepSinkType.classList.remove('completed');
  }

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

  allSteps.forEach(el => {
    if (!el) return;
    el.classList.remove('active');
    if (!el.dataset.scrollListenerSetup) {
      el.dataset.scrollListenerSetup = 'true';
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const step = el.dataset.step;
        const targetMap = {
          'sink-type': 'sink-types',
          'size': 'sz',
          'design': 'dc',
          'partition': 'vc-wall',
          'handle': 'hc',
          'location': 'btn-locate'
        };
        const targetId = targetMap[step];
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  });

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
Scroll & Sticky UI
================================================================================
*/

function setupScrollArrowButtons() {
  document.querySelectorAll('.scroll-arrow').forEach(btn => {
    if (btn.dataset.setupDone) return;
    btn.dataset.setupDone = 'true';
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
  document.querySelectorAll('.cards-row').forEach(row => {
    if (row.dataset.scrollListenerSetup) return;
    row.dataset.scrollListenerSetup = 'true';
    row.addEventListener('scroll', () => {
      document.querySelectorAll('.scroll-wrap').forEach(wrap => {
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
    if (card.dataset.clickSetup) return;
    card.dataset.clickSetup = 'true';
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

  updateArrows('sink-types');
  const sinkRow = document.getElementById('sink-types');
  if (sinkRow && !sinkRow.dataset.scrollListenerSetup) {
    sinkRow.dataset.scrollListenerSetup = 'true';
    sinkRow.addEventListener('scroll', () => updateArrows('sink-types'));
  }
}

let stickySetupDone = false;

function setupStickyPriceBar() {
  if (stickySetupDone) return;
  stickySetupDone = true;

  const MOBILE_BREAK = 900;
  let stickyEl = null;
  let io = null;

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

    stickyEl.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
    stickyEl.style.transform = 'translateY(100%)';
    stickyEl.style.opacity = '0';
    stickyEl.style.pointerEvents = 'none';
    stickyEl.style.display = 'flex';

    return stickyEl;
  }

  function destroySticky() {
    if (io) { io.disconnect(); io = null; }
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
      const lastVal = el.dataset.lastVal;
      if (lastVal !== undefined && lastVal !== formattedPrice) {
        pulsePrice(el, formattedPrice);
      } else {
        el.innerHTML = formattedPrice;
      }
      el.dataset.lastVal = formattedPrice;
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
    document.body.classList.add('has-sticky-bar');
    updateStickyValue();
  }

  function hideSticky() {
    if (stickyEl) {
      stickyEl.style.transform = 'translateY(100%)';
      stickyEl.style.opacity = '0';
      stickyEl.style.pointerEvents = 'none';
    }
    document.body.classList.remove('has-sticky-bar');
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
      createSticky();
    }
  });

  let resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(enableIfMobile, 120);
  });

  window.addEventListener('orientationchange', function () {
    setTimeout(enableIfMobile, 300);
  });

  window.updateStickyValue = updateStickyValue;
}

let stepperStickySetupDone = false;

function setupStepperSticky() {
  if (stepperStickySetupDone) return;
  stepperStickySetupDone = true;

  function setup() {
    const stepperEl = document.getElementById('design-stepper');
    const navbar = document.querySelector('.navbar');
    const targetSection = document.getElementById('sbar') || document.querySelector('.price-column.sbar') || document.querySelector('.details-section');
    
    if (!stepperEl || !targetSection) return;

    if (navbar) {
      document.documentElement.style.setProperty('--nav-height', `${navbar.offsetHeight}px`);
    }

    let io = new IntersectionObserver(function (entries) {
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
}

function openLB(s) { 
  document.getElementById('lb-img').src = s; 
  document.getElementById('lb').classList.add('open'); 
}

function closeLB() { 
  document.getElementById('lb').classList.remove('open'); 
}

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

/*
================================================================================
Design Request Modal
================================================================================
*/

function openDesignRequestModal() {
  const isMultiShapeHandle = S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02');
  const selectedShapesCount = (isMultiShapeHandle && Array.isArray(S.selectedHandleShapes)) ? S.selectedHandleShapes.length : 0;
  const hasSelectedTwoShapes = selectedShapesCount >= 2;
  const isHandleIncomplete = S.design && S.design.hc !== 0 && (!S.handle || (isMultiShapeHandle && !hasSelectedTwoShapes));
  const hasSelectedColor = Array.isArray(S.selectedColors) && S.selectedColors.length >= 1;
  const isDesignIncomplete = !S.design || !hasSelectedColor;

  if (!S.sinkType || !S.size || isDesignIncomplete || !S.div || isHandleIncomplete) {
    if (S.design && !hasSelectedColor) {
      showToast('يرجى اختيار لون الوحدة أولاً.');
    } else if (isMultiShapeHandle && selectedShapesCount === 1) {
      showToast('لقد اخترت شكلاً واحدًا فقط للمقبض، يرجى اختيار الشكل الثاني.');
    } else if (isMultiShapeHandle && selectedShapesCount === 0) {
      showToast('يرجى اختيار الشكلين الخاصين بالمقبض أولاً');
    } else {
      showToast('يرجى إكمال جميع اختيارات وحدة الحوض أولاً');
    }

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

  document.body.style.overflow = 'hidden';

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  window.drDesignConfig = {
    sinkType: S.sinkType,
    design: S.design,
    size: S.size,
    division: S.div,
    handle: S.handle,
    unitPrice: calc()
  };

  document.getElementById('dr-sink-type').value =
    S.sinkType === 'wall-hung' ? 'حوض معلق' :
    S.sinkType === 'floor-standing' ? 'حوض برجل كاملة' :
    S.sinkType === 'drop-in' ? 'حوض ساقط' : 'حوض فوق الكاونتر';

  loadDRDraft();

  const inputIds = [
    'dr-sink-brand',
    'dr-sink-width',
    'dr-sink-code',
    'dr-customer-name',
    'dr-customer-phone',
    'dr-manual-address'
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

  const savedDraft = JSON.parse(localStorage.getItem(DR_STORAGE_KEY) || '{}');
  const savedStep = savedDraft.currentStep || 1;
  drShowStep(savedStep);
  if (savedStep === 3) setTimeout(drRenderPreview, 100);
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
  window.drCurrentStep = stepNum;
  const savedDraft = JSON.parse(localStorage.getItem(DR_STORAGE_KEY) || '{}');
  savedDraft.currentStep = stepNum;
  try { localStorage.setItem(DR_STORAGE_KEY, JSON.stringify(savedDraft)); } catch(e) {}
  document.querySelectorAll('.dr-label').forEach(el => {
    el.style.color = 'var(--color-text-main)';
  });

  document.querySelectorAll('.dr-hint').forEach(el => {
    el.style.color = 'var(--color-text-main)';
    el.style.opacity = '0.6';
  });

  document.querySelectorAll('.dr-step-content').forEach(el => {
    el.style.display = 'none';
  });

  const currentStep = document.querySelector(
    `.dr-step-content[data-step="${stepNum}"]`
  );

  if (currentStep) {
    currentStep.style.display = 'block';
  }

  const stepperItems = document.querySelectorAll(
    '#dr-stepper .stepper-item'
  );

  stepperItems.forEach(el => {
    const step = parseInt(el.dataset.step, 10);

    if (step === stepNum) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }

    if (step < stepNum) {
      el.classList.add('completed');
    } else {
      el.classList.remove('completed');
    }

    el.classList.remove('out-of-range');
  });

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

window.drShowStep = drShowStep;

function drValidateStep(stepNum) {
  if (stepNum === 1) {
    const name = document.getElementById('dr-customer-name')?.value.trim();
    const phone = document.getElementById('dr-customer-phone')?.value.trim();
    const manualAddress = document.getElementById('dr-manual-address')?.value.trim();
    const govSelect = document.getElementById('dr-select-gov')?.value.trim();
    const districtSelect = document.getElementById('dr-select-district')?.value.trim();
    const hasAutoLocation = !!window.userLat && !!window.userLng;

    const hasDropdownLocation = !!govSelect && !!districtSelect;
    const hasLocation = hasAutoLocation || !!manualAddress || hasDropdownLocation;

    const missingFields = [];
    const phoneDigits = phone.replace(/\D/g, '');
    const validPhone = phoneDigits.length === 11 && phoneDigits.startsWith('01');
    if (!name) missingFields.push('الاسم');
    if (!phone) missingFields.push('رقم الهاتف');
    else if (!validPhone) {
      showToast('رقم الهاتف غير صحيح — يجب أن يبدأ بـ 01 ويتكون من 11 رقم');
      return false;
    }
    if (!hasLocation) missingFields.push('العنوان');

    if (missingFields.length > 0) {
      if (missingFields.length === 3) {
        showToast('يرجى ملء جميع البيانات المطلوبة');
      } else if (missingFields.length === 2) {
        showToast(`يرجى إدخال ${missingFields[0]} و${missingFields[1]}`);
      } else {
        showToast(`يرجى إدخال ${missingFields[0]}`);
      }
      return false;
    }
    return true;
  } else if (stepNum === 2) {
    const brand = document.getElementById('dr-sink-brand').value.trim();
    const width = document.getElementById('dr-sink-width').value.trim();
    const hasImage = document.getElementById('dr-sink-image').files.length > 0 || !!window.drSavedImages?.wall;

    const missingFields = [];

    if (!brand) missingFields.push('ماركة الحوض');
    if (!width) missingFields.push('عرض الحوض');
    if (!hasImage) missingFields.push('صورة الحائط');

    if (missingFields.length > 0) {
      let message = 'يرجى ';
      if (missingFields.length === 1) {
        message += `استكمال خانة ${missingFields[0]}`;
      } else if (missingFields.length === 2) {
        message += `استكمال خانتي ${missingFields[0]} و ${missingFields[1]}`;
      } else {
        const last = missingFields.pop();
        message += `استكمال الخانات التالية: ${missingFields.join('، ')} و ${last}`;
      }
      
      showToast(message);
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

function fitPreviewToWidth() {
  const frame = document.getElementById('dr-invoice-preview');
  const content = frame?.querySelector('.dr-preview-document');
  const pages = content?.querySelectorAll('.page');

  if (!frame || !content || !pages || pages.length === 0) return;

  const availableWidth = frame.clientWidth - 20;
  const pageWidth = pages[0].offsetWidth;

  if (!availableWidth || !pageWidth) return;

  let scale = availableWidth / pageWidth;
  scale = Math.min(1, scale);
  scale = Math.max(0.5, scale);

  pages.forEach(page => {
    page.style.transformOrigin = 'top center';
    page.style.transform = `scale(${scale})`;
    page.style.marginLeft = '0';
    page.style.marginRight = '0';
  });

  requestAnimationFrame(() => {
    const maxScroll = frame.scrollWidth - frame.clientWidth;
    if (maxScroll > 0) {
      frame.scrollLeft = maxScroll / 2;
    } else {
      frame.scrollLeft = 0;
    }
  });
}

async function drRenderPreview() {
  const previewEl = document.getElementById('dr-invoice-preview');
  if (!previewEl) return;

  previewEl.innerHTML = '';

  const frame = previewEl;
  let previewZoom = 1;

  // Zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.className = 'dr-zoom-controls';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
  zoomOutBtn.className = 'dr-zoom-btn';
  zoomOutBtn.textContent = '−';
  zoomOutBtn.title = 'تصغير';

  const zoomResetBtn = document.createElement('button');
  zoomResetBtn.type = 'button';
  zoomResetBtn.className = 'dr-zoom-btn';
  zoomResetBtn.textContent = '100%';
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

  // Load template
  let response;
  try {
    response = await fetch('product-order-summary.html', { cache: 'no-store' });
  } catch (error) {
    console.error('Failed to load product-order-summary.html:', error);
    return;
  }

  if (!response.ok) {
    console.error('Failed to load product-order-summary.html:', response.status);
    return;
  }

  const html = await response.text();
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');

  // Load styles
  parsedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const absoluteHref = new URL(href, new URL('product-order-summary.html', window.location.href)).href;
    const alreadyLoaded = [...document.querySelectorAll('link[rel="stylesheet"]')].some(el => el.href === absoluteHref);
    if (!alreadyLoaded) {
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = absoluteHref;
      document.head.appendChild(styleLink);
    }
  });

  // Content
  const content = document.createElement('div');
  content.className = 'dr-preview-document';
  content.innerHTML = parsedDoc.body.innerHTML;
  Object.assign(content.style, {
    width: '100%',
    minWidth: '0',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxSizing: 'border-box'
  });
  frame.appendChild(content);

  const pages = content.querySelectorAll('.page');
  if (pages.length) pages[pages.length - 1].style.marginBottom = '0';

  // Zoom function — single source of truth
  function applyZoom(zoom) {
    previewZoom = Math.min(2, Math.max(0.5, +zoom.toFixed(2)));
    const allPages = content.querySelectorAll('.page');
    const frameWidth = frame.clientWidth - 20;
    const pageWidth = allPages[0]?.offsetWidth || 1;
    const fitScale = Math.min(1, frameWidth / pageWidth);
    const finalScale = fitScale * previewZoom;

    allPages.forEach(page => {
      page.style.transformOrigin = 'top center';
      page.style.transform = `scale(${finalScale})`;
      page.style.marginBottom = `${(finalScale - 1) * page.offsetHeight}px`;
    });

    zoomResetBtn.textContent = `${Math.round(previewZoom * 100)}%`;
  }

  // Initial fit
  requestAnimationFrame(() => requestAnimationFrame(() => applyZoom(1)));

  // Zoom events
  zoomInBtn.addEventListener('click', () => applyZoom(previewZoom + 0.1));
  zoomOutBtn.addEventListener('click', () => applyZoom(previewZoom - 0.1));
  zoomResetBtn.addEventListener('click', () => applyZoom(1));

  // Pinch-to-zoom (mobile)
  let lastPinchDist = null;
  frame.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (lastPinchDist !== null) {
      const delta = (dist - lastPinchDist) / 200;
      applyZoom(previewZoom + delta);
    }
    lastPinchDist = dist;
  }, { passive: false });

  frame.addEventListener('touchend', () => { lastPinchDist = null; });

  // Resize
  const resizeObserver = new ResizeObserver(() => applyZoom(previewZoom));
  resizeObserver.observe(frame);

  try {
    const brand = document.getElementById('dr-sink-brand')?.value || 'غير متوفر';
    const width = document.getElementById('dr-sink-width')?.value || 'غير متوفر';
    const code = document.getElementById('dr-sink-code')?.value || 'غير متوفر';
    const name = document.getElementById('dr-customer-name')?.value || 'غير متوفر';
    const phone = document.getElementById('dr-customer-phone')?.value || 'غير متوفر';

    const config = window.drDesignConfig;

    if (!config) {
      console.warn('drDesignConfig is missing');
      return;
    }

    const locationAddress = window.userLocationAddress || {};
    const lat = window.userLat;
    const lng = window.userLng;
    const shippingCost = window.installCost;
    const isManualLocation = window.drIsManualLocation === true;

    const designImg = content.querySelector('#design-img');
    const divisionImg = content.querySelector('#division-img');
    const handleImg = content.querySelector('#handle-img');

    if (designImg && config.design?.id) {
      designImg.src = getConfiguratorImageUrl(config.design.id, config.sinkType);
    }

    if (divisionImg && config.division?.id) {
      divisionImg.src = getConfiguratorImageUrl(config.division.id, config.sinkType);
    }

    if (handleImg && config.handle?.id) {
      handleImg.src = getConfiguratorImageUrl(config.handle.id, config.sinkType);
    }

    const wallImageEl = content.querySelector('#sink-wall-image');
    const wallImageInput = document.getElementById('dr-sink-image');
    const wallImageFile = wallImageInput?.files?.[0];

    if (wallImageFile && wallImageEl) {
      const reader = new FileReader();

      reader.onload = e => {
        wallImageEl.src = e.target.result;
      };

      reader.readAsDataURL(wallImageFile);
    } else if (window.drSavedImages?.wall && wallImageEl) {
      wallImageEl.src = window.drSavedImages.wall;
    }

    const sinkImageEl = content.querySelector('#sink-image');
    const sinkImageInput = document.getElementById('dr-sink-photo');
    const sinkImageFile = sinkImageInput?.files?.[0];

    if (sinkImageFile && sinkImageEl) {
      const reader = new FileReader();

      reader.onload = e => {
        sinkImageEl.src = e.target.result;
      };

      reader.readAsDataURL(sinkImageFile);
    } else if (window.drSavedImages?.photo && sinkImageEl) {
      sinkImageEl.src = window.drSavedImages.photo;
    }

    const stickerImageEl = content.querySelector('#sink-label-image');
    const stickerImageInput = document.getElementById('dr-sink-sticker');
    const stickerImageFile = stickerImageInput?.files?.[0];

    if (stickerImageFile && stickerImageEl) {
      const reader = new FileReader();

      reader.onload = e => {
        stickerImageEl.src = e.target.result;
      };

      reader.readAsDataURL(stickerImageFile);
    } else if (window.drSavedImages?.sticker && stickerImageEl) {
      stickerImageEl.src = window.drSavedImages.sticker;
    }

    const sinkTypeEl = content.querySelector('#sink-type');

    if (sinkTypeEl) {
      const sinkTypeNames = {
        'wall-hung': 'حوض معلق',
        'floor-standing': 'حوض برجل كاملة',
        'drop-in': 'حوض ساقط',
        'bowl': 'حوض فوق الكاونتر'
      };

      sinkTypeEl.textContent = sinkTypeNames[config.sinkType] || config.sinkType;
    }

    const sinkBrandEl = content.querySelector('#sink-brand');
    if (sinkBrandEl) {
      sinkBrandEl.textContent = brand;
    }

    const sinkWidthEl = content.querySelector('#sink-width');
    if (sinkWidthEl) {
      sinkWidthEl.textContent = width ? `${width} سم` : '';
    }

    const sinkCodeEl = content.querySelector('#sink-code');
    if (sinkCodeEl) {
      sinkCodeEl.textContent = code;
    }

    const custNameEl = content.querySelector('#customer-name');
    if (custNameEl) {
      custNameEl.textContent = name;
    }

    const custPhoneEl = content.querySelector('#customer-phone');
    if (custPhoneEl) {
      custPhoneEl.textContent = phone;
    }

    const governorateEl = content.querySelector('#shipping-governorate');
    if (governorateEl) {
      governorateEl.textContent = locationAddress.governorate || 'غير متوفر';
    }

    const districtEl = content.querySelector('#shipping-district');
    if (districtEl) {
      districtEl.textContent = locationAddress.district || locationAddress.city || 'غير متوفر';
    }

    const lngEl = content.querySelector('#shipping-lng');
    if (lngEl) {
      lngEl.textContent =
        !isManualLocation && typeof lng === 'number'
          ? lng.toFixed(6)
          : 'غير متوفر';
    }

    const latEl = content.querySelector('#shipping-lat');
    if (latEl) {
      latEl.textContent =
        !isManualLocation && typeof lat === 'number'
          ? lat.toFixed(6)
          : 'غير متوفر';
    }

    const shippingMapEl = content.querySelector('#shipping-map-image');

    if (shippingMapEl) {
      if (
        !isManualLocation &&
        typeof lat === 'number' &&
        typeof lng === 'number'
      ) {
        const mapUrl = buildStaticMapUrl(lat, lng, 700, 350);

        if (mapUrl) {
          shippingMapEl.src = mapUrl;
          shippingMapEl.hidden = false;
        }
      } else {
        shippingMapEl.hidden = true;
      }
    }

    const shippingCostEl = content.querySelector('#shipping-cost');

    if (shippingCostEl) {
      if (
        shippingCost !== null &&
        shippingCost !== undefined &&
        shippingCost !== ''
      ) {
        shippingCostEl.textContent =
          `${Number(shippingCost).toLocaleString('en-US')} ج.م` +
          (isManualLocation ? ' (تقريبي)' : '');
      } else {
        shippingCostEl.textContent = 'غير متوفر';
      }
    }

    const notesEl = content.querySelector('#order-notes');

    if (notesEl) {
      notesEl.innerHTML = isManualLocation
        ? `
          1. يرجى التواصل قبل التوصيل بيوم لتحديد الميعاد المناسب.<br>
          2. تكلفة النقل تقديرية بناءً على المحافظة والحي المحددين يدويًا، وقد تختلف التكلفة الفعلية بعد تحديد الموقع بدقة.
        `
        : `
          1. يرجى التواصل قبل التوصيل بيوم لتحديد الميعاد المناسب.
        `;
    }

    const designTbody = content.querySelector('#sink-design-items');
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

    const divisionTbody = content.querySelector('#sink-division-items');
    if (divisionTbody) {
      const sg = sgr(config.size.size);
      const divPrice = dvp(config.division, sg);

      divisionTbody.innerHTML = `
        <tr class="item-row">
          <td class="col-section">التقسيمة الداخلية</td>
          <td class="col-name">${config.division.name}</td>
          <td class="col-code">${config.division.id}</td>
          <td class="col-price">${divPrice} ج.م</td>
        </tr>
      `;
    }

    const handleTbody = content.querySelector('#sink-handle-items');
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

    const totalEl = content.querySelector('#order-total');
    if (totalEl) {
      totalEl.textContent = `${config.unitPrice} ج.م`;
    }

    const orderNumEl = content.querySelector('#order-number');
    if (orderNumEl) {
    const orderNum =
      window.drCurrentOrderNum || '—';

    orderNumEl.textContent = orderNum;
        }

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxSize = 1600;

        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas is not supported'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.78);

        resolve(compressedBase64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = reader.result;
    };

    reader.onerror = error => reject(error);

    reader.readAsDataURL(file);
  });
}

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

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);

      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (targetSize - w) / 2;
      const y = (targetSize - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

async function saveDRDraft() {
  const wallFile = document.getElementById('dr-sink-image')?.files?.[0];
  const photoFile = document.getElementById('dr-sink-photo')?.files?.[0];
  const stickerFile = document.getElementById('dr-sink-sticker')?.files?.[0];

  const saved = JSON.parse(localStorage.getItem(DR_STORAGE_KEY) || '{}');

  const wallBase64 = wallFile ? await fileToBase64(wallFile) : (saved.wallImage || null);
  const photoBase64 = photoFile ? await fileToBase64(photoFile) : (saved.sinkPhoto || null);
  const stickerBase64 = stickerFile ? await fileToBase64(stickerFile) : (saved.stickerPhoto || null);

  if (wallFile) updateCustomFileUI('dr-sink-image', wallBase64);
  if (photoFile) updateCustomFileUI('dr-sink-photo', photoBase64);
  if (stickerFile) updateCustomFileUI('dr-sink-sticker', stickerBase64);

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

    userLat:
      window.userLat !== undefined && window.userLat !== null
        ? window.userLat
        : (saved.userLat || null),

    userLng:
      window.userLng !== undefined && window.userLng !== null
        ? window.userLng
        : (saved.userLng || null),

    installCost:
      window.installCost !== undefined && window.installCost !== null
        ? window.installCost
        : (saved.installCost ?? null),

    isManualLocation:
      window.drIsManualLocation !== undefined
        ? window.drIsManualLocation
        : (saved.isManualLocation || false),

    manualGovernorate:
      document.getElementById('dr-select-gov')?.value ||
      saved.manualGovernorate ||
      '',

    manualDistrict:
      document.getElementById('dr-select-district')?.value ||
      saved.manualDistrict ||
      '',

    wallImage: wallBase64,
    sinkPhoto: photoBase64,
    stickerPhoto: stickerBase64
  };

  data.currentStep = window.drCurrentStep || 1;
  try {
    localStorage.setItem(DR_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage quota exceeded (image might be too large):', e);
  }
}

function loadDRDraft() {
  updateCustomFileUI('dr-sink-image', null, 'اضغط لرفع صورة الحائط');
  updateCustomFileUI('dr-sink-photo', null, 'اضغط لرفع صورة الحوض');
  updateCustomFileUI('dr-sink-sticker', null, 'اضغط لرفع صورة الملصق');

  const saved = localStorage.getItem(DR_STORAGE_KEY);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);

    if (data.brand) document.getElementById('dr-sink-brand').value = data.brand;
    if (data.width) document.getElementById('dr-sink-width').value = data.width;
    if (data.code) document.getElementById('dr-sink-code').value = data.code;

    document.getElementById('dr-customer-name').value =
      window.currentUser?.displayName || data.name || '';
    document.getElementById('dr-customer-phone').value =
      window.currentUser?.phoneNumber || data.phone || '';

    // Restore saved location
    if (data.locationAddress) {
      window.userLocationAddress = data.locationAddress;

      window.userLat =
        data.userLat !== undefined && data.userLat !== null
          ? data.userLat
          : null;

      window.userLng =
        data.userLng !== undefined && data.userLng !== null
          ? data.userLng
          : null;

      window.installCost =
        data.installCost !== undefined && data.installCost !== null
          ? data.installCost
          : null;

      window.drIsManualLocation = data.isManualLocation === true;

      const govSelect = document.getElementById('dr-select-gov');
      const districtSelect = document.getElementById('dr-select-district');

      // =========================================
      // Restore manual location
      // =========================================
      if (
        window.drIsManualLocation &&
        govSelect &&
        districtSelect &&
        data.manualGovernorate
      ) {
        govSelect.value = data.manualGovernorate;

        // إعادة بناء قائمة الأحياء فقط
        // بدون تشغيل geocoding أو إعادة حساب التكلفة
        drOnGovChange();

        if (data.manualDistrict) {
          districtSelect.value = data.manualDistrict;
        }

        window.drIsManualLocation = true;

        const manualGroup =
          document.getElementById('dr-manual-address-group');

        if (manualGroup) {
          manualGroup.style.display = 'block';
        }

        const manualLink =
          document.getElementById('dr-toggle-manual-address');

        if (manualLink) {
          manualLink.style.display = 'none';
        }

        const res = document.getElementById('dr-loc-result');

        if (res) {
          res.innerHTML = `
            <div>
              تكلفة التوصيل:
              <strong>
                ${window.installCost !== null
                  ? Number(window.installCost).toLocaleString('en-US') + ' EGP'
                  : '—'}
              </strong>
            </div>

            <div style="font-size: 10px; font-weight: 400; margin-top: 2px;">
              (تقديرية — يُفضل تحديد الموقع تلقائيًا لحساب التكلفة بدقة أكبر)
            </div>
          `;

          res.className = 'loc-result show';
          res.style.display = 'block';
        }

      // =========================================
      // Restore GPS location
      // =========================================
      } else if (
        !window.drIsManualLocation &&
        typeof window.userLat === 'number' &&
        typeof window.userLng === 'number'
      ) {

        const res = document.getElementById('dr-loc-result');
        const mapContainer = document.getElementById('dr-mapContainer');
        const mapImage = document.getElementById('dr-staticMap');

        if (mapImage) {
          const mapUrl = buildStaticMapUrl(
            window.userLat,
            window.userLng,
            600,
            300
          );

          if (mapUrl) {
            mapImage.src = mapUrl;
          }
        }

        if (mapContainer) {
          mapContainer.hidden = false;
          mapContainer.style.display = 'block';
        }

        if (res) {
          res.innerHTML = `
            تم استعادة موقعك — تكلفة التوصيل:
            ${window.installCost !== null
              ? Number(window.installCost).toLocaleString('en-US') + ' EGP'
              : '—'}
          `;

          res.className = 'loc-result show';
          res.style.display = 'block';
        }

        const btn = document.getElementById('dr-btn-locate');

        if (btn) {
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            تم تحديد الموقع
          `;

          btn.disabled = false;
        }
      }
    }

    window.drSavedImages = {
      wall: data.wallImage || null,
      photo: data.sinkPhoto || null,
      sticker: data.stickerPhoto || null
    };

    if (data.wallImage) updateCustomFileUI('dr-sink-image', data.wallImage);
    if (data.sinkPhoto) updateCustomFileUI('dr-sink-photo', data.sinkPhoto);
    if (data.stickerPhoto) updateCustomFileUI('dr-sink-sticker', data.stickerPhoto);

  } catch (e) {
    console.error('Failed to parse draft data:', e);
  }
}

function drDownloadPdf() {
  const previewEl = document.getElementById('dr-invoice-preview');
  const content = previewEl?.querySelector('.dr-preview-document');
  if (!content) {
    showToast('يرجى مراجعة المعاينة أولاً');
    return;
  }

  const orderNum = window.drCurrentOrderNum || `DR-${String(Date.now()).slice(-8)}`;
  const pages = content.querySelectorAll('.page');
  const baseUrl = window.location.href.replace(/\/[^\/]*$/, '/');

  let pagesHtml = '';
  if (pages.length > 0) {
    pages.forEach(p => {
      const clone = p.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.marginBottom = '0';
      clone.style.marginLeft = '0';
      clone.style.marginRight = '0';
      pagesHtml += clone.outerHTML;
    });
  } else {
    const clone = content.cloneNode(true);
    clone.style.transform = 'none';
    pagesHtml = clone.outerHTML;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${baseUrl}css/product-order-summary.css">
  <style>
    body { margin: 0; padding: 0; background: #fff; }
    .page { transform: none !important; margin: 0 !important; }
    @media print { 
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 10mm; }
    }
    .print-btn {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #91a37f;
      color: #fff;
      border: none;
      padding: 12px 32px;
      font-size: 16px;
      font-family: 'Cairo', sans-serif;
      border-radius: 8px;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة / حفظ كـ PDF</button>
  ${pagesHtml}
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  showToast('اضغط "طباعة / حفظ كـ PDF" واختر A4');
}

window.drDownloadPdf = drDownloadPdf;

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

async function submitOrderToSheet() {
  const config = window.drDesignConfig;

  // ID ثابت لنفس محاولة إرسال الطلب
  let submissionId =
    localStorage.getItem('wodi_pending_submission_id');

  if (!submissionId) {
    submissionId =
      `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(
      'wodi_pending_submission_id',
      submissionId
    );
  }
  const locationAddress = window.userLocationAddress || {};
  const currentUser = window.currentUser || null;

  const body = {
    submissionId,
    email: currentUser?.email || null,
    uid: currentUser?.uid || null,

    name: document.getElementById('dr-customer-name')?.value || '',
    phone: document.getElementById('dr-customer-phone')?.value || '',

    brand: document.getElementById('dr-sink-brand')?.value || '',
    sinkWidth: document.getElementById('dr-sink-width')?.value || '',
    sinkCode: document.getElementById('dr-sink-code')?.value || '',

    locationAddress,
    locationMethod: window.drIsManualLocation === true ? 'يدوي' : 'تلقائي',
    lat: window.drIsManualLocation === true ? '' : (window.userLat || ''),
    lng: window.drIsManualLocation === true ? '' : (window.userLng || ''),

    sinkType: config?.sinkType || '',
    designName: config?.design?.name || '',
    size: config?.size?.size || '',
    divisionName: config?.division?.name || '',
    handleName: config?.handle?.name || 'بدون',
    unitPrice: config?.unitPrice || '',

    // Historical Snapshot
    designId: config?.design?.id || '',
    designPrice: config?.size?.price || '',

    divisionId: config?.division?.id || '',
    divisionPrice: (
      config?.division &&
      config?.size
        ? dvp(config.division, sgr(config.size.size))
        : ''
    ),

    handleId: config?.handle?.id || '',
    handlePrice: (
      config?.handle &&
      config?.design
        ? config.handle.price * config.design.hc
        : 0
    ),

    colorId: S?.selectedColors?.[0] || '',
    colorPrice: (() => {
      const selectedId = S?.selectedColors?.[0] || '';

      if (!selectedId) return 0;

      let familyKey = 'solid';

      if (selectedId.startsWith('clr_wd_')) {
        familyKey = 'wood';
      } else if (selectedId.startsWith('clr_gls_')) {
        familyKey = 'gloss';
      }

      const colorObj = (D.colors || [])
        .find(c => c.family === familyKey);

      if (colorObj) {
        return colorObj.price || 0;
      }

      if (familyKey === 'wood') return 800;
      if (familyKey === 'gloss') return 1100;

      return 0;
    })(),

    installationFee: 200,
    installationCost: installCost ?? '',

    selectedColor: S?.selectedColors?.[0] || '',
    handleShape1: S?.selectedHandleShapes?.[0] || '',
    handleShape2: S?.selectedHandleShapes?.[1] || '',

    // صور الطلب
    wallImage: window.drSavedImages?.wall || '',
    sinkPhoto: window.drSavedImages?.photo || '',
    stickerPhoto: window.drSavedImages?.sticker || ''
  };

  try {

    const resp = await fetch('/api/submit-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    if (!data.success && data.error === 'max_orders') {
      showToast('وصلت للحد الأقصى من الطلبات — تواصل معنا على الواتساب للمتابعة');
      return null;
    }

    if (!data.success) {
      console.warn('Order submission failed:', data);
      return null;
    }

    return data.orderNum || null;

  } catch (e) {

    console.warn('Failed to submit order:', e);
    return null;

  }
}

async function drSubmitOrder() {
  const button = document.getElementById('dr-btn-whatsapp');

  // منع الضغط المتكرر أثناء الإرسال
  if (button?.disabled) return;

  // تغيير شكل الزر فورًا لإظهار أن الضغط تم الاستجابة له
  if (button) {
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = `
      <span class="dr-btn-spinner"></span>
      جاري إرسال الطلب...
    `;
  }

  const orderNum = await submitOrderToSheet();

  // لو فشل الإرسال: لا نقفل المودال ولا نصفر أي بيانات
  if (!orderNum) {
    console.warn('Order not saved to sheet');
    showToast('حدث خطأ أثناء إرسال الطلب — حاول مرة أخرى');

    if (button) {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
        تأكيد الطلب
      `;
    }

    return;
  }

  // وصلنا هنا فقط بعد نجاح حفظ الطلب
  window.drCurrentOrderNum = orderNum;
  localStorage.setItem('wodi_order_submitted', orderNum);

  localStorage.removeItem('wodi_pending_submission_id');

  // مسح اختيارات الكونفيجوريتور والداتا
  if (typeof resetAll === 'function') resetAll();
  localStorage.removeItem('wodi_configurator_state');
  localStorage.removeItem(DR_STORAGE_KEY);
  sessionStorage.removeItem('wodi_configurator_cache');

  // إغلاق مودال طلب التصميم
  closeDesignRequestModal();

  // فتح درج الطلبات وإظهار حالة التحميل
  await drOpenOrdersDrawer({
    focusOrderNum: orderNum,
    showLoading: true
  });

  // تم إرسال الطلب بنجاح
  showToast('تم إرسال الطلب بنجاح');
}

window.drSubmitOrder = drSubmitOrder;

function drShowConfirmation(orderNum) {
  const modal = document.getElementById('design-request-modal');
  const box = modal?.querySelector('.design-request-box');
  if (!box) return;

  box.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 48px 24px; text-align:center; gap:16px;">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#91a37f" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
      <h2 style="font-size:20px; font-weight:700; color:var(--color-text-main); margin:0;">تم إرسال طلبك بنجاح!</h2>
      <p style="font-size:13px; color:var(--color-text-muted); margin:0;">رقم طلبك: <strong>${orderNum}</strong></p>
      <p style="font-size:13px; color:var(--color-text-muted); margin:0;">احتفظ بهذا الرقم للمتابعة</p>
      <p style="font-size:13px; color:var(--color-text-muted); margin:0;">هنتواصل معاك خلال 24 ساعة</p>
      <div style="display:flex; gap:12px; margin-top:8px;">
        <button onclick="closeDesignRequestModal()" style="padding:10px 24px; border-radius:8px; border:1px solid var(--color-border); background:#fff; cursor:pointer; font-family:var(--font-family-main); font-size:13px;">إغلاق</button>
        <button onclick="drViewSummary('${orderNum}')" style="padding:10px 24px; border-radius:8px; border:none; background:var(--color-accent,#91a37f); color:#fff; cursor:pointer; font-family:var(--font-family-main); font-size:13px;">عرض ملخص الطلب</button>
      </div>
    </div>
  `;
}

async function drViewSummary(orderNum, button) {

  if (!orderNum) return;

  const currentUser = window.currentUser;

  if (!currentUser?.email) {
    showToast('تعذر تحديد حساب المستخدم');
    return;
  }

  // منع الضغط المتكرر أثناء التحميل
  if (button?.disabled) return;

  let loadingToastTimer = null;

  if (button) {
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = `
      <span class="dr-btn-spinner"></span>
      جاري تحميل الملخص...
    `;

    loadingToastTimer = setTimeout(() => {
      showToast(
        'جاري تحميل بيانات الطلب، قد يستغرق الأمر بضع ثوانٍ...'
      );
    }, 3000);
  }

  if (!currentUser?.email) {
    showToast('تعذر تحديد حساب المستخدم');
    return;
  }

  try {

    // =========================================================
    // تحميل الطلب + قالب الملخص بالتوازي
    // =========================================================

    const orderPromise = fetch(
      `/api/get-config?action=getOrder&orderNum=${encodeURIComponent(orderNum)}&email=${encodeURIComponent(currentUser.email)}`
    ).then(response => response.json());

    if (!window.drOrderSummaryTemplatePromise) {
      window.drOrderSummaryTemplatePromise =
        fetch('product-order-summary.html', {
          cache: 'force-cache'
        }).then(response => {
          if (!response.ok) {
            throw new Error('Failed to load invoice template');
          }

          return response.text();
        });
    }

    const [data, html] = await Promise.all([
      orderPromise,
      window.drOrderSummaryTemplatePromise
    ]);

    if (!data.success || !data.order) {
      throw new Error('Order summary not available');
    }

    const order = data.order;

    const parser = new DOMParser();

    const parsedDoc =
      parser.parseFromString(html, 'text/html');

    const baseUrl =
      window.location.href.replace(/\/[^\/]*$/, '/');

    const content =
      document.createElement('div');

    content.className =
      'dr-preview-document';

    content.innerHTML =
      parsedDoc.body.innerHTML;


    // =========================================================
    // Helpers
    // =========================================================

    const setText = (selector, value) => {

      const el = content.querySelector(selector);

      if (!el) return;

      el.textContent =
        value !== undefined &&
        value !== null &&
        value !== ''
          ? value
          : 'غير متوفر';
    };


    const formatPrice = value => {

      const n = parseFloat(value);

      if (!Number.isFinite(n)) {
        return '—';
      }

      return `${n.toLocaleString('en-US')} ج.م`;
    };


    const imageUrl = (path) => {

      if (!path) return '';

      return new URL(
        path,
        baseUrl
      ).href;
    };


    // =========================================================
    // البيانات الأساسية
    // =========================================================

    setText(
      '#order-number',
      order['رقم الطلب']
    );

    setText(
      '#customer-name',
      order['الاسم']
    );

    setText(
      '#customer-phone',
      order['التليفون']
    );

    setText(
      '#sink-brand',
      order['ماركة الحوض']
    );


    const widthEl =
      content.querySelector('#sink-width');

    if (widthEl) {

      widthEl.textContent =
        order['عرض الحوض']
          ? `${order['عرض الحوض']} سم`
          : 'غير متوفر';
    }


    setText(
      '#sink-code',
      order['كود الحوض']
    );


    // =========================================================
    // نوع الحوض
    // =========================================================

    const sinkTypeNames = {

      'wall-hung': 'حوض معلق',

      'floor-standing': 'حوض برجل كاملة',

      'drop-in': 'حوض ساقط',

      'bowl': 'حوض فوق الكاونتر'

    };

    setText(
      '#sink-type',
      sinkTypeNames[order['نوع الحوض']] ||
      order['نوع الحوض']
    );


    // =========================================================
    // الموقع
    // =========================================================

    setText(
      '#shipping-governorate',
      order['المحافظة']
    );

    setText(
      '#shipping-district',
      order['الحي']
    );


    const lngEl =
      content.querySelector('#shipping-lng');

    if (lngEl) {

      const lng =
        parseFloat(order['خط الطول']);

      lngEl.textContent =
        Number.isFinite(lng)
          ? lng.toFixed(6)
          : 'غير متوفر';
    }


    const latEl =
      content.querySelector('#shipping-lat');

    if (latEl) {

      const lat =
        parseFloat(order['دائرة العرض']);

      latEl.textContent =
        Number.isFinite(lat)
          ? lat.toFixed(6)
          : 'غير متوفر';
    }

 // =========================================================
// Tooltip
// =========================================================
  
  document.addEventListener('click', function (e) {
  const tooltip = e.target.closest('.info-tooltip');

  document.querySelectorAll('.info-tooltip.is-open').forEach(el => {
    if (el !== tooltip) {
      el.classList.remove('is-open');
    }
  });

  if (tooltip) {
    tooltip.classList.toggle('is-open');
  }
});


 // =========================================================
// صور العميل من Google Drive
// =========================================================

const setImage = (selector, url) => {

  const el = content.querySelector(selector);

  if (!el) return;

  if (!url) {
    el.hidden = true;
    return;
  }

  let imageUrlValue = String(url).trim();

  // تحويل Google Drive URL إلى Thumbnail مباشر
  const driveMatch = imageUrlValue.match(
    /drive\.google\.com\/(?:uc\?(?:[^#]*&)?id=|file\/d\/)([^&/]+)/i
  );

  if (driveMatch && driveMatch[1]) {
    imageUrlValue =
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveMatch[1])}&sz=w1200`;
  }

  el.src = imageUrlValue;
  el.hidden = false;

  el.onerror = () => {

    console.warn(
      'Failed to load order image:',
      imageUrlValue
    );

    el.hidden = true;
  };
};


setImage(
  '#sink-wall-image',
  order['رابط صورة الحائط']
);

setImage(
  '#sink-image',
  order['رابط صورة الحوض']
);

setImage(
  '#sink-label-image',
  order['رابط صورة الملصق']
);


// =========================================================
// Historical Snapshot
// =========================================================

const snapshot = {

  designId:
    order['Design ID'] ||
    '',

  designPrice:
    order['Design Price'] ??
    '',

  divisionId:
    order['Division ID'] ||
    '',

  divisionPrice:
    order['Division Price'] ??
    '',

  handleId:
    order['Handle ID'] ||
    '',

  handlePrice:
    order['Handle Price'] ??
    '',

  colorId:
    order['Color ID'] ||
    order['اللون'] ||
    '',

  colorPrice:
    order['Color Price'] ??
    '',

  installationFee:
    order['Installation Fee'] ??
    '',

  installationCost:
    order['Installation Cost'] ??
    ''
};


// =========================================================
// صورة التصميم
// =========================================================

const designImg =
  content.querySelector('#design-img');

if (designImg) {

  if (snapshot.designId) {

    let designImageId =
      snapshot.designId;

    // التصميم يحتاج نوع الحوض
    const typeCodeMap = {
      'drop-in': 'di',
      'bowl': 'bw'
    };

    const typeCode =
      typeCodeMap[order['نوع الحوض']];

    if (typeCode) {

      designImageId =
        designImageId.replace(
          /_wh_/,
          `_${typeCode}_`
        );
    }

    const encoded =
      encodeURIComponent(designImageId);

    const webp =
      `${GH}${encoded}.webp`;

    const png =
      `${GH}${encoded}.png`;

    designImg.src = webp;
    designImg.hidden = false;

    designImg.onerror = function () {

      if (this.src.endsWith('.webp')) {

        this.src = png;

      } else {

        this.hidden = true;
      }
    };

  } else {

    designImg.hidden = true;
  }
}


// =========================================================
// صورة التقسيمة
// =========================================================

const divisionImg =
  content.querySelector('#division-img');

if (divisionImg) {

  if (snapshot.divisionId) {

    const encoded =
      encodeURIComponent(
        snapshot.divisionId
      );

    const webp =
      `${GH}${encoded}.webp`;

    const png =
      `${GH}${encoded}.png`;

    divisionImg.src = webp;
    divisionImg.hidden = false;

    divisionImg.onerror = function () {

      if (this.src.endsWith('.webp')) {

        this.src = png;

      } else {

        this.hidden = true;
      }
    };

  } else {

    divisionImg.hidden = true;
  }
}


// =========================================================
// صورة نوع المقبض
// =========================================================

const handleImg =
  content.querySelector('#handle-img');

if (handleImg) {

  if (snapshot.handleId) {

    const encoded =
      encodeURIComponent(
        snapshot.handleId
      );

    const webp =
      `${GH}${encoded}.webp`;

    const png =
      `${GH}${encoded}.png`;

    handleImg.src = webp;
    handleImg.hidden = false;

    handleImg.onerror = function () {

      if (this.src.endsWith('.webp')) {

        this.src = png;

      } else {

        this.hidden = true;
      }
    };

  } else {

    handleImg.hidden = true;
  }
}


// =========================================================
// جدول التصميم
// =========================================================

const designTbody =
  content.querySelector(
    '#sink-design-items'
  );

if (designTbody) {

  const colorId =
    snapshot.colorId;

  const colorImgHtml =
    colorId
      ? `
        <img
          src="images/conf/clr/${encodeURIComponent(colorId)}.webp"
          style="height:36px; object-fit:contain;"
          onerror="this.onerror=null; this.src='images/conf/clr/${encodeURIComponent(colorId)}.png'"
        />
      `
      : '—';

  const designCode =
    snapshot.designId ||
    '—';

  const designPrice =
    snapshot.designPrice !== ''
      ? formatPrice(snapshot.designPrice)
      : '—';

  designTbody.innerHTML = `
    <tr class="item-row">

      <td class="col-section">
        التصميم
      </td>

      <td class="col-name">
        ${order['التصميم'] || '—'}
      </td>

      <td class="col-code">
        ${designCode}
      </td>

      <td class="col-color">
        ${colorImgHtml}
      </td>

      <td class="col-price">
        ${designPrice}
      </td>

    </tr>
  `;
}


// =========================================================
// جدول التقسيمة
// =========================================================

const divisionTbody =
  content.querySelector(
    '#sink-division-items'
  );

if (divisionTbody) {

  const divisionCode =
    snapshot.divisionId ||
    '—';

  const divisionPrice =
    snapshot.divisionPrice !== ''
      ? formatPrice(
          snapshot.divisionPrice
        )
      : '—';

  divisionTbody.innerHTML = `
    <tr class="item-row">

      <td class="col-section">
        التقسيمة الداخلية
      </td>

      <td class="col-name">
        ${order['التقسيمة'] || '—'}
      </td>

      <td class="col-code">
        ${divisionCode}
      </td>

      <td class="col-price">
        ${divisionPrice}
      </td>

    </tr>
  `;
}


// =========================================================
// جدول المقابض
// =========================================================

const handleTbody =
  content.querySelector(
    '#sink-handle-items'
  );

if (handleTbody) {

  const shape1 =
    order['شكل المقبض 1'] || '';

  const shape2 =
    order['شكل المقبض 2'] || '';


  const shape1Html =
    shape1
      ? `
        <img
          src="images/conf/hnd/${encodeURIComponent(shape1)}.webp"
          style="height:36px; object-fit:contain;"
          onerror="this.onerror=null; this.src='images/conf/hnd/${encodeURIComponent(shape1)}.png'"
        />
      `
      : '—';


  const shape2Html =
    shape2
      ? `
        <img
          src="images/conf/hnd/${encodeURIComponent(shape2)}.webp"
          style="height:36px; object-fit:contain;"
          onerror="this.onerror=null; this.src='images/conf/hnd/${encodeURIComponent(shape2)}.png'"
        />
      `
      : '—';


  const handleCode =
    snapshot.handleId ||
    '—';


  const handlePrice =
    snapshot.handlePrice !== ''
      ? formatPrice(
          snapshot.handlePrice
        )
      : '—';


  handleTbody.innerHTML = `
    <tr class="item-row">

      <td class="col-section">
        نوع المقبض
      </td>

      <td class="col-name">
        ${order['المقبض'] || '—'}
      </td>

      <td class="col-code">
        ${handleCode}
      </td>

      <td class="col-handle-priority">
        ${shape1Html}
      </td>

      <td class="col-handle-priority">
        ${shape2Html}
      </td>

      <td class="col-price">
        ${handlePrice}
      </td>

    </tr>
  `;
}


    // =========================================================
    // السعر النهائي التاريخي
    // =========================================================

    const totalEl =
      content.querySelector(
        '#order-total'
      );

    if (totalEl) {

      const savedTotal =
        order['السعر'];

      totalEl.textContent =
        savedTotal !== undefined &&
        savedTotal !== null &&
        savedTotal !== ''
          ? formatPrice(savedTotal)
          : 'غير متوفر';
    }


    // =========================================================
    // الخريطة
    // =========================================================

    const shippingMapEl =
      content.querySelector(
        '#shipping-map-image'
      );

    const lat =
      parseFloat(
        order['دائرة العرض']
      );

    const lng =
      parseFloat(
        order['خط الطول']
      );

    if (
      shippingMapEl &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      typeof buildStaticMapUrl === 'function'
    ) {

      const mapUrl =
        buildStaticMapUrl(
          lat,
          lng,
          700,
          350
        );

      if (mapUrl) {

        shippingMapEl.src =
          mapUrl;

        shippingMapEl.hidden =
          false;
      }
    }


    // =========================================================
    // تحميل CSS الخاص بالقالب
    // =========================================================

    parsedDoc
      .querySelectorAll(
        'link[rel="stylesheet"]'
      )
      .forEach(link => {

        const href =
          link.getAttribute('href');

        if (!href) return;

        const absoluteHref =
          new URL(
            href,
            new URL(
              'product-order-summary.html',
              window.location.href
            )
          ).href;


        const alreadyLoaded =
          [
            ...document.querySelectorAll(
              'link[rel="stylesheet"]'
            )
          ].some(
            el => el.href === absoluteHref
          );


        if (!alreadyLoaded) {

          const styleLink =
            document.createElement(
              'link'
            );

          styleLink.rel =
            'stylesheet';

          styleLink.href =
            absoluteHref;

          document.head.appendChild(
            styleLink
          );
        }

      });


    // =========================================================
    // فتح صفحة الملخص
    // =========================================================

    const htmlContent = `

<!DOCTYPE html>
<html lang="ar" dir="rtl">

<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}">
  <link
    href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap"
    rel="stylesheet"
  >
  <link
    rel="stylesheet"
    href="${baseUrl}css/product-order-summary.css"
  >
  <style>

    body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    .page {
      transform: none !important;
      margin: 0 !important;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
      .print-btn {
        display: none;
      }
    }

    .print-btn {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #91a37f;
      color: #fff;
      border: none;
      padding: 12px 32px;
      font-size: 16px;
      font-family: 'Cairo', sans-serif;
      border-radius: 8px;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <button
    class="print-btn"
    onclick="window.print()"
  >
    طباعة / حفظ كـ PDF
  </button>
  ${content.innerHTML}
</body>
</html>

`;
  const blob = new Blob(
    [htmlContent],
    {
      type: 'text/html'
    }
  );

  const blobUrl = URL.createObjectURL(blob);

  window.open(
    blobUrl,
    '_blank'
  );

  setTimeout(
    () => URL.revokeObjectURL(blobUrl),
    30000
  );
  } catch (error) {

    console.error(
      'Failed to load order summary:',
      error
    );

    showToast(
      'تعذر تحميل ملخص الطلب — حاول مرة أخرى'
    );

  } finally {

    if (loadingToastTimer) {
      clearTimeout(loadingToastTimer);
    }

    if (button) {
      button.disabled = false;
      button.classList.remove('is-loading');

      button.innerHTML = `
        عرض الملخص
      `;
    }
  }
}

window.drViewSummary = drViewSummary;

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

window.customWA = customWA;

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
    localStorage.removeItem('wodi_configurator_state');
    localStorage.removeItem('wodi-config');
    localStorage.clear();
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
      // Validate the saved state has content
      const state = JSON.parse(saved);
      if (state && state.sinkType) {
        stateRestorePending = true;
        const overlay = document.getElementById('config-loader-overlay');
        if (overlay) overlay.style.display = 'flex';
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

function genericClickForStepper(e) {
  if (e.target.closest('.card') || e.target.closest('.option') || e.target.closest('button')) {
    setTimeout(updateStepperProgress, 120);
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