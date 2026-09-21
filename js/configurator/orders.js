"use strict";

/*
================================================================================
Orders Drawer (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded AFTER js/configurator/utils.js, js/configurator/pricing.js and
js/configurator/whatsapp.js, and BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator.js : showToast
  - window.* at runtime: currentUser (js/auth.js), updatePageScrollLock
Subsystem state moved with these functions: drOrdersLoadPromise,
drOrdersPollingInterval. The window.drOrdersLoaded initialization remains in
js/configurator.js (it is also written by js/auth.js).
Global exposure remains in js/configurator.js:
  - window.drOpenOrdersDrawer / window.drCloseOrdersDrawer / window.drLoadUserOrders
  - window.drStartOrdersPolling / window.drStopOrdersPolling / window.drCancelOrder
================================================================================
*/

function formatOrderDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

async function drOpenOrdersDrawer(options = {}) {
  const drawer = document.getElementById('drOrdersDrawer');
  const backdrop = document.getElementById('drDrawerOverlay');
  const bodyContainer = document.getElementById('drOrdersContainer');

  const focusOrderNum = options.focusOrderNum || null;
  const showLoading = options.showLoading === true;

  if (drawer && backdrop) {

    const sidebarTab = document.querySelector('.dr-sidebar-tab');

    if (sidebarTab) {
      sidebarTab.classList.add('drawer-opening');
    }

    setTimeout(() => {

      drawer.classList.add('open');
      backdrop.classList.add('open');
      if (typeof window.updatePageScrollLock === 'function') window.updatePageScrollLock();

      if (sidebarTab) {
        sidebarTab.classList.remove('drawer-opening');
        sidebarTab.classList.add('drawer-hidden');
      }

    }, 180);
  }

  if (!window.currentUser) {
    if (bodyContainer) {
      const loginTemplate =
        document.getElementById('dr-orders-login-template');

      if (loginTemplate) {
        bodyContainer.replaceChildren(
          loginTemplate.content.cloneNode(true)
        );
      }
    }
    return;
  }

  // عند فتح الدرج بعد إرسال طلب جديد، نعرض skeleton فورًا
  if (showLoading && bodyContainer) {
    bodyContainer.innerHTML = `
      <div class="dr-orders-loading-new">
        <div class="dr-order-skeleton">
          <div class="dr-skeleton-line dr-skeleton-date"></div>
          <div class="dr-skeleton-line dr-skeleton-title"></div>
          <div class="dr-skeleton-line dr-skeleton-price"></div>

          <div class="dr-skeleton-steps">
            <div class="dr-skeleton-step"></div>
            <div class="dr-skeleton-step"></div>
            <div class="dr-skeleton-step"></div>
            <div class="dr-skeleton-step"></div>
          </div>
        </div>

        <div class="dr-orders-loading-message">
          جاري تحميل بيانات طلبك، قد يستغرق الأمر بضع ثوانٍ...
        </div>
      </div>
    `;
  }

  if (!window.drOrdersLoaded || showLoading) {
    await drLoadUserOrders();
    window.drOrdersLoaded = true;
  }

  // محاولة الوصول تلقائيًا للطلب الذي تم إرساله
  if (focusOrderNum && bodyContainer) {
    const orderCards = bodyContainer.querySelectorAll('.dr-order-card');

    orderCards.forEach(card => {
      const orderId = card.querySelector('.dr-order-id');

      if (orderId && orderId.textContent.trim() === String(focusOrderNum)) {
        requestAnimationFrame(() => {
          card.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          card.classList.add('dr-order-card-new');

          setTimeout(() => {
            card.classList.remove('dr-order-card-new');
          }, 2500);
        });
      }
    });
  }
}

// إغلاق الـ Side Drawer
function drCloseOrdersDrawer() {

  const drawer = document.getElementById('drOrdersDrawer');
  const backdrop = document.getElementById('drDrawerOverlay');
  const sidebarTab = document.querySelector('.dr-sidebar-tab');

  if (drawer) {
    drawer.classList.remove('open');
  }

  if (backdrop) {
    backdrop.classList.remove('open');
  }

  if (typeof window.updatePageScrollLock === 'function') window.updatePageScrollLock();

  setTimeout(() => {

    if (sidebarTab) {
      sidebarTab.classList.remove('drawer-hidden');
      sidebarTab.classList.add('drawer-closing');

      requestAnimationFrame(() => {
        sidebarTab.classList.remove('drawer-closing');
      });
    }

  }, 230);

}

// جلب الطلبات الخاصة بالعميل من Google Apps Script
let drOrdersLoadPromise = null;

