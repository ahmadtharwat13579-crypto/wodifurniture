const WA='201556840368';
const LOCATION_SHEET='https://script.google.com/macros/s/AKfycbz1Dj9QB3rlz_sZoLwC-kdfZiMUBsHheGT62dIgajmzqffFm7Z_XiQ9sH558XW9sgDZ/exec?pwd=double-protection-password';
let LOC={workshop_lat:30.061113,workshop_lng:31.394701,correction_factor:0,price_per_km:0,fixed_cost:0};
let userLat=null,userLng=null,installCost=null;
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/website/images/';
const SHEET='https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password';

const r5=n=>Math.round(n/5)*5;
const toAr=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',').replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]).replace(',','،');
const cur='ج.م.';
const base = id => (id && typeof id.toString === 'function') ? id.toString().replace(/_\d+[\-\.]?\d*cm$/i, '') : '';

function toggleNotes(){
  document.getElementById('notes-box').classList.toggle('open');
}

function scrollCards(id,dir){
  const el=document.getElementById(id);
  el.scrollLeft += dir * -160;
  setTimeout(()=>updateArrows(id),300);
}

function updateArrows(id){
  const el=document.getElementById(id);
  if(!el)return;
  const startBtn=document.getElementById(id+'-start');
  const endBtn=document.getElementById(id+'-end');
  if(!startBtn||!endBtn)return;
  const max=el.scrollWidth-el.clientWidth;
  if(max<=4){startBtn.classList.add('hidden');endBtn.classList.add('hidden');return;}
  const sl=el.scrollLeft;
  const atStart=(sl>=0&&sl<=4)||(sl<0&&Math.abs(sl)<=4);
  const atEnd=(sl>=0&&sl>=max-4)||(sl<0&&Math.abs(sl)>=max-4);
  startBtn.classList.toggle('hidden',atStart);
  endBtn.classList.toggle('hidden',atEnd);
}

function parseCSV(t){
  const ls=t.trim().split('\n');
  const hs=ls[0].split(',').map(h=>h.trim().replace(/^\uFEFF/,'').replace(/^"|"$/g,''));
  return ls.slice(1).map(l=>{const v=l.split(',').map(x=>x.trim().replace(/^"|"$/g,''));const o={};hs.forEach((h,i)=>o[h]=v[i]||'');return o;});
}

function showAllSkeletons() {
  // إنشاء كارتين أو ثلاثة كـ Skeleton لكل صف بداخل الـ HTML النظيف
  const skeletonCardHtml = `
    <div class="prod-skeleton" role="status">
      <div class="skel-img"></div>
      <div class="skel-info">
        <div class="skel-line w-80"></div>
        <div class="skel-line w-40"></div>
      </div>
    </div>
  `.repeat(2); // تكرار كارتين وهميين في كل صف

  ['dc-wall', 'dc-floor', 'vc-wall', 'vc-floor', 'hc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skeletonCardHtml;
  });
}

// returns group id like '4b_wh_cic01' from '4b_wh_cic01_45cm' or leaves '4b_fp_cic00' as-is
function divisionBase(id){
  if(!id) return id;
  const s = String(id);

  // 1) لو النهاية هي مقياس مثل _45cm أو _100cm -> احذفها
  const sizeSuffix = /_\d+[\-\.]?\d*cm$/i;
  if(sizeSuffix.test(s)) return s.replace(sizeSuffix, '');

  // 2) خلاف ذلك: إذا كان المعرف يحتوي على 3 أجزاء أو أكثر، نعيد أول 3 أجزاء
  const parts = s.split('_');
  if(parts.length >= 3) return parts.slice(0,3).join('_');

  // 3) خلاف ذلك اعد القيمة كما هي
  return s;
}


