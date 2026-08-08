function initNavbar() {
  let lastScrollY = window.scrollY;
  let ticking = false;

  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  function updateNavbar() {
    const currentScrollY = window.scrollY;

    if (currentScrollY > lastScrollY && currentScrollY > 80) {
      navbar.style.setProperty('transform', 'translateY(-100%)', 'important');
    } else {
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
}

function initNavbar() {

  // --- 1. سلوك الإخفاء/الإظهار عند السكرول ---
  let lastScrollY = window.scrollY;
  let ticking = false;
  const navbar = document.querySelector('.navbar');

  if (navbar) {
    function updateNavbar() {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        navbar.style.setProperty('transform', 'translateY(-100%)', 'important');
      } else {
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
  }

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

  // --- 3. مودال تسجيل الخروج ---
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
    if (logoutModal) logoutModal.classList.remove('is-visible');
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

  // --- 6. ربط زرار تسجيل الخروج ---
  document
    .getElementById('sideNavLogoutBtn')
    ?.addEventListener('click', openLogoutModal);

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

}