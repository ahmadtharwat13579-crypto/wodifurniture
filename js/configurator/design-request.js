"use strict";

/*
================================================================================
Design Request Wizard / Preview (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js, js/configurator/rendering.js,
js/configurator/pricing.js, js/configurator/whatsapp.js, js/configurator/orders.js,
js/configurator/state.js, js/configurator/data.js, js/configurator/stepper.js
and js/configurator/interaction.js, and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/pricing.js : calc, buildDesignConfig
  - js/configurator/utils.js   : sgr, dvp
  - js/configurator/whatsapp.js: customWA, outOfRangeWA
  - js/configurator/orders.js  : drOpenOrdersDrawer (called from
                                 drSubmitOrder flow in js/configurator.js)
  - js/configurator.js         : S, D, DR_STORAGE_KEY, showToast,
                                 loadDRDraft, drGetLocation, getLocation,
                                 drViewSummary (reverse call), upd, resetAll
Global exposure preserved from js/configurator.js:
  - window.openDesignRequestModal = openDesignRequestModal;
  - window.closeDesignRequestModal = closeDesignRequestModal;
  - window.drShowStep = drShowStep;
  - window.drNextStep = drNextStep;
  - window.drPrevStep = drPrevStep;
  - window.drRenderPreview = drRenderPreview;
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
        : document.getElementById('unit-color-section');
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

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  if (typeof window.updatePageScrollLock === 'function') window.updatePageScrollLock();

  const noHandle = isNoHandle();
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

  const unitPrice = r5(
    S.size.price +
    colorExtra +
    dvp(S.div, sg) +
    (noHandle ? 0 : S.handle.price * S.design.hc)
  );

  window.drDesignConfig = {
    sinkType: S.sinkType,
    design: S.design,
    size: S.size,
    division: S.div,
    handle: S.handle,

    unitPrice,
    installationFee: 200,
    installationCost: window.installCost
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
  if (typeof window.updatePageScrollLock === 'function') window.updatePageScrollLock();
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

function getOrderSummaryTemplate() {
  if (!window.drOrderSummaryTemplatePromise) {
    window.drOrderSummaryTemplatePromise = fetch(
      'product-order-summary.html',
      { cache: 'no-store' }
    ).then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load invoice template: ${response.status}`);
      }

      return response.text();
    }).catch(error => {
      window.drOrderSummaryTemplatePromise = null;
      throw error;
    });
  }

  return window.drOrderSummaryTemplatePromise;
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
  let html;
  try {
    html = await getOrderSummaryTemplate();
  } catch (error) {
    console.error('Failed to load product-order-summary.html:', error);
    return;
  }
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
          1. الأسعار الموضحة في هذا الملخص مبنية على الاختيارات والمواصفات المحددة في الطلب.<br>
          2. تكلفة الانتقالات تقديرية بناءً على المحافظة والحي المحددين يدويًا، وقد تختلف التكلفة الفعلية بعد تحديد الموقع بدقة.
        `
        : `
          1. الأسعار الموضحة في هذا الملخص مبنية على الاختيارات والمواصفات المحددة في الطلب.
        `;
    }

    const designTbody = content.querySelector('#sink-design-items');
    if (designTbody) {
      const selectedColorId = S.selectedColors && S.selectedColors[0] ? S.selectedColors[0] : null;
      let colorExtra = 0;

      if (selectedColorId) {
        let familyKey = 'solid';

        if (selectedColorId.startsWith('clr_wd_')) {
          familyKey = 'wood';
        } else if (selectedColorId.startsWith('clr_gls_')) {
          familyKey = 'gloss';
        }

        const colorFamilyObj = (D.colors || []).find(c => c.family === familyKey);

        if (colorFamilyObj) {
          colorExtra = colorFamilyObj.price || 0;
        } else {
          if (familyKey === 'wood') colorExtra = 800;
          else if (familyKey === 'gloss') colorExtra = 1100;
        }
      }
      const colorImgHtml = selectedColorId
        ? `<img src="images/conf/clr/${encodeURIComponent(selectedColorId)}.webp" style="height:36px; object-fit:contain;" onerror="this.src='images/conf/clr/${encodeURIComponent(selectedColorId)}.png'" />`
        : '—';

      designTbody.innerHTML = `
        <tr class="item-row">
          <td class="col-section">التصميم</td>
          <td class="col-name">${config.design.name}</td>
          <td class="col-code">${config.design.id}</td>
          <td class="col-color">${colorImgHtml}</td>
          <td class="col-price">${(Number(config.size.price) + colorExtra).toLocaleString('en-US')} ج.م</td>
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

    const unitTotalEl = content.querySelector('#sink-unit-total');

    const noHandle = isNoHandle();
    const previewSizeGroup = sgr(config.size.size);

    let colorExtra = 0;

    const selectedColorId =
      S.selectedColors && S.selectedColors[0]
        ? S.selectedColors[0]
        : '';

    if (selectedColorId) {
      let familyKey = 'solid';

      if (selectedColorId.startsWith('clr_wd_')) {
        familyKey = 'wood';
      } else if (selectedColorId.startsWith('clr_gls_')) {
        familyKey = 'gloss';
      }

      const colorFamilyObj = (D.colors || [])
        .find(c => c.family === familyKey);

      if (colorFamilyObj) {
        colorExtra = colorFamilyObj.price || 0;
      } else {
        if (familyKey === 'wood') colorExtra = 800;
        else if (familyKey === 'gloss') colorExtra = 1100;
      }
    }

    const previewUnitPrice = r5(
      config.size.price +
      colorExtra +
      dvp(config.division, previewSizeGroup) +
      (
        noHandle
          ? 0
          : config.handle.price * config.design.hc
      )
    );

    if (unitTotalEl) {
      unitTotalEl.textContent =
        `${previewUnitPrice.toLocaleString('en-US')} ج.م`;
    }

    const inspectionCostEl = content.querySelector('#inspection-cost');

    if (inspectionCostEl) {
      inspectionCostEl.textContent = '200 ج.م';
    }

    const totalEl = content.querySelector('#order-total');

    if (totalEl) {
      const shipping =
        shippingCost !== null &&
        shippingCost !== undefined &&
        shippingCost !== ''
          ? Number(shippingCost)
          : 0;

      const total =
        previewUnitPrice +
        shipping +
        200;

      totalEl.textContent =
        `${total.toLocaleString('en-US')} ج.م`;
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