function build(rows){
  const des={},divs=[],hnd=[];
  rows.forEach(r=>{
    const id=r.product_name,cat=r.product_category,p=parseFloat(r.price)||0,nm=r.display_name,sz=r.size;
    if(cat==='sink_cabinets'){
      const b=base(id);
      if(!des[b]) {
        // تحديد النوع: fp للرجل الكاملة، أي شيء آخر يعتبر معلق
        let type;

        if (id.includes('_fp_')) {
            type = 'floor-standing';
        }
        else if (id.includes('_wh_')) {
            type = 'wall-hung';
        }
        else if (id.includes('_di_')) {
            type = 'drop-in';
        }
        else if (id.includes('_bw_')) {
            type = 'bowl';
        }
        else {
            type = 'wall-hung';
        }
        des[b]={id:b, name:nm, hc:parseInt(r.handle_count)||0, sizes:[], type:type};
      }
      else if(nm) des[b].name=nm;
      des[b].sizes.push({id,size:sz,price:p});
      } else if (cat === 'cabinet_inside_config') {
        // use grouping that keeps the _wh_/_fp_ part but removes size suffix
        const b = divisionBase(id); // e.g. '4b_wh_cic01' or '4b_fp_cic01'
        // determine type from the original id (which قد يحتوي على _fp_ أو _wh_)
        const type = id.includes('_fp_')
        ? 'floor-standing'
        : 'wall-hung';

        let g = divs.find(d => d.id === b);
        if (!g) {
          g = {
            id: b,
            name: nm || b,
            type: type,
            sizes: []
          };
          divs.push(g);
        } else if (nm) {
          g.name = nm;
        }

        // push the full row as a size entry (so we still have the exact id for matching/prices)
        g.sizes.push({
          id: id,
          size: sz || 'any',
          price: p
        });

      }
      else if(cat==='handles_&_knobs'){
      hnd.push({id,name:nm,price:p});
    }
  });
  return{designs:Object.values(des),divisions:divs,handles:hnd};
}

function sgr(s){
  if(!s||s==='any')return'any';
  const n=s.replace(/\s/g,'');
  if(/40|45|50/.test(n))return'45';
  if(/55|65/.test(n))return'65';
  if(/70|80|85/.test(n))return'85';
  if(/90|100|105/.test(n))return'100';
  return'85';
}

function dvp(div,sg){
  if(!div.sizes.length)return 0;
  if(div.sizes[0].size==='any')return div.sizes[0].price;
  const m={'45':'45cm','65':'65cm','85':'85cm','100':'85cm'};
  const sfx=m[sg]||'85cm';
  const f=div.sizes.find(s=>s.id.endsWith(sfx));
  return f?f.price:div.sizes[div.sizes.length-1].price;
}

let D={designs:[],divisions:[],handles:[]};

let S={
  sinkType:null,
  design:null,
  size:null,
  div:null,
  handle:null
};

let dt=null;
let dataLoaded=false;

// Placeholder data — cards show immediately, prices show — until data loads
const PLACEHOLDER={
  designs:[
    {id:'4a_wh_sc01',name:'تخزين مفتوح',hc:0,sizes:[{id:'4a_wh_sc01_45cm',size:'40–50 cm',price:null},{id:'4a_wh_sc01_60cm',size:'55–65 cm',price:null}]},
    {id:'4a_wh_sc02',name:'ضلفة واحدة',hc:1,sizes:[{id:'4a_wh_sc02_45cm',size:'40–50 cm',price:null}]},
    {id:'4a_wh_sc03',name:'ضلفتين',hc:2,sizes:[{id:'4a_wh_sc03_60cm',size:'55–65 cm',price:null},{id:'4a_wh_sc03_80cm',size:'70–85 cm',price:null}]},
    {id:'4a_wh_sc04',name:'ضلفتين مع رف مفتوح',hc:2,sizes:[{id:'4a_wh_sc04_60cm',size:'55–65 cm',price:null},{id:'4a_wh_sc04_80cm',size:'70–85 cm',price:null}]},
    {id:'4a_wh_sc05',name:'ضلفتين مع رف جانبي مفتوح',hc:2,sizes:[{id:'4a_wh_sc05_80cm',size:'70–85 cm',price:null},{id:'4a_wh_sc05_100cm',size:'90–105 cm',price:null}]}
  ],
  divisions:[
    {id:'4b_cic00',name:'بدون تقسيمة',sizes:[{id:'4b_cic00',size:'any',price:0}]},
    {id:'4b_cic01',name:'رف كامل',sizes:[{id:'4b_cic01_45cm',size:'40–50 cm',price:null},{id:'4b_cic01_65cm',size:'55–65 cm',price:null},{id:'4b_cic01_85cm',size:'70–85 cm',price:null}]},
    {id:'4b_cic02',name:'رف خلفي صغير',sizes:[{id:'4b_cic02_45cm',size:'40–50 cm',price:null},{id:'4b_cic02_65cm',size:'55–65 cm',price:null},{id:'4b_cic02_85cm',size:'70–85 cm',price:null}]},
    {id:'4b_cic03',name:'تقسيم جانبي مزدوج',sizes:[{id:'4b_cic03_45cm',size:'40–50 cm',price:null},{id:'4b_cic03_65cm',size:'55–65 cm',price:null},{id:'4b_cic03_85cm',size:'70–85 cm',price:null}]},
    {id:'4b_cic04',name:'تقسيمات خلفية متعددة',sizes:[{id:'4b_cic04_45cm',size:'40–50 cm',price:null},{id:'4b_cic04_65cm',size:'55–65 cm',price:null},{id:'4b_cic04_85cm',size:'70–85 cm',price:null}]}
  ],
  handles:[
    {id:'4c_h&k01',name:'مقبض سحابي',price:null},
    {id:'4c_h&k02',name:'مقبض دائري',price:null},
    {id:'4c_h&k03',name:'بدون مقبض',price:null}
  ]
};

