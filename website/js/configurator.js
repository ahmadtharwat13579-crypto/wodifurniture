const WA = '201556840368';
const LOCATION_SHEET = 'https://script.google.com/macros/s/AKfycbzK8n0uZcXlq2Ux2FwW1DSi8W4RNF3wAB3OCJy_ECO8oCM3bHIaApbUAWJ7sr57CEnj/exec?pwd=double-protection-password';
const SHEET = 'https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password';
const GH = 'https://raw.githubusercontent.com/ahmadtharwat13579-crypto/wodifurniture/main/website/images/';

let LOC = { workshop_lat: 30.061113, workshop_lng: 31.394701, correction_factor: 1.3, price_per_km: 30, base_install_price: 300 };
let userLat = null, userLng = null, installCost = null;
let D = { designs: [], divisions: [], handles: [] };
let S = { design: null, size: null, div: null, handle: null };
let dt = null;
let dataLoaded = false;

// دالة حماية التفاعل (جديدة)
function isLocked() {
    if (!dataLoaded) {
        showToast('جاري تحميل الأسعار، يرجى الانتظار ثانية...');
        return true;
    }
    return false;
}

const r5 = n => Math.round(n / 5) * 5;
const toAr = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(',', '،');
const cur = 'ج.م.';
const base = id => id.replace(/_\d+[\-\.]?\d*cm$/i, '');

function toggleNotes() {
    document.getElementById('notes-box').classList.toggle('open');
}

function scrollCards(id, dir) {
    const el = document.getElementById(id);
    el.scrollLeft += dir * -160;
    setTimeout(() => updateArrows(id), 300);
}

function updateArrows(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const startBtn = document.getElementById(id + '-start');
    const endBtn = document.getElementById(id + '-end');
    if (!startBtn || !endBtn) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) { startBtn.classList.add('hidden'); endBtn.classList.add('hidden'); return; }
    const sl = el.scrollLeft;
    const atStart = (sl >= 0 && sl <= 4) || (sl < 0 && Math.abs(sl) <= 4);
    const atEnd = (sl >= 0 && sl >= max - 4) || (sl < 0 && Math.abs(sl) >= max - 4);
    startBtn.classList.toggle('hidden', atStart);
    endBtn.classList.toggle('hidden', atEnd);
}

function parseCSV(t) {
    const ls = t.trim().split('\n');
    const hs = ls[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
    return ls.slice(1).map(l => { const v = l.split(',').map(x => x.trim().replace(/^"|"$/g, '')); const o = {}; hs.forEach((h, i) => o[h] = v[i] || ''); return o; });
}

function build(rows) {
    const des = {}, divs = [], hnd = [];
    rows.forEach(r => {
        const id = r.product_name, cat = r.product_category, p = parseFloat(r.price) || 0, nm = r.display_name, sz = r.size;
        if (cat === 'sink_cabinets') {
            const b = base(id);
            if (!des[b]) des[b] = { id: b, name: nm, hc: parseInt(r.handle_count) || 0, sizes: [] };
            else if (nm) des[b].name = nm;
            des[b].sizes.push({ id, size: sz, price: p });
        } else if (cat === 'cabinet_inside_config') {
            const b = base(id);
            let g = divs.find(d => d.id === b);
            if (!g) { g = { id: b, name: nm, sizes: [] }; divs.push(g); }
            g.sizes.push({ id, size: sz || 'any', price: p });
        } else if (cat === 'handles_&_knobs') {
            hnd.push({ id, name: nm, price: p });
        }
    });
    return { designs: Object.values(des), divisions: divs, handles: hnd };
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

function mkImg(id, cardEl) {
    const w = document.createElement('div'); w.className = 'cimg';
    const img = document.createElement('img');
    const b = base(id);
    const encoded = encodeURIComponent(b);
    img.src = GH + encoded + '.webp';
    img.alt = '';
    img.onerror = function() {
        if (this.src.endsWith('.webp')) {
            this.src = GH + encoded + '.png';
        } else {
            this.style.display = 'none';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'placeholder');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '1.5');
            svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>';
            w.appendChild(svg);
        }
    };
    w.appendChild(img);
    const zoomBtn = document.createElement('div');
    zoomBtn.className = 'zoom-btn';
    zoomBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>';
    zoomBtn.onclick = function(e) { e.stopPropagation(); openLB(img.src); };
    w.appendChild(zoomBtn);
    return w;
}

