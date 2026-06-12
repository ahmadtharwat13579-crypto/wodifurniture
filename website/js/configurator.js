const WA='201556840368';
const LOCATION_SHEET='https://script.google.com/macros/s/AKfycbzK8n0uZcXlq2Ux2FwW1DSi8W4RNF3wAB3OCJy_ECO8oCM3bHIaApbUAWJ7sr57CEnj/exec?pwd=double-protection-password';
let LOC={workshop_lat:30.061113,workshop_lng:31.394701,correction_factor:1.3,price_per_km:30,base_install_price:300};
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
      if(!des[b])des[b]={id:b,name:nm,hc:parseInt(r.handle_count)||0,sizes:[]};
      else if(nm)des[b].name=nm;
      des[b].sizes.push({id,size:sz,price:p});
    }else if(cat==='cabinet_inside_config'){
      const b=base(id);
      let g=divs.find(d=>d.id===b);
      if(!g){g={id:b,name:nm,sizes:[]};divs.push(g);}
      g.sizes.push({id,size:sz||'any',price:p});
    }else if(cat==='handles_&_knobs'){
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

function rDes(){
  const c=document.getElementById('dc');c.innerHTML='';
  D.designs.forEach(d=>{
    const validPrices=d.sizes.map(s=>s.price).filter(p=>p!==null&&p!==undefined);
    const minP=validPrices.length?Math.min(...validPrices):null;
    const el=document.createElement('div');
    el.className='design-card'+(S.design&&S.design.id===d.id?' selected':'');
    el.appendChild(mkImg(d.id,el));
    const info=document.createElement('div');info.className='cinfo';
    const priceDisp=minP!==null?r5(minP)+' EGP':'—';
    info.innerHTML='<div class="cname">'+d.name+'</div><div class="cprice'+(dataLoaded?'':' loading')+'">يبدأ من: '+priceDisp+'</div>';
    el.appendChild(info);
    el.onclick=()=>{S.design=d;S.size=null;rDes();rSz();rHnd();upd();};
    c.appendChild(el);
  });
  setTimeout(()=>updateArrows('dc'),50);
}

function rSz(){
  const c=document.getElementById('sb');c.innerHTML='';
  if(!S.design){c.innerHTML='<span class="miss">يجب اختيار التصميم أولاً</span>';return;}
  S.design.sizes.forEach(s=>{
    const b=document.createElement('button');
    b.className='size-btn'+(S.size&&S.size.id===s.id?' selected':'');
    b.textContent=s.size;
    b.onclick=()=>{S.size=s;rSz();rDiv();upd();};
    c.appendChild(b);
  });
}

function rDiv(){
  const c=document.getElementById('vc');c.innerHTML='';
  const sg=S.size?sgr(S.size.size):null;
  D.divisions.forEach(d=>{
    const el=document.createElement('div');
    el.className='div-card'+(S.div&&S.div.id===d.id?' selected':'');
    el.appendChild(mkImg(d.id,el));
    const info=document.createElement('div');info.className='cinfo';
    const divP=sg?dvp(d,sg):null;
    const priceText=(!dataLoaded)?'—':(divP!==null&&divP!==undefined&&sg?'+'+divP+' EGP':'—');
    info.innerHTML='<div class="cname">'+d.name+'</div><div class="cprice'+(dataLoaded?'':' loading')+'">'+(dataLoaded?priceText:'—')+'</div>';
    el.appendChild(info);
    el.onclick=()=>{S.div=d;rDiv();upd();};
    c.appendChild(el);
  });
  setTimeout(()=>updateArrows('vc'),50);
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

function calcInstall(lat,lng){
  const dist=haversine(LOC.workshop_lat,LOC.workshop_lng,lat,lng);
  const adjusted=dist*LOC.correction_factor;
  return r5(4*adjusted*LOC.price_per_km+LOC.base_install_price);
}

function calc(){
  if(!S.design||!S.size||!S.div)return null;
  const noH=S.design.hc===0;
  if(!noH&&!S.handle)return null;
  const sg=sgr(S.size.size);
  const unitPrice=r5(S.size.price+dvp(S.div,sg)+(noH?0:S.handle.price*S.design.hc));
  if(installCost===null) return unitPrice;
  return r5(unitPrice+installCost);
}

function upd(){
  clearTimeout(dt);
  dt=setTimeout(()=>{
    const t=calc();
    const noH=S.design&&S.design.hc===0;
    const sg=S.size?sgr(S.size.size):'85';

    document.getElementById('total-price').textContent=t!==null?t+' EGP':'— EGP';

    const warn=document.getElementById('price-warning');
    if(warn){
      const needsWarn=S.design&&S.div&&S.handle&&!S.size;
      warn.classList.toggle('show',needsWarn);
    }

    // Install warning - show when all selected except location
    const allSelected=S.design&&S.size&&S.div&&(S.design.hc===0||S.handle);
    const instWarn=document.getElementById('install-warning');
    if(instWarn) instWarn.classList.toggle('show',allSelected&&installCost===null);

    // Install price in summary
    const siLabel=document.getElementById('si-label');
    const siPrice=document.getElementById('si-price');
    if(siLabel) siLabel.textContent=installCost!==null?'محسوبة':'—';
    if(siPrice) siPrice.textContent=installCost!==null?installCost+' EGP':'—';

    document.getElementById('sd').textContent=S.design?S.design.name:'—';
    document.getElementById('sd-price').textContent=S.size?r5(S.size.price)+' EGP':'—';

    document.getElementById('ss').textContent=S.size?S.size.size:'—';
    document.getElementById('ss-price').textContent='';

    document.getElementById('sv').textContent=S.div?S.div.name:'—';
    const divPrice=S.div?dvp(S.div,sg):0;
    document.getElementById('sv-price').textContent=S.div?(divPrice>0?'+'+divPrice+' EGP':'+0 EGP'):'—';

    document.getElementById('sh').textContent=S.handle?S.handle.name:(noH?'بدون مقبض':'—');
    const handlePrice=S.handle&&!noH?S.handle.price*S.design.hc:0;
    document.getElementById('sh-price').textContent=S.handle?(handlePrice>0?'+'+handlePrice+' EGP':'+0 EGP'):(noH?'—':'—');
  },300);
}

// دالة جلب العنوان (Reverse Geocoding)
async function getAddress(lat, lon, resElement) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.display_name) {
      // عرض العنوان (بناخد أول 3 أجزاء من العنوان للاختصار)
      const address = data.display_name.split(',').slice(0, 3).join(', ');
      resElement.innerHTML += `<br><small style="color:#666;">العنوان: ${address}</small>`;
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

  // 2. طلب الموقع
  setTimeout(() => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        
        // حساب التكلفة
        installCost = calcInstall(userLat, userLng);
        
        // تحديث الخريطة (Zoom 0.002)
        const zoomFactor = 0.002; 
        mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${userLng - zoomFactor},${userLat - zoomFactor},${userLng + zoomFactor},${userLat + zoomFactor}&layer=mapnik`;
        mapContainer.style.display = 'block';

        // 4. عرض النتيجة
        res.innerHTML = 'تم تحديد موقعك — تكلفة المعاينة والتركيب: ' + installCost + ' EGP';
        
        // استدعاء دالة جلب العنوان النصي
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
  const t=calc();
  if(!t){showToast('الطلب غير مكتمل، يرجى إكمال جميع الخيارات');return;}
  const noH=S.design.hc===0;
  const installNote=installCost!==null?'\nتكلفة المعاينة والتركيب: '+installCost+' EGP':'\nتكلفة المعاينة والتركيب: سيتم تحديدها عند التواصل';
  const msg='السلام عليكم، أرغب في طلب وحدة حوض بالمواصفات التالية:\n\nالتصميم: '+S.design.name+'\nالمقاس: '+S.size.size+'\nالتقسيمة الداخلية: '+S.div.name+'\nنوع المقبض: '+(noH?'بدون مقبض':S.handle.name)+installNote+'\n\nالسعر الإجمالي: '+t+' EGP\n\nبرجاء تأكيد الطلب.';
  window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(msg),'_blank');
}

function customWA(){window.open('https://wa.me/'+WA+'?text='+encodeURIComponent('السلام عليكم، عندي فكرة تصميم وحدة حوض خاص وعايز أستفسر عنه.'),'_blank');}
function openLB(s){document.getElementById('lb-img').src=s;document.getElementById('lb').classList.add('open');}
function closeLB(){document.getElementById('lb').classList.remove('open');}

window.addEventListener('load',()=>{
  ['dc','vc','hc'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('scroll',()=>updateArrows(id));
    setTimeout(()=>updateArrows(id),150);
  });
});

fetch(LOCATION_SHEET)
  .then(r=>r.json())
  .then(settings=>{
    if(settings.workshop_lat) LOC=settings;
    console.log('✅ Location settings loaded');
  })
  .catch(()=>{console.log('Using default location settings');});

fetch(SHEET)
  .then(r=>r.json())
  .then(rows=>{
    if(rows.length>5){
      D=build(rows);
      dataLoaded=true;
      rDes();rSz();rDiv();rHnd();upd();
      console.log('✅ Loaded fresh data from Apps Script');
    }
  })
  .catch(e=>{
    console.error('❌ Failed to load data:', e.message);
  });

// Render cards immediately with placeholder data
rDes();rSz();rDiv();rHnd();upd();

const images = ['ic-01.webp', 'ic-02.webp', 'ic-03.webp']; // أضف أسماء كل صورك هنا
let currentIndex = 0;

function initCarousel() {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    
    images.forEach((img, index) => {
        // إنشاء السلايد
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.innerHTML = `<img src="${GH}${img}" alt="عمل منفذ ${index+1}">`;
        track.appendChild(slide);
        
        // إنشاء النقطة
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
        dot.onclick = () => showSlide(index);
        dotsContainer.appendChild(dot);
    });

    // التقليب التلقائي كل 3 ثواني
    setInterval(() => moveSlide(1), 3000);
}

function showSlide(index) {
    currentIndex = (index + images.length) % images.length;
    const track = document.getElementById('carousel-track');
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    
    // تحديث النقط
    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIndex);
    });
}

function moveSlide(step) { showSlide(currentIndex + step); }

// تشغيل عند التحميل
window.addEventListener('load', initCarousel);