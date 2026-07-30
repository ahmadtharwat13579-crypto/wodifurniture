const WA='201556840368';
const LOCATION_SHEET='https://script.google.com/macros/s/AKfycbz1Dj9QB3rlz_sZoLwC-kdfZiMUBsHheGT62dIgajmzqffFm7Z_XiQ9sH558XW9sgDZ/exec?pwd=double-protection-password';
let LOC={workshop_lat:30.061113,workshop_lng:31.394701,correction_factor:0,price_per_km:0,fixed_cost:0};
let userLat=null,userLng=null,installCost=null;
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/images/conf/';
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

  const isDivision = id && typeof id === 'string' && id.includes('_cic');

  const typeCodeMap = { 'drop-in': 'di', 'bowl': 'bw' };
  let finalImgId = imgBaseId;
  if (!isDivision && S.sinkType && typeCodeMap[S.sinkType]) {
    finalImgId = finalImgId.replace(/_wh_/, '_' + typeCodeMap[S.sinkType] + '_');
  }
  const encoded = encodeURIComponent(finalImgId);
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
  zoomBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
    </svg>
    `;
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

            desc.innerHTML = "";

        }
        else if(!S.size){

            desc.innerHTML = 'اختر <strong>عرض الحوض</strong> لعرض التصميمات المتوافقة.';

        }
        else{

              const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
              const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;

              const count = D.designs.filter(d =>
                  d.type === effectiveType &&
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
    "wall-hung": "تصميمات وحدات الحوض المعلق",
    "drop-in": "تصميمات وحدات الحوض الساقط",
    "bowl": "تصميمات وحدات الحوض فوق الكاونتر",
    "floor-standing": "تصميمات وحدات الحوض برجل كاملة"
  };

  title.textContent = titleMap[S.sinkType];

  const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
  const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;

  D.designs
    .filter(d => d.type === effectiveType)
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
  const title = document.getElementById("size-group-title");

if (!S.sinkType) {

    S.size = null;

    title.textContent = "اختر نوع الحوض أولاً";

    c.innerHTML = "";

    return;
}

  title.textContent = "اختر عرض الحوض لديك";

  const sharedTypes = ['wall-hung', 'drop-in', 'bowl'];
  const effectiveType = sharedTypes.includes(S.sinkType) ? 'wall-hung' : S.sinkType;

  // جمع المقاسات بدون تكرار
  const sizesMap = new Map();

  D.designs
    .filter(d => d.type === effectiveType)
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

  const c = document.getElementById('hc');
  const title = document.getElementById('handle-group-title');
  const desc = document.getElementById('handle-desc');
  c.innerHTML = '';

  // لم يتم اختيار نوع الحوض
  if(!S.sinkType){

    title.textContent = 'اختر نوع الحوض أولاً';

    document.querySelector('[data-group="hc"]').classList.add('hidden');

    return;
  }

  // إظهار السكشن بعد اختيار نوع الحوض
  document.querySelector('[data-group="hc"]').classList.remove('hidden');


  title.textContent = 'اختر نوع المقبض';

  desc.replaceChildren();

  const noH = S.design && S.design.hc === 0;

  if(noH){

    S.handle = null;

    desc.innerHTML =
    'التصميم المختار لا يدعم استخدام المقابض.';

    D.handles.forEach(h=>{

      const el = document.createElement('div');
      el.className = 'handle-card disabled';

      el.appendChild(mkImg(h.id, el));

      const info = document.createElement('div');
      info.className = 'cinfo';

      const displayPrice =
        (dataLoaded && h.price !== null)
          ? '+ ' + h.price + ' EGP / ضلفة'
          : '—';

      info.innerHTML =
        '<div class="cname">'+h.name+'</div>' +
        '<div class="cprice'+(dataLoaded?'':' loading')+'">'+
        (dataLoaded ? displayPrice : '—')+
        '</div>';

      el.appendChild(info);

      c.appendChild(el);

    });

    setTimeout(()=>updateArrows('hc'),50);
    return;
  }

  D.handles.forEach(h=>{

    const el = document.createElement('div');

    el.className =
      'handle-card' +
      (S.handle && S.handle.id===h.id ? ' selected' : '');

    el.appendChild(mkImg(h.id,el));

    const info = document.createElement('div');
    info.className='cinfo';

    const displayPrice =
      (S.design && dataLoaded && h.price !== null)
        ? '+ ' + h.price + ' EGP / ضلفة'
        : '—';

    info.innerHTML =
      '<div class="cname">'+h.name+'</div>' +
      '<div class="cprice'+(dataLoaded?'':' loading')+'">'+
      (dataLoaded ? displayPrice : '—')+
      '</div>';

    el.appendChild(info);

    el.onclick = ()=>{
      S.handle = h;
      rHnd();
      upd();
    };

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
  const sinkTypeNames = {
    'wall-hung': 'حوض معلق',
    'drop-in': 'حوض ساقط',
    'bowl': 'حوض فوق الكاونتر',
    'floor-standing': 'حوض برجل كاملة'
  };
  sdTypeEl.textContent = S.sinkType ? sinkTypeNames[S.sinkType] : '—';
  updateStepperProgress()
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


function resetAll(){
  S={sinkType:null,design:null,size:null,div:null,handle:null};
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

  if(!t){
    showToast('الطلب غير مكتمل، يرجى إكمال جميع الخيارات');
    return;
  }

  const noH = S.design.hc === 0;

  const sinkTypeNames = {
    "wall-hung": "حوض معلق",
    "drop-in": "حوض ساقط",
    "bowl": "حوض فوق الكاونتر",
    "floor-standing": "حوض برجل كاملة"
  };

  const specs =
`نوع الحوض: ${sinkTypeNames[S.sinkType]}
عرض الحوض: ${S.size.size}
تصميم الوحدة: ${S.design.name}
التقسيمة الداخلية: ${S.div.name}
نوع المقبض: ${noH ? 'بدون مقبض' : S.handle.name}
`;

  let msg;

  // خارج نطاق الخدمة
  if (installCost === null) {

    msg =
`السلام عليكم،

