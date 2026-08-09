// ==========================================
// ملف تهيئة الفوتر (footer.js)
// ==========================================

function initFooter() {
  console.log("تم تحميل الفوتر بنجاح!");

  // استدعاء دالة جلب الفئات الديناميكية المعرفة في nav.js لتعبئة #footerCategoryLinks
  if (typeof loadAndRenderCategoryLinks === 'function') {
    loadAndRenderCategoryLinks();
  } else {
    console.warn("دالة loadAndRenderCategoryLinks غير موجودة، تأكد من تحميل nav.js أولاً.");
  }
}

// تشغيل التهيئة فور تحميل محتوى الفوتر أو الصفحة
document.addEventListener('DOMContentLoaded', function () {
  initFooter();
});