function rDes() {
    const c = document.getElementById('dc'); c.innerHTML = '';
    D.designs.forEach(d => {
        const validPrices = d.sizes.map(s => s.price).filter(p => p !== null && p !== undefined);
        const minP = validPrices.length ? Math.min(...validPrices) : null;
        const el = document.createElement('div');
        el.className = 'design-card' + (S.design && S.design.id === d.id ? ' selected' : '');
        el.appendChild(mkImg(d.id, el));
        const info = document.createElement('div'); info.className = 'cinfo';
        info.innerHTML = '<div class="cname">' + d.name + '</div><div class="cprice' + (dataLoaded ? '' : ' loading') + '">يبدأ من: ' + (minP !== null ? r5(minP) + ' EGP' : '—') + '</div>';
        el.onclick = () => { if (isLocked()) return; S.design = d; S.size = null; rDes(); rSz(); rHnd(); upd(); };
        c.appendChild(el);
    });
    setTimeout(() => updateArrows('dc'), 50);
}

function rSz() {
    const c = document.getElementById('sb'); c.innerHTML = '';
    if (!S.design) { c.innerHTML = '<span class="miss">يجب اختيار التصميم أولاً</span>'; return; }
    S.design.sizes.forEach(s => {
        const b = document.createElement('button');
        b.className = 'size-btn' + (S.size && S.size.id === s.id ? ' selected' : '');
        b.textContent = s.size;
        b.onclick = () => { if (isLocked()) return; S.size = s; rSz(); rDiv(); upd(); };
        c.appendChild(b);
    });
}

function rDiv() {
    const c = document.getElementById('vc'); c.innerHTML = '';
    const sg = S.size ? sgr(S.size.size) : null;
    D.divisions.forEach(d => {
        const el = document.createElement('div');
        el.className = 'div-card' + (S.div && S.div.id === d.id ? ' selected' : '');
        el.appendChild(mkImg(d.id, el));
        const info = document.createElement('div'); info.className = 'cinfo';
        const divP = sg ? dvp(d, sg) : null;
        info.innerHTML = '<div class="cname">' + d.name + '</div><div class="cprice' + (dataLoaded ? '' : ' loading') + '">' + (dataLoaded && divP !== null ? '+' + divP + ' EGP' : '—') + '</div>';
        el.onclick = () => { if (isLocked()) return; S.div = d; rDiv(); upd(); };
        c.appendChild(el);
    });
    setTimeout(() => updateArrows('vc'), 50);
}

function rHnd() {
    const c = document.getElementById('hc'); c.innerHTML = '';
    const noH = S.design && S.design.hc === 0;
    if (noH) S.handle = null;
    D.handles.forEach(h => {
        const el = document.createElement('div');
        el.className = 'handle-card' + (noH ? ' dis' : '') + (S.handle && S.handle.id === h.id ? ' selected' : '');
        el.appendChild(mkImg(h.id, el));
        const info = document.createElement('div'); info.className = 'cinfo';
        info.innerHTML = '<div class="cname">' + h.name + '</div><div class="cprice' + (dataLoaded ? '' : ' loading') + '">' + (dataLoaded && h.price !== null ? '+ ' + h.price + ' EGP' : '—') + '</div>';
        el.onclick = () => { if (isLocked()) return; S.handle = h; rHnd(); upd(); };
        c.appendChild(el);
    });
    setTimeout(() => updateArrows('hc'), 50);
}

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcInstall(lat, lng) {
    const dist = haversine(LOC.workshop_lat, LOC.workshop_lng, lat, lng);
    const adjusted = dist * LOC.correction_factor;
    return r5(4 * adjusted * LOC.price_per_km + LOC.base_install_price);
}

function calc() {
    if (!S.design || !S.size || !S.div) return null;
    const noH = S.design.hc === 0;
    if (!noH && !S.handle) return null;
    const sg = sgr(S.size.size);
    const unitPrice = r5(S.size.price + dvp(S.div, sg) + (noH ? 0 : S.handle.price * S.design.hc));
    if (installCost === null) return unitPrice;
    return r5(unitPrice + installCost);
}

function upd() {
    clearTimeout(dt);
    dt = setTimeout(() => {
        const t = calc();
        const noH = S.design && S.design.hc === 0;
        const sg = S.size ? sgr(S.size.size) : '85';
        document.getElementById('total-price').textContent = t !== null ? t + ' EGP' : '— EGP';
        const warn = document.getElementById('price-warning');
        if (warn) { const needsWarn = S.design && S.div && S.handle && !S.size; warn.classList.toggle('show', needsWarn); }
        const allSelected = S.design && S.size && S.div && (S.design.hc === 0 || S.handle);
        const instWarn = document.getElementById('install-warning');
        if (instWarn) instWarn.classList.toggle('show', allSelected && installCost === null);
        const siLabel = document.getElementById('si-label');
        const siPrice = document.getElementById('si-price');
        if (siLabel) siLabel.textContent = installCost !== null ? 'محسوبة' : '—';
        if (siPrice) siPrice.textContent = installCost !== null ? installCost + ' EGP' : '—';
        document.getElementById('sd').textContent = S.design ? S.design.name : '—';
        document.getElementById('sd-price').textContent = S.size ? r5(S.size.price) + ' EGP' : '—';
        document.getElementById('ss').textContent = S.size ? S.size.size : '—';
        document.getElementById('sv').textContent = S.div ? S.div.name : '—';
        const divPrice = S.div ? dvp(S.div, sg) : 0;
        document.getElementById('sv-price').textContent = S.div ? (divPrice > 0 ? '+' + divPrice + ' EGP' : '+0 EGP') : '—';
        document.getElementById('sh').textContent = S.handle ? S.handle.name : (noH ? 'بدون مقبض' : '—');
        const handlePrice = S.handle && !noH ? S.handle.price * S.design.hc : 0;
        document.getElementById('sh-price').textContent = S.handle ? (handlePrice > 0 ? '+' + handlePrice + ' EGP' : '+0 EGP') : (noH ? '—' : '—');
    }, 300);
}