أرغب في الاستفسار عن إمكانية تنفيذ وحدة حوض بالمواصفات التالية:

${specs}

هل يمكن تنفيذ وتركيب الوحدة في موقعي؟

وشكرًا لكم.`;

  }

  // داخل نطاق الخدمة
  else {

    msg =
`السلام عليكم،

أرغب في الاستفسار عن وحدة حوض بالمواصفات التالية:

${specs}

برجاء التواصل معي لمعرفة التفاصيل وإتمام الطلب.

وشكرًا لكم.`;

  }

  window.open(
    'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg),
    '_blank'
  );
}

function customWA(){
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

function outOfRangeWA(){
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

// Intro collapse toggle
(function () {
  const introToggle = document.getElementById('intro-toggle');
  const introPara = document.getElementById('intro-para');

  if (!introToggle || !introPara) return;

  introToggle.addEventListener('click', function () {
    const collapsed = introPara.classList.toggle('collapsed');
    // When class 'collapsed' is present we treat it as collapsed state,
    // so button text should reflect the action to expand.
    introToggle.textContent = collapsed ? 'عرض المزيد' : 'عرض أقل';
    introToggle.setAttribute('aria-expanded', String(!collapsed));
    introPara.setAttribute('aria-expanded', String(!collapsed));
  });
})();


// Notes toggle
(function () {
  const notesBtn = document.getElementById('notes-toggle-btn');
  const notesPanel = document.getElementById('notes-panel');

  if (!notesBtn || !notesPanel) return;

  notesBtn.addEventListener('click', function () {
    const expanded = notesPanel.hidden;
    notesPanel.hidden = !expanded;
    notesBtn.setAttribute('aria-expanded', String(expanded));
  });
})();

// Show/hide scroll arrows based on overflow & hookup arrows
(function () {
  function updateScrollArrows() {
    document.querySelectorAll('.scroll-wrap').forEach(function (wrap) {
      const row = wrap.querySelector('.cards-row');
      const startBtn = wrap.querySelector('.scroll-arrow.arr-start');
      const endBtn = wrap.querySelector('.scroll-arrow.arr-end');

      if (!row) return;

      const maxScroll = row.scrollWidth - row.clientWidth;
      if (maxScroll <= 0) {
        if (startBtn) startBtn.classList.add('hidden');
        if (endBtn) endBtn.classList.add('hidden');
        return;
      }

      // القيمة المطلقة لضمان دقة الحسابات بغض النظر عن طريقة المتصفح في الـ RTL
      const current = Math.abs(row.scrollLeft);

      // في الـ RTL، السكرول يبدأ من أقصى اليمين ويقل باتجاه اليسار
      const canScrollRight = current > 10;                  // هل متاح التحريك يمين؟
      const canScrollLeft = current < (maxScroll - 10);     // هل متاح التحريك يسار؟

      // ربط الحالة بالأسهم (arr-start تمثل اليمين، arr-end تمثل اليسار في تصميمك)
      if (startBtn) startBtn.classList.toggle('hidden', !canScrollRight);
      if (endBtn) endBtn.classList.toggle('hidden', !canScrollLeft);
    });
  }

  window.addEventListener('load', updateScrollArrows);
  window.addEventListener('resize', updateScrollArrows);

  document.querySelectorAll('.cards-row').forEach(function (row) {
    row.addEventListener('scroll', updateScrollArrows);
  });
  
  // التشغيل فور تحميل السكربت لضمان ظهور الأسهم صحيحة من البداية
  document.addEventListener('DOMContentLoaded', updateScrollArrows);
})();


// Arrow buttons handling (scroll by chunk)
(function () {
  document.querySelectorAll('.scroll-arrow').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetId = btn.dataset.target;
      const dir = parseInt(btn.dataset.dir || '1', 10);
      const row = document.getElementById(targetId);

      if (!row) return;

      // scroll by ~60% of visible width (RTL-aware flip handled in HTML/CSS)
      const chunk = row.clientWidth * 0.6;
      // dir is -1 or 1; multiply by -1 if needed for RTL (HTML sets arr-start/arr-end)
      row.scrollBy({ left: dir * chunk * -1, behavior: 'smooth' });
    });
  });
})();

// Ensure initial ARIA states on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
  const panel = document.getElementById('notes-panel');
  if (panel) panel.hidden = true;

  const introPara = document.getElementById('intro-para');
  if (introPara) introPara.classList.add('collapsed');

  // run arrow update once DOM is ready
  if (typeof updateScrollArrows === 'function') {
    try { updateScrollArrows(); } catch (e) { /* ignore if not defined */ }
  }
});


// ---------- Improved Sticky total bar behavior for mobile ----------
(function () {
  const MOBILE_BREAK = 900; // px
  let stickyEl = null;
  let io = null;
  let mutation = null;

  function createSticky() {
    if (stickyEl) return stickyEl;

    stickyEl = document.createElement('div');
    stickyEl.className = 'price-sticky';
    stickyEl.innerHTML =
      '<div class="total">' +
        '<span class="lbl">الإجمالي</span>' +
        '<span class="val" id="sticky-total">— EGP</span>' +
      '</div>' +
      '<div class="sticky-actions">' +
        '<button class="sticky-reset" id="sticky-reset">إعادة</button>' +
        '<button class="sticky-order" id="sticky-order">إرسال الطلب</button>' +
      '</div>';

    document.body.appendChild(stickyEl);

    const orderBtn = document.getElementById('sticky-order');
    if (orderBtn) {
      orderBtn.addEventListener('click', function () {
        if (typeof orderWA === 'function') orderWA();
        else document.querySelector('.btn-order')?.click();
      });
    }

    const resetBtn = document.getElementById('sticky-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (typeof resetAll === 'function') resetAll();
        else document.querySelector('.btn-reset')?.click();
      });
    }

    stickyEl.style.display = 'none';
    return stickyEl;
  }

  function destroySticky() {
    if (io) { io.disconnect(); io = null; }
    if (mutation) { mutation.disconnect(); mutation = null; }
    if (stickyEl) { stickyEl.remove(); stickyEl = null; }
  }

function updateStickyValue() {
  const total = document.getElementById('total-price')?.textContent?.trim() || '— EGP';
  const stickyVal = document.getElementById('sticky-total');
  if (stickyVal) {
    stickyVal.textContent = total;
    pulsePrice(stickyVal);
  }
}

  function showSticky() {
    if (!stickyEl) createSticky();
    stickyEl.style.display = 'flex';
    updateStickyValue();
  }

  function hideSticky() {
    if (stickyEl) stickyEl.style.display = 'none';
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
    
    // استخدام مراقب لتحديد موقع سكشن الأسعار الأصلي بالنسبة للشاشة
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (ent) {
        // إذا كان السكشن الأصلي مرئياً في الشاشة أو تم تجاوزه (مختفي لأعلى)، نُخفي الشريط العائم.
        // أي أنه لا يظهر إلا عندما يكون السكشن الأصلي أسفل شاشة العضو (في بداية الصفحة للأعلى).
        if (ent.isIntersecting || ent.boundingClientRect.top < 0) {
          hideSticky();
        } else {
          showSticky();
        }
      });
    }, {
      root: null,
      threshold: 0
    });
    
    io.observe(target);
  }

  function enableIfMobile() {
    if (window.innerWidth > MOBILE_BREAK) {
      destroySticky();
      return;
    }

    const target = document.getElementById('sbar') || document.querySelector('.price-column.sbar');

    // If original price-column is styled fixed/sticky via CSS, avoid creating duplicate sticky
    if (target && isElementPositionedFixedOrSticky(target)) {
      destroySticky();
      return;
    }

    setupObservers();
  }

  window.addEventListener('load', enableIfMobile);
  window.addEventListener('resize', function () {
    clearTimeout(window._priceStickyResize);
    window._priceStickyResize = setTimeout(enableIfMobile, 120);
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(enableIfMobile, 300);
  });

  window.updateStickyValue = updateStickyValue;

})();

function pulsePrice(el) {
  if (!el) return;
  const text = el.textContent?.trim() || '';
  if (text === '— EGP' || text === '') return;
  el.classList.remove('price-pulse');
  void el.offsetWidth;
  el.classList.add('price-pulse');
}

// دالة لتحديث الـ Stepper وتغيير الشكل (عن طريق إضافة أو إزالة الكلاسات المباشرة)
function updateStepperProgress() {
  const stepDesign = document.getElementById('st-design');
  const stepSinkType = document.getElementById('st-sink-type');
  const stepSize = document.getElementById('st-size');
  const stepPartition = document.getElementById('st-partition');
  const stepHandle = document.getElementById('st-handle');
  const stepLocation = document.getElementById('st-location');

  // فحص التصميم: شملنا جميع حالات الكارد (سواء معلق أو رجل كاملة أو أي خصائص مرتبطة به)
  const hasDesign = (typeof S !== 'undefined' && S.design && (S.design.id || S.design.name || S.design.type));
  const hasSinkType = (typeof S !== 'undefined' && S.sinkType);
  const hasSize = (typeof S !== 'undefined' && S.size);
  const hasDiv = (typeof S !== 'undefined' && S.div);
  
  const noH = (typeof S !== 'undefined' && S.design && S.design.hc === 0);
  const hasHandle = (typeof S !== 'undefined' && (S.handle || noH));

    if (stepSinkType) {
      if (hasSinkType) {
        stepSinkType.classList.add('completed');
      } else {
        stepSinkType.classList.remove('completed');
      }
    }
  
  if (stepDesign) {
    if (hasDesign) {
      stepDesign.classList.add('completed');
    } else {
      stepDesign.classList.remove('completed');
    }
  }

  if (stepSize) {
    if (hasSize) {
      stepSize.classList.add('completed');
    } else {
      stepSize.classList.remove('completed');
    }
  }

  if (stepPartition) {
    if (hasDiv) {
      stepPartition.classList.add('completed');
    } else {
      stepPartition.classList.remove('completed');
    }
  }

  if (stepHandle) {
    if (hasHandle) {
      stepHandle.classList.add('completed');
    } else {
      stepHandle.classList.remove('completed');
    }
  }

  if (stepLocation) {
    const errorMsgElement = document.body.innerText.includes('خارج نطاق خدمتنا');
    const isOutOfRange = (typeof locationError !== 'undefined' && locationError === true) || errorMsgElement;
    
    const hasLocation = (typeof installCost !== 'undefined' && installCost !== null && !isOutOfRange);

    if (hasLocation) {
      stepLocation.classList.add('completed');
      stepLocation.classList.remove('out-of-range');
    } else if (isOutOfRange) {
      stepLocation.classList.remove('completed');
      stepLocation.classList.add('out-of-range'); // ستتلون بالبرتقالي فوراً
    } else {
      stepLocation.classList.remove('completed', 'out-of-range');
    }
  }
}


// نظام الـ Sticky والخلفية البيضاء عند التمرير
(function () {
  let io = null;

  function setupStepperSticky() {
    const stepperEl = document.getElementById('design-stepper');
    const targetSection = document.getElementById('sbar') || document.querySelector('.price-column.sbar') || document.querySelector('.details-section');

    if (!stepperEl || !targetSection) return;

    if (io) io.disconnect();

    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (ent) {
        if (ent.boundingClientRect.top < 0 && !ent.isIntersecting) {
          stepperEl.style.opacity = '0';
          stepperEl.style.pointerEvents = 'none';
        } else {
          stepperEl.style.opacity = '1';
          stepperEl.style.pointerEvents = 'auto';
        }
      });
    }, {
      root: null,
      threshold: 0
    });

    io.observe(targetSection);

    window.addEventListener('scroll', function() {
      if (window.scrollY > 150) {
        stepperEl.classList.add('is-sticky');
      } else {
        stepperEl.classList.remove('is-sticky');
      }
    });
  }

  window.addEventListener('load', setupStepperSticky);
  window.addEventListener('resize', setupStepperSticky);
})();

// تحديث تلقائي عند النقر مع تأمين ضد أخطاء الـ DOM
document.addEventListener('click', function(e) {
  if (e.target.closest('.card') || e.target.closest('.option') || e.target.closest('button')) {
    setTimeout(updateStepperProgress, 120);
  }
});

// تشغيل أولي عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', updateStepperProgress);

// التشغيل الفوري عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', function() {
  updateStepperProgress();
});

function saveConfig() {

  localStorage.setItem("wodi-config", JSON.stringify({

    sinkType: S.sinkType || null,

    size: S.size ? S.size.size : null,

    design: S.design ? S.design.id : null,

    division: S.division ? S.division.id : null,

    handle: S.handle ? S.handle.id : null,

    location: S.loc || null

  }));

}
