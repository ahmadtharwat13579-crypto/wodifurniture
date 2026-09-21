/*
================================================================================
Utility Helpers (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded BEFORE js/configurator.js.
================================================================================
*/

const r5 = n => Math.round(n / 5) * 5;

const base = id => (id && typeof id.toString === 'function') ? id.toString().replace(/_\d+[\-\.]?\d*cm$/i, '') : '';

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