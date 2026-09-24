"use strict";

/*
================================================================================
Order Summary Viewer (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js, js/configurator/rendering.js,
js/configurator/pricing.js, js/configurator/whatsapp.js, js/configurator/orders.js,
js/configurator/state.js, js/configurator/data.js, js/configurator/stepper.js,
js/configurator/interaction.js, js/configurator/design-request.js,
js/configurator/customer-data.js and js/configurator/submission.js,
and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/pricing.js       : buildDesignConfig (via snapshot data),
                                       calc (via snapshot data)
  - js/configurator/utils.js         : sgr, dvp (via snapshot data)
  - js/configurator/whatsapp.js      : customWA, outOfRangeWA (inline
                                       handlers in generated HTML)
  - js/configurator/design-request.js: closeDesignRequestModal (inline
                                       handler), getOrderSummaryTemplate
  - js/configurator/submission.js    : drViewSummary is referenced from
                                       drShowConfirmation HTML (reverse call)
  - js/configurator.js               : S, D, showToast, buildStaticMapUrl
                                       (typeof-guarded)
  - window.* at runtime              : currentUser (js/auth.js)
Nested helpers travel inside drViewSummary (not top-level): setImage,
snapshot, designImg, divisionImg, handleImg, designTbody, divisionTbody,
handleTbody, plus local setText/formatPrice/imageUrl closures and the
content.innerHTML template with its inline handlers.
Global exposure preserved from js/configurator.js:
  - window.drViewSummary = drViewSummary;
================================================================================
*/

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
      <span class="modal-btn-spinner"></span>
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
    ).then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to load order summary: ${response.status}`);
      }

      return response.json();
    });

    const [data, html] = await Promise.all([
      orderPromise,
      getOrderSummaryTemplate()
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
      'modal-preview-document';

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

    const phoneEl =
      content.querySelector('#customer-phone');

    if (phoneEl) {
      phoneEl.textContent =
        order['التليفون'] || 'غير متوفر';

      phoneEl.setAttribute('dir', 'ltr');
      phoneEl.style.direction = 'ltr';
      phoneEl.style.unicodeBidi = 'plaintext';
      phoneEl.style.textAlign = 'right';
    }

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
  
  if (!window.wodiTooltipListenerAttached) {
    window.wodiTooltipListenerAttached = true;

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
  }


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
      if (this.dataset.fallbackTried !== 'true') {
        this.dataset.fallbackTried = 'true';
        this.src = png;
        return;
      }
      this.hidden = true;
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

  const designPriceValue =
    Number(snapshot.designPrice || 0) +
    Number(snapshot.colorPrice || 0);

  const designPrice =
    snapshot.designPrice !== ''
      ? formatPrice(designPriceValue)
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
// تفاصيل التكلفة
// =========================================================

  const designPriceValue =
    Number(snapshot.designPrice || 0);

  const colorPriceValue =
    Number(snapshot.colorPrice || 0);

  const divisionPriceValue =
    Number(snapshot.divisionPrice || 0);

  const handlePriceValue =
    Number(snapshot.handlePrice || 0);

  const installationFeeValue =
    Number(snapshot.installationFee || 0);

  const shippingCostValue =
    Number(snapshot.installationCost || 0);

  const unitTotal =
    designPriceValue +
    colorPriceValue +
    divisionPriceValue +
    handlePriceValue;

  const grandTotal =
    unitTotal +
    shippingCostValue +
    installationFeeValue;


  // تكلفة وحدة الحوض
  const sinkUnitTotalEl =
    content.querySelector('#sink-unit-total');

  if (sinkUnitTotalEl) {
    sinkUnitTotalEl.textContent =
      formatPrice(unitTotal);
  }


  // تكلفة الانتقالات
  const shippingCostEl =
    content.querySelector('#shipping-cost');

  if (shippingCostEl) {

    if (Number.isFinite(shippingCostValue)) {

      shippingCostEl.textContent =
        formatPrice(shippingCostValue) +
        (
          order['طريقة تحديد الموقع'] === 'يدوي'
            ? ' (تقريبي)'
            : ''
        );

    } else {

      shippingCostEl.textContent =
        'غير متوفر';

    }
  }


  // المعاينة والتركيب
  const inspectionCostEl =
    content.querySelector('#inspection-cost');

  if (inspectionCostEl) {
    inspectionCostEl.textContent =
      formatPrice(installationFeeValue);
  }


  // الإجمالي
  const totalEl =
    content.querySelector('#order-total');

  if (totalEl) {
    totalEl.textContent =
      formatPrice(grandTotal);
  }

  // =========================================================
  // الملاحظات
  // =========================================================

  const notesEl =
    content.querySelector('#order-notes');

  if (notesEl) {

    const isManualLocation =
      order['طريقة تحديد الموقع'] === 'يدوي';

    notesEl.innerHTML =
      isManualLocation
        ? `
          1. الأسعار الموضحة في هذا الملخص مبنية على الاختيارات والمواصفات المحددة في الطلب.<br>
          2. تكلفة الانتقالات تقديرية بناءً على المحافظة والحي المحددين يدويًا، وقد تختلف التكلفة الفعلية بعد تحديد الموقع بدقة.
        `
        : `
          1. الأسعار الموضحة في هذا الملخص مبنية على الاختيارات والمواصفات المحددة في الطلب.
        `;
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
