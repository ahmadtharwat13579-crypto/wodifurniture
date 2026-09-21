"use strict";

/*
================================================================================
Interaction / Scroll / Sticky / Lightbox (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js, js/configurator/rendering.js,
js/configurator/pricing.js and js/configurator/stepper.js, and BEFORE
js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/rendering.js : updateArrows, rDes, rSz, rDiv, rHnd,
                                   showConfiguratorLoading (all called at
                                   event time); openLB is defined here and
                                   called at click time from rendering.js,
                                   showToast, pulsePrice via main
  - js/configurator/pricing.js   : calc
  - js/configurator/stepper.js   : genericClickForStepper (called from
                                   initConfigurator in js/configurator.js)
  - js/configurator/state.js     : hidePlaceholders
  - js/configurator/data.js      : loadConfiguratorData
  - js/configurator/design-request.js : openDesignRequestModal (sticky button),
  - js/configurator.js           : S, dataLoaded, upd, resetAll,
                                   initConfigurator (call sites),
                                   stateRestorePending,
                                   updateStepperProgress (typeof-guarded)
Global exposure remains in js/configurator.js:
  - window.openLB = openLB;
  - window.closeLB = closeLB;
  - window.updateStickyValue = updateStickyValue; (assigned inside
    setupStickyPriceBar, unchanged)
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
      stickyBtn.onclick = () => openDesignRequestModal();
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

    // Set initial sticky state immediately — don't wait for first scroll event
    if (window.scrollY > 20) {
      stepperEl.classList.add('is-sticky');
    } else {
      stepperEl.classList.remove('is-sticky');
    }
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
