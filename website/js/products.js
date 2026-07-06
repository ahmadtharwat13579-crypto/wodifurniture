// دالة إنشاء الصورة الذكية
function mkImg(id) {
    const w = document.createElement('div');
    w.className = 'cimg';
    const img = document.createElement('img');
    img.className = 'prod-img';

    // مسار مجلد الصور
    const GH = 'images/';
    const encoded = id.toLowerCase(); // تحويل الاسم لسمول لتطابق أسماء الملفات

    img.src = GH + encoded + '.webp';
    img.alt = id;

    img.onerror = function() {
        if (this.src.endsWith('.webp')) {
            // تجربة صيغة png إذا فشل الويب بي
            this.src = GH + encoded + '.png';
        } else {
            // في حالة فشل الكل، إخفاء الصورة وعرض أيقونة بديلة
            this.style.display = 'none';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '50');
            svg.setAttribute('height', '50');
            svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" fill="#ccc"/><path d="M3 9h18M9 21V9" stroke="white" stroke-width="2"/>';
            w.appendChild(svg);
        }
    };
    w.appendChild(img);
    return w;
}

// تشغيل الدالة عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.prod-card').forEach(card => {
        const nameDiv = card.querySelector('.prod-name');
        if (!nameDiv) return;
        
        const id = nameDiv.id.replace('name-', '');
        
        // إزالة أي إيميج قديمة مكتوبة يدوياً في الـ HTML
        const oldImg = card.querySelector('.prod-img');
        if (oldImg) oldImg.remove();
        
        // إضافة الصورة الذكية في أول الكارت
        card.prepend(mkImg(id));
    });
});