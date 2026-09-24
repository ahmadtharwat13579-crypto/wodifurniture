"use strict";

/*
================================================================================
Rendering (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/utils.js  : base, divisionBase, r5, sgr, dvp
  - js/configurator/stepper.js : updateStepperProgress (typeof-guarded)
  - js/configurator.js        : GH, S, D, dataLoaded, unavailableDesigns,
                               showToast, openLB, upd
Global exposure: none required. Call sites in js/configurator.js and
js/configurator/*.js resolve these top-level function declarations as
globals (classic scripts).
================================================================================
*/

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

function mkImg(id, cardEl, imagePath = null, fallbackPath = null) {
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
  const webpSrc = imagePath || GH + encoded + '.webp';
  const pngSrc = fallbackPath || GH + encoded + '.png';

  img.src = webpSrc;
  let fallbackTried = false;
  img.onerror = function () {
    if (!fallbackTried) {
      fallbackTried = true;
      this.src = pngSrc;
      return;
    }
    this.style.display = 'none';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'placeholder');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
    w.appendChild(svg);
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

      const cleanColorId = String(colorId).replace(/\.(png|webp|jpg|jpeg)$/i, '');
      const encodedColorId = encodeURIComponent(cleanColorId);
      const imgContainer = mkImg(
        colorId,
        colorCard,
        GH + `clr/${encodedColorId}.webp`,
        GH + `clr/${encodedColorId}.png`
      );
      imgContainer.querySelectorAll('.card-overlay').forEach(el => el.remove());

      if (!S.size) {
        imgContainer.appendChild(mkLockOverlay());
      }

      const img = imgContainer.querySelector('img');
      if (img) {
        img.onerror = function () {
          if (this.dataset.fallbackTried === 'true') {
            colorCard.remove();
            if (typeof checkGroupVisibility === 'function') checkGroupVisibility();
            return;
          }
          this.dataset.fallbackTried = 'true';
          this.src = GH + `clr/${encodeURIComponent(cleanColorId)}.png`;
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

      const cleanId = String(d.id).replace(/\.(png|webp|jpg|jpeg)$/i, '');
      const encodedId = encodeURIComponent(cleanId);
      const imgContainer = mkImg(
        d.id,
        el,
        GH + `${encodedId}.webp`,
        GH + `${encodedId}.png`
      );
      const img = imgContainer.querySelector('img');
      if (img) {
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

    rHnd();
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

      const encodedShapeId = encodeURIComponent(shapeId);
      const imgContainer = mkImg(
        shapeId,
        shapeCard,
        GH + `hnd/${encodedShapeId}.webp`,
        GH + `hnd/${encodedShapeId}.png`
      );
      const img = imgContainer.querySelector('img');

      if (img) {
        img.onerror = function () {
          if (this.dataset.fallbackTried === 'true') {
            shapeCard.remove();
            setTimeout(() => updateArrows('handle-shapes-row'), 50);
            return;
          }
          this.dataset.fallbackTried = 'true';
          this.src = GH + `hnd/${encodedShapeId}.png`;
        };
      }

      shapeCard.appendChild(imgContainer);

      const zoomBtn = imgContainer.querySelector('.czoom, .zoom-btn, [data-action="zoom"]');
      if (zoomBtn) {
        zoomBtn.onclick = (e) => {
          e.stopPropagation();
          openLB(
            `images/conf/hnd/${encodeURIComponent(shapeId)}.webp`,
            'Handle Shape',
            `images/conf/hnd/${encodeURIComponent(shapeId)}.png`
          );
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

  setTimeout(() => updateArrows('hc'), 50);
}
