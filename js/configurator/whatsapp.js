"use strict";

/*
================================================================================
WhatsApp Helpers (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js and js/configurator/pricing.js,
and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator.js : WA (WhatsApp number constant)
Global exposure remains in js/configurator.js:
  - window.customWA = customWA;
  - window.outOfRangeWA = outOfRangeWA;
================================================================================
*/

function customWA() {
  window.open(
    'https://wa.me/' + WA + '?text=' +
    encodeURIComponent(
`السلام عليكم،

أرغب في تنفيذ وحدة حوض بتصميم خاص يختلف عن التصميمات المتوفرة في الموقع.

هل يمكن مناقشة الفكرة ومعرفة إمكانية تنفيذها؟

وشكرًا لكم.`
    ),
    '_blank'
  );
}

function outOfRangeWA() {
  window.open(
    'https://wa.me/' + WA + '?text=' +
    encodeURIComponent(
`السلام عليكم،

قمت بتجربة تحديد موقعي في الموقع، وظهر أنه خارج نطاق الخدمة الحالي.

هل يمكن تنفيذ وتركيب وحدة حوض في منطقتي؟

وشكرًا لكم.`
    ),
    '_blank'
  );
}
