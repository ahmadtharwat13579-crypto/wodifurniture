"use strict";

/*
================================================================================
Submission (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js, js/configurator/rendering.js,
js/configurator/pricing.js, js/configurator/whatsapp.js, js/configurator/orders.js,
js/configurator/state.js, js/configurator/data.js, js/configurator/stepper.js,
js/configurator/interaction.js, js/configurator/design-request.js and
js/configurator/customer-data.js, and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/pricing.js       : buildDesignConfig, calc
  - js/configurator/utils.js         : sgr, dvp
  - js/configurator/whatsapp.js      : customWA (via preview HTML),
                                       outOfRangeWA (via preview HTML)
  - js/configurator/orders.js        : drOpenOrdersDrawer, drLoadUserOrders,
                                       drStopOrdersPolling
  - js/configurator/design-request.js: closeDesignRequestModal,
                                       drRenderPreview, drShowStep
  - js/configurator/customer-data.js : fileToBase64 (via saveDRDraft),
                                       updateCustomFileUI, makeSquareImage,
                                       loadDRDraft (via openDesignRequestModal)
  - js/configurator.js               : S, D, SHEET, WA, DR_STORAGE_KEY,
                                       showToast, getLocation, resetAll,
                                       drViewSummary (reverse call from
                                       confirmation HTML), initConfigurator
                                       (call-site wiring)
  - window.* at runtime              : currentUser, drCurrentOrderNum,
                                       drSavedImages, drIsManualLocation,
                                       userLat, userLng, installCost,
                                       userLocationAddress, loginWithGoogle
                                       (js/auth.js, called when login required;
                                       js/auth.js reverse-calls
                                       window.drSubmitOrder())
Global exposure preserved from js/configurator.js:
  - window.drDownloadPdf = drDownloadPdf;
  - window.drGetLocation = drGetLocation;
  - window.drSubmitOrder = drSubmitOrder;
  - window.drContactOrderWhatsApp = drContactOrderWhatsApp;
================================================================================
*/

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

async function compressBase64Image(base64, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = base64;
  });
}

async function uploadImageToCloudinary(base64Image, fileName) {
  if (!base64Image) return '';

  const compressed = await compressBase64Image(
    base64Image,
    800,
    0.7
  );

  const response = await fetch(compressed);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('upload_preset', 'wodi_orders');
  formData.append('folder', 'wodi-orders');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(
      'https://api.cloudinary.com/v1_1/fpz05btz/image/upload',
      {
        method: 'POST',
        body: formData,
        signal: controller.signal
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Cloudinary upload timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed: ${res.status} ${errorText.slice(0, 200)}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Cloudinary returned an invalid response');
  }

  if (!data.secure_url) {
    throw new Error('Cloudinary returned no secure URL');
  }

  return data.secure_url;
}

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

  let draft = {};
  try {
    draft = JSON.parse(localStorage.getItem(DR_STORAGE_KEY) || '{}');
  } catch (error) {
    console.warn('Failed to parse saved order draft:', error);
  }

  if (!currentUser) {
    throw new Error('Authenticated user is required');
  }

  const idToken = await currentUser.getIdToken(true);

  let wallImageUrl = '';
  let sinkPhotoUrl = '';
  let stickerPhotoUrl = '';

  const orderNumForImages = 
    `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  [
    wallImageUrl,
    sinkPhotoUrl,
    stickerPhotoUrl
  ] = await Promise.all([
    window.drSavedImages?.wall
      ? uploadImageToCloudinary(
          window.drSavedImages.wall,
          `${orderNumForImages}_wall`
        )
      : Promise.resolve(''),

    window.drSavedImages?.photo
      ? uploadImageToCloudinary(
          window.drSavedImages.photo,
          `${orderNumForImages}_sink`
        )
      : Promise.resolve(''),

    window.drSavedImages?.sticker
      ? uploadImageToCloudinary(
          window.drSavedImages.sticker,
          `${orderNumForImages}_sticker`
        )
      : Promise.resolve('')
  ]);

  const body = {
    submissionId,
    idToken,
    email: currentUser.email || null,
    uid: currentUser.uid || null,

    name: document.getElementById('dr-customer-name')?.value || draft.name || '',
    phone: document.getElementById('dr-customer-phone')?.value || draft.phone || '',

    brand: document.getElementById('dr-sink-brand')?.value || draft.brand || '',
    sinkWidth: document.getElementById('dr-sink-width')?.value || draft.width || '',
    sinkCode: document.getElementById('dr-sink-code')?.value || draft.code || '',
    manualAddress:
      document.getElementById('dr-manual-address')?.value ||
      draft.manualAddress ||
      '',

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
    installationCost: window.installCost ?? '',

    selectedColor: S?.selectedColors?.[0] || '',
    handleShape1: S?.selectedHandleShapes?.[0] || '',
    handleShape2: S?.selectedHandleShapes?.[1] || '',

    // صور الطلب
    wallImage: wallImageUrl,
    sinkPhoto: sinkPhotoUrl,
    stickerPhoto: stickerPhotoUrl,
  };

  try {
    console.log('submitting order, config:', JSON.stringify(config));
    const resp = await fetch('/api/submit-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const respText = await resp.clone().text();
    console.log('submit-order response:', resp.status, respText);

    const responseContentType = resp.headers.get('content-type') || '';
    const data = responseContentType.includes('application/json')
      ? await resp.json()
      : {
          success: false,
          error: (await resp.text()) || `HTTP ${resp.status}`
        };

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
  console.log('drSubmitOrder called, currentUser:', window.currentUser?.email);
  console.log('localStorage before save:', localStorage.getItem('pendingOrder'), localStorage.getItem('reopenOrderModal'));
  // التحقق من تسجيل الدخول أولاً
  if (!window.currentUser) {
    localStorage.setItem('pendingOrder', JSON.stringify({ pendingSubmit: true }));
    localStorage.setItem('reopenOrderModal', 'true');
    window.loginWithGoogle();
    return;
  }

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

  let orderNum = null;
  try {
    orderNum = await submitOrderToSheet();
  } catch (error) {
    console.warn('Order submission preparation failed:', error);
  }

  // لو فشل الإرسال: لا نقفل المودال ولا نصفر أي بيانات
  if (!orderNum) {
    console.warn('Order not saved to sheet');
    showToast('حدث خطأ أثناء إرسال الطلب — حاول مرة أخرى');

    if (button) {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.innerHTML = `
        تأكيد الطلب
      `;
    }

    return;
  }

  // وصلنا هنا فقط بعد نجاح حفظ الطلب
  window.drCurrentOrderNum = orderNum;
  localStorage.setItem('wodi_order_submitted', orderNum);

  localStorage.removeItem('pendingOrder');
  localStorage.removeItem('reopenOrderModal');
  localStorage.removeItem('wodi_pending_submission_id');

  // مسح اختيارات الكونفيجوريتور والداتا
  if (typeof resetAll === 'function') resetAll();
  localStorage.removeItem('wodi_configurator_state');
  localStorage.removeItem(DR_STORAGE_KEY);
  // Keep the configurator data cache; it is independent of the submitted order.

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

function drContactOrderWhatsApp(orderNum) {
  if (!orderNum) {
    showToast('تعذر تحديد رقم الطلب');
    return;
  }

  const phone = '201556840368';

  const message =
    `مرحبًا WODI، أريد الاستفسار عن طلبي رقم ${orderNum}.`;

  const whatsappUrl =
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

window.drContactOrderWhatsApp = drContactOrderWhatsApp;
