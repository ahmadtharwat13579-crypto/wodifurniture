function initNavbar() {

  // --- 1. سلوك إخفاء/إظهار الـ Nav عند السكرول ---
  (function () {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    function updateNavbar() {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // نازل تحت وعدى مسافة معينة (80px) → إخفاء
        navbar.style.setProperty('transform', 'translateY(-100%)', 'important');
      } else {
        // طالع فوق (في أي مكان) → إظهار
        navbar.style.setProperty('transform', 'translateY(0)', 'important');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    }, { passive: true });
  })();

  // --- 2. القائمة الجانبية (Side Nav) ---
  window.toggleSideNav = function () {
    const sideNav = document.getElementById('sideNav');
    const backdrop = document.getElementById('sideNavBackdrop');
    if (!sideNav || !backdrop) return;

    const isOpen = sideNav.classList.toggle('active');
    backdrop.classList.toggle('active', isOpen);
    document.body.classList.toggle('side-nav-open', isOpen);

    if (isOpen) openProductsDropdown();
  };

  // --- 3. مودال تسجيل الخروج (معدل ومتاح عالمياً وضمن initNavbar) ---
  window.openLogoutModal = function () {
    const logoutModal = document.getElementById('logoutModal');
    if (!logoutModal) return;

    const sideNav = document.getElementById('sideNav');
    const backdrop = document.getElementById('sideNavBackdrop');
    if (sideNav) sideNav.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    document.body.classList.remove('side-nav-open');

    logoutModal.classList.add('is-visible');
  };

  window.closeLogoutModal = function () {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal) {
      logoutModal.classList.remove('is-visible');
    }
  };

  // --- 4. دروب داون المنتجات ---
  window.toggleProductsDropdown = function () {
    const menu = document.getElementById('productsDropdown');
    const button = document.querySelector('.side-nav-dropdown-toggle');
    if (!menu || !button) return;

    const isOpen = menu.classList.toggle('open');
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  window.openProductsDropdown = function () {
    const menu = document.getElementById('productsDropdown');
    const button = document.querySelector('.side-nav-dropdown-toggle');
    if (!menu || !button) return;

    menu.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
  };

  // --- 5. إغلاق بزرار Escape ---
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const sideNav = document.getElementById('sideNav');
    if (sideNav && sideNav.classList.contains('active')) {
      toggleSideNav();
    }
  });

  // --- 6. ربط زرار تسجيل الخروج (بالكود الأصلي مع تأمين العنصر) ---
  const logoutBtn = document.getElementById('sideNavLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', openLogoutModal);
  }

  // --- 7. عرض بيانات المستخدم (لو موجود نظام حسابات) ---
  window.updateSideNavAccount = function (user) {
    const loginSection = document.getElementById('sideNavLogin');
    const userSection = document.getElementById('sideNavUser');
    if (!loginSection || !userSection) return;

    loginSection.classList.remove('is-visible');
    userSection.classList.remove('is-visible');

    if (user) {
      userSection.classList.add('is-visible');
      const userName = document.getElementById('sideNavUserName');
      const userImage = document.getElementById('sideNavUserImage');

      if (userName) {
        userName.textContent = user.displayName || user.email?.split('@')[0] || 'حسابي';
      }
      if (userImage && user.photoURL) {
        userImage.src = user.photoURL;
      }
    } else {
      loginSection.classList.add('is-visible');
    }
  };

  loadAndRenderCategoryLinks();
  initAccountHint();

}

  // --- 8. بناء الفئات من الJSON لعرضها في الSide Menu--
async function loadAndRenderCategoryLinks() {
  const CACHE_KEY = 'wodi_categories_cache';

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    renderCategoryLinksFromData(JSON.parse(cached));
  }

  try {
    const res = await fetch("https://script.google.com/macros/s/AKfycbz3xuCuZ6sU9QVo2nTRaItWFLplEhG7bKuzeZSQpk4DseShYrzycpRhyO2u2kuwPVkY/exec?pwd=double-protection-password");
    const data = await res.json();
    const categories = (data.categories || []).filter(cat => cat.visible === true);

    localStorage.setItem(CACHE_KEY, JSON.stringify(categories));
    renderCategoryLinksFromData(categories); // تحديث العرض بأحدث نسخة
  } catch (err) {
    console.error('فشل تحديث الفئات:', err);
  }
}

function renderCategoryLinksFromData(categories) {
  categories.sort((a, b) => a.order - b.order);

  const sideMenuContainer = document.getElementById('productsDropdown');
  if (sideMenuContainer) {
    sideMenuContainer.innerHTML = `
      <a href="products.html" class="side-nav-dropdown-item">جميع المنتجات</a>
    ` + categories
      .map(cat => `<a href="products.html?category=${cat.category_id}" class="side-nav-dropdown-item">${cat.display_name}</a>`)
      .join('');
  }

  const footerContainer = document.getElementById('footerCategoryLinks');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <li><a href="products.html">جميع المنتجات</a></li>
    ` + categories
      .map(cat => `<li><a href="products.html?category=${cat.category_id}">${cat.display_name}</a></li>`)
      .join('');
  }
}

  // --- 9. تهيئة تلميح الحساب ---
function initAccountHint() {
  const hint = document.getElementById("accountHint");
  const profileBtn = document.querySelector(".account-btn");
  if (!hint || !profileBtn) return;

  const currentUrl = window.location.href;
  const path = window.location.pathname;
  
  // استبعاد الصفحة الرئيسية
  const isHomePage = path === '/' || path.endsWith('index.html') || path === '' || currentUrl.endsWith('/');
  if (isHomePage) return;

  const messages = {
    'products.html': 'سجل دخولك لحفظ منتجاتك المفضلة',
    'configurator.html': 'سجل دخولك لحفظ تصميمك والرجوع له لاحقًا',
  };

  const pageKey = Object.keys(messages).find(key => path.includes(key));
  if (!pageKey) return; // لو الصفحة مش مدرجة في القائمة، متظهرش

  // إنشاء مفتاح فريد لكل صفحة في الـ localStorage (مثلاً: accountHintShown_products.html)
  const storageKey = `accountHintShown_${pageKey}`;

  // لو ظهرت في الصفحة دي قبل كده، متظهرش تاني فيها
  if (localStorage.getItem(storageKey)) return;

  hint.textContent = messages[pageKey] || 'سجل دخولك لحفظ المفضلة';

  setTimeout(() => {
    hint.classList.add("show");
    profileBtn.classList.add("attention");
  }, 1600);

  setTimeout(() => {
    hint.classList.remove("show");
    profileBtn.classList.remove("attention");
    // تسجيل أن الرسالة ظهرت في هذه الصفحة فقط
    localStorage.setItem(storageKey, "true");
  }, 3500);
}

// تشغيل الدالة فور تحميل الصفحة (أو استدعائها بعد تحميل الـ Navbar لو بتستخدم Fetch)
document.addEventListener('DOMContentLoaded', () => {
  initAccountHint();
});