async function getAddress(lat, lon, resElement) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`;
    try { const response = await fetch(url); const data = await response.json(); if (data.display_name) { const address = data.display_name.split(',').slice(0, 3).join(', '); resElement.innerHTML += `<br><small style="color:#666;">العنوان: ${address}</small>`; } } catch (e) { console.error("تعذر جلب العنوان", e); }
}

function requestLocation() {
    const btn = document.getElementById('btn-locate'); const res = document.getElementById('loc-result'); const mapContainer = document.getElementById('mapContainer'); const mapIframe = document.getElementById('staticMap');
    btn.disabled = true; btn.innerHTML = 'جارٍ تحديد موقعك...';
    if (!navigator.geolocation) { res.textContent = 'متصفحك لا يدعم تحديد الموقع'; res.className = 'loc-result error show'; btn.disabled = false; return; }
    setTimeout(() => {
        navigator.geolocation.getCurrentPosition(async pos => {
            installCost = calcInstall(pos.coords.latitude, pos.coords.longitude);
            const zoomFactor = 0.002; mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${pos.coords.longitude - zoomFactor},${pos.coords.latitude - zoomFactor},${pos.coords.longitude + zoomFactor},${pos.coords.latitude + zoomFactor}&layer=mapnik`;
            mapContainer.style.display = 'block';
            res.innerHTML = 'تم تحديد موقعك — تكلفة المعاينة والتركيب: ' + installCost + ' EGP';
            await getAddress(pos.coords.latitude, pos.coords.longitude, res);
            res.className = 'loc-result show'; btn.innerHTML = 'تم تحديد الموقع'; btn.disabled = false; upd();
        }, err => { res.textContent = 'يرجى السماح بالوصول لموقعك'; res.className = 'loc-result error show'; btn.disabled = false; btn.innerHTML = 'إعادة المحاولة'; }, { timeout: 15000 });
    }, 500);
}

function openTooltip() { document.getElementById('tooltip-overlay').classList.add('open'); }
function closeTooltip() { document.getElementById('tooltip-overlay').classList.remove('open'); }
function resetAll() { S = { design: null, size: null, div: null, handle: null }; installCost = null; const res = document.getElementById('loc-result'); if (res) { res.className = 'loc-result'; res.textContent = ''; } rDes(); rSz(); rDiv(); rHnd(); upd(); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); }
function orderWA() { const t = calc(); if (!t) { showToast('يرجى إكمال جميع الخيارات'); return; } const noH = S.design.hc === 0; const installNote = installCost !== null ? '\nتكلفة المعاينة والتركيب: ' + installCost + ' EGP' : '\nتكلفة المعاينة والتركيب: عند التواصل'; const msg = 'أرغب في طلب وحدة حوض: ' + S.design.name + '، مقاس: ' + S.size.size + '، تقسيم: ' + S.div.name + '، مقبض: ' + (noH ? 'بدون' : S.handle.name) + installNote + '\n\nالإجمالي: ' + t + ' EGP'; window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank'); }
function openLB(s) { document.getElementById('lb-img').src = s; document.getElementById('lb').classList.add('open'); }
function closeLB() { document.getElementById('lb').classList.remove('open'); }

window.addEventListener('load', () => { ['dc', 'vc', 'hc'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('scroll', () => updateArrows(id)); setTimeout(() => updateArrows(id), 150); }); });

// التحميل النهائي مع مانع الكاش
fetch(LOCATION_SHEET + '&t=' + new Date().getTime()).then(r => r.json()).then(s => { if (s.workshop_lat) { LOC = s; upd(); } }).catch(() => console.log('Location default'));
fetch(SHEET + '&t=' + new Date().getTime()).then(r => r.json()).then(rows => { if (rows && rows.length > 5) { D = build(rows); dataLoaded = true; rDes(); rSz(); rDiv(); rHnd(); upd(); showToast('تم تحديث الأسعار!'); } });

rDes(); rSz(); rDiv(); rHnd(); upd();
