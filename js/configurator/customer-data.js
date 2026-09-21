"use strict";

/*
================================================================================
Customer Data / Draft / Files (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/design-request.js and BEFORE
js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator.js         : showToast, S, D, DR_STORAGE_KEY,
                                 calcInstall (typeof-guarded),
                                 buildStaticMapUrl (typeof-guarded), upd
  - js/configurator/whatsapp.js: outOfRangeWA
  - js/configurator/design-request.js : loadDRDraft is called from
                                 openDesignRequestModal (reverse call)
  - CDN global                 : Cleave (phone mask)
Global exposure: none. Inline handlers in configurator.html
  (onchange="drOnGovChange()", onchange="drOnDistrictChange()") resolve
  these top-level function declarations as globals (classic scripts).
================================================================================
*/

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
      <div>تم تحديد المنطقة — التكلفة التقديرية:</div>

      <div style="font-size: 15px; font-weight: 600; margin-top: 2px;">
        ${Number(calculatedCost).toLocaleString('en-US')} EGP
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

    if (data.currentStep) {
      window.drCurrentStep = data.currentStep;
    }

    if (data.wallImage) updateCustomFileUI('dr-sink-image', data.wallImage);
    if (data.sinkPhoto) updateCustomFileUI('dr-sink-photo', data.sinkPhoto);
    if (data.stickerPhoto) updateCustomFileUI('dr-sink-sticker', data.stickerPhoto);

  } catch (e) {
    console.error('Failed to parse draft data:', e);
  }
}