async function fetchUserOrders(options = {}) {
  const silent = options.silent === true;
  const bodyContainer = document.getElementById('drOrdersContainer');

  if (!bodyContainer) return;

  if (!silent) {
    const loadingTemplate =
      document.getElementById('dr-orders-loading-template');

    if (loadingTemplate) {
      bodyContainer.replaceChildren(
        loadingTemplate.content.cloneNode(true)
      );
    }
  }

  try {
    const userEmail = window.currentUser
      ? window.currentUser.email
      : '';

    if (!userEmail) {
      bodyContainer.innerHTML = `
        <div class="dr-orders-empty">
          <div class="placeholder-title">تعذر تحديد البريد</div>
          <div class="placeholder-text">
            يرجى إعادة تسجيل الدخول لمتابعة طلباتك
          </div>
        </div>
      `;
      return;
    }

    const response = await fetch(
      `/api/get-config?action=getUserOrders&email=${encodeURIComponent(userEmail)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to load orders: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.orders)) {
      throw new Error('Invalid orders response');
    }
    const nextOrdersSnapshot = JSON.stringify(data.orders || []);

    if (
      silent &&
      bodyContainer.dataset.ordersSnapshot === nextOrdersSnapshot
    ) {
      return;
    }

    bodyContainer.dataset.ordersSnapshot = nextOrdersSnapshot;

    if (!data.orders || data.orders.length === 0) {
      const emptyTemplate =
        document.getElementById('dr-orders-empty-template');

      if (emptyTemplate) {
        bodyContainer.replaceChildren(
          emptyTemplate.content.cloneNode(true)
        );
      }

      return;
    }

    const eyeIcon = `
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;

    const displayOrders = [
      ...data.orders.filter(order => order.status !== 'ملغي'),
      ...data.orders.filter(order => order.status === 'ملغي')
    ];

    bodyContainer.innerHTML = displayOrders.map(order => {

      const orderTotal =
        Number(order.unitPrice || 0) +
        Number(order.installationCost || 0) +
        Number(order.installationFee || 200);

      return `
        <div class="dr-order-card">

          <div class="dr-order-card-header">
            <span class="dr-order-date">
              ${formatOrderDate(order.date)}
            </span>

            <span class="dr-order-id">
              ${order.orderNum}
            </span>
          </div>

          <div class="dr-order-details">

            <div class="dr-order-detail">
              <span class="dr-order-detail-label">
                التصميم
              </span>

              <span class="dr-order-detail-value">
                ${order.designName || 'تصميم وحدة'}
              </span>
            </div>

            <div class="dr-order-detail">
              <span class="dr-order-detail-label">
                إجمالي الطلب
              </span>

              <span class="dr-order-detail-value">
                ${orderTotal.toLocaleString('en-US')} ج.م

                ${order.locationMethod === 'يدوي'
                  ? `<span class="dr-approximate-price">(تقريبي)</span>`
                  : ''}
              </span>
            </div>

          </div>

          ${order.status === 'ملغي' ? `

            <div class="dr-order-cancelled-status">
              <div class="dr-order-cancelled-icon">×</div>
              <span>تم إلغاء الطلب</span>
            </div>

          ` : `

            <div class="dr-order-status-stepper">

              ${(() => {

                const steps = [
                  {
                    status: 'بانتظار المراجعة',
                    title: 'بانتظار المراجعة',
                    description:
                      'وصلنا طلبك بنجاح. جارٍ مراجعته وتأكيده، وسنتواصل معك عند الانتهاء.',
                    icon:
                      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>'
                  },

                  {
                    status: 'المعاينة ودفع المقدم',
                    title: 'المعاينة ودفع المقدم',
                    description:
                      'سيتم تحديد موعد المعاينة وأخذ المقاسات، ثم استكمال تأكيد الطلب ودفع المقدم.',
                    icon:
                      '<svg viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><path d="M1 10h22"></path><path d="M7 15h.01"></path><path d="M11 15h2"></path></svg>'
                  },

                  {
                    status: 'رؤية التصميم وملاحظاتك',
                    title: 'رؤية التصميم وملاحظاتك',
                    description:
                      'سنجهز لك تصورًا واقعيًا لشكل وحدتك النهائي بناءً على المقاسات واختياراتك، لتراه وتبدي ملاحظاتك وتفضيلاتك قبل بدء التصنيع.',
                    icon:
                      '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><path d="M8 10l2 2 4-4"></path></svg>'
                  },

                  {
                    status: 'قيد التنفيذ',
                    title: 'قيد التنفيذ',
                    description:
                      'بعد اعتماد التصميم، نبدأ تجهيز وتصنيع وحدتك.',
                    icon:
                      '<svg viewBox="0 0 24 24"><path d="M16 4l5 5-9 9-5-5 9-9z"></path><path d="M7 14l-4 4 1.5 1.5L8.5 15.5 7 14z"></path><path d="M14 6l1 1M12 8l1 1M10 10l1 1M8 12l1 1"></path><circle cx="5.5" cy="18.5" r="1.5"></circle></svg>'
                  },

                  {
                    status: 'جاهز للتسليم',
                    title: 'جاهز للتسليم',
                    description:
                      'وحدتك جاهزة، وسنتواصل معك لتنسيق موعد التسليم والتركيب.',
                    icon:
                      '<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>'
                  },

                  {
                    status: 'تم التسليم',
                    title: 'تم التسليم',
                    description:
                      'تم تسليم وتركيب وحدتك بنجاح.',
                    icon:
                      '<svg viewBox="0 0 24 24"><polyline points="5 12 10 17 19 7"></polyline></svg>'
                  }
                ];

                const currentIndex = steps.findIndex(
                  step => step.status === order.status
                );

                return steps.map((step, index) => {

                  const isCompleted =
                    currentIndex > index;

                  const isActive =
                    currentIndex === index;

                  return `
                    <div class="dr-status-step
                      ${isCompleted ? 'completed' : ''}
                      ${isActive ? 'active' : ''}">

                      <div class="dr-status-step-marker">
                        ${isCompleted ? '✓' : step.icon}
                      </div>

                      <div class="dr-status-step-content">

                        <div class="dr-status-step-title">
                          ${step.title}
                        </div>

                        ${isActive
                          ? `
                            <div class="dr-status-step-description">
                              ${step.description}
                            </div>
                          `
                          : ''
                        }

                      </div>

                    </div>
                  `;
                }).join('');

              })()}

            </div>

          `}

          ${order.status !== 'ملغي' ? `
          <div class="dr-order-card-actions">

            <button
              type="button"
              onclick="drViewSummary('${order.orderNum}', this)"
              class="dr-order-summary-btn"
            >
              ${eyeIcon}
              عرض الملخص
            </button>

            <button
              type="button"
              onclick="drContactOrderWhatsApp('${order.orderNum}')"
              class="dr-order-summary-btn"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.16-1.35A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.13l-.3-.18-3.06.8.82-2.98-.2-.31A8 8 0 1 1 12 20zm4.38-5.9c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.02.4 1.37.51.58.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"></path>
              </svg>

              تواصل معنا
            </button>

            <button
              type="button"
              onclick="${order.status === 'بانتظار المراجعة'
                ? `drCancelOrder('${order.orderNum}')`
                : `showToast('لا يمكن إلغاء الطلب في هذه المرحلة. تواصل معنا للمساعدة.')`}"
              class="dr-order-cancel-btn ${order.status !== 'بانتظار المراجعة' ? 'unavailable' : ''}"
            >
              إلغاء الطلب
            </button>

          </div>
          ` : ''}

        </div>
      `;

    }).join('');

  } catch (err) {

    console.error('Error loading user orders:', err);

    bodyContainer.innerHTML =
      '<div class="dr-orders-empty">تعذر جلب البيانات. حاول مرة أخرى.</div>';
  }
}

