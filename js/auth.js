// 1. استيراد المكتبات الأساسية من الـ CDN (عشان يشتغلوا من المتصفح مباشرة من غير تعقيد)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// 2. حط بيانات مشروعك اللي جبتها من الفايربيس هنا
const firebaseConfig = {
  apiKey: "AIzaSyCS6kK1nV0FMy_Pk44aImJJTF2zQf3_8sI",
  authDomain: "wodi-furniture.firebaseapp.com",
  projectId: "wodi-furniture",
  storageBucket: "wodi-furniture.firebasestorage.app",
  messagingSenderId: "453802118858",
  appId: "1:453802118858:web:dadf3546af2c3c65e8ee33",
  measurementId: "G-YZ76X4QNC7"
};

// تهيئة الفايربيس
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 3. دالة تسجيل الدخول بحساب جوجل (تظل كما هي)
window.loginWithGoogle = function() {
  // 1. اطلب التوكن من ريكابتشا أولاً
  grecaptcha.enterprise.ready(async () => {
    const token = await grecaptcha.enterprise.execute('6Lde4nktAAAAAAPAlUeMAGT4Ki99VV9yNW56TuVw', {action: 'login'});
    
    // 2. إذا التوكن تمام، كمل عملية تسجيل الدخول
    if (token) {
      signInWithPopup(auth, provider)
        .then((result) => {
          window.location.reload();
        })
        .catch((error) => {
          console.error("خطأ: ", error.message);
        });
    }
  });
};

function updateSideNavAccount(user) {
    const loginSection = document.getElementById('sideNavLogin');
    const userSection = document.getElementById('sideNavUser');
    if (!loginSection || !userSection) return;

    if (user) {
        loginSection.style.display = 'none';
        userSection.style.display = 'flex';
        
        const userName = document.getElementById('sideNavUserName');
        const userImage = document.getElementById('sideNavUserImage');
        if (userName) userName.textContent = user.displayName || 'حسابي';
        if (userImage && user.photoURL) userImage.src = user.photoURL;
    } else {
        loginSection.style.display = 'flex';
        userSection.style.display = 'none';
    }
      // داخل دالة تحديث القائمة الجانبية للمستخدم المسجل
  document.getElementById('sideNavUserName').textContent = user.displayName || 'مستخدم WODI';
  document.getElementById('sideNavUserEmail').textContent = user.email || ''; // ده السطر اللي بيحط الإيميل الحقيقي
  document.getElementById('sideNavUserImage').src = user.photoURL || '';
}

// 6. مراقبة حالة المستخدم وتحديث شكل أيقونة البروفايل تلقائياً
// 6. مراقبة حالة المستخدم وتحديث شكل أيقونة البروفايل تلقائياً
onAuthStateChanged(auth, (user) => {

    updateSideNavAccount(user);
    updateNavbarAccount(user);

    const accountBtn = document.querySelector('.account-btn');
    if (!accountBtn) return;

    if (user) {
        // المستخدم مسجل دخول
        accountBtn.innerHTML = `
            <img
                class="account-profile-image"
                src="${user.photoURL || ''}"
                alt="Profile"
                title="تسجيل الخروج"
                style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;"
            >
        `;
        accountBtn.href = '#';
        accountBtn.onclick = function(event) {
            event.preventDefault();
            openLogoutModal();
        };
    } else {
        // المستخدم غير مسجل دخول
        accountBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
        accountBtn.href = '#';
        accountBtn.onclick = function(event) {
            event.preventDefault();
            loginWithGoogle(); // تفتح نافذة جوجل المنبثقة مباشرة
        };
    }

});

function updateNavbarAccount(user) {

    const accountBtn = document.querySelector('.account-btn');
    const accountHint = document.getElementById('accountHint');

    if (!accountBtn) return;

    if (user) {
        accountBtn.innerHTML = `
            <img
                class="account-profile-image"
                src="${user.photoURL || ''}"
                alt="صورة الحساب"
                style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;"
            >
        `;
        accountBtn.href = '#';
        accountBtn.onclick = function(event) {
            event.preventDefault();
            openLogoutModal();
        };

        if (accountHint) {
            accountHint.textContent = 'اضغط لتسجيل الخروج';
        }
    } else {
        accountBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
        accountBtn.href = '#';
        accountBtn.onclick = function(event) {
            event.preventDefault();
            loginWithGoogle(); // تفتح نافذة جوجل المنبثقة مباشرة
        };

        if (accountHint) {
            accountHint.textContent = 'سجل دخولك لحفظ المفضلة';
        }
    }

}

/* =========================================
   LOGOUT
========================================= */

function initLogoutSystem() {

    const logoutModal =
        document.getElementById('logoutModal');

    const cancelLogout =
        document.getElementById('cancelLogout');

    const confirmLogout =
        document.getElementById('confirmLogout');

    const closeLogoutModal =
        document.getElementById('closeLogoutModal');

    const sideNavLogoutBtn =
        document.getElementById('sideNavLogoutBtn');


    if (!logoutModal) {
        console.warn('logoutModal غير موجود في الصفحة');
        return;
    }


    /* فتح نافذة تأكيد تسجيل الخروج */

    window.handleProfileClick = function () {

        logoutModal.classList.add('is-visible');

    };


    /* إغلاق النافذة */
function closeLogoutConfirmation() {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal) {
        logoutModal.style.display = 'none';
        logoutModal.classList.remove('is-visible');
    }
}
    




    /* تأكيد تسجيل الخروج */

    confirmLogout?.addEventListener(
        'click',
        async function () {

            try {

                await signOut(auth);

                closeLogoutConfirmation();

                window.location.reload();

            } catch (error) {

                console.error(
                    'حدث خطأ أثناء تسجيل الخروج:',
                    error
                );

            }

        }
    );

}


/* تشغيل النظام بعد تحميل الـ HTML */

if (document.readyState === 'loading') {

    document.addEventListener(
        'DOMContentLoaded',
        initLogoutSystem
    );

} else {

    initLogoutSystem();

}

  function handleLogoutClick(event) {
      // يمنع القائمة إنها تتقفل
      event.stopPropagation();
      event.preventDefault();
      
      // يفتح الـ Modal بتاعك (تأكد إن اسم الدالة هو اللي بتستخدمه فعلاً)
      openLogoutModal(); 
  }
