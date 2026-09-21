"use strict";

/*
================================================================================
Data Loading / Model (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js and js/configurator/state.js,
and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator/utils.js : base, divisionBase
  - js/configurator/state.js : applyStateIfReady
  - js/configurator.js       : configuratorRequestId, LOC (written), D (written),
                               dataLoaded (written), stateRestorePending, S, SHEET,
                               hideConfiguratorLoading, showConfiguratorLoading,
                               renderDesigns, showToast
Global exposure remains in js/configurator.js:
  - window.loadConfiguratorData = loadConfiguratorData;
================================================================================
*/

function loadConfiguratorData() {
  const requestId = ++configuratorRequestId;
  const isCurrentRequest = () => requestId === configuratorRequestId;

  // Check for cached data first
  try {
    const cached = sessionStorage.getItem('wodi_configurator_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const rows = Array.isArray(parsed) ? parsed : parsed.rows;
        const colorRows = parsed.colorRows || [];
        const cachedAt = Array.isArray(parsed) ? 0 : Number(parsed.cachedAt || 0);
        const cacheIsFresh = cachedAt && Date.now() - cachedAt < 10 * 60 * 1000;

        if (parsed.settings && parsed.settings.workshop_lat) {
          LOC = parsed.settings;
        }

        D = build(rows, colorRows);
        dataLoaded = true;
        hideConfiguratorLoading();

        if (cacheIsFresh) {
          if (stateRestorePending) {
            applyStateIfReady();
          } else if (S.sinkType) {
            renderDesigns();
          }
          return;
        }

        if (stateRestorePending) {
          applyStateIfReady();
        } else if (S.sinkType) {
          renderDesigns();
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
    // Watchdog: abort the in-flight request after TIMEOUT_MS so it can be retried.
    // `timedOut` marks aborts raised by this watchdog so the catch below reports
    // the real cause (a timeout) instead of the generic browser abort message
    // ("signal is aborted without reason").
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);
    try {
      const resp = await fetch(SHEET, { signal: controller.signal });
      clearTimeout(timer);

      if (!isCurrentRequest()) return;

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.error('SHEET fetch non-OK', resp.status, txt.slice ? txt.slice(0, 500) : txt);
        throw new Error('SHEET non-OK ' + resp.status);
      }

      const responseText = await resp.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        console.error('SHEET returned non-JSON (first 500 chars):', responseText.slice(0, 500));
        throw jsonErr;
      }

      if (!isCurrentRequest()) return;

      const rows = data && data.configurator;
      const colorRows = data && data.colors;
      const settings = data && data.locationSettings;

      if (settings && settings.workshop_lat) {
        LOC = settings;
      }

      if (rows && rows.length > 0) {
        D = build(rows, colorRows);
        dataLoaded = true;
        hideConfiguratorLoading();
        try { 
          sessionStorage.setItem(
  'wodi_configurator_cache',
  JSON.stringify({
    rows,
    colorRows,
    settings,
    cachedAt: Date.now()
  })
); 
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

      if (!isCurrentRequest()) return;

      if (timedOut) {
        console.warn('loadConfiguratorData attempt timed out after ' + TIMEOUT_MS + 'ms (retrying)', retry, err && err.name ? err.name : err);
      } else {
        console.warn('loadConfiguratorData attempt failed', retry, err && err.message ? err.message : err);
      }

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