D=PLACEHOLDER;

function mkImg(id, cardEl){
  const w = document.createElement('div'); w.className = 'cimg';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';

  // determine which base id to use for image files
  let imgBaseId = id;
  if (id && typeof id === 'string' && id.includes('_cic')) {
    // if id is a size-id like '4b_wh_cic01_45cm' -> use its group '4b_wh_cic01'
    imgBaseId = divisionBase(id); // returns '4b_wh_cic01'
  } else {
    // for products/handles keep original base() behavior (strip trailing '45cm' only)
    imgBaseId = base(id);
  }

  const encoded = encodeURIComponent(imgBaseId);
  img.src = GH + encoded + '.webp';
  img.onerror = function(){
    if(this.src.endsWith('.webp')){
      this.src = GH + encoded + '.png';
    }else{
      this.style.display = 'none';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','placeholder');
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('fill','none');
      svg.setAttribute('stroke','currentColor');
      svg.setAttribute('stroke-width','1.5');
      svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
      w.appendChild(svg);
    }
  };
  w.appendChild(img);

  // zoom button unchanged...
  const zoomBtn = document.createElement('div');
  zoomBtn.className = 'zoom-btn';
  zoomBtn.innerHTML = '...'; // (احتفظ بما لديك)
  zoomBtn.onclick = function(e){
    e.stopPropagation();
    openLB(img.src);
  };
  w.appendChild(zoomBtn);

  return w;
}

function rDes() {

  const box = document.getElementById("dc");
  const title = document.getElementById("design-group-title");

  if (!box) return;

  box.innerHTML = "";

      const desc = document.getElementById("design-desc");

    if(desc){

        if(!S.sinkType){

            desc.innerHTML = "اختر نوع الحوض أولاً.";

        }
        else if(!S.size){

            desc.innerHTML = 'اختر <strong>مقاس الحوض</strong> لإختيار التصميم.';

        }
        else{

            const count = D.designs.filter(d =>
                d.type === S.sinkType &&
                d.sizes.some(s => s.size === S.size.size)
            ).length;

            desc.innerHTML = `تم العثور على <strong>${count}</strong> تصميمات مناسبة.`;

        }

    }

  if (!S.sinkType) {
    title.textContent = "اختر نوع الحوض أولاً";
    updateArrows("dc");
    return;
  }

  const titleMap = {
    "wall-hung": "تصميمات الحوض المعلق",
    "drop-in": "تصميمات الحوض السقط رخام",
    "bowl": "تصميمات الحوض فوق سطح أفقي",
    "floor-standing": "تصميمات الحوض برجل كاملة"
  };

  title.textContent = titleMap[S.sinkType];

  D.designs
    .filter(d => d.type === S.sinkType)
    .forEach(d => {
      box.appendChild(createDesignCard(d));
    });

  updateArrows("dc");
}

// دالة مساعدة لإنشاء كارت التصميم
function createDesignCard(d) {

  const validPrices = d.sizes
    .map(s => s.price)
    .filter(p => p !== null);

  const minP = validPrices.length ? Math.min(...validPrices) : null;

  const el = document.createElement("div");

  const isAvailable =
    !S.size ||
    d.sizes.some(s => s.size === S.size.size);

  el.className =
    "design-card" +
    (S.design && S.design.id === d.id ? " selected" : "") +
    (S.size && !isAvailable ? " disabled" : "");

  el.appendChild(mkImg(d.id, el));

  if (!S.size) {
  const overlay = document.createElement("div");
  overlay.className = "card-overlay";

  overlay.innerHTML = `
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="2">
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V8a4 4 0 118 0v3"/>
  </svg>
  `;

  el.querySelector(".cimg").appendChild(overlay);
}

  // ========= المقاسات =========

  const availableSizes = d.sizes.map(s => s.size);

  let sizeText = "";

  if (availableSizes.length) {

    const first = availableSizes[0];
    const last = availableSizes[availableSizes.length - 1];

    const firstMin = first.split("-")[0].trim();

    const lastMax = last
      .split("-")[1]
      .replace("cm","")
      .replace("سم","")
      .trim();

    sizeText = `${firstMin}–${lastMax} سم`;
  }

  // ============================

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

    // ممنوع اختيار التصميم قبل اختيار المقاس
    if (!S.size) return;

    // أو لو التصميم غير متاح للمقاس المختار
    if (!isAvailable) return;

    if (!S.design || S.design.id !== d.id) {
      S.div = null;
      S.handle = null;
    }

    S.design = d;

    rDes();
    rDiv();
    rHnd();
    upd();

  };

  return el;
}