function drLoadUserOrders(options = {}) {
  if (drOrdersLoadPromise) return drOrdersLoadPromise;

  drOrdersLoadPromise = fetchUserOrders(options)
    .finally(() => {
      drOrdersLoadPromise = null;
    });

  return drOrdersLoadPromise;
}

let drOrdersPollingInterval = null;

function drStartOrdersPolling() {
    if (drOrdersPollingInterval) {
        return;
    }

    drOrdersPollingInterval = setInterval(async () => {

        if (!window.currentUser) {
            drStopOrdersPolling();
            return;
        }

        try {
            const previousOrders = document
              .getElementById('drOrdersContainer')
              ?.dataset.ordersSnapshot || '';

            await drLoadUserOrders({
              silent: true,
              previousSnapshot: previousOrders
            });

            window.drOrdersLoaded = true;
        } catch (error) {
            console.error('Error refreshing user orders:', error);
        }

    }, 30000);
}

function drStopOrdersPolling() {
    if (drOrdersPollingInterval) {
        clearInterval(drOrdersPollingInterval);
        drOrdersPollingInterval = null;
    }
}

async function drCancelOrder(orderNum) {
  if (!confirm('هل أنت متأكد من إلغاء الطلب؟')) return;
  try {
    const currentUser = window.currentUser;
    if (!currentUser) {
      showToast('يرجى تسجيل الدخول أولاً');
      return;
    }

    const idToken = await currentUser.getIdToken(true);

    const resp = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancelOrder',
        orderNum,
        idToken,
        uid: currentUser.uid,
        email: currentUser.email || ''
      })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      showToast('تم إلغاء الطلب بنجاح');
      await drLoadUserOrders();
      window.drOrdersLoaded = true;
    } else {
      showToast('تعذر إلغاء الطلب');
    }
  } catch (e) {
    showToast('حدث خطأ — حاول مرة أخرى');
  }
}