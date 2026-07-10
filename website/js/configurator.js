const WA='201556840368';
const LOCATION_SHEET='https://script.google.com/macros/s/AKfycbz1Dj9QB3rlz_sZoLwC-kdfZiMUBsHheGT62dIgajmzqffFm7Z_XiQ9sH558XW9sgDZ/exec?pwd=double-protection-password';
let LOC={workshop_lat:30.061113,workshop_lng:31.394701,correction_factor:0,price_per_km:0,fixed_cost:0};
let userLat=null,userLng=null,installCost=null;
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/website/images/';
const SHEET='https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password';

const r5=n=>Math.round(n/5)*5;
const toAr=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',').replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]).replace(',','،');
const cur='ج.م.';
const base=id=>id.replace(/_\d+[\-\.]?\d*cm$/i,'');


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

function build(rows){
  const des={},divs=[],hnd=[];
  rows.forEach(r=>{
    const id=r.product_name,cat=r.product_category,p=parseFloat(r.price)||0,nm=r.display_name,sz=r.size;
    if(cat==='sink_cabinets'){
      const b=base(id);
      if(!des[b]) {
        // تحديد النوع: fp للرجل الكاملة، أي شيء آخر يعتبر معلق
        const type = id.includes('_fp_') ? 'floor-standing' : 'wall-hung';
        des[b]={id:b, name:nm, hc:parseInt(r.handle_count)||0, sizes:[], type:type};
      }
      else if(nm) des[b].name=nm;
      des[b].sizes.push({id,size:sz,price:p});
      }else if(cat==='cabinet_inside_config'){
        const b = base(id);

        // تحديد النوع من كود المنتج
        const type = id.includes('_fp_') ? 'floor-standing' : 'wall-hung';

        let g = divs.find(d => d.id === b);

        if(!g){
          g = {
            id: b,
            name: nm,
            type: type,
            sizes: []
          };
          divs.push(g);
        }

        g.sizes.push({
          id,
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
let S={design:null,size:null,div:null,handle:null};
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

function mkImg(id,cardEl){
  const w=document.createElement('div');w.className='cimg';
  const img=document.createElement('img');
  const b=base(id);
  const encoded=encodeURIComponent(b);
  img.src=GH+encoded+'.webp';
  img.alt='';
  img.onerror=function(){
    if(this.src.endsWith('.webp')){
      this.src=GH+encoded+'.png';
    }else{
      this.style.display='none';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','placeholder');
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('fill','none');
      svg.setAttribute('stroke','currentColor');
      svg.setAttribute('stroke-width','1.5');
      svg.innerHTML='<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
      w.appendChild(svg);
    }
  };
  w.appendChild(img);

  const zoomBtn=document.createElement('div');
  zoomBtn.className='zoom-btn';
  zoomBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>';
  zoomBtn.onclick=function(e){
    e.stopPropagation();
    openLB(img.src);
  };
  w.appendChild(zoomBtn);

  return w;
}

function rDes() {
  const wall = document.getElementById('dc-wall');
  const floor = document.getElementById('dc-floor');

  if (!wall || !floor) return;

  wall.innerHTML = '';
  floor.innerHTML = '';

  D.designs
    .filter(d => d.type !== 'floor-standing')
    .forEach(d => wall.appendChild(createDesignCard(d)));

  D.designs
    .filter(d => d.type === 'floor-standing')
    .forEach(d => floor.appendChild(createDesignCard(d)));

  updateArrows('dc-wall');
  updateArrows('dc-floor');
}

// دالة مساعدة لإنشاء الكارت (بنفس تنسيق الموقع الأصلي)
function createDesignCard(d) {
  const validPrices = d.sizes.map(s => s.price).filter(p => p !== null);
  const minP = validPrices.length ? Math.min(...validPrices) : null;
  
  const el = document.createElement('div');
  el.className = 'design-card' + (S.design && S.design.id === d.id ? ' selected' : '');
  el.appendChild(mkImg(d.id, el));
  
  const info = document.createElement('div'); info.className = 'cinfo';
  info.innerHTML = '<div class="cname">'+d.name+'</div><div class="cprice">يبدأ من: '+(minP!==null?r5(minP)+' EGP':'—')+'</div>';
  el.appendChild(info);

  el.onclick = () => {
  // إذا تغير التصميم، صفّر المقاس
  if (!S.design || S.design.id !== d.id) {
    S.size = null;
  }

  // إذا تغير نوع التصميم، صفّر أيضًا التقسيمة والمقبض
  if (S.design && S.design.type !== d.type) {
    S.div = null;
    S.handle = null;
  }

  S.design = d;
  rDes();
  rSz();
  rDiv();
  rHnd();
  upd();
};
}

// دالة إنشاء الكارت (نفس التي استخدمناها سابقاً)
function createDesignCard(d) {
  const validPrices = d.sizes.map(s => s.price).filter(p => p !== null);
  const minP = validPrices.length ? Math.min(...validPrices) : null;
  
  const el = document.createElement('div');
  el.className = 'design-card' + (S.design && S.design.id === d.id ? ' selected' : '');
  el.appendChild(mkImg(d.id, el));
  
  const info = document.createElement('div'); info.className = 'cinfo';
  info.innerHTML = `<div class="cname">${d.name}</div><div class="cprice">يبدأ من: ${minP !== null ? r5(minP) : '—'} EGP</div>`;
  el.appendChild(info);

  el.onclick = () => {
    if (S.design && S.design.type !== d.type) { S.size = null; S.div = null; S.handle = null; }
    S.design = d; 
    rDes(); rSz(); rDiv(); rHnd(); upd();
  };
  return el;
}

// دالة مساعدة لإنشاء الكارت بنفس تنسيقك القديم
function createDesignCard(d) {
    const validPrices = d.sizes.map(s => s.price).filter(p => p !== null);
    const minP = validPrices.length ? Math.min(...validPrices) : null;
    
    const el = document.createElement('div');
    el.className = 'design-card' + (S.design && S.design.id === d.id ? ' selected' : '');
    el.appendChild(mkImg(d.id, el));
    
    const info = document.createElement('div'); info.className = 'cinfo';
    info.innerHTML = `<div class="cname">${d.name}</div><div class="cprice">يبدأ من: ${minP !== null ? r5(minP) : '—'} EGP</div>`;
    el.appendChild(info);

    el.onclick = () => {
        if (S.design && S.design.type !== d.type) { S.size = null; S.div = null; S.handle = null; }
        S.design = d; 
        rDes(); rSz(); rDiv(); rHnd(); upd();
    };
    return el;
}

function rSz() {
  const c = document.getElementById('sb');
  c.innerHTML = '';

  if (!S.design) {
    S.size = null;
    c.innerHTML = '<span class="miss">يجب اختيار التصميم أولاً</span>';
    return;
  }

  // إذا كان المقاس الحالي لا ينتمي للتصميم المختار، امسحه
  if (S.size && !S.design.sizes.some(s => s.id === S.size.id)) {
    S.size = null;
  }

  S.design.sizes.forEach(s => {
    const b = document.createElement('button');
    b.className = 'size-btn' + (S.size && S.size.id === s.id ? ' selected' : '');
    b.textContent = s.size;
    b.onclick = () => {
      S.size = s;
      rSz();
      rDiv();
      upd();
    };
    c.appendChild(b);
  });
}

function rDiv() {
  const c = document.getElementById('vc');
  c.innerHTML = '';
  if (!S.design) return;

  const isFp = S.design.type === 'floor-standing';
  const sg = S.size ? sgr(S.size.size) : null;

  D.divisions.forEach(d => {
    // إظهار التقسيمات المطابقة فقط لنوع الحوض
  if (d.type !== S.design.type) return;

    const el = document.createElement('div');
    el.className = 'div-card' + (S.div && S.div.id === d.id ? ' selected' : '');
    el.appendChild(mkImg(d.id, el));
    
    const info = document.createElement('div'); info.className = 'cinfo';
    const divP = sg ? dvp(d, sg) : null;
    const priceText = (divP !== null && divP !== undefined) ? '+' + divP + ' EGP' : '—';
    info.innerHTML = '<div class="cname">' + d.name + '</div><div class="cprice">' + priceText + '</div>';
    el.appendChild(info);
    
    el.onclick = () => { S.div = d; rDiv(); upd(); };
    c.appendChild(el);
  });
  setTimeout(() => updateArrows('vc'), 100);
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
  setTimeout(() => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        
        // 1. تحديث الخريطة أولاً لتظهر دائماً
        const zoomFactor = 0.002; 
        mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${userLng - zoomFactor},${userLat - zoomFactor},${userLng + zoomFactor},${userLat + zoomFactor}&layer=mapnik`;
        mapContainer.style.display = 'block';

        // 2. حساب المسافة (المعيار الأساسي)
        installCost = calcInstall(userLat, userLng);

        // 3. جلب العنوان للتحقق من المناطق المستبعدة (فلتر إضافي)
        let isForbidden = false;
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}&accept-language=ar`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.address) {
                const addr = JSON.stringify(data.address);
                const forbiddenKeywords = ['أشمون', 'بشتيل', 'أوسيم', 'أبو زعبل', 'القناطر', 'طنان'];
                isForbidden = forbiddenKeywords.some(keyword => addr.includes(keyword));
            }
        } catch (e) {
            console.warn("تعذر التحقق من اسم المنطقة، سنعتمد على المسافة فقط.");
        }

        // 4. التحقق من النطاق (سواء بالمسافة أو بالكلمات المحظورة)
        if (installCost === null || isForbidden) {
            res.innerHTML = `نعتذر, موقعك خارج نطاق خدمتنا. <button onclick="outOfRangeWA()" style="background:none;border:none;color:#9caf88;cursor:pointer;font-family:'Cairo',sans-serif;font-size:12px;text-decoration:underline;">هل يمكن التنفيذ في منطقتي؟</button>`;
            res.className = 'loc-result show out-of-range';
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" stroke-dasharray="4 2"/></svg> تحديد موقعي الحالي';
            btn.disabled = false;
            upd();
            return; 
        }

        // 5. إذا كان داخل النطاق، عرض النتيجة وتفاصيل العنوان
        res.innerHTML = 'تم تحديد موقعك — تكلفة التوصيل: ' + installCost + ' EGP';
        await getAddress(userLat, userLng, res);
        
        res.className = 'loc-result show';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> تم تحديد الموقع';
        btn.disabled = false;
        upd();
      },
      err => {
        let msg = 'لم يتم السماح بالوصول للموقع';
        if (err.code === 1) msg = 'يرجى السماح للمتصفح بالوصول لموقعك';
        res.textContent = msg;
        res.className = 'loc-result error show';
        btn.disabled = false;
        btn.innerHTML = 'إعادة المحاولة';
      },
      { timeout: 15000, maximumAge: 60000 }
    );
  }, 500);
}



function openTooltip(){document.getElementById('tooltip-overlay').classList.add('open');}
function closeTooltip(){document.getElementById('tooltip-overlay').classList.remove('open');}

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

const images = ['ic-01.webp', 'ic-02.webp', 'ic-03.webp', 'ic-04.webp'];
let currentIndex = 0;
let autoplayTimer;

function initCarousel() {
  const track = document.getElementById('carousel-track');
  const dotsContainer = document.getElementById('carousel-dots');

  images.forEach((img, index) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.innerHTML = `<img src="${GH}${img}" alt="عمل منفذ ${index+1}">`;
    track.appendChild(slide);

    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
    dot.onclick = () => { showSlide(index); resetAutoplay(); };
    dotsContainer.appendChild(dot);
  });

  startAutoplay();
}

function showSlide(index) {
  currentIndex = (index + images.length) % images.length;
  const track = document.getElementById('carousel-track');
  track.style.transform = `translateX(${currentIndex * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

function moveSlide(step) { showSlide(currentIndex + step); resetAutoplay(); }
function startAutoplay() {
    // التأكد أننا نبدأ من أول عنصر
    currentIndex = 0; 
    autoplayTimer = setInterval(() => {
        // الاتجاه الطبيعي هو +1
        currentIndex = (currentIndex + 1) % images.length;
        showSlide(currentIndex);
    }, 2500);
}
function resetAutoplay() { clearInterval(autoplayTimer); startAutoplay(); }
// تشغيل عند التحميل
window.addEventListener('load', initCarousel);