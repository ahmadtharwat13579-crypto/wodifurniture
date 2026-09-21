"use strict";

/*
================================================================================
State Persistence (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js, js/configurator/pricing.js,
js/configurator/whatsapp.js and js/configurator/orders.js, and BEFORE
js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator.js : dataLoaded, stateRestorePending, S, D,
                         rDes, rSz, rDiv, rHnd, upd, updateStepperProgress
Global exposure: none required. skipSavedConfiguratorState() is invoked from an
inline onclick in configurator.html and resolves the global function
declaration below (classic-script top-level declarations are global).
================================================================================
*/

function applyStateIfReady() {
  if (!dataLoaded || !stateRestorePending) return;

  try {
    const rawSaved = localStorage.getItem('wodi_configurator_state');
    if (!rawSaved) {
      stateRestorePending = false;

      rDes();
      rSz();
      rDiv();
      rHnd();
      upd();

      if (typeof updateStepperProgress === 'function') {
        updateStepperProgress();
      }

      hideConfigLoaderOverlay();
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

    if (S.sinkType) {
      document.getElementById("placeholder-sz")?.classList.add("hidden");
      document.getElementById("placeholder-dc")?.classList.add("hidden");
      document.getElementById("placeholder-div")?.classList.add("hidden");
      document.getElementById("placeholder-hc")?.classList.add("hidden");
    }

    stateRestorePending = false;
    hideConfigLoaderOverlay();
  } catch (e) {
    console.warn('Failed to apply saved state:', e);
    stateRestorePending = false;
    hideConfigLoaderOverlay();
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

function hideConfigLoaderOverlay() {
  const overlay = document.getElementById('config-loader-overlay');
  if (!overlay) return;

  if (window.configRestoreTimeout) {
    clearTimeout(window.configRestoreTimeout);
    window.configRestoreTimeout = null;
  }

  overlay.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
  overlay.style.opacity = '0';
  overlay.style.visibility = 'hidden';

  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 300);
}

function skipSavedConfiguratorState() {
  console.log('User skipped saved configurator state.');

  // Stop any pending restore
  stateRestorePending = false;

  if (window.configRestoreTimeout) {
    clearTimeout(window.configRestoreTimeout);
    window.configRestoreTimeout = null;
  }

  // Remove the saved choices
  try {
    localStorage.removeItem('wodi_configurator_state');
  } catch (e) {
    console.warn('Failed to clear saved configurator state:', e);
  }

  // Reset configurator state
  S.sinkType = null;
  S.design = null;
  S.size = null;
  S.div = null;
  S.handle = null;
  S.selectedHandleShapes = [];
  S.selectedColors = [];

  // Render the normal initial configurator
  rDes();
  rSz();
  rDiv();
  rHnd();
  upd();

  if (typeof updateStepperProgress === 'function') {
    updateStepperProgress();
  }

  // Hide loader
  hideConfigLoaderOverlay();
}