function rSz() {

  const c = document.getElementById("sb");
  c.innerHTML = "";

  if (!S.sinkType) {
    S.size = null;

    c.innerHTML = `
      <button class="size-btn disabled" disabled>
        — اختر نوع الحوض أولاً —
      </button>
    `;
    return;
  }

  // جمع المقاسات بدون تكرار
  const sizesMap = new Map();

  D.designs
    .filter(d => d.type === S.sinkType)
    .forEach(d => {
      d.sizes.forEach(s => {
        if (!sizesMap.has(s.size)) {
          sizesMap.set(s.size, s);
        }
      });
    });

  const sizes = [...sizesMap.values()];

  sizes.forEach(s => {

    const b = document.createElement("button");

    b.className =
      "size-btn" +
      (S.size && S.size.size === s.size ? " selected" : "");

    b.textContent = s.size;

    b.onclick = () => {

      S.size = s;

      // تغيير المقاس يلغي الاختيارات التالية
      S.design = null;
      S.div = null;
      S.handle = null;

      rSz();
      rDes();
      rDiv();
      rHnd();
      upd();

    };

    c.appendChild(b);

  });

}

function rDiv() {

  const wall = document.getElementById('vc-wall');
  const floor = document.getElementById('vc-floor');
  const title = document.getElementById("division-group-title");

  if (!wall || !floor) return;

  wall.innerHTML = '';
  floor.innerHTML = '';

    if (!S.sinkType) {
      title.textContent = "اختر نوع الحوض أولاً";
      updateArrows('vc-wall');
      updateArrows('vc-floor');
      return;
    }

    const titleMap = {
      "wall-hung": "التقسيمة الداخلية للحوض المعلق",
      "drop-in": "التقسيمة الداخلية للحوض السقط رخام",
      "bowl": "التقسيمة الداخلية للحوض فوق سطح أفقي",
      "floor-standing": "التقسيمة الداخلية للحوض برجل كاملة"
    };

    title.textContent = titleMap[S.sinkType];

  // تحديد القسم الذي سيظهر
  const divisionType =
    (S.sinkType === 'floor-standing')
      ? 'floor-standing'
      : 'wall-hung';

  D.divisions
    .filter(d => d.type === divisionType)
    .forEach(d => {

      const el = document.createElement('div');

      el.className =
        'div-card' +
        (S.div && S.div.id === d.id ? ' selected' : '');

      el.appendChild(mkImg(d.id, el));

      const info = document.createElement('div');
      info.className = 'cinfo';

      const sg = S.size ? sgr(S.size.size) : null;
      const divP = sg ? dvp(d, sg) : null;

      info.innerHTML =
        '<div class="cname">' + d.name + '</div>' +
        '<div class="cprice">' +
        ((divP !== null && divP !== undefined) ? ('+' + divP + ' EGP') : '—') +
        '</div>';

      el.appendChild(info);

      el.onclick = () => {
        S.div = d;
        rDiv();
        upd();
      };

      if (divisionType === 'wall-hung') {
        wall.appendChild(el);
      } else {
        floor.appendChild(el);
      }

    });

  updateArrows('vc-wall');
  updateArrows('vc-floor');

}

function rHnd(){
  const c=document.getElementById('hc');c.innerHTML='';
  const noH=S.design&&S.design.hc===0;
  if(noH)S.handle=null;
  D.handles.forEach(h=>{
    const el=document.createElement('div');
    el.className='handle-card'+(noH?' dis':'')+(S.handle&&S.handle.id===h.id?' selected':'');
    el.appendChild(mkImg(h.id,el));
    const info=document.createElement('div');info.className='cinfo';
    const pricePerDoor=(!dataLoaded||h.price===null)?'—':(S.design?h.price:'—');
    const displayPrice=dataLoaded&&h.price!==null?'+ '+pricePerDoor+' EGP / ضلفة':'—';
    info.innerHTML='<div class="cname">'+h.name+'</div><div class="cprice'+(dataLoaded?'':' loading')+'">'+(dataLoaded?displayPrice:'—')+'</div>';
    el.appendChild(info);
    if(!noH)el.onclick=()=>{S.handle=h;rHnd();upd();};
    c.appendChild(el);
  });
  setTimeout(()=>updateArrows('hc'),50);
}

