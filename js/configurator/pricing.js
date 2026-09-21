"use strict";

/*
================================================================================
Pricing & Calculations (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/utils.js : r5, sgr, dvp
  - js/configurator.js       : S, D, installCost, isNoHandle()
Global exposure remains in js/configurator.js:
  - window.calc = calc;
  - window.buildDesignConfig = buildDesignConfig;
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

  const unitPrice = r5(
    S.size.price +
    colorExtra +
    dvp(S.div, sg) +
    (noH ? 0 : S.handle.price * S.design.hc)
  );

  if (installCost === null) return unitPrice;

  return unitPrice + installCost;
}

function buildDesignConfig() {
  if (!S.design || !S.size || !S.div || !S.sinkType) return null;
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
  const unitPrice = r5(
    S.size.price +
    colorExtra +
    dvp(S.div, sg) +
    (noH ? 0 : S.handle.price * S.design.hc)
  );

  return {
    sinkType: S.sinkType,
    design: S.design,
    size: S.size,
    division: S.div,
    handle: S.handle,
    unitPrice,
    installationFee: 200,
    installationCost: window.installCost ?? null
  };
}
