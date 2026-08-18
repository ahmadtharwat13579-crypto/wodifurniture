// 1. استيراد المكتبات الأساسية من الـ CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// 2. بيانات الفايربيس
const firebaseConfig = {
  apiKey: "AIzaSyCS6kK1nV0FMy_Pk44aImJJTF2zQf3_8sI",
  authDomain: "wodi-furniture.firebaseapp.com",
  projectId: "wodi-furniture",
  storageBucket: "wodi-furniture.firebasestorage.app",
  messagingSenderId: "453802118858",
  appId: "1:453802118858:web:dadf3546af2c3c65e8ee33",
  measurementId: "G-YZ76X4QNC7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// تسجيل الدخول بحساب جوجل
window.loginWithGoogle = function() {
  grecaptcha.enterprise.ready(async () => {
    const token = await grecaptcha.enterprise.execute('6Lde4nktAAAAAAPAlUeMAGT4Ki99VV9yNW56TuVw', {action: 'login'});
    if (token) {
      signInWithPopup(auth, provider)
        .then(() => { window.location.reload(); })
        .catch((error) => { console.error("خطأ: ", error.message); });
    }
  });
};

function updateSideNavAccount(user) {
    const loginSection = document.getElementById('sideNavLogin');
    const userSection = document.getElementById('sideNavUser');
    if (!loginSection || !userSection) return;

    const userName = document.getElementById('sideNavUserName');
    const userEmail = document.getElementById('sideNavUserEmail');
    const userImage = document.getElementById('sideNavUserImage');

    if (user) {
        loginSection.style.display = 'none';
        userSection.style.display = 'flex';
        if (userName) userName.textContent = user.displayName || user.email?.split('@')[0] || 'مستخدم WODI';
        if (userEmail) userEmail.textContent = user.email || '';
        if (userImage) userImage.src = user.photoURL || '';
    } else {
        loginSection.style.display = 'flex';
        userSection.style.display = 'none';
    }
}

function updateNavbarAccount(user) {
    const accountBtn = document.getElementById('accountBtn');
    const accountHint = document.getElementById('accountHint');
    if (!accountBtn) return;

    if (user) {
        accountBtn.innerHTML = `<img class="account-profile-image" src="${user.photoURL || ''}" alt="صورة الحساب">`;
        accountBtn.href = '#';
        accountBtn.onclick = function (event) {
            event.preventDefault();
            if (typeof window.openLogoutModal === 'function') {
                window.openLogoutModal();
            }
        };
        if (accountHint) accountHint.textContent = 'اضغط لتسجيل الخروج';
    } else {
        accountBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
        accountBtn.href = '#';
        accountBtn.onclick = function (event) {
            event.preventDefault();
            window.loginWithGoogle();
        };
        if (accountHint) accountHint.textContent = 'سجل دخولك لحفظ المفضلة';
    }
}

onAuthStateChanged(auth, (user) => {
    updateSideNavAccount(user);
    updateNavbarAccount(user);
});

// Expose auth state listener globally for other pages (like wishlist)
window.onAuthStateChanged = function(callback) {
  onAuthStateChanged(auth, callback);
};

// Expose current user for other pages
Object.defineProperty(window, 'currentUser', {
  get() {
    return auth.currentUser;
  }
});

// نظام إدارة الـ Logout Modal بشكل آمن بدون Duplicate Listeners
window.initLogoutSystem = function () {
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogoutBtn = document.getElementById('cancelLogout');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModal');
    const confirmLogoutBtn = document.getElementById('confirmLogout');
    const sideNavLogoutBtn = document.getElementById('sideNavLogoutBtn');
    const cancelLogout = document.getElementById('cancelLogout');
    const confirmLogout = document.getElementById('confirmLogout');
    const closeLogoutModal = document.getElementById('closeLogoutModal');

    // تأكيد فتح المودال من أي زر خروج
    window.openLogoutModal = function () {
        if (logoutModal) {
            const sideNav = document.getElementById('sideNav');
            const backdrop = document.getElementById('sideNavBackdrop');
            if (sideNav) sideNav.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            document.body.classList.remove('side-nav-open');
            logoutModal.classList.add('active');
        }
    };

    window.closeLogoutConfirmation = function () {
        if (logoutModal) {
            logoutModal.classList.remove('active');
        }
    };

    // ربط الأحداث مرة واحدة فقط لكل عنصر
    if (cancelLogoutBtn && !cancelLogoutBtn.dataset.listenerAttached) {
        cancelLogoutBtn.dataset.listenerAttached = 'true';
        cancelLogoutBtn.addEventListener('click', window.closeLogoutConfirmation);
    }

    if (closeLogoutModalBtn && !closeLogoutModalBtn.dataset.listenerAttached) {
        closeLogoutModalBtn.dataset.listenerAttached = 'true';
        closeLogoutModalBtn.addEventListener('click', window.closeLogoutConfirmation);
    }

    if (logoutModal && !logoutModal.dataset.listenerAttached) {
        logoutModal.dataset.listenerAttached = 'true';
        logoutModal.addEventListener('click', function (event) {
            if (event.target === logoutModal) {
                window.closeLogoutConfirmation();
            }
        });
    }

    if (confirmLogoutBtn && !confirmLogoutBtn.dataset.listenerAttached) {
        confirmLogoutBtn.dataset.listenerAttached = 'true';
        confirmLogoutBtn.addEventListener('click', async function () {
            try {
                await signOut(auth);
                window.closeLogoutConfirmation();
                window.location.reload();
            } catch (error) {
                console.error('حدث خطأ أثناء تسجيل الخروج:', error);
            }
        });
    }

    if (sideNavLogoutBtn && !sideNavLogoutBtn.dataset.listenerAttached) {
        sideNavLogoutBtn.dataset.listenerAttached = 'true';
        sideNavLogoutBtn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            window.openLogoutModal();
        });
    }
};

// تشغيل نظام الـ Logout بعد التأكد من تحميل محتوى الصفحة بالكامل أو الـ Navbar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.initLogoutSystem());
} else {
    window.initLogoutSystem();
}

// محاولة ثانية احترازية في حال كان الـ Navbar يتم حقنه ديناميكياً عبر fetch تأخذ وقتاً إضافياً
setTimeout(() => {
    if (typeof window.initLogoutSystem === 'function') {
        window.initLogoutSystem();
    }
}, 1000);