function haversine(lat1,lng1,lat2,lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function calcInstall(lat, lng) {
  const dist = haversine(LOC.workshop_lat, LOC.workshop_lng, lat, lng);
  const maxDist = (LOC.max_distance_km !== undefined && LOC.max_distance_km !== null) 
                ? parseFloat(LOC.max_distance_km) 
                : 25;

  // التحقق من المسافة
  if (dist > maxDist) {
    return null; // نعيد null فقط، والتحكم في عرض الرسالة يكون في دالة requestLocation
  }

  // الحساب إذا كان داخل النطاق
  const adjusted = dist * LOC.correction_factor;
  // أصلحت الحساب هنا بإزالة الـ 4 التي كانت مضافة بدون داعٍ
  return r5(4*adjusted * LOC.price_per_km + LOC.fixed_cost);
}

function calc(){
  if(!S.design||!S.size||!S.div)return null;
  const noH=S.design.hc===0;
  if(!noH&&!S.handle)return null;
  
  const sg=sgr(S.size.size);
  const installationFee = 200; // البند الثابت للمعاينة والتركيب
  const unitPrice = r5(S.size.price + dvp(S.div, sg) + (noH ? 0 : S.handle.price * S.design.hc));
  
  // إذا كان العميل لم يحدد موقعه بعد، نعيد سعر الوحدة + التركيب الثابت فقط
  if(installCost === null) return unitPrice + installationFee;
  
  // إذا حدد موقعه، نضيف سعر التوصيل أيضاً
  return unitPrice + installationFee + installCost;
}

function upd() {
  clearTimeout(dt);
  dt = setTimeout(() => {
    const t = calc();
    const noH = S.design && S.design.hc === 0;
    const sg = S.size ? sgr(S.size.size) : '85';

    // 1. تحديث السعر الإجمالي
    const totalEl = document.getElementById('total-price');
const canShowPrice = S.design && S.size;

totalEl.textContent =
  canShowPrice && t !== null
    ? t + ' EGP'
    : '— EGP';

    pulsePrice(totalEl);

    // 2. تحديث التحذيرات (إن وجدت)
    const warn = document.getElementById('price-warning');
    if (warn) {
      const needsWarn = S.design && !S.size;
      warn.classList.toggle('show', needsWarn);
    }

    const allSelected = S.design && S.size && S.div && (S.design.hc === 0 || S.handle);
    const instWarn = document.getElementById('install-warning');
    if (instWarn) instWarn.classList.toggle('show', allSelected && installCost === null);

    // 3. تحديث بيانات التوصيل
    const siLabel = document.getElementById('si-label');
    const siPrice = document.getElementById('si-price');
    if (siLabel) siLabel.textContent = installCost !== null ? 'محسوبة' : '—';
    if (siPrice) siPrice.textContent = installCost !== null ? installCost + ' EGP' : '—';

  // تحديث النوع
const sdTypeEl = document.getElementById('sd-type');
if (sdTypeEl) {
  if (S.design) {
    sdTypeEl.textContent =
      S.design.type === 'floor-standing'
        ? 'حوض رجل كاملة'
        : 'حوض معلق / سقط رخام';
  } else {
    sdTypeEl.textContent = '—';
  }
  updateStepperProgress()
  if (typeof updateStickyValue === 'function') updateStickyValue();
}


// تحديث اسم التصميم
const sdEl = document.getElementById('sd');
if (sdEl) {
  sdEl.textContent = S.design ? S.design.name : '—';
}

    document.getElementById('sd-price').textContent = S.size ? r5(S.size.price) + ' EGP' : '—';
    document.getElementById('ss').textContent = S.size ? S.size.size : '—';
    document.getElementById('ss-price').textContent = '';

    document.getElementById('sv').textContent = S.div ? S.div.name : '—';
    const divPrice = S.div ? dvp(S.div, sg) : 0;
    document.getElementById('sv-price').textContent = S.div ? (divPrice > 0 ? '+' + divPrice + ' EGP' : '+0 EGP') : '—';

    document.getElementById('sh').textContent = S.handle ? S.handle.name : (noH ? 'بدون مقبض' : '—');
    const handlePrice = S.handle && !noH ? S.handle.price * S.design.hc : 0;
    document.getElementById('sh-price').textContent = S.handle ? (handlePrice > 0 ? '+' + handlePrice + ' EGP' : '+0 EGP') : (noH ? '—' : '—');

  }, 300);
}

// دالة جلب العنوان (Reverse Geocoding)
async function getAddress(lat, lon, resElement) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    console.table(data.configurator);
    if (data.address) {
      const a = data.address;
      // ناخد الحي والمدينة فقط
      const neighbourhood = a.neighbourhood || a.suburb || a.quarter || '';
      const city = a.city || a.town || a.state_district || a.state || a.county || '';
      const parts = [neighbourhood, city].filter(Boolean);
      const address = parts.join('، ');
      if (address) {
        resElement.innerHTML += `<br><small>الموقع: ${address}</small>`;
      }
    }
    window.lastAddress = shortLabel || display || (`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  } catch (e) {
    console.error("تعذر جلب العنوان", e);
  }
}

function requestLocation() {
  const btn = document.getElementById('btn-locate');
  const res = document.getElementById('loc-result');
  const mapContainer = document.getElementById('mapContainer');
  const mapIframe = document.getElementById('staticMap');

  // 1. حالة البدء
  btn.disabled = true;
  btn.innerHTML = '<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> جارٍ تحديد موقعك...';

  if (!navigator.geolocation) {
    res.textContent = 'متصفحك لا يدعم تحديد الموقع';
    res.className = 'loc-result error show';
    btn.disabled = false;
    return;
  }

  // الآن نستدعي دالة تحديد الموقع
  getLocation(btn, res, mapContainer, mapIframe);
}

function getLocation(btn, res, mapContainer, mapIframe) {
  // normalize parameters (accept element or id)
  btn = (typeof btn === 'string') ? document.getElementById(btn) : btn;
  res = (typeof res === 'string') ? document.getElementById(res) : res;
  mapContainer = (typeof mapContainer === 'string') ? document.getElementById(mapContainer) : mapContainer;
  mapIframe = (typeof mapIframe === 'string') ? document.getElementById(mapIframe) : mapIframe;

  // early UI: show loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> جارٍ تحديد موقعك...';
  }
  if (res) {
    res.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>يتم تحديد موقعك... الرجاء الانتظار</span></span>';
    res.className = 'loc-result';
    res.style.display = 'block';
  }

  // short delay for UX
  setTimeout(() => {
    if (!navigator.geolocation) {
      if (res) {
        res.textContent = 'متصفحك لا يدعم تحديد الموقع';
        res.className = 'loc-result error show';
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'تحديد موقعي الحالي';
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          // set globals so other features (export, etc.) can read them
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          window.userLat = userLat;
          window.userLng = userLng;

          // show static map (OpenStreetMap embed)
          const zoomFactor = 0.0005;
          if (mapIframe) {
            mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${userLng - zoomFactor},${userLat - zoomFactor},${userLng + zoomFactor},${userLat + zoomFactor}&layer=mapnik`;
          }
          if (mapContainer) {
            mapContainer.style.display = 'block';
            mapContainer.hidden = false;
          }

          // compute install cost and expose globally
          try {
            installCost = (typeof calcInstall === 'function') ? calcInstall(userLat, userLng) : null;
          } catch (e) {
            console.warn('calcInstall error', e);
            installCost = null;
          }
          window.installCost = installCost;

          // optional: check forbidden keywords via reverse geocode (best-effort)
          let isForbidden = false;
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}&accept-language=ar`;
            const response = await fetch(url);
            if (response && response.ok) {
              const data = await response.json();
              if (data && data.address) {
                const addr = JSON.stringify(data.address);
                const forbiddenKeywords = ['أشمون', 'بشتيل', 'أوسيم', 'أبو زعبل', 'القناطر', 'طنان'];
                isForbidden = forbiddenKeywords.some(keyword => addr.includes(keyword));
              }
            }
          } catch (e) {
            console.warn("تعذر التحقق من اسم المنطقة، سنعتمد على المسافة فقط.", e);
          }

          // handle out-of-range or forbidden
          if (installCost === null || isForbidden) {
            if (res) {
              res.innerHTML = `نعتذر، موقعك خارج نطاق خدمتنا. <button onclick="outOfRangeWA()" style="background:none;border:none;color:#9caf88;cursor:pointer;font-family:'Cairo',sans-serif;font-size:12px;text-decoration:underline;">هل يمكن التنفيذ في منطقتي؟</button>`;
              res.className = 'loc-result show out-of-range';
            }
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" stroke-dasharray="4 2"/></svg> تحديد موقعي الحالي';
            }
            // ensure totals update
            if (typeof upd === 'function') try { upd(); } catch (e) { console.warn(e); }
            return;
          }

          // success: show cost and then fetch + display address details (getAddress updates sidebar and res)
          if (res) {
            res.innerHTML = 'تم تحديد موقعك — تكلفة التوصيل: ' + (installCost !== null ? installCost + ' EGP' : '—');
            res.className = 'loc-result show';
          }

          // call getAddress to show short address (neighbourhood/city) and update sidebar fields
          if (typeof getAddress === 'function') {
            try { await getAddress(userLat, userLng, res); } catch (e) { console.warn('getAddress failed', e); }
          }

          // enable export button if present
          const expBtn = document.getElementById('export-location');
          if (expBtn) expBtn.disabled = false;

          // finalize UI
          if (btn) {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> تم تحديد الموقع';
            btn.disabled = false;
          }

          // mark step complete and update totals
          if (typeof completeStep === 'function') {
            try { completeStep('step-location'); } catch (e) { /* ignore */ }
          }
          if (typeof upd === 'function') {
            try { upd(); } catch (e) { console.warn(e); }
          }

        } catch (err) {
          console.error('Error in getLocation success handler', err);
          if (res) { res.textContent = 'حدث خطأ أثناء معالجة الموقع'; res.className = 'loc-result error show'; }
          if (btn) { btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }
        }
      },
      err => {
        let msg = 'لم يتم السماح بالوصول للموقع';
        if (err && err.code === 1) msg = 'يرجى السماح للمتصفح بالوصول لموقعك';
        if (res) { res.textContent = msg; res.className = 'loc-result error show'; }
        if (btn) { btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }
      },
      { timeout: 15000, maximumAge: 60000 }
    );
  }, 500);
}

// safe escapeHtml fallback (إن لم تكن موجودة)
function escapeHtmlSafe(str) {
  if (typeof str !== 'string') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// improved tooltip that can open many times and always sets text
function openTooltip(text) {
  const note = (typeof text === 'string' && text.length) ? text : 'نستخدم موقعك لحساب المسافة وتوفير أفضل سعر للتوصيل. لا يتم حفظ موقعك، ولا يُستخدم إلا لهذا الغرض.';
  try {
    let overlay = document.getElementById('tooltip-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tooltip-overlay';
      overlay.className = 'tooltip-overlay';
      overlay.innerHTML = `
        <div class="tooltip-box" role="dialog" aria-modal="true" aria-label="ملاحظة النقل والتوصيل">
          <button class="tooltip-close" type="button" aria-label="إغلاق">×</button>
          <div class="tooltip-text" aria-live="polite"></div>
        </div>`;
      document.body.appendChild(overlay);

      // attach close handler (no inline onclick)
      const closeBtn = overlay.querySelector('.tooltip-close');
      closeBtn.addEventListener('click', closeTooltip);
      // also close on overlay click outside box
      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) closeTooltip();
      });
      // allow ESC to close
      document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape' && document.getElementById('tooltip-overlay')) {
          closeTooltip();
        }
      });
    }

    // set/replace text (use innerHTML only with escaped content)
    const textEl = overlay.querySelector('.tooltip-text');
    if (textEl) {
      textEl.innerHTML = escapeHtmlSafe(note).replace(/\n/g, '<br>');
    }

    // show overlay
    overlay.style.display = 'flex';
    // small delay for CSS animation if any
    requestAnimationFrame(() => overlay.classList.add('open'));
  } catch (err) {
    console.error('openTooltip error', err);
  }
}

function closeTooltip() {
  try {
    const overlay = document.getElementById('tooltip-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    // allow animation then hide
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.style.display = 'none';
      }
    }, 180);
  } catch (err) {
    console.error('closeTooltip error', err);
  }
}

function resetAll(){
  S={design:null,size:null,div:null,handle:null};
  userLat=null;userLng=null;installCost=null;
  const res=document.getElementById('loc-result');
  if(res){res.className='loc-result';res.textContent='';}
  const btn=document.getElementById('btn-locate');
  if(btn){btn.disabled=false;btn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> تحديد موقعي الحالي';}
  rDes();rSz();rDiv();rHnd();upd();
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3500);
}

function orderWA(){
  const t = calc();
  if(!t){showToast('الطلب غير مكتمل، يرجى إكمال جميع الخيارات');return;}
  const noH = S.design.hc===0;
  const deliveryNote = installCost !== null ? '\nتكلفة التوصيل: ' + installCost + ' EGP' : '\nتكلفة التوصيل: سيتم تحديدها عند التواصل';
  
  const msg = 'السلام عليكم، أرغب في طلب وحدة حوض بالمواصفات التالية:\n\n' +
              'التصميم: ' + S.design.name + '\n' +
              'المقاس: ' + S.size.size + '\n' +
              'التقسيمة الداخلية: ' + S.div.name + '\n' +
              'نوع المقبض: ' + (noH ? 'بدون مقبض' : S.handle.name) + '\n' +
              'تكلفة المعاينة والتركيب: 200 EGP' + 
              deliveryNote + '\n\n' +
              'السعر الإجمالي: ' + t + ' EGP\n\n' +
              'برجاء تأكيد الطلب.';
              
  window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank');
}

function customWA(){window.open('https://wa.me/'+WA+'?text='+encodeURIComponent('السلام عليكم، عندي فكرة تصميم وحدة حوض خاص وعايز أستفسر عنه.'),'_blank');}
function outOfRangeWA(){ 
  window.open('https://wa.me/'+WA+'?text='+
  encodeURIComponent('السلام عليكم، موقعي خارج نطاق الخدمة الحالي، وأرغب في معرفة إمكانية التنفيذ في منطقتي.'),'_blank');
}
function openLB(s){document.getElementById('lb-img').src=s;document.getElementById('lb').classList.add('open');}
function closeLB(){document.getElementById('lb').classList.remove('open');}

window.addEventListener('load',()=>{
  ['dc','vc','hc'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('scroll',()=>updateArrows(id));
    setTimeout(()=>updateArrows(id),150);
  });
});

const container = document.getElementById('selection-container');

fetch(LOCATION_SHEET)
  .then(r=>r.json())
  .then(settings=>{
    if(settings.workshop_lat) LOC=settings;
    console.log('✅ Location settings loaded');
  })
  .catch(()=>{console.log('Using default location settings');});


fetch(SHEET)
  .then(r => r.json())
  .then(data => {

    const rows = data.configurator;

    if (rows && rows.length > 5) {

        // حفظ الاختيارات القديمة
        const oldDesignId = S.design?.id;
        const oldSizeId = S.size?.id;
        const oldDivId = S.div?.id;
        const oldHandleId = S.handle?.id;

        D = build(rows);
        dataLoaded = true;

        // ريستور الاختيارات
        if (oldDesignId) S.design = D.designs.find(d => d.id === oldDesignId) || null;
        if (oldSizeId && S.design) S.size = S.design.sizes.find(s => s.id === oldSizeId) || null;
        if (oldDivId) S.div = D.divisions.find(d => d.id === oldDivId) || null;
        if (oldHandleId) S.handle = D.handles.find(h => h.id === oldHandleId) || null;

        rDes();
        rSz();
        rDiv();
        rHnd();
        upd();

        console.log("✅ Loaded fresh data from Apps Script");
    }

});

// Render cards immediately with placeholder data
rDes();rSz();rDiv();rHnd();upd();

// تشغيل عند التحميل

window.addEventListener('DOMContentLoaded', function () {

  // زرار تحديد الموقع
  const btn = document.getElementById('btn-locate');
  if (btn && typeof requestLocation === 'function') {
    try { btn.removeEventListener('click', requestLocation); } catch (e) {}
    btn.addEventListener('click', requestLocation);
  }

  // كروت نوع الحوض
  document.querySelectorAll('.sink-type-card').forEach(card => {

    card.addEventListener('click', function () {

      document.querySelectorAll('.sink-type-card').forEach(c => {
        c.classList.remove('selected');
      });

      this.classList.add('selected');

      S.sinkType = this.dataset.type;

      S.design = null;
      S.size = null;
      S.div = null;
      S.handle = null;

      rDes();
      rSz();
      rDiv();
      rHnd();
      upd();

    });

  });

  // Scroll arrows الخاصة بنوع الحوض
  updateArrows('sink-types');

  const sinkRow = document.getElementById('sink-types');
  if (sinkRow) {
    sinkRow.addEventListener('scroll', () => updateArrows('sink-types'));
  }

});
