// Debug: track localStorage changes
const _setItem = localStorage.setItem.bind(localStorage);
const _removeItem = localStorage.removeItem.bind(localStorage);
const _clear = localStorage.clear.bind(localStorage);

localStorage.setItem = function(key, value) {
  console.log('localStorage.setItem:', key, value);
  _setItem(key, value);
};

localStorage.removeItem = function(key) {
  console.log('localStorage.removeItem:', key, new Error().stack);
  _removeItem(key);
};

localStorage.clear = function() {
  console.log('localStorage.clear called:', new Error().stack);
  _clear();
};


// 1. استيراد المكتبات الأساسية من الـ CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Google One Tap init
window.addEventListener('load', () => {
  window.google.accounts.id.initialize({
    client_id: '453802118858-q3tqor1hco5cr1b36bjpmnthaabmni7d.apps.googleusercontent.com',
    callback: async (response) => {
      const credential = GoogleAuthProvider.credential(response.credential);
      await signInWithCredential(auth, credential);
      // احفظ الـ pending state لو موجود قبل الـ reload
      const pendingOrder = localStorage.getItem('pendingOrder');
      const reopenModal = localStorage.getItem('reopenOrderModal');
      console.log('One Tap callback - pendingOrder:', pendingOrder, 'reopenModal:', reopenModal);
      if (pendingOrder) localStorage.setItem('pendingOrder', pendingOrder);
      if (reopenModal) localStorage.setItem('reopenOrderModal', reopenModal);
      window.location.reload();
    }
  });
});

window.saveInvoiceToFirestore = async function(orderNum, invoiceHtml) {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated');
  await setDoc(doc(db, 'invoices', orderNum), {
    html: invoiceHtml,
    uid: user.uid,
    createdAt: new Date()
  });
};

window.getInvoiceFromFirestore = async function(orderNum) {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated');
  const invoiceRef = doc(db, 'invoices', orderNum);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) return null;
  const data = invoiceSnap.data();
  if (data.uid !== user.uid) throw new Error('Unauthorized invoice access');
  return data.html || null;
};

// تسجيل الدخول بحساب جوجل
window.loginWithGoogle = function() {
  grecaptcha.enterprise.ready(async () => {
    const token = await grecaptcha.enterprise.execute('6Lde4nktAAAAAAPAlUeMAGT4Ki99VV9yNW56TuVw', {action: 'login'});
    if (!token) return;
    localStorage.setItem('scrollPosition', window.scrollY);
    if (typeof window.showToast === 'function') {
      window.showToast('سجّل دخولك بحساب Google لتأكيد طلبك');
    }
    window.google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      signInWithPopup(auth, provider)
        .then(() => {
          console.log('popup success - pendingOrder:', localStorage.getItem('pendingOrder'));
          window.location.href = window.location.href;
        })
        .catch((error) => { console.error("خطأ: ", error.message); });
    }
  });
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
            if (typeof window.openLogoutModal === 'function') window.openLogoutModal();
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
    console.log('onAuthStateChanged fired, user:', user?.email, 'pendingOrder:', localStorage.getItem('pendingOrder'), 'reopenModal:', localStorage.getItem('reopenOrderModal'));
    updateSideNavAccount(user);
    updateNavbarAccount(user);

    if (!user) {
        window.drOrdersLoaded = false;
        if (typeof window.drStopOrdersPolling === 'function') window.drStopOrdersPolling();
        const bodyContainer = document.getElementById('drOrdersContainer');
        if (bodyContainer) bodyContainer.replaceChildren();
        return;
    }

    const preloadOrders = () => {
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
        if (typeof window.drLoadUserOrders !== 'function') { setTimeout(preloadOrders, 100); return; }
        if (window.drOrdersLoaded) return;
        window.drLoadUserOrders()
            .then(() => { if (auth.currentUser?.uid === user.uid) window.drOrdersLoaded = true; })
            .catch((error) => { console.error('Error preloading user orders:', error); });
    };
    preloadOrders();

    const startPolling = () => {
        if (auth.currentUser?.uid !== user.uid) return;
        if (typeof window.drStartOrdersPolling === 'function') { window.drStartOrdersPolling(); return; }
        setTimeout(startPolling, 100);
    };
    startPolling();

    const pendingOrder = localStorage.getItem('pendingOrder');
    const reopenModal = localStorage.getItem('reopenOrderModal');

    if (reopenModal && pendingOrder) {
        const savedScroll = parseInt(localStorage.getItem('scrollPosition') || '0');
        localStorage.removeItem('scrollPosition');
        window.scrollTo(0, savedScroll);

        const trySubmit = (attempts = 0) => {
            const savedState = JSON.parse(localStorage.getItem('wodi_configurator_state') || '{}');
            if (
                typeof window.drSubmitOrder !== 'function' ||
                typeof window.buildDesignConfig !== 'function' ||
                !savedState.designId ||
                !S?.design ||
                !S?.sinkType
            ) {
                if (attempts < 20) setTimeout(() => trySubmit(attempts + 1), 300);
                return;
            }

            window.drDesignConfig = window.buildDesignConfig();

            if (!window.drDesignConfig) {
                if (attempts < 20) setTimeout(() => trySubmit(attempts + 1), 300);
                return;
            }

            // افتح الدرج فوراً عشان العميل يعرف إن في حاجة بتحصل
            if (typeof window.drOpenOrdersDrawer === 'function') {
                window.drOpenOrdersDrawer({ showLoading: true });
            }

            // ابعت الطلب في الخلفية
            window.drSubmitOrder();
        };

        trySubmit();
    }
});

// Expose auth state listener globally
window.onAuthStateChanged = function(callback) {
  onAuthStateChanged(auth, callback);
};

// Expose current user
Object.defineProperty(window, 'currentUser', {
  get() { return auth.currentUser; }
});

// نظام إدارة الـ Logout Modal
window.initLogoutSystem = function () {
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogoutBtn = document.getElementById('cancelLogout');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModal');
    const confirmLogoutBtn = document.getElementById('confirmLogout');
    const sideNavLogoutBtn = document.getElementById('sideNavLogoutBtn');

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
        if (logoutModal) logoutModal.classList.remove('active');
    };

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
            if (event.target === logoutModal) window.closeLogoutConfirmation();
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.initLogoutSystem());
} else {
    window.initLogoutSystem();
}

setTimeout(() => {
    if (typeof window.initLogoutSystem === 'function') window.initLogoutSystem();
}, 1000);