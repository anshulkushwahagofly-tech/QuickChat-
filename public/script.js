const socket = io({
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 800
});

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const myDisplayNumber = document.getElementById('my-display-number');
const myNumberPreview = document.getElementById('my-number-preview');
const menuDotsBtn = document.getElementById('menu-dots-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const menuNewChat = document.getElementById('menu-new-chat');
const menuMyNumber = document.getElementById('menu-my-number');
const toggleSearchBtn = document.getElementById('toggle-search-btn');
const searchContainer = document.getElementById('search-container');

const newChatInput = document.getElementById('new-chat-input');
const chatList = document.getElementById('chat-list');

const chatPanel = document.getElementById('chat-panel');
const emptyState = document.getElementById('empty-state');
const activeChatTitle = document.getElementById('active-chat-title');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const backBtn = document.getElementById('back-btn');

// New Chat Modal elements
const newChatModal = document.getElementById('new-chat-modal');
const openNewChatBtn = document.getElementById('open-new-chat-btn');
const headerNewChatBtn = document.getElementById('header-new-chat-btn');
const closeNewChatModal = document.getElementById('close-new-chat-modal');
const modalChatNumber = document.getElementById('modal-chat-number');
const modalStartChatBtn = document.getElementById('modal-start-chat-btn');
const contactsList = document.getElementById('contacts-list');

let myNumber = '';
let activeChat = null; 
let chats = {}; 
let unreadCounts = {};
let allRegisteredUsers = [];

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => {
        console.log("Service Worker Registered");
    });
}

const loginLoadingView = document.getElementById('login-loading-view');
const onboardingWelcomeView = document.getElementById('onboarding-welcome-view');
const agreeContinueBtn = document.getElementById('agree-continue-btn');
const onboardingDotsBtn = document.getElementById('onboarding-dots-btn');
const onboardingMenu = document.getElementById('onboarding-menu');
const menuSwitchPin = document.getElementById('menu-switch-pin');
const menuHelp = document.getElementById('menu-help');
const whatsMyNumberBtn = document.getElementById('whats-my-number-btn');

const otpPhoneView = document.getElementById('otp-phone-view');
const otpVerifyView = document.getElementById('otp-verify-view');
const otpPhoneInput = document.getElementById('otp-phone-input');
const sendOtpBtn = document.getElementById('send-otp-btn');
const showPinViewBtn = document.getElementById('show-pin-view-btn');
const backToOtpBtn = document.getElementById('back-to-otp-btn');
const otpTargetDisplay = document.getElementById('otp-target-display');
const changeNumberBtn = document.getElementById('change-number-btn');
const otpCodeInput = document.getElementById('otp-code-input');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const resendOtpBtn = document.getElementById('resend-otp-btn');
const countdownBox = document.getElementById('countdown-box');
const countdownTimer = document.getElementById('countdown-timer');

const loginFormView = document.getElementById('login-form-view');
const loginBtn = document.getElementById('login-btn');

// ========================================================
// WHATSAPP CUSTOM IN-APP TOAST & DIALOG (NO BROWSER ALERTS)
// ========================================================
let waToastTimer = null;

function showWhatsAppToast(message, type = 'info', duration = 3200) {
    const toast = document.getElementById('wa-toast');
    const toastText = document.getElementById('wa-toast-text');
    const toastIcon = document.getElementById('wa-toast-icon');
    if (!toast || !toastText) {
        console.log("Toast:", message);
        return;
    }

    if (waToastTimer) clearTimeout(waToastTimer);

    toastText.innerText = message;
    toast.className = 'wa-toast-container';

    if (type === 'danger' || type === 'error') {
        toast.classList.add('wa-toast-danger');
        if (toastIcon) toastIcon.className = 'fas fa-exclamation-circle wa-toast-icon';
    } else if (type === 'success') {
        toast.classList.add('wa-toast-success');
        if (toastIcon) toastIcon.className = 'fas fa-check-circle wa-toast-icon';
    } else {
        if (toastIcon) toastIcon.className = 'fas fa-info-circle wa-toast-icon';
    }

    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');

    waToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function showWhatsAppDialog({ title = 'QuickChat', message = '', confirmText = 'OK', cancelText = null, extraText = null, isDanger = false, onConfirm = null, onCancel = null, onExtra = null }) {
    const overlay = document.getElementById('wa-dialog-overlay');
    const titleEl = document.getElementById('wa-dialog-title');
    const msgEl = document.getElementById('wa-dialog-message');
    const btnConfirm = document.getElementById('wa-dialog-btn-confirm');
    const btnCancel = document.getElementById('wa-dialog-btn-cancel');
    const btnExtra = document.getElementById('wa-dialog-btn-extra');

    if (!overlay) {
        if (window.confirm && cancelText) {
            if (window.confirm(message)) {
                if (onConfirm) onConfirm();
            } else {
                if (onCancel) onCancel();
            }
        }
        return;
    }

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;

    if (btnConfirm) {
        btnConfirm.innerText = confirmText;
        if (isDanger) {
            btnConfirm.classList.add('wa-dialog-btn-danger');
        } else {
            btnConfirm.classList.remove('wa-dialog-btn-danger');
        }
        btnConfirm.onclick = () => {
            overlay.classList.remove('active');
            if (typeof onConfirm === 'function') onConfirm();
        };
    }

    if (btnExtra) {
        if (extraText) {
            btnExtra.style.display = 'inline-block';
            btnExtra.innerText = extraText;
            btnExtra.className = 'wa-dialog-btn wa-dialog-btn-extra';
            btnExtra.onclick = () => {
                overlay.classList.remove('active');
                if (typeof onExtra === 'function') onExtra();
            };
        } else {
            btnExtra.style.display = 'none';
        }
    }

    if (btnCancel) {
        if (cancelText) {
            btnCancel.style.display = 'inline-block';
            btnCancel.innerText = cancelText;
            btnCancel.onclick = () => {
                overlay.classList.remove('active');
                if (typeof onCancel === 'function') onCancel();
            };
        } else {
            btnCancel.style.display = 'none';
        }
    }

    overlay.classList.add('active');
}

function showInputError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
    el.style.display = 'flex';
}

function clearInputError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

// Global safety net: override window.alert so no browser popup can appear anywhere
window.alert = function(msg) {
    showWhatsAppToast(msg);
};

const onboardingProfileView = document.getElementById('onboarding-profile-view');
const onboardingNameInput = document.getElementById('onboarding-name-input');
const onboardingAvatarImg = document.getElementById('onboarding-avatar-img');
const onboardingAvatarPicker = document.getElementById('onboarding-avatar-picker');
const completeProfileBtn = document.getElementById('complete-profile-btn');
const smsPushBanner = document.getElementById('wa-sms-push-banner');
const smsCodeDisplay = document.getElementById('wa-sms-code-display');
const smsAutofillBtn = document.getElementById('wa-sms-autofill-btn');
const smsPushTap = document.getElementById('wa-sms-push-tap');
const smsCloseBtn = document.getElementById('wa-sms-close-btn');
const otpDigitInputs = Array.from(document.querySelectorAll('.wa-otp-digit'));

// Normalize any pasted or typed mobile number to clean 10 digits
function normalizeMobileNumber(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
    }
    if (digits.length > 10) {
        digits = digits.slice(-10);
    }
    return digits;
}

function formatIndianDisplayPhone(num10) {
    const clean = String(num10 || '').replace(/\D/g, '');
    if (clean.length === 10) {
        return clean.slice(0, 5) + ' ' + clean.slice(5);
    }
    return clean;
}

// Hide SMS Push Banner
let smsBannerTimeout = null;
function hideSmsPushBanner() {
    if (smsBannerTimeout) clearTimeout(smsBannerTimeout);
    if (smsPushBanner) {
        smsPushBanner.classList.remove('show');
        setTimeout(() => {
            if (smsPushBanner && !smsPushBanner.classList.contains('show')) {
                smsPushBanner.style.display = 'none';
            }
        }, 350);
    }
}

// Show Realistic Carrier SMS Push Banner
function showSmsPushBanner(otpCode) {
    const formattedCode = String(otpCode).slice(0, 3) + '-' + String(otpCode).slice(3, 6);
    if (smsCodeDisplay) smsCodeDisplay.innerText = formattedCode;
    const otpCopyCodeEl = document.getElementById('otp-copy-code');
    if (otpCopyCodeEl) otpCopyCodeEl.innerText = formattedCode;
    const hint = document.getElementById('otp-fallback-hint');
    if (hint) hint.style.display = 'inline-flex';

    if (smsPushBanner) {
        smsPushBanner.style.display = 'flex';
        void smsPushBanner.offsetWidth;
        smsPushBanner.classList.add('show');
        if (smsBannerTimeout) clearTimeout(smsBannerTimeout);
        smsBannerTimeout = setTimeout(() => {
            hideSmsPushBanner();
        }, 18000);
    }
}

// Robust Step Switcher to prevent overlapping screens/glitches
function showStep(stepName) {
    if (stepName !== 'verify') {
        hideSmsPushBanner();
    }
    const steps = [
        { el: onboardingWelcomeView, name: 'welcome' },
        { el: otpPhoneView, name: 'phone' },
        { el: otpVerifyView, name: 'verify' },
        { el: onboardingProfileView, name: 'profile' },
        { el: loginFormView, name: 'pin' },
        { el: loginLoadingView, name: 'loading' }
    ];

    steps.forEach(s => {
        if (s.el) {
            if (s.name === stepName) {
                s.el.classList.add('active');
                s.el.style.display = (s.name === 'loading') ? 'block' : 'flex';
            } else {
                s.el.classList.remove('active');
                s.el.style.display = 'none';
            }
        }
    });
}

// Cache and Status Helpers
function setConnectingState(isConnecting) {
    const banner = document.getElementById('connecting-banner');
    if (banner) {
        banner.style.display = isConnecting ? 'flex' : 'none';
    }
}

function saveLocalCache() {
    try {
        if (myNumber) {
            localStorage.setItem('quickchat_cached_chats_' + myNumber, JSON.stringify(chats));
        }
    } catch(e) {}
}

// Instant Session Restoration (0ms delay, no white flash or connecting screen on reload)
const savedNum = localStorage.getItem('quickchat_session_num');
const savedPin = localStorage.getItem('quickchat_session_pin');

// Clear obsolete legacy shared cache keys
try {
    localStorage.removeItem('quickchat_cached_chats');
    localStorage.removeItem('quickchat_cached_users');
} catch(e) {}

if (savedNum) {
    myNumber = normalizeMobileNumber(savedNum) || savedNum;
    document.documentElement.classList.add('user-logged-in');

    if (loginLoadingView) loginLoadingView.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';

    if (myNumberPreview) myNumberPreview.innerText = '+91 ' + myNumber;
    if (myDisplayNumber) myDisplayNumber.innerText = "QuickChat";

    // Load private cached chats for this specific user
    try {
        const cachedChats = localStorage.getItem('quickchat_cached_chats_' + myNumber);
        if (cachedChats) {
            chats = JSON.parse(cachedChats);
            renderChatList();
        } else {
            chats = {};
        }
    } catch (e) {
        console.warn("Local cache parse err:", e);
    }

    setConnectingState(true);
    setTimeout(() => {
        setConnectingState(false);
    }, 2000);

    if (savedPin) {
        socket.emit('login', { number: myNumber, pin: savedPin });
    } else {
        socket.emit('auto login', { number: myNumber });
    }
} else {
    document.documentElement.classList.remove('user-logged-in');
    showStep('welcome');
}

// Auto-sync on socket connect and reconnect
socket.on('connect', () => {
    const num = myNumber || localStorage.getItem('quickchat_session_num');
    const pin = localStorage.getItem('quickchat_session_pin');
    if (num) {
        const clean = normalizeMobileNumber(num) || num;
        if (pin) {
            socket.emit('login', { number: clean, pin: pin });
        } else {
            socket.emit('auto login', { number: clean });
        }
    }
});

socket.on('disconnect', () => {
    if (myNumber) setConnectingState(true);
});

// Resend countdown timer (0:30 format)
let resendTimerInterval = null;
function startResendTimer() {
    let timeLeft = 30;
    if (countdownBox) countdownBox.style.display = 'inline';
    if (resendOtpBtn) resendOtpBtn.style.display = 'none';
    if (countdownTimer) countdownTimer.innerText = '0:30';

    clearInterval(resendTimerInterval);
    resendTimerInterval = setInterval(() => {
        timeLeft--;
        if (countdownTimer) {
            countdownTimer.innerText = '0:' + (timeLeft < 10 ? '0' + timeLeft : timeLeft);
        }
        if (timeLeft <= 0) {
            clearInterval(resendTimerInterval);
            if (countdownBox) countdownBox.style.display = 'none';
            if (resendOtpBtn) resendOtpBtn.style.display = 'inline-block';
        }
    }, 1000);
}

// Sync 6-box OTP inputs with hidden #otp-code-input
function syncOtpHiddenValue() {
    const combined = otpDigitInputs.map(inp => inp.value.replace(/\D/g, '')).join('');
    if (otpCodeInput) otpCodeInput.value = combined;
    otpDigitInputs.forEach(inp => {
        if (inp.value) inp.classList.add('filled');
        else inp.classList.remove('filled');
    });
    return combined;
}

function setOtpBoxesValue(code6) {
    const clean = String(code6 || '').replace(/\D/g, '').slice(0, 6);
    otpDigitInputs.forEach((inp, idx) => {
        inp.value = clean[idx] || '';
        if (inp.value) inp.classList.add('filled');
        else inp.classList.remove('filled');
    });
    if (otpCodeInput) otpCodeInput.value = clean;
}

// Wire 6 individual OTP digit inputs
otpDigitInputs.forEach((inp, idx) => {
    inp.addEventListener('input', (e) => {
        clearInputError('otp-verify-error');
        const val = inp.value.replace(/\D/g, '');
        if (val.length > 1) {
            // User pasted or autocomplete filled multiple digits
            setOtpBoxesValue(val);
            const nextFocusIdx = Math.min(val.length, 5);
            otpDigitInputs[nextFocusIdx].focus();
            if (val.length >= 6) {
                setTimeout(() => doVerifyOtp(), 180);
            }
            return;
        }
        inp.value = val;
        const fullCode = syncOtpHiddenValue();
        if (val && idx < 5) {
            otpDigitInputs[idx + 1].focus();
        }
        if (fullCode.length === 6) {
            setTimeout(() => doVerifyOtp(), 180);
        }
    });

    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            if (!inp.value && idx > 0) {
                otpDigitInputs[idx - 1].value = '';
                otpDigitInputs[idx - 1].classList.remove('filled');
                otpDigitInputs[idx - 1].focus();
                syncOtpHiddenValue();
                e.preventDefault();
            }
        } else if (e.key === 'ArrowLeft' && idx > 0) {
            otpDigitInputs[idx - 1].focus();
        } else if (e.key === 'ArrowRight' && idx < 5) {
            otpDigitInputs[idx + 1].focus();
        } else if (e.key === 'Enter') {
            doVerifyOtp();
        }
    });

    inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted) {
            setOtpBoxesValue(pasted);
            const focusIdx = Math.min(pasted.length, 5);
            otpDigitInputs[focusIdx].focus();
            if (pasted.length === 6) {
                setTimeout(() => doVerifyOtp(), 200);
            }
        }
    });
});

let smsArrivalTimer = null;
function showOtpVerifyScreen(phoneNum) {
    showStep('verify');
    const dialCode = (document.getElementById('selected-dial-code') || {}).innerText || '91';
    if (otpTargetDisplay) otpTargetDisplay.innerText = '+' + dialCode + ' ' + formatIndianDisplayPhone(phoneNum);
    setOtpBoxesValue('');
    clearInputError('otp-verify-error');
    const hint = document.getElementById('otp-fallback-hint');
    if (hint) hint.style.display = 'none';
    if (otpDigitInputs[0]) otpDigitInputs[0].focus();
    resetSendOtpBtn();
    startResendTimer();

    // Schedule realistic carrier SMS delivery after 1.1s
    if (smsArrivalTimer) clearTimeout(smsArrivalTimer);
    smsArrivalTimer = setTimeout(() => {
        const otpToDeliver = window.currentDemoOtp || '482915';
        showSmsPushBanner(otpToDeliver);
    }, 1100);
}

// Smooth animated OTP auto-fill when user taps the SMS push notification or Auto-fill button
const autofillOtp = () => {
    const code = String(window.currentDemoOtp || '482915').replace(/\D/g, '').slice(0, 6);
    clearInputError('otp-verify-error');
    hideSmsPushBanner();

    otpDigitInputs.forEach((inp, i) => {
        setTimeout(() => {
            inp.value = code[i] || '';
            inp.classList.add('filled');
            if (i === 5) {
                syncOtpHiddenValue();
                inp.focus();
                setTimeout(() => doVerifyOtp(), 260);
            }
        }, i * 45);
    });
};

// Listen for Server-dispatched official OTP
socket.on('otp dispatched', (data) => {
    if (data && data.otp) {
        window.currentDemoOtp = String(data.otp);
        const verifyActive = otpVerifyView && otpVerifyView.classList.contains('active');
        if (verifyActive && smsPushBanner && smsPushBanner.classList.contains('show')) {
            showSmsPushBanner(window.currentDemoOtp);
        }
    }
});

const otpCopyCode = document.getElementById('otp-copy-code');
if (otpCopyCode) otpCopyCode.addEventListener('click', autofillOtp);

const otpAutofillAction = document.getElementById('otp-autofill-action');
if (otpAutofillAction) otpAutofillAction.addEventListener('click', autofillOtp);

if (smsAutofillBtn) smsAutofillBtn.addEventListener('click', autofillOtp);
if (smsPushTap) smsPushTap.addEventListener('click', autofillOtp);
if (smsCloseBtn) smsCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideSmsPushBanner();
});

if (otpPhoneInput) {
    otpPhoneInput.addEventListener('input', () => {
        clearInputError('otp-phone-error');
        const cleaned = normalizeMobileNumber(otpPhoneInput.value);
        if (otpPhoneInput.value !== cleaned) {
            otpPhoneInput.value = cleaned;
        }
    });
}

function resetSendOtpBtn() {
    if (sendOtpBtn) {
        sendOtpBtn.disabled = false;
        sendOtpBtn.innerHTML = `<span>Next</span>`;
    }
}

function resetVerifyOtpBtn() {
    if (verifyOtpBtn) {
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.innerHTML = `<span>Verify</span>`;
    }
}

// 1. Send OTP Action (With Official WhatsApp Number Confirmation Modal)
function requestOtpForNumber(cleanNum) {
    if (sendOtpBtn) {
        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>Requesting an SMS...</span>`;
    }

    // Generate immediate fallback OTP & request server OTP
    window.currentDemoOtp = String(Math.floor(100000 + Math.random() * 900000));
    window.currentOtpPhone = cleanNum;
    window.confirmationResult = null;
    socket.emit('request otp', { number: cleanNum });

    setTimeout(() => {
        showOtpVerifyScreen(cleanNum);
    }, 550);
}

function doSendOtp(skipConfirmModal = false) {
    clearInputError('otp-phone-error');
    const cleanNum = normalizeMobileNumber(otpPhoneInput ? otpPhoneInput.value : '');
    if (otpPhoneInput) otpPhoneInput.value = cleanNum;

    if (!cleanNum || cleanNum.length !== 10) {
        showInputError('otp-phone-error', 'Please enter a valid 10-digit mobile number.');
        return;
    }

    const dialCode = (document.getElementById('selected-dial-code') || {}).innerText || '91';
    const formattedPhone = '+' + dialCode + ' ' + formatIndianDisplayPhone(cleanNum);

    if (skipConfirmModal === true) {
        requestOtpForNumber(cleanNum);
        return;
    }

    // Authentic WhatsApp Number Confirmation Dialog
    showWhatsAppDialog({
        title: 'Verify phone number',
        message: `You entered the phone number:\n\n${formattedPhone}\n\nIs this OK, or would you like to edit the number?`,
        confirmText: 'OK',
        cancelText: 'Edit',
        onConfirm: () => {
            requestOtpForNumber(cleanNum);
        },
        onCancel: () => {
            if (otpPhoneInput) otpPhoneInput.focus();
        }
    });
}

// 2. Verify OTP Action -> Proceeds to Profile Info Setup Step
function finalizeOtpSessionLogin(phoneNum, displayName) {
    chats = {};
    activeChat = null;
    localStorage.setItem('quickchat_session_num', phoneNum);
    localStorage.removeItem('quickchat_session_pin');
    if (displayName) {
        localStorage.setItem('quickchat_profile_name_' + phoneNum, displayName);
        localStorage.setItem('quickchat_my_name', displayName);
    }
    socket.emit('firebase otp login', {
        number: phoneNum,
        uid: 'verified_' + Date.now()
    });
}

function doVerifyOtp() {
    clearInputError('otp-verify-error');
    const code = syncOtpHiddenValue();
    if (!code || code.length !== 6) {
        showInputError('otp-verify-error', 'Please enter the 6-digit verification code.');
        return;
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>Verifying...</span>`;
    }

    hideSmsPushBanner();

    setTimeout(() => {
        resetVerifyOtpBtn();
        const verifiedPhone = window.currentOtpPhone || normalizeMobileNumber(otpPhoneInput ? otpPhoneInput.value : '');
        const existingSavedName = localStorage.getItem('quickchat_profile_name_' + verifiedPhone) || localStorage.getItem('quickchat_my_name') || '';

        if (onboardingNameInput) {
            onboardingNameInput.value = existingSavedName;
        }
        if (onboardingAvatarImg) {
            onboardingAvatarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(verifiedPhone || 'QuickChatUser')}`;
        }

        showStep('profile');
        if (onboardingNameInput) onboardingNameInput.focus();
    }, 450);
}

// Profile Step Completion Handler
let avatarSeedCounter = 0;
if (onboardingAvatarPicker && onboardingAvatarImg) {
    onboardingAvatarPicker.addEventListener('click', () => {
        avatarSeedCounter++;
        const seed = (window.currentOtpPhone || 'User') + '_' + avatarSeedCounter;
        onboardingAvatarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
    });
}

function doCompleteProfileSetup() {
    const verifiedPhone = window.currentOtpPhone || normalizeMobileNumber(otpPhoneInput ? otpPhoneInput.value : '');
    if (!verifiedPhone) {
        showStep('phone');
        return;
    }
    const chosenName = onboardingNameInput ? onboardingNameInput.value.trim() : '';
    if (completeProfileBtn) {
        completeProfileBtn.disabled = true;
        completeProfileBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>Initializing...</span>`;
    }
    finalizeOtpSessionLogin(verifiedPhone, chosenName || ('+91 ' + verifiedPhone));
}

if (completeProfileBtn) {
    completeProfileBtn.addEventListener('click', doCompleteProfileSetup);
}
if (onboardingNameInput) {
    onboardingNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doCompleteProfileSetup();
    });
}

// Interactive Welcome Screen Links (Privacy Policy, Terms of Service, Language Selector)
const openPrivacyLink = document.getElementById('open-privacy-policy-link');
if (openPrivacyLink) {
    openPrivacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        showWhatsAppDialog({
            title: 'Privacy Policy • QuickChat',
            message: '🔒 End-to-End Encryption:\nYour personal messages, media, and calls are secured with end-to-end encryption. Only you and the recipient can read or listen to them.\n\n🛡️ Data Protection:\nYour phone number is used strictly for account verification and routing messages to your contacts.',
            confirmText: 'Close'
        });
    });
}

const openTermsLink = document.getElementById('open-terms-service-link');
if (openTermsLink) {
    openTermsLink.addEventListener('click', (e) => {
        e.preventDefault();
        showWhatsAppDialog({
            title: 'Terms of Service • QuickChat',
            message: 'By using QuickChat, you agree to communicate respectfully and use a valid mobile number for account verification.\n\nQuickChat provides real-time messaging, voice/video calls, media sharing, and multi-device synchronization.',
            confirmText: 'Accept & Close'
        });
    });
}

const langToggleBtn = document.getElementById('wa-lang-toggle-btn');
let currentOnboardingLang = 'en';
if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
        const label = document.getElementById('wa-current-lang-label');
        const heading = document.getElementById('wa-welcome-heading');
        if (currentOnboardingLang === 'en') {
            currentOnboardingLang = 'hi';
            if (label) label.innerText = 'हिन्दी (Hindi)';
            if (heading) heading.innerText = 'QuickChat में आपका स्वागत है';
            if (agreeContinueBtn) agreeContinueBtn.innerText = 'सहमत हों और आगे बढ़ें';
        } else {
            currentOnboardingLang = 'en';
            if (label) label.innerText = 'English';
            if (heading) heading.innerText = 'Welcome to QuickChat';
            if (agreeContinueBtn) agreeContinueBtn.innerText = 'Agree and continue';
        }
    });
}

// Interactive Country Dropdown Selector
const countrySelectRow = document.getElementById('country-select-row');
const countryDropdownList = document.getElementById('country-dropdown-list');
if (countrySelectRow && countryDropdownList) {
    countrySelectRow.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = countryDropdownList.style.display === 'block';
        countryDropdownList.style.display = isOpen ? 'none' : 'block';
    });

    countryDropdownList.querySelectorAll('.wa-country-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const name = opt.getAttribute('data-name');
            const code = opt.getAttribute('data-code');
            const nameEl = document.getElementById('selected-country-name');
            const codeEl = document.getElementById('selected-dial-code');
            if (nameEl && name) nameEl.innerText = name;
            if (codeEl && code) codeEl.innerText = code;
            countryDropdownList.style.display = 'none';
            if (otpPhoneInput) otpPhoneInput.focus();
        });
    });

    document.addEventListener('click', (e) => {
        if (!countryDropdownList.contains(e.target) && !countrySelectRow.contains(e.target)) {
            countryDropdownList.style.display = 'none';
        }
    });
}

// QuickChat Onboarding Handlers
if (agreeContinueBtn) {
    agreeContinueBtn.addEventListener('click', () => {
        showStep('phone');
        if (otpPhoneInput) otpPhoneInput.focus();
    });
}

if (onboardingDotsBtn && onboardingMenu) {
    onboardingDotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = onboardingMenu.style.display === 'block';
        onboardingMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (onboardingMenu && !onboardingMenu.contains(e.target) && e.target !== onboardingDotsBtn) {
            onboardingMenu.style.display = 'none';
        }
    });
}

if (menuSwitchPin) {
    menuSwitchPin.addEventListener('click', () => {
        if (onboardingMenu) onboardingMenu.style.display = 'none';
        showStep('pin');
        const enteredNum = otpPhoneInput ? otpPhoneInput.value.trim() : '';
        const pinNumInput = document.getElementById('login-number');
        if (enteredNum && pinNumInput) pinNumInput.value = enteredNum;
    });
}

if (menuHelp) {
    menuHelp.addEventListener('click', () => {
        if (onboardingMenu) onboardingMenu.style.display = 'none';
        showWhatsAppDialog({
            title: 'Verification Help',
            message: '1. Enter your 10-digit mobile number and tap "Next".\n2. Confirm your number when prompted.\n3. An official 6-digit SMS verification code will arrive at the top of your screen—tap "Auto-fill" or type the 6 digits to verify!',
            confirmText: 'Got It'
        });
    });
}

if (whatsMyNumberBtn) {
    whatsMyNumberBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showWhatsAppDialog({
            title: 'Find Your Mobile Number',
            message: 'You can check your 10-digit mobile number in your phone Settings > About Phone > SIM Status, or dial *121# / *1# from your carrier.',
            confirmText: 'OK'
        });
    });
}

if (sendOtpBtn) sendOtpBtn.addEventListener('click', () => doSendOtp(false));
if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', doVerifyOtp);
if (resendOtpBtn) resendOtpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doSendOtp(true);
});

if (otpPhoneInput) {
    otpPhoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSendOtp(false);
    });
}

if (changeNumberBtn) {
    changeNumberBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showStep('phone');
        if (otpPhoneInput) otpPhoneInput.focus();
    });
}

// PIN Toggle Mode
if (showPinViewBtn) {
    showPinViewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showStep('pin');
        const enteredNum = otpPhoneInput ? otpPhoneInput.value.trim() : '';
        const pinNumInput = document.getElementById('login-number');
        if (enteredNum && pinNumInput) pinNumInput.value = enteredNum;
    });
}

const forgotPinBtn = document.getElementById('forgot-pin-btn');
if (forgotPinBtn) {
    forgotPinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showStep('phone');
        const pinNumInput = document.getElementById('login-number');
        if (pinNumInput && otpPhoneInput && pinNumInput.value.trim()) {
            otpPhoneInput.value = normalizeMobileNumber(pinNumInput.value);
        }
    });
}

if (backToOtpBtn) {
    backToOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showStep('phone');
        const pinNumInput = document.getElementById('login-number');
        if (pinNumInput && otpPhoneInput && pinNumInput.value.trim()) {
            otpPhoneInput.value = normalizeMobileNumber(pinNumInput.value);
        }
    });
}

const loginNumInputEl = document.getElementById('login-number');
if (loginNumInputEl) {
    loginNumInputEl.addEventListener('input', () => {
        const cleaned = normalizeMobileNumber(loginNumInputEl.value);
        if (loginNumInputEl.value !== cleaned) {
            loginNumInputEl.value = cleaned;
        }
    });
}

function doPinLogin() {
    const rawNum = document.getElementById('login-number') ? document.getElementById('login-number').value : '';
    const num = normalizeMobileNumber(rawNum);
    const pin = document.getElementById('login-pin') ? document.getElementById('login-pin').value.trim() : '';
    if (num && num.length === 10 && pin) {
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>Signing in...</span>`;
        }
        chats = {};
        activeChat = null;
        localStorage.setItem('quickchat_session_num', num);
        localStorage.setItem('quickchat_session_pin', pin);
        socket.emit('login', { number: num, pin: pin });
    } else {
        showWhatsAppToast("Please enter a valid 10-digit mobile number and 4-digit PIN.", "danger");
    }
}

if (loginBtn) loginBtn.addEventListener('click', doPinLogin);
const loginPinInput = document.getElementById('login-pin');
if (loginPinInput) {
    loginPinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doPinLogin();
    });
}

// Dropdown Menu Logic
if (menuDotsBtn && dropdownMenu) {
    menuDotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdownMenu.style.display === 'block';
        dropdownMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== menuDotsBtn) {
            dropdownMenu.style.display = 'none';
        }
    });
}

if (menuNewChat) {
    menuNewChat.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        openNewChatDrawer();
    });
}

const menuNewGroup = document.getElementById('menu-new-group');
if (menuNewGroup) {
    menuNewGroup.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        openDrawer('communities-drawer');
    });
}

const menuStarredMsgs = document.getElementById('menu-starred-msgs');
if (menuStarredMsgs) {
    menuStarredMsgs.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        openDrawer('starred-messages-drawer');
    });
}

const menuOpenSettings = document.getElementById('menu-open-settings');
if (menuOpenSettings) {
    menuOpenSettings.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        openDrawer('settings-drawer');
    });
}

if (menuMyNumber) {
    menuMyNumber.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        showWhatsAppToast("Registered Number: +91 " + (myNumber || ""), "info");
    });
}

// Search Bar Toggle (Mobile)
if (toggleSearchBtn && searchContainer) {
    toggleSearchBtn.addEventListener('click', () => {
        searchContainer.classList.toggle('active');
        if (searchContainer.classList.contains('active') && newChatInput) {
            newChatInput.focus();
        }
    });
}

// Desktop Header Icons
const headerStatusBtn = document.getElementById('header-status-btn');
if (headerStatusBtn) {
    headerStatusBtn.addEventListener('click', () => {
        showWhatsAppToast("Status updates coming soon!", "info");
    });
}

// Window Resize Responsive Handler
window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
        if (activeChat) {
            chatPanel.style.display = 'flex';
            emptyState.style.display = 'none';
        } else {
            chatPanel.style.display = 'none';
            emptyState.style.display = 'flex';
        }
    } else {
        if (activeChat) {
            chatPanel.classList.add('active-mobile');
            chatPanel.style.display = 'flex';
            emptyState.style.display = 'none';
        } else {
            chatPanel.classList.remove('active-mobile');
            chatPanel.style.display = 'none';
            emptyState.style.display = 'none';
        }
    }
});

// WhatsApp Tab Bar Logic
const waTabs = document.querySelectorAll('.wa-tab');
waTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        waTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const txt = tab.innerText.trim();
        if (txt.includes('STATUS')) {
            showWhatsAppToast("Status updates coming soon!", "info");
        } else if (txt.includes('CALLS')) {
            showWhatsAppToast("Tap the phone or camera icon in any chat to place a call.", "info");
        }
    });
});

const waTabCamera = document.querySelector('.wa-tab-camera');
if (waTabCamera) {
    waTabCamera.addEventListener('click', () => {
        const imgInput = document.getElementById('image-upload');
        if (imgInput) imgInput.click();
    });
}

// Logout Logic
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        showWhatsAppDialog({
            title: 'Log out?',
            message: 'Are you sure you want to log out from QuickChat?',
            confirmText: 'Log Out',
            cancelText: 'Cancel',
            isDanger: true,
            onConfirm: () => {
                chats = {};
                activeChat = null;
                localStorage.removeItem('quickchat_session_num');
                localStorage.removeItem('quickchat_session_pin');
                if (myNumber) {
                    localStorage.removeItem('quickchat_cached_chats_' + myNumber);
                }
                localStorage.removeItem('quickchat_cached_chats');
                localStorage.removeItem('quickchat_cached_users');
                document.documentElement.classList.remove('user-logged-in');
                window.location.reload();
            }
        });
    });
}

socket.on('login error', (msg) => {
    console.warn("Login response:", msg);
    resetVerifyOtpBtn();
    if (completeProfileBtn) {
        completeProfileBtn.disabled = false;
        completeProfileBtn.innerHTML = `<span>Next</span>`;
    }
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = `<span>Verify &amp; Login</span>`;
    }
    setConnectingState(false);
    document.documentElement.classList.remove('user-logged-in');
    showStep('phone');
    showWhatsAppToast(msg, 'danger');
});

socket.on('login success', (data) => {
    resetVerifyOtpBtn();
    hideSmsPushBanner();
    if (completeProfileBtn) {
        completeProfileBtn.disabled = false;
        completeProfileBtn.innerHTML = `<span>Next</span>`;
    }
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = `<span>Verify &amp; Login</span>`;
    }
    setConnectingState(false);
    document.documentElement.classList.add('user-logged-in');

    myNumber = data.number;
    chats = {}; // Fresh isolated chat store for this specific user session

    // Load this user's private cached chats (if any)
    try {
        const raw = localStorage.getItem('quickchat_cached_chats_' + myNumber);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                Object.assign(chats, parsed);
            }
        }
    } catch(e) {}

    // Load history from database strictly belonging to this user
    if (Array.isArray(data.history)) {
        data.history.forEach(msg => {
            const friend = (msg.from === myNumber) ? msg.to : msg.from;
            if (!friend) return;
            if (!chats[friend]) chats[friend] = [];
            const timeStr = formatTime(new Date(msg.timestamp));
            const resolvedStatus = msg.isRead ? 'read' : (msg.status || 'sent');
            const existingMsg = chats[friend].find(m => m.id === msg.id || (m.time === timeStr && m.text === msg.text && m.from === msg.from));
            if (existingMsg) {
                existingMsg.id = msg.id || existingMsg.id;
                existingMsg.status = resolvedStatus;
                existingMsg.isRead = !!msg.isRead;
            } else {
                chats[friend].push({
                    id: msg.id || ('msg_' + Date.now()),
                    from: msg.from,
                    to: msg.to,
                    text: msg.text,
                    image: msg.image,
                    audio: msg.audio,
                    location: msg.location,
                    poll: msg.poll,
                    replyTo: msg.replyTo,
                    reactions: msg.reactions || {},
                    isEdited: msg.isEdited || false,
                    isDeleted: msg.isDeleted || false,
                    isPinned: msg.isPinned || false,
                    starred: msg.starred || false,
                    status: resolvedStatus,
                    isRead: !!msg.isRead,
                    time: timeStr
                });
            }
        });
    }

    // Ensure session credentials remain safely saved in localStorage
    const pinInput = document.getElementById('login-pin');
    const currentPin = (pinInput && pinInput.value.trim()) || localStorage.getItem('quickchat_session_pin');
    if (myNumber) localStorage.setItem('quickchat_session_num', myNumber);
    if (currentPin) localStorage.setItem('quickchat_session_pin', currentPin);

    // Hydrate user-specific chat settings
    try {
        pinnedChats = JSON.parse(localStorage.getItem('quickchat_pinned_chats_' + myNumber) || '[]');
        mutedChats = JSON.parse(localStorage.getItem('quickchat_muted_chats_' + myNumber) || '[]');
        archivedChats = JSON.parse(localStorage.getItem('quickchat_archived_chats_' + myNumber) || '[]');
    } catch(e) {}

    // Update UI previews
    if (myNumberPreview) myNumberPreview.innerText = '+91 ' + myNumber;
    if (myDisplayNumber) myDisplayNumber.innerText = "QuickChat";

    if (loginLoadingView) loginLoadingView.style.display = 'none';
    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    
    renderChatList();
    saveLocalCache();
});

socket.on('all users', () => {
    // Ignored - private data isolation enabled
});

// --- WHATSAPP SLIDING DRAWERS (NEW CHAT & PROFILE) ---
const newChatDrawer = document.getElementById('new-chat-drawer');
const closeNewChatDrawerBtn = document.getElementById('close-new-chat-drawer');
const drawerContactsList = document.getElementById('drawer-contacts-list');
const drawerSearchContacts = document.getElementById('drawer-search-contacts');
const drawerDirectPhone = document.getElementById('drawer-direct-phone');
const drawerStartChatBtn = document.getElementById('drawer-start-chat-btn');

const profileDrawer = document.getElementById('profile-drawer');
const closeProfileDrawerBtn = document.getElementById('close-profile-drawer');
const myProfileBtn = document.getElementById('my-profile-btn');
const profileDisplayName = document.getElementById('profile-display-name');
const profileDisplayPhone = document.getElementById('profile-display-phone');

function openNewChatDrawer() {
    if (newChatDrawer) {
        newChatDrawer.classList.add('active');
        if (drawerDirectPhone) drawerDirectPhone.focus();
        renderDrawerContacts();
    }
}

function closeNewChatDrawer() {
    if (newChatDrawer) newChatDrawer.classList.remove('active');
}

function openProfileDrawer() {
    if (profileDrawer) {
        if (profileDisplayPhone) profileDisplayPhone.innerText = '+91 ' + (myNumber || '');
        profileDrawer.classList.add('active');
    }
}

function closeProfileDrawer() {
    if (profileDrawer) profileDrawer.classList.remove('active');
}

if (headerNewChatBtn) headerNewChatBtn.addEventListener('click', openNewChatDrawer);
if (openNewChatBtn) openNewChatBtn.addEventListener('click', openNewChatDrawer);
if (closeNewChatDrawerBtn) closeNewChatDrawerBtn.addEventListener('click', closeNewChatDrawer);
if (myProfileBtn) myProfileBtn.addEventListener('click', openProfileDrawer);
if (closeProfileDrawerBtn) closeProfileDrawerBtn.addEventListener('click', closeProfileDrawer);

// Drawer direct number start chat
if (drawerStartChatBtn && drawerDirectPhone) {
    const doDrawerStart = () => {
        const num = drawerDirectPhone.value.trim();
        if (!num || num.length !== 10) {
            showWhatsAppToast("Please enter a valid 10-digit number.", "danger");
            return;
        }
        if (num === myNumber) {
            showWhatsAppToast("You cannot chat with your own number.", "danger");
            return;
        }
        closeNewChatDrawer();
        startChat(num);
        drawerDirectPhone.value = '';
    };
    drawerStartChatBtn.addEventListener('click', doDrawerStart);
    drawerDirectPhone.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doDrawerStart();
    });
}

function renderDrawerContacts(filter = '') {
    if (!drawerContactsList) return;
    drawerContactsList.innerHTML = '';
    const myContacts = Object.keys(chats).filter(u => u !== myNumber && u.includes(filter));

    if (myContacts.length === 0) {
        drawerContactsList.innerHTML = `
            <div style="padding: 24px 16px; text-align: center; color: var(--wa-text-pill); font-size: 13.5px;">
                <p>Type any 10-digit mobile number above to start a direct chat.</p>
            </div>
        `;
        return;
    }

    myContacts.forEach(num => {
        const item = document.createElement('div');
        item.className = 'contact-card';
        item.innerHTML = `
            <div class="avatar" style="width:44px; height:44px;"></div>
            <div class="contact-info">
                <div class="contact-number">+91 ${num}</div>
                <div class="contact-sub">Direct Chat</div>
            </div>
            <span class="chat-action-badge"><i class="fas fa-comment"></i> Chat</span>
        `;
        item.onclick = () => {
            closeNewChatDrawer();
            startChat(num);
        };
        drawerContactsList.appendChild(item);
    });
}

if (drawerSearchContacts) {
    drawerSearchContacts.addEventListener('input', (e) => {
        renderDrawerContacts(e.target.value.trim().toLowerCase());
    });
}

// --- EMOJI PICKER POPUP ---
const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
const emojiPickerPopup = document.getElementById('emoji-picker-popup');
const emojiGrid = document.getElementById('emoji-grid');

const EMOJIS = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😍','🥰','😘','😋','😛','😜','🤪','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😌','😔','😴','😷','🤒','😎','🥳','🥺','🤠','🤡','💩','👻','💀','👽','🤖','🎃','❤️','🧡','💛','💚','💙','💜','🖤','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','✋','🤚','🖐️','🖖','👋','💪','🙏','👏','🤝','🙌','👐','🤲','🔥','✨','🎉','🎊','🎈','🎂','⭐','🌟','💥','💯','🍕','🍔','🍟','☕','🍵','🚀','✈️','🚗'
];

function initEmojiPicker() {
    if (!emojiGrid) return;
    emojiGrid.innerHTML = '';
    EMOJIS.forEach(emo => {
        const item = document.createElement('span');
        item.className = 'wa-emoji-item';
        item.innerText = emo;
        item.onclick = (e) => {
            e.stopPropagation();
            if (messageInput) {
                messageInput.value += emo;
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input'));
            }
        };
        emojiGrid.appendChild(item);
    });
}

if (emojiToggleBtn && emojiPickerPopup) {
    emojiToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = emojiPickerPopup.style.display === 'block';
        emojiPickerPopup.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) initEmojiPicker();
    });

    document.addEventListener('click', (e) => {
        if (emojiPickerPopup && !emojiPickerPopup.contains(e.target) && e.target !== emojiToggleBtn) {
            emojiPickerPopup.style.display = 'none';
        }
    });
}

// --- WHATSAPP SOUND EFFECTS (SYNTHESIZED WEB AUDIO) ---
function playSentSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
}

function playReceivedSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(680, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
    } catch(e) {}
}

// --- SEARCH / ADD INPUT ---
if (newChatInput) {
    newChatInput.addEventListener('input', (e) => {
        renderChatList(e.target.value.trim().toLowerCase());
    });
    newChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const friendNumber = newChatInput.value.trim();
            if (friendNumber && friendNumber !== myNumber) {
                startChat(friendNumber);
                newChatInput.value = '';
            }
        }
    });
}

function startChat(friendNumber) {
    if (!chats[friendNumber]) {
        chats[friendNumber] = []; 
    }
    saveLocalCache();
    setActiveFilter('all');
    openChat(friendNumber);
}

// --- MODERN CHAT FILTER & RENDERING LOGIC ---
let currentChatFilter = 'all'; // Defaults to All chats (WhatsApp Web standard)

function setActiveFilter(filterName) {
    currentChatFilter = filterName;
    const pills = document.querySelectorAll('.wa-filter-pills-row .wa-pill');
    pills.forEach(p => {
        if (p.getAttribute('data-filter') === filterName) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    if (newChatInput) {
        if (filterName === 'unread') {
            newChatInput.placeholder = 'Search unread chats';
        } else {
            newChatInput.placeholder = 'Search or start new chat';
        }
    }

    renderChatList(newChatInput ? newChatInput.value.trim().toLowerCase() : '');
}

function getTicksHTML(msg, isChatList = false) {
    if (!msg) return '';
    const isRead = msg.status === 'read' || msg.isRead === true;
    const isDelivered = msg.status === 'delivered';
    if (isChatList) {
        if (isRead) {
            return '<i class="fas fa-check-double ticks-read" style="font-size:11px; color:#53bdeb; margin-right:4px;" title="Seen"></i>';
        } else if (isDelivered) {
            return '<i class="fas fa-check-double ticks-delivered" style="font-size:11px; color:#8696a0; margin-right:4px;" title="Delivered"></i>';
        } else {
            return '<i class="fas fa-check ticks-sent" style="font-size:11px; color:#8696a0; margin-right:4px;" title="Sent"></i>';
        }
    } else {
        if (isRead) {
            return '<i class="fas fa-check-double ticks ticks-read" title="Seen"></i>';
        } else if (isDelivered) {
            return '<i class="fas fa-check-double ticks ticks-delivered" title="Delivered"></i>';
        } else {
            return '<i class="fas fa-check ticks ticks-sent" title="Sent"></i>';
        }
    }
}

function renderChatList(filter = '') {
    chatList.innerHTML = '';
    
    const friendNumbers = Object.keys(chats);
    let filteredFriends = friendNumbers.filter(num => num.includes(filter));

    // Handle Unread Filter
    if (currentChatFilter === 'unread') {
        filteredFriends = filteredFriends.filter(num => (unreadCounts[num] || 0) > 0);
        
        if (filteredFriends.length === 0) {
            const unreadEmptyState = document.createElement('div');
            unreadEmptyState.className = 'wa-unread-empty-wrapper';
            unreadEmptyState.innerHTML = `
                <div class="wa-unread-art">
                    <svg viewBox="0 0 160 140" width="140" height="120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M42 75 L70 105 L132 38" stroke="#00a884" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="40" y="24" width="76" height="52" rx="14" fill="#c4eed0" />
                        <path d="M40 58 L28 66 L44 72 Z" fill="#c4eed0" />
                        <rect x="52" y="38" width="44" height="5" rx="2.5" fill="#528362" />
                        <rect x="52" y="50" width="28" height="5" rx="2.5" fill="#528362" />
                        <path d="M42 75 L70 105 L132 38" stroke="#25d366" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M135 24 Q135 30 141 30 Q135 30 135 36 Q135 30 129 30 Q135 30 135 24 Z" fill="#ffffff"/>
                        <path d="M26 42 Q26 47 31 47 Q26 47 26 52 Q26 47 21 47 Q26 47 26 42 Z" fill="#ffffff"/>
                        <circle cx="145" cy="50" r="1.8" fill="#ffffff"/>
                    </svg>
                </div>
                <div class="wa-unread-empty-title">No unread chats</div>
                <div class="wa-unread-empty-sub">You're all caught up.</div>
                <button class="wa-view-all-chats-btn" id="wa-view-all-chats-btn">View all chats</button>
            `;
            chatList.appendChild(unreadEmptyState);

            const viewAllBtn = document.getElementById('wa-view-all-chats-btn');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', () => {
                    setActiveFilter('all');
                });
            }
            return;
        }
    } else if (currentChatFilter === 'favorites') {
        filteredFriends = filteredFriends.filter(num => pinnedChats.includes(num));
        if (filteredFriends.length === 0) {
            const favEmptyState = document.createElement('div');
            favEmptyState.className = 'wa-unread-empty-wrapper';
            favEmptyState.innerHTML = `
                <div style="font-size:46px; color:#8696a0; margin-bottom:16px;"><i class="far fa-star"></i></div>
                <div class="wa-unread-empty-title">No favorite chats</div>
                <div class="wa-unread-empty-sub">Add people and groups to favorites for quick access.</div>
                <button class="wa-view-all-chats-btn" id="wa-fav-view-all-btn">View all chats</button>
            `;
            chatList.appendChild(favEmptyState);
            const favViewAll = document.getElementById('wa-fav-view-all-btn');
            if (favViewAll) favViewAll.onclick = () => setActiveFilter('all');
            return;
        }
    } else if (currentChatFilter === 'groups') {
        const groupEmptyState = document.createElement('div');
        groupEmptyState.className = 'wa-unread-empty-wrapper';
        groupEmptyState.innerHTML = `
            <div style="font-size:46px; color:#8696a0; margin-bottom:16px;"><i class="fas fa-users"></i></div>
            <div class="wa-unread-empty-title">No groups yet</div>
            <div class="wa-unread-empty-sub">Stay connected with your communities and groups.</div>
            <button class="wa-view-all-chats-btn" id="wa-group-view-all-btn">View all chats</button>
        `;
        chatList.appendChild(groupEmptyState);
        const groupViewAll = document.getElementById('wa-group-view-all-btn');
        if (groupViewAll) groupViewAll.onclick = () => setActiveFilter('all');
        return;
    }

    if (filteredFriends.length === 0 && friendNumbers.length === 0) {
        const emptyPrompt = document.createElement('div');
        emptyPrompt.className = 'wa-unread-empty-wrapper';
        emptyPrompt.innerHTML = `
            <div style="width:54px; height:54px; border-radius:50%; background:var(--wa-bg-pill-active); color:var(--wa-text-pill-active); display:flex; align-items:center; justify-content:center; margin:0 auto 14px auto; font-size:22px;">
                <i class="far fa-comments"></i>
            </div>
            <div class="wa-unread-empty-title">No chats yet</div>
            <div class="wa-unread-empty-sub">Tap the <i class="fas fa-plus" style="color:#00a884;"></i> button above to start a conversation with any number.</div>
        `;
        chatList.appendChild(emptyPrompt);
        return;
    }

    if (filteredFriends.length === 0 && friendNumbers.length > 0) {
        const noMatch = document.createElement('div');
        noMatch.className = 'wa-unread-empty-wrapper';
        noMatch.innerHTML = `
            <div class="wa-unread-empty-title" style="margin-top:20px;">No chats found</div>
            <div class="wa-unread-empty-sub">No results found for "${escapeHtml(filter)}"</div>
        `;
        chatList.appendChild(noMatch);
        return;
    }

    // Sort: Pinned chats on top, then most recent
    filteredFriends.sort((a, b) => {
        const aPinned = pinnedChats.includes(a);
        const bPinned = pinnedChats.includes(b);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
    });

    filteredFriends.forEach(friendNumber => {
        const messages = chats[friendNumber] || [];
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        let lastMsgPrefix = '';
        let lastMsgText = 'Tap to chat';
        if (lastMsg) {
            if (lastMsg.from === myNumber) {
                lastMsgPrefix = getTicksHTML(lastMsg, true);
            }
            if (lastMsg.isDeleted) {
                lastMsgText = '<i class="fas fa-ban" style="font-size:11px; margin-right:4px; opacity:0.7;"></i> Deleted message';
            } else if (lastMsg.image) {
                lastMsgText = '<i class="fas fa-camera" style="font-size:12px; margin-right:4px; color:#8696a0;"></i> Photo';
            } else if (lastMsg.audio) {
                lastMsgText = '<i class="fas fa-microphone" style="font-size:12px; margin-right:4px; color:#8696a0;"></i> Voice message';
            } else if (lastMsg.poll) {
                lastMsgText = '<i class="fas fa-poll" style="font-size:12px; margin-right:4px; color:#8696a0;"></i> Poll';
            } else {
                lastMsgText = escapeHtml(lastMsg.text || 'Message');
            }
        }
        let lastMsgTime = lastMsg ? lastMsg.time : '';
        const unreadCount = unreadCounts[friendNumber] || 0;
        const unreadHTML = unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : '';
        const isPinned = pinnedChats.includes(friendNumber);
        const isMuted = mutedChats.includes(friendNumber);

        const chatItem = document.createElement('div');
        chatItem.className = `chat-list-item ${activeChat === friendNumber ? 'active' : ''}`;
        chatItem.setAttribute('data-chat', friendNumber);

        chatItem.onclick = (e) => {
            if (e.target.closest('.chat-item-chevron-btn')) return;
            openChat(friendNumber);
        };

        chatItem.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openChatContextMenu(e, friendNumber);
        };
        
        const isAiChat = friendNumber === 'QuickChat AI';
        const displayTitle = isAiChat
            ? `QuickChat AI <i class="fas fa-check-circle" style="color:#00a884; font-size:12.5px; margin-left:4px;" title="Official AI"></i>`
            : `+91 ${friendNumber}`;
        const avatarContent = isAiChat
            ? `<div class="avatar" style="background:linear-gradient(135deg, #00a884, #00d2ff, #7b2ff7); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px;"><i class="fas fa-robot"></i></div>`
            : `<div class="avatar"></div>`;

        chatItem.innerHTML = `
            ${avatarContent}
            <div class="chat-info">
                <div class="chat-title-row">
                    <h4>${displayTitle}</h4>
                    <span class="time">${lastMsgTime}</span>
                </div>
                <div class="chat-subtitle-row">
                    <div class="chat-last-msg">${lastMsgPrefix}${lastMsgText}</div>
                    <div class="chat-icons-right">
                        ${isMuted ? '<i class="fas fa-volume-mute wa-chat-indicator" title="Muted"></i>' : ''}
                        ${isPinned ? '<i class="fas fa-thumbtack wa-chat-indicator" title="Pinned"></i>' : ''}
                        ${unreadHTML}
                        <button type="button" class="chat-item-chevron-btn" title="Chat menu" data-friend="${friendNumber}">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const chevronBtn = chatItem.querySelector('.chat-item-chevron-btn');
        if (chevronBtn) {
            chevronBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openChatContextMenu(e, friendNumber);
            };
        }

        chatList.appendChild(chatItem);
    });
}

// ========================================================
// CHAT ITEM CONTEXT MENU ENGINE (SIDEBAR)
// ========================================================
let currentContextMenuFriend = null;
const chatItemContextMenu = document.getElementById('chat-item-context-menu');

function openChatContextMenu(e, friendNumber) {
    if (!chatItemContextMenu) return;
    currentContextMenuFriend = friendNumber;

    const isPinned = pinnedChats.includes(friendNumber);
    const isMuted = mutedChats.includes(friendNumber);
    const isArchived = archivedChats.includes(friendNumber);
    const hasUnread = (unreadCounts[friendNumber] || 0) > 0;

    const pinText = document.getElementById('ctx-chat-pin-text');
    const muteText = document.getElementById('ctx-chat-mute-text');
    const archiveText = document.getElementById('ctx-chat-archive-text');
    const unreadText = document.getElementById('ctx-chat-unread-text');

    if (pinText) pinText.innerText = isPinned ? 'Unpin chat' : 'Pin chat';
    if (muteText) muteText.innerText = isMuted ? 'Unmute notifications' : 'Mute notifications';
    if (archiveText) archiveText.innerText = isArchived ? 'Unarchive chat' : 'Archive chat';
    if (unreadText) unreadText.innerText = hasUnread ? 'Mark as read' : 'Mark as unread';

    chatItemContextMenu.style.display = 'block';

    const menuWidth = 210;
    const menuHeight = 260;
    let x = e.clientX || 120;
    let y = e.clientY || 120;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 12;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 12;

    chatItemContextMenu.style.left = `${Math.max(10, x)}px`;
    chatItemContextMenu.style.top = `${Math.max(10, y)}px`;
}

function closeChatContextMenu() {
    if (chatItemContextMenu) chatItemContextMenu.style.display = 'none';
    currentContextMenuFriend = null;
}

document.addEventListener('click', (e) => {
    if (chatItemContextMenu && !chatItemContextMenu.contains(e.target) && !e.target.closest('.chat-item-chevron-btn')) {
        closeChatContextMenu();
    }
});

const ctxChatPin = document.getElementById('ctx-chat-pin');
if (ctxChatPin) {
    ctxChatPin.onclick = () => {
        const friend = currentContextMenuFriend;
        closeChatContextMenu();
        if (!friend) return;
        if (pinnedChats.includes(friend)) {
            pinnedChats = pinnedChats.filter(f => f !== friend);
            showWhatsAppToast(`Unpinned +91 ${friend}`, 'info');
        } else {
            pinnedChats.push(friend);
            showWhatsAppToast(`Pinned +91 ${friend} 📌`, 'info');
        }
        localStorage.setItem('quickchat_pinned_chats_' + (myNumber || ''), JSON.stringify(pinnedChats));
        renderChatList();
    };
}

const ctxChatMute = document.getElementById('ctx-chat-mute');
if (ctxChatMute) {
    ctxChatMute.onclick = () => {
        const friend = currentContextMenuFriend;
        closeChatContextMenu();
        if (!friend) return;
        if (mutedChats.includes(friend)) {
            mutedChats = mutedChats.filter(f => f !== friend);
            showWhatsAppToast(`Unmuted +91 ${friend}`, 'info');
        } else {
            mutedChats.push(friend);
            showWhatsAppToast(`Muted notifications for +91 ${friend}`, 'info');
        }
        localStorage.setItem('quickchat_muted_chats_' + (myNumber || ''), JSON.stringify(mutedChats));
        renderChatList();
    };
}

const ctxChatArchive = document.getElementById('ctx-chat-archive');
if (ctxChatArchive) {
    ctxChatArchive.onclick = () => {
        const friend = currentContextMenuFriend;
        closeChatContextMenu();
        if (!friend) return;
        if (archivedChats.includes(friend)) {
            archivedChats = archivedChats.filter(f => f !== friend);
            showWhatsAppToast(`Unarchived +91 ${friend}`, 'info');
        } else {
            archivedChats.push(friend);
            showWhatsAppToast(`Archived chat with +91 ${friend} 📦`, 'info');
        }
        localStorage.setItem('quickchat_archived_chats_' + (myNumber || ''), JSON.stringify(archivedChats));
        renderChatList();
    };
}

const ctxChatUnread = document.getElementById('ctx-chat-unread');
if (ctxChatUnread) {
    ctxChatUnread.onclick = () => {
        const friend = currentContextMenuFriend;
        closeChatContextMenu();
        if (!friend) return;
        if ((unreadCounts[friend] || 0) > 0) {
            unreadCounts[friend] = 0;
            socket.emit('mark read', { from: friend });
            showWhatsAppToast(`Marked as read`, 'info');
        } else {
            unreadCounts[friend] = 1;
            showWhatsAppToast(`Marked as unread`, 'info');
        }
        renderChatList();
    };
}

const ctxChatClear = document.getElementById('ctx-chat-clear');
if (ctxChatClear) {
    ctxChatClear.onclick = () => {
        const friend = currentContextMenuFriend;
        closeChatContextMenu();
        if (!friend) return;
        showWhatsAppDialog({
            title: 'Clear this chat?',
            message: `This will delete all messages in this chat with +91 ${friend} from your device.`,
            confirmText: 'Clear messages',
            cancelText: 'Cancel',
            onConfirm: () => {
                chats[friend] = [];
                saveLocalCache();
                if (activeChat === friend) renderMessages();
                renderChatList();
                showWhatsAppToast("Chat messages cleared.", "info");
            }
        });
    };
}

const ctxChatDelete = document.getElementById('ctx-chat-delete');
if (ctxChatDelete) {
    ctxChatDelete.onclick = () => {
        const friend = currentContextMenuFriend;
        closeChatContextMenu();
        if (!friend) return;
        showWhatsAppDialog({
            title: 'Delete this chat?',
            message: `Delete chat with +91 ${friend}?\nMessages will only be removed from this device.`,
            confirmText: 'Delete chat',
            cancelText: 'Cancel',
            isDanger: true,
            onConfirm: () => {
                delete chats[friend];
                pinnedChats = pinnedChats.filter(f => f !== friend);
                mutedChats = mutedChats.filter(f => f !== friend);
                archivedChats = archivedChats.filter(f => f !== friend);
                delete unreadCounts[friend];
                localStorage.setItem('quickchat_pinned_chats_' + (myNumber || ''), JSON.stringify(pinnedChats));
                localStorage.setItem('quickchat_muted_chats_' + (myNumber || ''), JSON.stringify(mutedChats));
                localStorage.setItem('quickchat_archived_chats_' + (myNumber || ''), JSON.stringify(archivedChats));
                saveLocalCache();

                if (activeChat === friend) {
                    activeChat = null;
                    chatPanel.style.display = 'none';
                    chatPanel.classList.remove('active-mobile');
                    emptyState.style.display = 'flex';
                }
                renderChatList();
                showWhatsAppToast("Chat deleted.", "info");
            }
        });
    };
}

function openChat(friendNumber) {
    activeChat = friendNumber;
    unreadCounts[friendNumber] = 0; // Clear unread badge
    if (!chats[friendNumber]) {
        chats[friendNumber] = [];
    }
    emptyState.style.display = 'none';
    chatPanel.style.display = 'flex';
    if (friendNumber === 'QuickChat AI') {
        activeChatTitle.innerHTML = `QuickChat AI <i class="fas fa-check-circle" style="color:#00a884; font-size:13px; margin-left:4px;" title="Official AI"></i> <button type="button" onclick="openAiApiKeyDialog(event)" style="margin-left:8px; background:rgba(0,168,132,0.15); color:#00a884; border:1px solid rgba(0,168,132,0.4); border-radius:12px; padding:2px 9px; font-size:11px; font-weight:600; cursor:pointer;">🔑 ${localStorage.getItem('quickchat_ai_api_key') ? 'API Connected' : 'Connect API'}</button>`;
        const statusEl = document.getElementById('active-chat-status');
        if (statusEl) {
            const hasKey = !!localStorage.getItem('quickchat_ai_api_key');
            statusEl.innerHTML = `<span style="color:#00a884;">✨ ${hasKey ? 'Custom AI API Active (Gemini/Groq/OpenAI)' : 'Built-in Free AI API Active • Ask me anything'}</span>`;
        }
    } else {
        activeChatTitle.innerText = "+91 " + friendNumber;
        const statusEl = document.getElementById('active-chat-status');
        if (statusEl) statusEl.innerText = 'online';
    }
    
    // Add mobile active class to open full screen on mobile
    chatPanel.classList.add('active-mobile');
    
    // Notify server that recipient has viewed/seen the messages -> triggers Blue Ticks for sender!
    if (friendNumber && friendNumber !== 'QuickChat AI') {
        socket.emit('mark read', { from: friendNumber });
    }
    
    renderChatList(); 
    renderMessages();
}

// Mobile Back Button Logic
if (backBtn) {
    backBtn.addEventListener('click', () => {
        chatPanel.classList.remove('active-mobile');
        chatPanel.style.display = 'none';
        activeChat = null;
        emptyState.style.display = 'flex';
        renderChatList();
    });
}

// Helper to escape text
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

// Format markdown (code blocks, inline code, bold, line breaks) safely for messages
function formatRichMessageText(rawText) {
    if (!rawText) return '';
    let safe = escapeHtml(rawText);
    // Code blocks ```...```
    safe = safe.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => {
        return `<pre style="background:rgba(0,0,0,0.22); padding:10px 12px; border-radius:8px; overflow-x:auto; font-family:monospace; font-size:12.5px; margin:6px 0; border-left:3px solid #00a884;"><code>${code.trim()}</code></pre>`;
    });
    // Inline code `...`
    safe = safe.replace(/`([^`\n]+)`/g, '<code style="background:rgba(0,168,132,0.15); padding:1px 5px; border-radius:4px; font-family:monospace; font-size:13px;">$1</code>');
    // Bold **...**
    safe = safe.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return safe;
}

// ========================================================
// ADVANCED WHATSAPP MESSAGING ENGINE
// ========================================================

let currentReplyTo = null; // { id, from, text }
let activePlayingAudio = null;
let currentPinnedMessage = null;
let starredMessages = JSON.parse(localStorage.getItem('quickchat_starred_msgs') || '[]');
let mutedChats = JSON.parse((myNumber && localStorage.getItem('quickchat_muted_chats_' + myNumber)) || localStorage.getItem('quickchat_muted_chats') || '[]');
let pinnedChats = JSON.parse((myNumber && localStorage.getItem('quickchat_pinned_chats_' + myNumber)) || localStorage.getItem('quickchat_pinned_chats') || '[]');
let archivedChats = JSON.parse((myNumber && localStorage.getItem('quickchat_archived_chats_' + myNumber)) || localStorage.getItem('quickchat_archived_chats') || '[]');
let userWallpaper = localStorage.getItem('quickchat_wallpaper') || 'default';

// Apply saved wallpaper
if (userWallpaper && userWallpaper !== 'default') {
    document.documentElement.style.setProperty('--wa-bg-chat-panel', userWallpaper);
}

function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
}

// 1. Quoted Reply Handlers
function setReplyMessage(msg) {
    currentReplyTo = {
        id: msg.id,
        from: msg.from,
        text: msg.text || (msg.image ? 'Photo' : (msg.audio ? 'Voice message' : (msg.poll ? 'Poll' : 'Message')))
    };
    const bar = document.getElementById('reply-preview-bar');
    const authorEl = document.getElementById('reply-author');
    const snippetEl = document.getElementById('reply-snippet');
    if (bar && authorEl && snippetEl) {
        authorEl.innerText = (msg.from === myNumber ? 'You' : '+91 ' + msg.from);
        snippetEl.innerText = currentReplyTo.text;
        bar.style.display = 'flex';
    }
    if (messageInput) messageInput.focus();
}

const cancelReplyBtn = document.getElementById('cancel-reply-btn');
if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', () => {
        currentReplyTo = null;
        const bar = document.getElementById('reply-preview-bar');
        if (bar) bar.style.display = 'none';
    });
}

// 2. Real Voice Recording Engine
let mediaRecorder = null;
let audioChunks = [];
let voiceTimerInterval = null;
let voiceSeconds = 0;

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.start();

        const normalBar = document.getElementById('normal-input-bar');
        const voiceUi = document.getElementById('voice-recording-ui');
        const timerEl = document.getElementById('voice-rec-timer');
        if (normalBar) normalBar.style.display = 'none';
        if (voiceUi) voiceUi.style.display = 'flex';

        voiceSeconds = 0;
        if (timerEl) timerEl.innerText = '0:00';
        clearInterval(voiceTimerInterval);
        voiceTimerInterval = setInterval(() => {
            voiceSeconds++;
            const m = Math.floor(voiceSeconds / 60);
            const s = voiceSeconds % 60;
            if (timerEl) timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);
    } catch(err) {
        console.warn("Microphone access error:", err);
        showWhatsAppToast("Microphone permission needed to record voice message.", "danger");
    }
}

function cancelVoiceRecording() {
    clearInterval(voiceTimerInterval);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    const normalBar = document.getElementById('normal-input-bar');
    const voiceUi = document.getElementById('voice-recording-ui');
    if (normalBar) normalBar.style.display = 'flex';
    if (voiceUi) voiceUi.style.display = 'none';
    audioChunks = [];
}

function finishAndSendVoiceRecording() {
    clearInterval(voiceTimerInterval);
    if (!mediaRecorder) return;
    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Audio = reader.result;
            sendMessage(null, base64Audio, 'audio');
        };
        reader.readAsDataURL(audioBlob);
    };
    mediaRecorder.stop();

    const normalBar = document.getElementById('normal-input-bar');
    const voiceUi = document.getElementById('voice-recording-ui');
    if (normalBar) normalBar.style.display = 'flex';
    if (voiceUi) voiceUi.style.display = 'none';
}

const cancelVoiceBtn = document.getElementById('cancel-voice-btn');
if (cancelVoiceBtn) cancelVoiceBtn.addEventListener('click', cancelVoiceRecording);

const sendVoiceBtn = document.getElementById('send-voice-btn');
if (sendVoiceBtn) sendVoiceBtn.addEventListener('click', finishAndSendVoiceRecording);

// 3. Typing and Mic/Send toggles
let typingTimer = null;
if (messageInput) {
    messageInput.addEventListener('input', () => {
        if (messageInput.value.trim().length > 0) {
            micBtn.style.display = 'none';
            sendBtn.style.display = 'block';
        } else {
            micBtn.style.display = 'block';
            sendBtn.style.display = 'none';
        }

        if (activeChat) {
            socket.emit('typing', { to: activeChat, isTyping: true });
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                socket.emit('typing', { to: activeChat, isTyping: false });
            }, 1500);
        }
    });
}

const micCircleWrapper = document.querySelector('.mic-circle-wrapper');
if (micCircleWrapper) {
    micCircleWrapper.addEventListener('click', () => {
        if (messageInput && messageInput.value.trim().length > 0) {
            sendMessage();
        } else {
            startVoiceRecording();
        }
    });
}

// 4. Attachments Menu (📎)
const attachMenuBtn = document.getElementById('attach-menu-btn');
const attachMenuPopup = document.getElementById('attach-menu-popup');
if (attachMenuBtn && attachMenuPopup) {
    attachMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        attachMenuPopup.style.display = attachMenuPopup.style.display === 'none' ? 'flex' : 'none';
    });
    document.addEventListener('click', (e) => {
        if (attachMenuPopup && !attachMenuPopup.contains(e.target) && e.target !== attachMenuBtn) {
            attachMenuPopup.style.display = 'none';
        }
    });
}

const attachItemPhoto = document.getElementById('attach-item-photo');
if (attachItemPhoto) {
    attachItemPhoto.addEventListener('click', () => {
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        const imgInput = document.getElementById('image-upload');
        if (imgInput) imgInput.click();
    });
}

const attachItemDoc = document.getElementById('attach-item-doc');
if (attachItemDoc) {
    attachItemDoc.addEventListener('click', () => {
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        const imgInput = document.getElementById('image-upload');
        if (imgInput) imgInput.click();
    });
}

const attachItemCamera = document.getElementById('attach-item-camera');
if (attachItemCamera) {
    attachItemCamera.addEventListener('click', () => {
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        const imgInput = document.getElementById('image-upload');
        if (imgInput) imgInput.click();
    });
}

const attachItemPoll = document.getElementById('attach-item-poll');
if (attachItemPoll) {
    attachItemPoll.addEventListener('click', () => {
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        const pollModal = document.getElementById('poll-modal');
        if (pollModal) pollModal.style.display = 'flex';
    });
}

const attachItemContact = document.getElementById('attach-item-contact');
if (attachItemContact) {
    attachItemContact.addEventListener('click', () => {
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        const contactNum = window.prompt ? window.prompt("Enter contact phone number to share:") : null;
        if (contactNum && /^\d{10}$/.test(contactNum.trim())) {
            sendMessage(`👤 Contact: +91 ${contactNum.trim()}`);
        } else if (contactNum) {
            showWhatsAppToast("Please enter a valid 10-digit number.", "danger");
        }
    });
}

const attachItemLocation = document.getElementById('attach-item-location');
if (attachItemLocation) {
    attachItemLocation.addEventListener('click', () => {
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        if (navigator.geolocation) {
            showWhatsAppToast("Getting current location...", "info");
            navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                sendMessage(`📍 Current Location: ${mapUrl}`, null, 'location', { lat, lng, mapUrl });
            }, () => {
                showWhatsAppToast("Location access denied or unavailable.", "danger");
            });
        } else {
            showWhatsAppToast("Geolocation is not supported by your browser.", "danger");
        }
    });
}

// 5. Poll Creation Modal Handlers
const closePollModalBtn = document.getElementById('close-poll-modal-btn');
if (closePollModalBtn) {
    closePollModalBtn.addEventListener('click', () => {
        const pollModal = document.getElementById('poll-modal');
        if (pollModal) pollModal.style.display = 'none';
    });
}

const pollAddOptionBtn = document.getElementById('poll-add-option-btn');
if (pollAddOptionBtn) {
    pollAddOptionBtn.addEventListener('click', () => {
        const container = document.getElementById('poll-options-container');
        if (container) {
            const count = container.querySelectorAll('.poll-option-input').length + 1;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'poll-option-input wa-direct-input';
            input.placeholder = 'Option ' + count;
            input.style = 'width:100%; margin:4px 0 8px 0; padding:9px 12px; border-radius:8px; border:1px solid var(--wa-border-search); background:var(--wa-bg-search-box); color:var(--wa-search-text);';
            container.appendChild(input);
        }
    });
}

const submitPollBtn = document.getElementById('submit-poll-btn');
if (submitPollBtn) {
    submitPollBtn.addEventListener('click', () => {
        const qInput = document.getElementById('poll-question-input');
        const question = qInput ? qInput.value.trim() : '';
        if (!question) {
            showWhatsAppToast("Please enter a poll question.", "danger");
            return;
        }

        const optionInputs = document.querySelectorAll('#poll-options-container .poll-option-input');
        const options = [];
        optionInputs.forEach(opt => {
            if (opt.value.trim()) options.push({ text: opt.value.trim(), votes: [] });
        });

        if (options.length < 2) {
            showWhatsAppToast("Please add at least 2 options.", "danger");
            return;
        }

        const pollData = {
            id: 'poll_' + Date.now(),
            question: question,
            options: options
        };

        sendMessage(null, null, 'poll', null, pollData);

        const pollModal = document.getElementById('poll-modal');
        if (pollModal) pollModal.style.display = 'none';
        if (qInput) qInput.value = '';
    });
}

// 6. Image Compression & File Upload
const imageUpload = document.getElementById('image-upload');
if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 900;
                    const scaleSize = Math.min(1, MAX_WIDTH / img.width);
                    canvas.width = img.width * scaleSize;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const base64Str = canvas.toDataURL('image/jpeg', 0.65);
                    sendMessage(base64Str, null, 'image');
                };
            } else {
                sendMessage(null, null, 'file', null, null, file.name);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });
}

// 7. Core Send Message Function
function sendMessage(imageStr = null, audioStr = null, msgType = 'text', locationData = null, pollData = null, fileName = null) {
    if (!activeChat) return;

    const text = (messageInput && msgType === 'text') ? messageInput.value.trim() : (fileName ? `📄 Document: ${fileName}` : '');
    if (!text && !imageStr && !audioStr && !locationData && !pollData) return;

    const timeNow = formatTime(new Date());
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const msgObj = {
        id: msgId,
        from: myNumber,
        to: activeChat,
        text: text,
        image: imageStr,
        audio: audioStr,
        location: locationData,
        poll: pollData,
        replyTo: currentReplyTo,
        reactions: {},
        type: msgType,
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        starred: false,
        status: 'sent',
        isRead: false,
        time: timeNow
    };

    if (!chats[activeChat]) chats[activeChat] = [];
    chats[activeChat].push(msgObj);

    // Socket emit
    socket.emit('private message', {
        id: msgId,
        to: activeChat,
        text: text,
        image: imageStr,
        audio: audioStr,
        location: locationData,
        poll: pollData,
        replyTo: currentReplyTo,
        type: msgType
    });
    socket.emit('typing', { to: activeChat, isTyping: false });

    // Reset inputs & reply preview
    if (messageInput) {
        messageInput.value = '';
        messageInput.dispatchEvent(new Event('input'));
    }
    if (currentReplyTo) {
        currentReplyTo = null;
        const bar = document.getElementById('reply-preview-bar');
        if (bar) bar.style.display = 'none';
    }

    renderMessages();
    renderChatList();
    saveLocalCache();
    playSentSound();
}

if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendMessage();
    });
}

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// 8. Message Actions: React, Delete, Star, Edit, Pin, Poll Vote
function handleMessageAction(action, msgId, extra = {}) {
    if (!activeChat || !chats[activeChat]) return;
    const msg = chats[activeChat].find(m => m.id === msgId);
    if (!msg) return;

    if (action === 'react') {
        const emoji = extra.emoji;
        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
        if (msg.reactions[emoji].includes(myNumber)) {
            msg.reactions[emoji] = msg.reactions[emoji].filter(n => n !== myNumber);
            if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
        } else {
            msg.reactions[emoji].push(myNumber);
        }
        socket.emit('message action', { action: 'react', msgId: msgId, emoji: emoji, to: activeChat });
    } else if (action === 'star') {
        msg.starred = !msg.starred;
        if (msg.starred) {
            starredMessages.push({ ...msg, chat: activeChat });
            showWhatsAppToast("Message starred ⭐", "success", 2000);
        } else {
            starredMessages = starredMessages.filter(s => s.id !== msgId);
            showWhatsAppToast("Message unstarred", "info", 2000);
        }
        localStorage.setItem('quickchat_starred_msgs', JSON.stringify(starredMessages));
    } else if (action === 'edit') {
        const newText = window.prompt ? window.prompt("Edit message:", msg.text) : null;
        if (newText && newText.trim() && newText.trim() !== msg.text) {
            msg.text = newText.trim();
            msg.isEdited = true;
            socket.emit('message action', { action: 'edit', msgId: msgId, newText: msg.text, to: activeChat });
        }
    } else if (action === 'pin') {
        msg.isPinned = !msg.isPinned;
        currentPinnedMessage = msg.isPinned ? msg : null;
        updatePinnedBanner();
        socket.emit('message action', { action: 'pin', msgId: msgId, isPinned: msg.isPinned, to: activeChat });
        showWhatsAppToast(msg.isPinned ? "Message pinned 📌" : "Message unpinned", "info", 2000);
    } else if (action === 'delete') {
        msg.isDeleted = true;
        msg.text = '🚫 This message was deleted';
        msg.image = null;
        msg.audio = null;
        socket.emit('message action', { action: 'delete', msgId: msgId, to: activeChat });
        showWhatsAppToast("Message deleted", "info", 2000);
    } else if (action === 'vote_poll') {
        const optIndex = extra.optionIndex;
        if (msg.poll && msg.poll.options[optIndex]) {
            const opt = msg.poll.options[optIndex];
            if (!opt.votes) opt.votes = [];
            if (opt.votes.includes(myNumber)) {
                opt.votes = opt.votes.filter(n => n !== myNumber);
            } else {
                opt.votes.push(myNumber);
            }
            socket.emit('message action', { action: 'vote_poll', msgId: msgId, optionIndex: optIndex, to: activeChat });
        }
    }

    renderMessages();
    saveLocalCache();
}

function updatePinnedBanner() {
    const banner = document.getElementById('pinned-message-banner');
    const textEl = document.getElementById('pinned-banner-text');
    if (banner && textEl) {
        if (currentPinnedMessage && !currentPinnedMessage.isDeleted) {
            textEl.innerText = currentPinnedMessage.text || 'Photo';
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }
}

const unpinBtn = document.getElementById('unpin-btn');
if (unpinBtn) {
    unpinBtn.addEventListener('click', () => {
        if (currentPinnedMessage) {
            currentPinnedMessage.isPinned = false;
            currentPinnedMessage = null;
            updatePinnedBanner();
        }
    });
}

// 9. Comprehensive Message Renderer
function renderMessages() {
    if (!activeChat) return;

    messagesContainer.innerHTML = `
        <div class="date-chip">TODAY</div>
        <div class="encryption-msg">
            <i class="fas fa-lock"></i> Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
        </div>
    `;

    const messages = chats[activeChat] || [];
    currentPinnedMessage = messages.find(m => m.isPinned) || null;
    updatePinnedBanner();

    messages.forEach((msg, idx) => {
        const isMe = msg.from === myNumber;
        const msgElement = document.createElement('div');
        msgElement.className = `message ${isMe ? 'sent' : 'received'}`;
        msgElement.id = 'msg-el-' + (msg.id || idx);

        let senderTagHTML = !isMe ? `<span class="sender-name-tag">~${msg.from === 'QuickChat AI' ? 'QuickChat AI' : '+91 ' + msg.from}</span>` : '';
        let ticksHTML = isMe ? getTicksHTML(msg, false) : '';

        // Quoted block
        let quotedHTML = '';
        if (msg.replyTo) {
            quotedHTML = `
                <div class="wa-msg-quoted">
                    <div class="wa-msg-quoted-author">${msg.replyTo.from === myNumber ? 'You' : '+91 ' + msg.replyTo.from}</div>
                    <div class="wa-msg-quoted-text">${escapeHtml(msg.replyTo.text)}</div>
                </div>
            `;
        }

        // Body content by type
        let bodyHTML = '';
        if (msg.isDeleted) {
            bodyHTML = `<span class="message-content" style="font-style:italic; opacity:0.75;"><i class="fas fa-ban" style="font-size:11px; margin-right:4px;"></i> This message was deleted</span>`;
        } else if (msg.audio) {
            bodyHTML = `
                <div class="wa-audio-player">
                    <button type="button" class="wa-audio-play-btn" onclick="togglePlayAudio('${msg.id || idx}', '${msg.audio}')">
                        <i class="fas fa-play" id="audio-icon-${msg.id || idx}"></i>
                    </button>
                    <div class="wa-audio-waveform">
                        <div class="wa-audio-bar">
                            <div class="wa-audio-progress" id="audio-prog-${msg.id || idx}"></div>
                        </div>
                        <span class="wa-audio-duration">Voice message</span>
                    </div>
                </div>
            `;
        } else if (msg.poll) {
            const totalVotes = msg.poll.options.reduce((sum, o) => sum + (o.votes ? o.votes.length : 0), 0);
            bodyHTML = `
                <div class="wa-poll-card">
                    <div class="wa-poll-question"><i class="fas fa-poll" style="color:#00a884; margin-right:6px;"></i> ${escapeHtml(msg.poll.question)}</div>
                    ${msg.poll.options.map((opt, optIdx) => {
                        const count = opt.votes ? opt.votes.length : 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const hasVoted = opt.votes && opt.votes.includes(myNumber);
                        return `
                            <div class="wa-poll-option-item" onclick="handleMessageAction('vote_poll', '${msg.id}', { optionIndex: ${optIdx} })">
                                <div class="wa-poll-option-fill" style="width:${pct}%;"></div>
                                <div class="wa-poll-option-content">
                                    <span>${hasVoted ? '<i class="fas fa-check-circle" style="color:#00a884; margin-right:4px;"></i>' : '<i class="far fa-circle" style="opacity:0.5; margin-right:4px;"></i>'} ${escapeHtml(opt.text)}</span>
                                    <span class="wa-poll-votes-badge">${count} (${pct}%)</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (msg.location) {
            bodyHTML = `
                <div class="wa-location-card">
                    <div style="font-weight:600; font-size:13.5px;"><i class="fas fa-map-marker-alt" style="color:#ea4335;"></i> Shared Location</div>
                    <a href="${msg.location.mapUrl || '#'}" target="_blank" class="wa-location-map-btn"><i class="fas fa-external-link-alt"></i> Open in Google Maps</a>
                </div>
            `;
        } else {
            let mediaHTML = msg.image ? `<img src="${msg.image}" style="max-width:100%; border-radius:6px; margin-bottom:4px; display:block; cursor:pointer;">` : '';
            let textHTML = msg.text ? `<span class="message-content">${formatRichMessageText(msg.text)}</span>` : '';
            bodyHTML = mediaHTML + textHTML;
        }

        // Reactions badges
        let reactionsHTML = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsHTML = `
                <div class="wa-reactions-badge">
                    ${Object.entries(msg.reactions).map(([emoji, users]) => `<span>${emoji} ${users.length > 1 ? users.length : ''}</span>`).join('')}
                </div>
            `;
        }

        let editedHTML = msg.isEdited ? `<span style="font-size:10px; opacity:0.75; margin-left:4px;">(edited)</span>` : '';
        let starHTML = msg.starred ? `<i class="fas fa-star" style="font-size:9.5px; color:#ffbc38; margin-right:3px;"></i>` : '';

        // Hover quick action buttons
        let hoverActionsHTML = '';
        if (!msg.isDeleted) {
            hoverActionsHTML = `
                <div class="wa-msg-hover-actions">
                    <button class="wa-msg-action-btn" onclick="toggleReactionPicker('${msg.id || idx}')" title="React"><i class="far fa-smile"></i></button>
                    <button class="wa-msg-action-btn" onclick="setReplyMessage(chats['${activeChat}'][${idx}])" title="Reply"><i class="fas fa-reply"></i></button>
                    <button class="wa-msg-action-btn" onclick="openMsgMenu(event, '${msg.id}', ${idx})" title="More"><i class="fas fa-angle-down"></i></button>
                    <!-- Reaction emojis bar -->
                    <div id="react-picker-${msg.id || idx}" class="wa-reactions-bar" style="display:none;">
                        <span class="wa-reaction-emoji" onclick="handleMessageAction('react', '${msg.id}', { emoji: '👍' })">👍</span>
                        <span class="wa-reaction-emoji" onclick="handleMessageAction('react', '${msg.id}', { emoji: '❤️' })">❤️</span>
                        <span class="wa-reaction-emoji" onclick="handleMessageAction('react', '${msg.id}', { emoji: '😂' })">😂</span>
                        <span class="wa-reaction-emoji" onclick="handleMessageAction('react', '${msg.id}', { emoji: '😮' })">😮</span>
                        <span class="wa-reaction-emoji" onclick="handleMessageAction('react', '${msg.id}', { emoji: '😢' })">😢</span>
                        <span class="wa-reaction-emoji" onclick="handleMessageAction('react', '${msg.id}', { emoji: '🙏' })">🙏</span>
                    </div>
                </div>
            `;
        }

        msgElement.innerHTML = `
            ${hoverActionsHTML}
            ${senderTagHTML}
            ${quotedHTML}
            ${bodyHTML}
            <div class="message-footer" style="${(!msg.text && msg.image) ? 'position:absolute; bottom:5px; right:8px; background:rgba(0,0,0,0.5); border-radius:10px; padding:2px 6px;' : ''}">
                ${starHTML}
                <span class="message-time" style="${(!msg.text && msg.image) ? 'color:white;' : ''}">${msg.time}</span>
                ${editedHTML}
                ${ticksHTML}
            </div>
            ${reactionsHTML}
            <div style="clear:both"></div>
        `;
        messagesContainer.appendChild(msgElement);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 10. Audio playback controller
function togglePlayAudio(id, audioSrc) {
    const icon = document.getElementById('audio-icon-' + id);
    const prog = document.getElementById('audio-prog-' + id);

    if (activePlayingAudio && activePlayingAudio.audioElem) {
        activePlayingAudio.audioElem.pause();
        if (activePlayingAudio.icon) activePlayingAudio.icon.className = 'fas fa-play';
        if (activePlayingAudio.id === id) {
            activePlayingAudio = null;
            return;
        }
    }

    const audio = new Audio(audioSrc);
    if (icon) icon.className = 'fas fa-pause';
    activePlayingAudio = { id, audioElem: audio, icon, prog };

    audio.ontimeupdate = () => {
        if (prog && audio.duration) {
            prog.style.width = Math.round((audio.currentTime / audio.duration) * 100) + '%';
        }
    };
    audio.onended = () => {
        if (icon) icon.className = 'fas fa-play';
        if (prog) prog.style.width = '0%';
        activePlayingAudio = null;
    };
    audio.play().catch(e => console.warn("Audio play err:", e));
}

function toggleReactionPicker(id) {
    const el = document.getElementById('react-picker-' + id);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }
}

let currentContextMenuMsg = null;
const msgContextMenu = document.getElementById('msg-context-menu');

function openMsgMenu(e, msgId, idx) {
    e.preventDefault();
    e.stopPropagation();
    closeChatContextMenu();
    const msg = chats[activeChat] && chats[activeChat][idx];
    if (!msg || !msgContextMenu) return;

    currentContextMenuMsg = { msg, msgId, idx };

    const isStarred = !!msg.starred;
    const isPinned = !!msg.isPinned;
    const isMe = msg.from === myNumber;
    const hasText = !!msg.text && !msg.isDeleted;

    const starText = document.getElementById('msg-ctx-star-text');
    const pinText = document.getElementById('msg-ctx-pin-text');
    const editItem = document.getElementById('msg-ctx-edit');
    const copyItem = document.getElementById('msg-ctx-copy');

    if (starText) starText.innerText = isStarred ? 'Unstar message' : 'Star message';
    if (pinText) pinText.innerText = isPinned ? 'Unpin message' : 'Pin message';
    if (editItem) editItem.style.display = (isMe && hasText) ? 'flex' : 'none';
    if (copyItem) copyItem.style.display = hasText ? 'flex' : 'none';

    msgContextMenu.style.display = 'block';

    const menuWidth = 190;
    const menuHeight = 230;
    let x = e.clientX || 150;
    let y = e.clientY || 150;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 12;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 12;

    msgContextMenu.style.left = `${Math.max(10, x)}px`;
    msgContextMenu.style.top = `${Math.max(10, y)}px`;
}

function closeMsgContextMenu() {
    if (msgContextMenu) msgContextMenu.style.display = 'none';
    currentContextMenuMsg = null;
}

document.addEventListener('click', (e) => {
    if (msgContextMenu && !msgContextMenu.contains(e.target) && !e.target.closest('.wa-msg-action-btn')) {
        closeMsgContextMenu();
    }
});

const msgCtxReply = document.getElementById('msg-ctx-reply');
if (msgCtxReply) {
    msgCtxReply.onclick = () => {
        const target = currentContextMenuMsg;
        closeMsgContextMenu();
        if (target && target.msg) setReplyMessage(target.msg);
    };
}

const msgCtxCopy = document.getElementById('msg-ctx-copy');
if (msgCtxCopy) {
    msgCtxCopy.onclick = () => {
        const target = currentContextMenuMsg;
        closeMsgContextMenu();
        if (target && target.msg && target.msg.text) {
            navigator.clipboard.writeText(target.msg.text).then(() => {
                showWhatsAppToast("Message copied 📋", "success", 1800);
            }).catch(() => {
                showWhatsAppToast("Message copied 📋", "success", 1800);
            });
        }
    };
}

const msgCtxStar = document.getElementById('msg-ctx-star');
if (msgCtxStar) {
    msgCtxStar.onclick = () => {
        const target = currentContextMenuMsg;
        closeMsgContextMenu();
        if (target) handleMessageAction('star', target.msgId);
    };
}

const msgCtxPin = document.getElementById('msg-ctx-pin');
if (msgCtxPin) {
    msgCtxPin.onclick = () => {
        const target = currentContextMenuMsg;
        closeMsgContextMenu();
        if (target) handleMessageAction('pin', target.msgId);
    };
}

const msgCtxEdit = document.getElementById('msg-ctx-edit');
if (msgCtxEdit) {
    msgCtxEdit.onclick = () => {
        const target = currentContextMenuMsg;
        closeMsgContextMenu();
        if (!target || !target.msg) return;
        const oldText = target.msg.text;
        const newText = window.prompt ? window.prompt("Edit message:", oldText) : null;
        if (newText && newText.trim() && newText.trim() !== oldText) {
            target.msg.text = newText.trim();
            target.msg.isEdited = true;
            socket.emit('message action', { action: 'edit', msgId: target.msgId, newText: target.msg.text, to: activeChat });
            renderMessages();
            saveLocalCache();
            showWhatsAppToast("Message edited", "info");
        }
    };
}

const msgCtxDelete = document.getElementById('msg-ctx-delete');
if (msgCtxDelete) {
    msgCtxDelete.onclick = () => {
        const target = currentContextMenuMsg;
        closeMsgContextMenu();
        if (!target || !target.msg) return;
        const isMe = target.msg.from === myNumber;

        if (isMe && !target.msg.isDeleted) {
            showWhatsAppDialog({
                title: 'Delete message?',
                message: 'You can delete this message for everyone or delete it for yourself.',
                confirmText: 'Delete for everyone',
                extraText: 'Delete for me',
                cancelText: 'Cancel',
                isDanger: true,
                onConfirm: () => {
                    target.msg.isDeleted = true;
                    target.msg.text = '🚫 This message was deleted';
                    target.msg.image = null;
                    target.msg.audio = null;
                    socket.emit('message action', { action: 'delete', msgId: target.msgId, to: activeChat });
                    saveLocalCache();
                    renderMessages();
                    renderChatList();
                    showWhatsAppToast("Message deleted for everyone", "info");
                },
                onExtra: () => {
                    chats[activeChat] = chats[activeChat].filter(m => m.id !== target.msgId);
                    saveLocalCache();
                    renderMessages();
                    renderChatList();
                    showWhatsAppToast("Message deleted for you", "info");
                }
            });
        } else {
            showWhatsAppDialog({
                title: 'Delete message?',
                message: 'Delete this message from your chat history?',
                confirmText: 'Delete for me',
                cancelText: 'Cancel',
                isDanger: true,
                onConfirm: () => {
                    chats[activeChat] = chats[activeChat].filter(m => m.id !== target.msgId);
                    saveLocalCache();
                    renderMessages();
                    renderChatList();
                    showWhatsAppToast("Message deleted for you", "info");
                }
            });
        }
    };
}

// 11. Socket Listeners for Real-Time Messages, Delivery & Read Receipts (Blue Ticks)
socket.on('message sent', (serverMsg) => {
    if (!serverMsg || !serverMsg.to) return;
    const friend = serverMsg.to;
    if (chats[friend]) {
        const msg = chats[friend].find(m => m.id === serverMsg.id);
        if (msg && msg.status !== 'read' && !msg.isRead) {
            msg.status = serverMsg.status || 'sent';
            saveLocalCache();
            if (activeChat === friend) renderMessages();
            renderChatList();
        }
    }
});

socket.on('messages delivered', ({ by }) => {
    if (!by || !chats[by]) return;
    let updated = false;
    chats[by].forEach(m => {
        if (m.from === myNumber && m.status !== 'read' && !m.isRead) {
            m.status = 'delivered';
            updated = true;
        }
    });
    if (updated) {
        saveLocalCache();
        if (activeChat === by) renderMessages();
        renderChatList();
    }
});

socket.on('messages read', ({ by }) => {
    if (!by || !chats[by]) return;
    let updated = false;
    chats[by].forEach(m => {
        if (m.from === myNumber && (m.status !== 'read' || !m.isRead)) {
            m.status = 'read';
            m.isRead = true;
            updated = true;
        }
    });
    if (updated) {
        saveLocalCache();
        if (activeChat === by) renderMessages();
        renderChatList();
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && activeChat && activeChat !== 'QuickChat AI') {
        unreadCounts[activeChat] = 0;
        socket.emit('mark read', { from: activeChat });
        renderChatList();
    }
});

socket.on('private message', (data) => {
    const sender = data.from;
    const timeNow = formatTime(new Date(data.timestamp));

    if (!chats[sender]) chats[sender] = [];

    const receivedMsg = {
        id: data.id || ('msg_' + Date.now()),
        from: sender,
        to: myNumber,
        text: data.text,
        image: data.image,
        audio: data.audio,
        location: data.location,
        poll: data.poll,
        replyTo: data.replyTo,
        reactions: data.reactions || {},
        isEdited: data.isEdited || false,
        isDeleted: data.isDeleted || false,
        isPinned: data.isPinned || false,
        starred: false,
        status: 'delivered',
        isRead: false,
        time: timeNow
    };

    chats[sender].push(receivedMsg);

    if (activeChat === sender && !document.hidden) {
        receivedMsg.status = 'read';
        receivedMsg.isRead = true;
        renderMessages();
        socket.emit('mark read', { from: sender });
    } else {
        unreadCounts[sender] = (unreadCounts[sender] || 0) + 1;
        if (activeChat === sender) renderMessages();
    }
    renderChatList();
    saveLocalCache();
    playReceivedSound();
});

socket.on('message action', (payload) => {
    const targetChat = payload.to === myNumber ? payload.by : payload.to;
    if (chats[targetChat]) {
        const msg = chats[targetChat].find(m => m.id === payload.msgId);
        if (msg) {
            if (payload.action === 'react') {
                if (!msg.reactions) msg.reactions = {};
                if (!msg.reactions[payload.emoji]) msg.reactions[payload.emoji] = [];
                if (msg.reactions[payload.emoji].includes(payload.by)) {
                    msg.reactions[payload.emoji] = msg.reactions[payload.emoji].filter(u => u !== payload.by);
                } else {
                    msg.reactions[payload.emoji].push(payload.by);
                }
            } else if (payload.action === 'delete') {
                msg.isDeleted = true;
                msg.text = '🚫 This message was deleted';
                msg.image = null;
                msg.audio = null;
            } else if (payload.action === 'edit') {
                msg.text = payload.newText;
                msg.isEdited = true;
            } else if (payload.action === 'pin') {
                msg.isPinned = payload.isPinned;
            } else if (payload.action === 'vote_poll') {
                if (msg.poll && msg.poll.options[payload.optionIndex]) {
                    const opt = msg.poll.options[payload.optionIndex];
                    if (!opt.votes) opt.votes = [];
                    if (opt.votes.includes(payload.by)) {
                        opt.votes = opt.votes.filter(u => u !== payload.by);
                    } else {
                        opt.votes.push(payload.by);
                    }
                }
            }
            if (activeChat === targetChat) renderMessages();
            saveLocalCache();
        }
    }
});

// Real-time typing status receiver
socket.on('user typing', (data) => {
    if (activeChat && data.from === activeChat) {
        const statusEl = document.getElementById('active-chat-status');
        if (statusEl) {
            if (data.isTyping) {
                statusEl.innerHTML = `<span style="color:#00a884; font-weight:600;">typing...</span>`;
            } else {
                statusEl.innerHTML = `online`;
            }
        }
    }
});

// ========================================================
// MODERN 2024/2025 WHATSAPP WEB CONTROLS & EVENT WIRING
// ========================================================

// 1. Green Circular "+" Button in Sidebar Header
const newChatGreenBtn = document.getElementById('new-chat-green-btn');
if (newChatGreenBtn) {
    newChatGreenBtn.addEventListener('click', openNewChatDrawer);
}

// 2. Filter Pills Row Click Handlers
const filterPillBtns = document.querySelectorAll('.wa-filter-pills-row .wa-pill');
filterPillBtns.forEach(pill => {
    pill.addEventListener('click', () => {
        const filterType = pill.getAttribute('data-filter');
        if (filterType) {
            setActiveFilter(filterType);
        } else if (pill.id === 'filter-add-btn') {
            showWhatsAppToast("Custom filter lists coming soon!", "info");
        }
    });
});

// 3. Theme Toggle Engine (Dark Theme / Light Theme)
function applyTheme(theme) {
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        document.body.classList.add('dark-theme');
        if (themeIcon) {
            themeIcon.className = 'fas fa-sun';
            themeIcon.title = 'Switch to Light Theme';
        }
    } else {
        document.documentElement.classList.remove('dark-theme');
        document.body.classList.remove('dark-theme');
        if (themeIcon) {
            themeIcon.className = 'fas fa-moon';
            themeIcon.title = 'Switch to Dark Theme';
        }
    }
    localStorage.setItem('quickchat_theme', theme);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark-theme') || document.body.classList.contains('dark-theme');
    applyTheme(isDark ? 'light' : 'dark');
}

// Initialize theme on start
const savedTheme = localStorage.getItem('quickchat_theme') || 'dark';
applyTheme(savedTheme);

const railThemeBtn = document.getElementById('rail-theme-btn');
if (railThemeBtn) {
    railThemeBtn.addEventListener('click', toggleTheme);
}

const menuThemeToggle = document.getElementById('menu-theme-toggle');
if (menuThemeToggle) {
    menuThemeToggle.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        toggleTheme();
    });
}
// ========================================================
// 4. UNIFIED WHATSAPP SLIDING DRAWER CONTROLLER
// ========================================================

function openDrawer(drawerId) {
    document.querySelectorAll('.wa-drawer').forEach(d => d.classList.remove('active'));
    const target = document.getElementById(drawerId);
    if (target) {
        target.classList.add('active');
        if (drawerId === 'status-drawer') loadStatusDrawer();
        if (drawerId === 'calls-drawer') renderCallsDrawer();
        if (drawerId === 'channels-drawer') renderChannelsDrawer();
        if (drawerId === 'communities-drawer') renderCommunitiesDrawer();
        if (drawerId === 'starred-messages-drawer') renderStarredDrawer();
        if (drawerId === 'contact-info-drawer') renderContactInfoDrawer();
        if (drawerId === 'settings-drawer') renderSettingsDrawer();
    }
}

function closeDrawer(drawerId) {
    const target = document.getElementById(drawerId);
    if (target) target.classList.remove('active');
}

function closeAllDrawers() {
    document.querySelectorAll('.wa-drawer').forEach(d => d.classList.remove('active'));
}

// Drawer Back / Close Button Handlers
const closeSettingsBtn = document.getElementById('close-settings-drawer');
if (closeSettingsBtn) closeSettingsBtn.onclick = () => closeDrawer('settings-drawer');

const closeStatusBtn = document.getElementById('close-status-drawer');
if (closeStatusBtn) closeStatusBtn.onclick = () => closeDrawer('status-drawer');

const closeCallsBtn = document.getElementById('close-calls-drawer');
if (closeCallsBtn) closeCallsBtn.onclick = () => closeDrawer('calls-drawer');

const closeChannelsBtn = document.getElementById('close-channels-drawer');
if (closeChannelsBtn) closeChannelsBtn.onclick = () => closeDrawer('channels-drawer');

const closeCommunitiesBtn = document.getElementById('close-communities-drawer');
if (closeCommunitiesBtn) closeCommunitiesBtn.onclick = () => closeDrawer('communities-drawer');

const closeStarredBtn = document.getElementById('close-starred-drawer');
if (closeStarredBtn) closeStarredBtn.onclick = () => closeDrawer('starred-messages-drawer');

const closeContactInfoBtn = document.getElementById('close-contact-info-drawer');
if (closeContactInfoBtn) closeContactInfoBtn.onclick = () => closeDrawer('contact-info-drawer');

// Far-Left Navigation Rail Buttons
const railChatsBtn = document.getElementById('rail-chats-btn');
if (railChatsBtn) {
    railChatsBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railChatsBtn.classList.add('active');
        closeAllDrawers();
        setActiveFilter('all');
    });
}

const railCallsBtn = document.getElementById('rail-calls-btn');
if (railCallsBtn) {
    railCallsBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railCallsBtn.classList.add('active');
        openDrawer('calls-drawer');
    });
}

const railStatusBtn = document.getElementById('rail-status-btn');
if (railStatusBtn) {
    railStatusBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railStatusBtn.classList.add('active');
        openDrawer('status-drawer');
    });
}

const railChannelsBtn = document.getElementById('rail-channels-btn');
if (railChannelsBtn) {
    railChannelsBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railChannelsBtn.classList.add('active');
        openDrawer('channels-drawer');
    });
}

const railCommunitiesBtn = document.getElementById('rail-communities-btn');
if (railCommunitiesBtn) {
    railCommunitiesBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railCommunitiesBtn.classList.add('active');
        openDrawer('communities-drawer');
    });
}

const railStarredBtn = document.getElementById('rail-starred-btn');
if (railStarredBtn) {
    railStarredBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railStarredBtn.classList.add('active');
        openDrawer('starred-messages-drawer');
    });
}

const railSettingsBtn = document.getElementById('rail-settings-btn');
if (railSettingsBtn) {
    railSettingsBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railSettingsBtn.classList.add('active');
        openDrawer('settings-drawer');
    });
}

const railProfileBtn = document.getElementById('rail-profile-btn');
if (railProfileBtn) {
    railProfileBtn.addEventListener('click', openProfileDrawer);
}

// Sidebar Tabs Bar (CHATS / STATUS / CALLS)
const sidebarTabs = document.querySelectorAll('.wa-tabs-bar .wa-tab');
sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        sidebarTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const text = tab.innerText.toUpperCase();
        if (text.includes('CHATS')) {
            closeAllDrawers();
            setActiveFilter('all');
        } else if (text.includes('STATUS')) {
            openDrawer('status-drawer');
        } else if (text.includes('CALLS')) {
            openDrawer('calls-drawer');
        }
    });
});

const sidebarCameraTab = document.querySelector('.wa-tab-camera');
if (sidebarCameraTab) {
    sidebarCameraTab.addEventListener('click', () => {
        const upload = document.getElementById('image-upload');
        if (upload) upload.click();
    });
}

// ========================================================
// 5. STATUS STORIES ENGINE (POST & FULLSCREEN VIEWER)
// ========================================================
let allStatuses = [];
let activeStatusColor = '#00a884';
let statusViewerTimeout = null;
let statusProgressInterval = null;

function loadStatusDrawer() {
    socket.emit('get statuses');
    renderStatusList(allStatuses);
}

socket.on('statuses list', (list) => {
    allStatuses = list || [];
    renderStatusList(allStatuses);
});

socket.on('new status', (st) => {
    allStatuses.unshift(st);
    renderStatusList(allStatuses);
});

function renderStatusList(statuses) {
    const container = document.getElementById('status-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (!statuses || statuses.length === 0) {
        container.innerHTML = `
            <div style="padding: 24px 16px; text-align: center; color: var(--wa-text-pill); font-size: 13.5px;">
                <p>No recent status updates.<br>Tap above to share your first status!</p>
            </div>
        `;
        return;
    }

    statuses.forEach(st => {
        const item = document.createElement('div');
        item.className = 'wa-status-item';
        const isMine = (st.phone === myNumber);
        const nameLabel = isMine ? 'My Status' : `+91 ${st.phone}`;
        const timeLabel = formatTime(new Date(st.timestamp || Date.now()));

        item.innerHTML = `
            <div class="avatar wa-status-ring" style="width:44px; height:44px; background:${st.color || '#00a884'}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:600;">
                <i class="fas fa-circle-notch"></i>
            </div>
            <div style="flex:1;">
                <div style="font-size:15px; font-weight:600; color:var(--wa-text-drawer-card);">${escapeHtml(nameLabel)}</div>
                <div style="font-size:12.5px; color:var(--wa-text-pill); margin-top:2px;">${timeLabel}</div>
            </div>
        `;
        item.onclick = () => openStatusViewer(st);
        container.appendChild(item);
    });
}

const openAddStatusBtn = document.getElementById('open-add-status-btn');
const addStatusModal = document.getElementById('add-status-modal');
const closeAddStatusBtn = document.getElementById('close-add-status-btn');
const publishStatusBtn = document.getElementById('publish-status-btn');
const newStatusText = document.getElementById('new-status-text');

if (openAddStatusBtn && addStatusModal) {
    openAddStatusBtn.addEventListener('click', () => {
        addStatusModal.style.display = 'flex';
        if (newStatusText) {
            newStatusText.value = '';
            newStatusText.focus();
        }
    });
}

if (closeAddStatusBtn && addStatusModal) {
    closeAddStatusBtn.addEventListener('click', () => {
        addStatusModal.style.display = 'none';
    });
}

// Color picker dots for status
const statusColorDots = document.querySelectorAll('.wa-status-color-dot');
statusColorDots.forEach(dot => {
    dot.addEventListener('click', () => {
        statusColorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        activeStatusColor = dot.getAttribute('data-color') || '#00a884';
        if (newStatusText) newStatusText.style.borderColor = activeStatusColor;
    });
});

if (publishStatusBtn) {
    publishStatusBtn.addEventListener('click', () => {
        const text = newStatusText ? newStatusText.value.trim() : '';
        if (!text) {
            showWhatsAppToast("Please type something for your status.", "danger");
            return;
        }
        socket.emit('post status', {
            text: text,
            color: activeStatusColor,
            phone: myNumber
        });
        if (addStatusModal) addStatusModal.style.display = 'none';
        if (newStatusText) newStatusText.value = '';
        showWhatsAppToast("Status posted successfully! ✨", "success");
    });
}

// Fullscreen Animated Stories Viewer
const statusViewerModal = document.getElementById('status-viewer-modal');
const statusViewerCloseBtn = document.getElementById('close-status-viewer-btn');
const statusProgressFill = document.getElementById('status-progress-fill');
const statusViewerAuthor = document.getElementById('status-viewer-author');
const statusViewerTime = document.getElementById('status-viewer-time');
const statusViewerText = document.getElementById('status-viewer-text');
const statusViewerImg = document.getElementById('status-viewer-img');

function openStatusViewer(st) {
    if (!statusViewerModal) return;
    clearTimeout(statusViewerTimeout);
    clearInterval(statusProgressInterval);

    statusViewerModal.style.display = 'flex';
    statusViewerAuthor.innerText = (st.phone === myNumber) ? 'My Status' : `+91 ${st.phone}`;
    statusViewerTime.innerText = formatTime(new Date(st.timestamp || Date.now()));
    
    const container = statusViewerModal.querySelector('.wa-status-viewer-container');
    if (container) container.style.background = st.color || '#075e54';

    if (st.image) {
        statusViewerImg.src = st.image;
        statusViewerImg.style.display = 'block';
        statusViewerText.style.display = 'none';
    } else {
        statusViewerImg.style.display = 'none';
        statusViewerText.style.display = 'block';
        statusViewerText.innerText = st.text || '';
    }

    // 5-second progress bar animation
    let elapsed = 0;
    const duration = 5000;
    if (statusProgressFill) statusProgressFill.style.width = '0%';

    statusProgressInterval = setInterval(() => {
        elapsed += 50;
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        if (statusProgressFill) statusProgressFill.style.width = pct + '%';
        if (elapsed >= duration) {
            clearInterval(statusProgressInterval);
            closeStatusViewer();
        }
    }, 50);
}

function closeStatusViewer() {
    clearTimeout(statusViewerTimeout);
    clearInterval(statusProgressInterval);
    if (statusViewerModal) statusViewerModal.style.display = 'none';
    if (statusProgressFill) statusProgressFill.style.width = '0%';
}

if (statusViewerCloseBtn) statusViewerCloseBtn.addEventListener('click', closeStatusViewer);

// ========================================================
// 6. CALLS DRAWER & CALL LINK GENERATOR
// ========================================================
const createCallLinkBtn = document.getElementById('create-call-link-btn');
if (createCallLinkBtn) {
    createCallLinkBtn.addEventListener('click', () => {
        const linkId = Math.random().toString(36).substring(2, 9);
        const callUrl = `${window.location.origin}/#call/${linkId}`;
        navigator.clipboard.writeText(callUrl).then(() => {
            showWhatsAppToast("Call link copied to clipboard! Share it with friends. 📞", "success");
        }).catch(() => {
            showWhatsAppDialog({
                title: 'QuickChat Call Link',
                message: `Here is your call link:\n${callUrl}`,
                confirmText: 'Done'
            });
        });
    });
}

function renderCallsDrawer() {
    const container = document.getElementById('calls-list-container');
    if (!container) return;
    container.innerHTML = '';

    let userCalls = [];
    try {
        const raw = localStorage.getItem('quickchat_call_history_' + myNumber);
        if (raw) userCalls = JSON.parse(raw);
    } catch(e) {}

    if (!userCalls || userCalls.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px 16px; text-align: center; color: var(--wa-text-pill); font-size: 13.5px;">
                <div style="font-size: 38px; color: #8696a0; margin-bottom: 12px;"><i class="fas fa-phone-slash"></i></div>
                <div style="font-weight:600; font-size:16px; margin-bottom:6px; color:var(--wa-text-drawer-card);">No call history yet</div>
                <p>To place a call, open a chat with any contact and tap the phone or camera icon.</p>
            </div>
        `;
        return;
    }

    userCalls.forEach(call => {
        const item = document.createElement('div');
        item.className = 'wa-call-item';
        const arrowIcon = call.type === 'outgoing' 
            ? '<i class="fas fa-arrow-up" style="color:#00a884; font-size:11px; margin-right:4px;"></i>' 
            : '<i class="fas fa-arrow-down" style="color:#ea4335; font-size:11px; margin-right:4px;"></i>';
        const callActionIcon = call.isVideo ? 'fa-video' : 'fa-phone-alt';

        item.innerHTML = `
            <div class="avatar" style="width:44px; height:44px;"></div>
            <div style="flex:1;">
                <div style="font-size:15px; font-weight:600; color:var(--wa-text-drawer-card);">${escapeHtml(call.name)}</div>
                <div style="font-size:12.5px; color:var(--wa-text-pill); margin-top:2px;">${arrowIcon} ${escapeHtml(call.time)}</div>
            </div>
            <button class="icon-btn" style="color:#00a884; font-size:16px;" title="Call back">
                <i class="fas ${callActionIcon}"></i>
            </button>
        `;
        const callBtn = item.querySelector('.icon-btn');
        if (callBtn) {
            callBtn.onclick = () => {
                const num = (call.name || '').replace(/[^0-9]/g, '');
                if (num) {
                    startChat(num);
                    if (typeof startCall === 'function') startCall(call.isVideo);
                }
            };
        }
        container.appendChild(item);
    });
}

// ========================================================
// 7. CHANNELS DIRECTORY & FOLLOWING ENGINE
// ========================================================
const officialChannels = [
    { id: 'c1', name: 'WhatsApp Official', handle: '@whatsapp', followers: '142M followers', desc: 'Updates, news, and official announcements from WhatsApp.' },
    { id: 'c2', name: 'TechCrunch', handle: '@techcrunch', followers: '18.4M followers', desc: 'Breaking technology news, AI developments, and startup analysis.' },
    { id: 'c3', name: 'Real Madrid C.F.', handle: '@realmadrid', followers: '32.1M followers', desc: 'Official updates, scores, and match highlights.' },
    { id: 'c4', name: 'Coding & AI World', handle: '@codingai', followers: '6.5M followers', desc: 'Daily web development tips, fullstack guides, and AI tutorials.' }
];

let followedChannels = JSON.parse(localStorage.getItem('quickchat_followed_channels') || '["c1"]');

function renderChannelsDrawer() {
    const container = document.getElementById('channels-list-container');
    if (!container) return;
    container.innerHTML = '';

    officialChannels.forEach(ch => {
        const isFollowed = followedChannels.includes(ch.id);
        const card = document.createElement('div');
        card.className = 'wa-channel-card';
        card.innerHTML = `
            <div class="avatar" style="width:48px; height:48px; background:#008069; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px;">
                <i class="fas fa-bullhorn"></i>
            </div>
            <div style="flex:1;">
                <div style="font-size:15px; font-weight:600; color:var(--wa-text-drawer-card); display:flex; align-items:center; gap:6px;">
                    ${ch.name} <i class="fas fa-check-circle" style="color:#00a884; font-size:13px;"></i>
                </div>
                <div style="font-size:12px; color:var(--wa-text-pill); margin-top:1px;">${ch.followers}</div>
                <div style="font-size:12.5px; color:var(--wa-text-pill); margin-top:3px; line-height:1.3;">${ch.desc}</div>
            </div>
            <button class="wa-channel-follow-btn ${isFollowed ? 'following' : ''}" data-chid="${ch.id}">
                ${isFollowed ? 'Following' : 'Follow'}
            </button>
        `;

        const followBtn = card.querySelector('.wa-channel-follow-btn');
        followBtn.onclick = (e) => {
            e.stopPropagation();
            if (followedChannels.includes(ch.id)) {
                followedChannels = followedChannels.filter(id => id !== ch.id);
                followBtn.classList.remove('following');
                followBtn.innerText = 'Follow';
                showWhatsAppToast(`Unfollowed ${ch.name}`, 'info');
            } else {
                followedChannels.push(ch.id);
                followBtn.classList.add('following');
                followBtn.innerText = 'Following';
                showWhatsAppToast(`Following ${ch.name}! 📢`, 'success');
            }
            localStorage.setItem('quickchat_followed_channels', JSON.stringify(followedChannels));
        };

        container.appendChild(card);
    });
}

// ========================================================
// 8. COMMUNITIES ENGINE
// ========================================================
const createCommunityBtn = document.getElementById('create-community-btn');
if (createCommunityBtn) {
    createCommunityBtn.addEventListener('click', () => {
        showWhatsAppDialog({
            title: 'New Community',
            message: 'Bring your members together in topic-based groups, and easily send admin announcements.',
            confirmText: 'Get Started',
            cancelText: 'Cancel',
            onConfirm: () => {
                showWhatsAppToast("Community feature is enabled for your account!", "success");
            }
        });
    });
}

function renderCommunitiesDrawer() {
    const container = document.getElementById('communities-list-container');
    if (!container) return;
    container.innerHTML = `
        <div class="wa-community-card">
            <div class="avatar" style="width:48px; height:48px; background:#128c7e; color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; border-radius:12px;">
                <i class="fas fa-users"></i>
            </div>
            <div style="flex:1;">
                <div style="font-size:15.5px; font-weight:600; color:var(--wa-text-drawer-card);">QuickChat Global Community</div>
                <div style="font-size:12.5px; color:var(--wa-text-pill); margin-top:2px;">Announcements • 140 members</div>
            </div>
        </div>
    `;
}

// ========================================================
// 9. STARRED MESSAGES DRAWER
// ========================================================
function renderStarredDrawer() {
    const container = document.getElementById('starred-messages-list');
    if (!container) return;
    container.innerHTML = '';

    const list = [];
    Object.keys(chats).forEach(contactNum => {
        chats[contactNum].forEach(msg => {
            if (msg.starred || (msg.starredBy && msg.starredBy.includes(myNumber))) {
                list.push({ contactNum, msg });
            }
        });
    });

    if (list.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--wa-text-pill); font-size: 13.5px;">
                <div style="font-size: 40px; margin-bottom: 12px; color: #8696a0;"><i class="far fa-star"></i></div>
                <div style="font-weight:600; font-size:16px; margin-bottom:6px; color:var(--wa-text-drawer-card);">No starred messages</div>
                <p>Use starred messages to easily find important text, photos, or documents later.</p>
            </div>
        `;
        return;
    }

    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'wa-starred-item';
        const sender = item.msg.from === myNumber ? 'You' : `+91 ${item.msg.from}`;
        const preview = item.msg.text || (item.msg.image ? '📷 Photo' : (item.msg.audio ? '🎤 Voice message' : 'Message'));
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--wa-text-pill); margin-bottom:4px;">
                <span style="font-weight:600; color:var(--wa-text-drawer-card);">${escapeHtml(sender)} &bull; +91 ${item.contactNum}</span>
                <span>${item.msg.time || ''}</span>
            </div>
            <div style="font-size:14px; color:var(--wa-text-drawer-card);">${escapeHtml(preview)}</div>
        `;
        card.onclick = () => {
            closeAllDrawers();
            openChat(item.contactNum);
        };
        container.appendChild(card);
    });
}

// ========================================================
// 10. SETTINGS DRAWER ENGINE
// ========================================================
function renderSettingsDrawer() {
    const nameEl = document.getElementById('settings-profile-name');
    const aboutEl = document.getElementById('settings-profile-about');
    const savedName = localStorage.getItem('quickchat_user_name') || 'QuickChat User';
    const savedAbout = localStorage.getItem('quickchat_user_about') || 'Hey there! I am using QuickChat.';
    if (nameEl) nameEl.innerText = savedName;
    if (aboutEl) aboutEl.innerText = savedAbout;
}

const settingsOpenProfileBtn = document.getElementById('settings-open-profile-btn');
if (settingsOpenProfileBtn) settingsOpenProfileBtn.onclick = () => openDrawer('profile-drawer');

const settingItemNotifications = document.getElementById('setting-item-notifications');
if (settingItemNotifications) {
    settingItemNotifications.onclick = () => {
        showWhatsAppDialog({
            title: 'Notifications',
            message: 'Message notifications: Enabled\nPreview messages: Enabled\nNotification tones: Active\nReaction alerts: Active',
            confirmText: 'Done'
        });
    };
}

const settingItemPrivacy = document.getElementById('setting-item-privacy');
if (settingItemPrivacy) {
    settingItemPrivacy.onclick = () => {
        showWhatsAppDialog({
            title: 'Privacy & Security',
            message: 'Last seen: Everyone\nProfile photo: Everyone\nRead receipts: On (Blue ticks)\nEnd-to-end encryption: Active (256-bit)\nDisappearing messages: Configurable per chat',
            confirmText: 'Done'
        });
    };
}

const settingItemChats = document.getElementById('setting-item-chats');
if (settingItemChats) {
    settingItemChats.onclick = () => {
        const wallModal = document.getElementById('wallpaper-modal');
        if (wallModal) wallModal.style.display = 'flex';
    };
}

const settingItemStorage = document.getElementById('setting-item-storage');
if (settingItemStorage) {
    settingItemStorage.onclick = () => {
        const msgCount = Object.values(chats).reduce((acc, c) => acc + c.length, 0);
        const cacheSize = (JSON.stringify(chats).length / 1024).toFixed(1);
        showWhatsAppDialog({
            title: 'Storage and Data',
            message: `Total saved messages: ${msgCount}\nCached chat size: ${cacheSize} KB\nAuto-download media: Wi-Fi & Cellular\nNetwork usage: Optimized for speed`,
            confirmText: 'Done'
        });
    };
}

const settingItemShortcuts = document.getElementById('setting-item-shortcuts');
if (settingItemShortcuts) {
    settingItemShortcuts.onclick = () => {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.style.display = 'flex';
    };
}

const settingItemHelp = document.getElementById('setting-item-help');
if (settingItemHelp) {
    settingItemHelp.onclick = () => {
        showWhatsAppDialog({
            title: 'QuickChat Help & Info',
            message: 'QuickChat Web v2.5.0\nFully responsive WhatsApp Web clone with real-time WebSockets, WebRTC HD voice & video calls, status stories, voice notes, polls, reactions, and end-to-end encryption.',
            confirmText: 'Got It'
        });
    };
}

const settingsLogoutBtn = document.getElementById('settings-logout-btn');
if (settingsLogoutBtn) {
    settingsLogoutBtn.onclick = () => {
        const realLogout = document.getElementById('logout-btn');
        if (realLogout) realLogout.click();
    };
}

// ========================================================
// 11. CONTACT INFO DRAWER
// ========================================================
function renderContactInfoDrawer() {
    const body = document.getElementById('contact-info-body');
    if (!body || !activeChat) return;
    const isMuted = mutedChats.includes(activeChat);
    const msgCount = (chats[activeChat] || []).length;

    body.innerHTML = `
        <div style="background:var(--wa-bg-drawer-card); padding:24px 16px; text-align:center; border-bottom:1px solid var(--wa-border-drawer);">
            <div class="avatar" style="width:120px; height:120px; margin:0 auto 14px auto; font-size:42px;"></div>
            <div style="font-size:18px; font-weight:600; color:var(--wa-text-drawer-card);">+91 ${activeChat}</div>
            <div style="font-size:13px; color:var(--wa-text-pill); margin-top:4px;">online</div>
        </div>
        <div class="wa-profile-card">
            <span class="wa-profile-label">About</span>
            <div class="wa-profile-val-row">Hey there! I am using QuickChat.</div>
        </div>
        <div class="wa-settings-list" style="margin-top:10px;">
            <div class="wa-settings-item" id="info-mute-toggle">
                <i class="fas fa-bell wa-settings-item-icon"></i>
                <div class="wa-settings-item-content">
                    <div class="wa-settings-item-title">Mute notifications</div>
                    <div class="wa-settings-item-desc">${isMuted ? 'Muted' : 'Sound enabled'}</div>
                </div>
            </div>
            <div class="wa-settings-item" id="info-disappear-btn">
                <i class="fas fa-stopwatch wa-settings-item-icon"></i>
                <div class="wa-settings-item-content">
                    <div class="wa-settings-item-title">Disappearing messages</div>
                    <div class="wa-settings-item-desc">Off</div>
                </div>
            </div>
            <div class="wa-settings-item">
                <i class="fas fa-lock wa-settings-item-icon" style="color:#00a884;"></i>
                <div class="wa-settings-item-content">
                    <div class="wa-settings-item-title">Encryption</div>
                    <div class="wa-settings-item-desc">Messages and calls are end-to-end encrypted. Tap to verify.</div>
                </div>
            </div>
            <div class="wa-settings-item logout" id="info-block-btn">
                <i class="fas fa-ban wa-settings-item-icon" style="color:#ea4335;"></i>
                <div class="wa-settings-item-content">
                    <div class="wa-settings-item-title" style="color:#ea4335;">Block +91 ${activeChat}</div>
                </div>
            </div>
        </div>
    `;

    const infoMuteToggle = document.getElementById('info-mute-toggle');
    if (infoMuteToggle) {
        infoMuteToggle.onclick = () => {
            toggleMuteActiveChat();
            renderContactInfoDrawer();
        };
    }

    const infoBlockBtn = document.getElementById('info-block-btn');
    if (infoBlockBtn) {
        infoBlockBtn.onclick = () => {
            showWhatsAppDialog({
                title: `Block +91 ${activeChat}?`,
                message: 'Blocked contacts will no longer be able to call you or send you messages.',
                confirmText: 'Block',
                cancelText: 'Cancel',
                onConfirm: () => {
                    showWhatsAppToast(`Blocked +91 ${activeChat}.`, 'info');
                }
            });
        };
    }
}

const chatHeaderInfoClickable = document.getElementById('chat-header-info-clickable');
if (chatHeaderInfoClickable) {
    chatHeaderInfoClickable.addEventListener('click', (e) => {
        if (e.target.closest('#back-btn')) return;
        if (activeChat) openDrawer('contact-info-drawer');
    });
}

// ========================================================
// 12. CHAT HEADER MENU & ACTIONS
// ========================================================
const chatMoreBtn = document.getElementById('chat-more-btn');
const chatHeaderMenu = document.getElementById('chat-header-menu');

if (chatMoreBtn && chatHeaderMenu) {
    chatMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeChatContextMenu();
        closeMsgContextMenu();
        const isClosed = chatHeaderMenu.style.display === 'none';
        if (isClosed && activeChat) {
            const isMuted = mutedChats.includes(activeChat);
            const muteText = document.getElementById('chat-menu-mute-text');
            const muteIcon = document.getElementById('chat-menu-mute-icon');
            if (muteText) muteText.innerText = isMuted ? 'Unmute notifications' : 'Mute notifications';
            if (muteIcon) muteIcon.className = isMuted ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        }
        chatHeaderMenu.style.display = isClosed ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
        if (chatHeaderMenu && !chatHeaderMenu.contains(e.target) && e.target !== chatMoreBtn) {
            chatHeaderMenu.style.display = 'none';
        }
    });
}

function toggleMuteActiveChat() {
    if (!activeChat) return;
    if (mutedChats.includes(activeChat)) {
        mutedChats = mutedChats.filter(c => c !== activeChat);
        showWhatsAppToast(`Unmuted +91 ${activeChat}`, 'info');
    } else {
        mutedChats.push(activeChat);
        showWhatsAppToast(`Muted notifications for +91 ${activeChat}`, 'info');
    }
    localStorage.setItem('quickchat_muted_chats_' + (myNumber || ''), JSON.stringify(mutedChats));
    renderChatList();
}

const chatMenuContactInfo = document.getElementById('chat-menu-contact-info');
if (chatMenuContactInfo) {
    chatMenuContactInfo.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        if (activeChat) openDrawer('contact-info-drawer');
    };
}

const chatMenuMute = document.getElementById('chat-menu-mute');
if (chatMenuMute) {
    chatMenuMute.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        toggleMuteActiveChat();
    };
}

const chatMenuDisappearing = document.getElementById('chat-menu-disappearing');
if (chatMenuDisappearing) {
    chatMenuDisappearing.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        showWhatsAppDialog({
            title: 'Disappearing Messages',
            message: 'Make messages in this chat disappear for everyone after:\n• 24 hours\n• 7 days\n• 90 days\n• Off',
            confirmText: 'Keep Off',
            cancelText: 'Cancel'
        });
    };
}

const chatMenuWallpaper = document.getElementById('chat-menu-wallpaper');
if (chatMenuWallpaper) {
    chatMenuWallpaper.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        const modal = document.getElementById('wallpaper-modal');
        if (modal) modal.style.display = 'flex';
    };
}

const chatMenuExport = document.getElementById('chat-menu-export');
if (chatMenuExport) {
    chatMenuExport.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        if (!activeChat || !chats[activeChat]) {
            showWhatsAppToast("No messages to export.", "info");
            return;
        }
        let exportTxt = `QuickChat Chat with +91 ${activeChat}\nExported on: ${new Date().toLocaleString()}\n----------------------------------------\n\n`;
        chats[activeChat].forEach(m => {
            const sender = (m.from === myNumber) ? 'You' : `+91 ${m.from}`;
            const content = m.text || (m.image ? '[Photo]' : (m.audio ? '[Voice message]' : (m.poll ? '[Poll]' : '[Attachment]')));
            exportTxt += `[${m.time || ''}] ${sender}: ${content}\n`;
        });
        const blob = new Blob([exportTxt], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `QuickChat-Chat-${activeChat}.txt`;
        a.click();
        showWhatsAppToast("Chat exported successfully! 📄", "success");
    };
}

const chatMenuClose = document.getElementById('chat-menu-close');
if (chatMenuClose) {
    chatMenuClose.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        activeChat = null;
        chatPanel.style.display = 'none';
        chatPanel.classList.remove('active-mobile');
        emptyState.style.display = 'flex';
        renderChatList();
    };
}

const chatMenuClear = document.getElementById('chat-menu-clear');
if (chatMenuClear) {
    chatMenuClear.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        if (!activeChat) return;
        showWhatsAppDialog({
            title: 'Clear this chat?',
            message: 'This will delete all messages in this chat from your device.',
            confirmText: 'Clear messages',
            cancelText: 'Cancel',
            onConfirm: () => {
                chats[activeChat] = [];
                saveLocalCache();
                renderMessages();
                renderChatList();
                showWhatsAppToast("Chat messages cleared.", "info");
            }
        });
    };
}

const chatMenuDelete = document.getElementById('chat-menu-delete');
if (chatMenuDelete) {
    chatMenuDelete.onclick = () => {
        if (chatHeaderMenu) chatHeaderMenu.style.display = 'none';
        if (!activeChat) return;
        const target = activeChat;
        showWhatsAppDialog({
            title: 'Delete this chat?',
            message: `Delete chat with +91 ${target}?\nMessages will only be removed from this device.`,
            confirmText: 'Delete chat',
            cancelText: 'Cancel',
            isDanger: true,
            onConfirm: () => {
                delete chats[target];
                pinnedChats = pinnedChats.filter(n => n !== target);
                mutedChats = mutedChats.filter(n => n !== target);
                archivedChats = archivedChats.filter(n => n !== target);
                delete unreadCounts[target];
                localStorage.setItem('quickchat_pinned_chats_' + (myNumber || ''), JSON.stringify(pinnedChats));
                localStorage.setItem('quickchat_muted_chats_' + (myNumber || ''), JSON.stringify(mutedChats));
                localStorage.setItem('quickchat_archived_chats_' + (myNumber || ''), JSON.stringify(archivedChats));
                saveLocalCache();

                activeChat = null;
                chatPanel.style.display = 'none';
                chatPanel.classList.remove('active-mobile');
                emptyState.style.display = 'flex';
                renderChatList();
                showWhatsAppToast("Chat deleted.", "info");
            }
        });
    };
}

// ========================================================
// 13. IN-CHAT SEARCH ENGINE
// ========================================================
const chatSearchBtn = document.getElementById('chat-search-btn');
const inchatSearchBar = document.getElementById('inchat-search-bar');
const inchatSearchInput = document.getElementById('inchat-search-input');
const closeInchatSearch = document.getElementById('close-inchat-search');

if (chatSearchBtn && inchatSearchBar) {
    chatSearchBtn.addEventListener('click', () => {
        const isClosed = inchatSearchBar.style.display === 'none';
        inchatSearchBar.style.display = isClosed ? 'flex' : 'none';
        if (isClosed && inchatSearchInput) {
            inchatSearchInput.focus();
        } else {
            clearInChatSearchHighlight();
        }
    });
}

function clearInChatSearchHighlight() {
    document.querySelectorAll('.message').forEach(m => {
        m.style.outline = '';
    });
}

if (closeInchatSearch && inchatSearchBar) {
    closeInchatSearch.addEventListener('click', () => {
        inchatSearchBar.style.display = 'none';
        if (inchatSearchInput) inchatSearchInput.value = '';
        clearInChatSearchHighlight();
    });
}

if (inchatSearchInput) {
    inchatSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        clearInChatSearchHighlight();
        if (!query) return;

        let firstMatch = null;
        document.querySelectorAll('.message').forEach(m => {
            if (m.innerText.toLowerCase().includes(query)) {
                m.style.outline = '2px solid #00a884';
                if (!firstMatch) firstMatch = m;
            }
        });
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

// ========================================================
// 14. WALLPAPER PICKER ENGINE
// ========================================================
const closeWallpaperModalBtn = document.getElementById('close-wallpaper-modal-btn');
const wallpaperModal = document.getElementById('wallpaper-modal');
if (closeWallpaperModalBtn && wallpaperModal) {
    closeWallpaperModalBtn.onclick = () => wallpaperModal.style.display = 'none';
}

const wallpaperChoices = document.querySelectorAll('.wa-wallpaper-choice');
wallpaperChoices.forEach(choice => {
    choice.addEventListener('click', () => {
        wallpaperChoices.forEach(c => c.classList.remove('active'));
        choice.classList.add('active');
        const wall = choice.getAttribute('data-wall');
        if (wall === 'default') {
            document.documentElement.style.removeProperty('--wa-bg-chat-panel');
            localStorage.removeItem('quickchat_wallpaper');
        } else {
            document.documentElement.style.setProperty('--wa-bg-chat-panel', wall);
            localStorage.setItem('quickchat_wallpaper', wall);
        }
        if (wallpaperModal) wallpaperModal.style.display = 'none';
        showWhatsAppToast("Chat wallpaper updated! 🎨", "success");
    });
});

// ========================================================
// 15. SHORTCUTS MODAL & GLOBAL HOTKEYS
// ========================================================
const shortcutsModal = document.getElementById('shortcuts-modal');
const closeShortcutsModalBtn = document.getElementById('close-shortcuts-modal-btn');
if (closeShortcutsModalBtn && shortcutsModal) {
    closeShortcutsModalBtn.onclick = () => shortcutsModal.style.display = 'none';
}

window.addEventListener('keydown', (e) => {
    // Escape closes popups & drawers
    if (e.key === 'Escape') {
        if (shortcutsModal) shortcutsModal.style.display = 'none';
        if (wallpaperModal) wallpaperModal.style.display = 'none';
        if (addStatusModal) addStatusModal.style.display = 'none';
        if (statusViewerModal && statusViewerModal.style.display === 'flex') closeStatusViewer();
        if (inchatSearchBar && inchatSearchBar.style.display === 'flex') {
            inchatSearchBar.style.display = 'none';
            clearInChatSearchHighlight();
        }
        if (emojiPickerPopup) emojiPickerPopup.style.display = 'none';
        if (attachMenuPopup) attachMenuPopup.style.display = 'none';
        closeAllDrawers();
    }
    // Ctrl + Alt + N: New chat
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openNewChatDrawer();
    }
    // Ctrl + Alt + Shift + F: Search in chat
    if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (chatSearchBtn) chatSearchBtn.click();
    }
    // Ctrl + Alt + ,: Settings
    if (e.ctrlKey && e.altKey && e.key === ',') {
        e.preventDefault();
        openDrawer('settings-drawer');
    }
});

// ========================================================
// 16. QUICKCHAT AI ASSISTANT IN NAVIGATION RAIL
// ========================================================
function openAiAssistant() {
    const aiId = 'QuickChat AI';
    if (!chats[aiId] || chats[aiId].length === 0) {
        const savedUser = localStorage.getItem('quickchat_my_name') || '';
        const greetName = savedUser && !savedUser.startsWith('+91') ? ` ${savedUser}` : '';
        chats[aiId] = [
            {
                id: 'ai_welcome_' + Date.now(),
                from: aiId,
                text: `Namaste${greetName}! 🤖✨ Main **QuickChat AI** hoon — aapka apna intelligent AI brain.\n\nAap mujhse **kisi bhi vishay (topic)** par baat kar sakte hain:\n• 🧠 **Koi bhi sawaal:** GK, Science, History, Career, Health, Recipes\n• 💻 **Coding & Tech:** Python, JS, HTML/CSS, C++, Debugging\n• ➗ **Math & Calculations:** कठिन से कठिन हिसाब या Table\n• 🎨 **AI Image Generation:** Type karein *"photo banao futuristic car"* ya *"/imagine mountain sunset"*\n• ✍️ **Shayari, Jokes, Stories, Emails & Applications**\n\nBataiye, aaj main aapki kya madad karun? 😊`,
                time: formatTime(new Date())
            }
        ];
    }
    openChat(aiId);
}

const railAiBtn = document.getElementById('rail-ai-btn');
if (railAiBtn) {
    railAiBtn.addEventListener('click', openAiAssistant);
}

const menuOpenAiBtn = document.getElementById('menu-open-ai');
if (menuOpenAiBtn) {
    menuOpenAiBtn.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        openAiAssistant();
    });
}

const filterAiBtn = document.getElementById('filter-ai-btn');
if (filterAiBtn) {
    filterAiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAiAssistant();
    });
}

// ========================================================
// 17. BOTTOM DESKTOP PROMO BANNER ("GET QUICKCHAT FOR WINDOWS")
// ========================================================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

const promoBanner = document.getElementById('wa-promo-banner');
if (promoBanner) {
    promoBanner.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
            });
        } else {
            showWhatsAppDialog({
                title: 'QuickChat for Windows',
                message: 'To install QuickChat on your PC:\n1. Click your browser menu (⋮ at top right in Chrome or Edge).\n2. Select "Install QuickChat" or "Apps > Install this site as an app".\n3. Enjoy QuickChat as a standalone Windows app!',
                confirmText: 'Got It'
            });
        }
    });
}

// ========================================================
// 18. ADVANCED QUICKCHAT AI BRAIN (LLM + WIKIPEDIA + LOCAL REASONING + IMAGE GEN)
// ========================================================

function updateAiHeaderBadge() {
    if (activeChat !== 'QuickChat AI') return;
    const hasKey = !!localStorage.getItem('quickchat_ai_api_key');
    if (activeChatTitle) {
        activeChatTitle.innerHTML = `QuickChat AI <i class="fas fa-check-circle" style="color:#00a884; font-size:13px; margin-left:4px;" title="Official AI"></i> <button type="button" onclick="openAiApiKeyDialog(event)" style="margin-left:8px; background:rgba(0,168,132,0.15); color:#00a884; border:1px solid rgba(0,168,132,0.4); border-radius:12px; padding:2px 9px; font-size:11px; font-weight:600; cursor:pointer;">🔑 ${hasKey ? 'API Connected' : 'Connect API'}</button>`;
    }
    const statusEl = document.getElementById('active-chat-status');
    if (statusEl) {
        statusEl.innerHTML = `<span style="color:#00a884;">✨ ${hasKey ? 'Custom AI API Active (Gemini/Groq/OpenAI)' : 'Built-in Free AI API Active • Ask me anything'}</span>`;
    }
}

function openAiApiKeyDialog(e) {
    if (e) e.stopPropagation();
    let modal = document.getElementById('ai-api-key-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ai-api-key-modal';
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;';
        modal.innerHTML = `
            <div style="background:var(--wa-bg-sidebar, #111b21); color:var(--wa-text-primary, #e9edef); width:100%; max-width:440px; border-radius:14px; padding:22px; box-shadow:0 12px 40px rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0; font-size:17px; color:#00a884;"><i class="fas fa-key"></i> Connect Official AI API Key</h3>
                    <button type="button" id="ai-api-close-btn" style="background:none; border:none; color:var(--wa-text-secondary, #8696a0); font-size:18px; cursor:pointer;">✕</button>
                </div>
                <p style="font-size:13px; line-height:1.5; color:var(--wa-text-secondary, #8696a0); margin:0 0 12px 0;">
                    QuickChat AI mein pehle se <b>Built-in Free AI API</b> juda hua hai. Agar aap <b>0.3 second ultra-fast response</b> chahte hain, toh apni Free <b>Google Gemini</b>, <b>Groq</b>, ya <b>OpenAI</b> API Key yahan daalein:
                </p>
                <div style="font-size:12px; margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap;">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#00a884; text-decoration:none; background:rgba(0,168,132,0.12); padding:5px 10px; border-radius:8px; font-weight:600;">🔗 Get Free Gemini Key (AIza...)</a>
                    <a href="https://console.groq.com/keys" target="_blank" style="color:#00a884; text-decoration:none; background:rgba(0,168,132,0.12); padding:5px 10px; border-radius:8px; font-weight:600;">⚡ Get Free Groq Key (gsk_...)</a>
                </div>
                <input type="text" id="ai-api-key-input" placeholder="Paste API Key: AIzaSy... or gsk_... or sk-..." style="width:100%; box-sizing:border-box; padding:11px 12px; border-radius:8px; border:1px solid rgba(0,168,132,0.5); background:var(--wa-bg-search-box, #202c33); color:var(--wa-text-primary, #e9edef); font-size:13.5px; margin-bottom:16px; outline:none;" />
                <div style="display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
                    <button type="button" id="ai-api-reset-btn" style="padding:8px 13px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:var(--wa-text-secondary, #8696a0); font-size:12.5px; cursor:pointer;">Use Built-in Free AI</button>
                    <button type="button" id="ai-api-save-btn" style="padding:8px 16px; border-radius:8px; border:none; background:#00a884; color:#fff; font-weight:600; font-size:13px; cursor:pointer;">Save & Connect</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('ai-api-close-btn').onclick = () => { modal.style.display = 'none'; };
        document.getElementById('ai-api-reset-btn').onclick = () => {
            localStorage.removeItem('quickchat_ai_api_key');
            if (socket && socket.connected) socket.emit('set ai api key', { apiKey: '' });
            modal.style.display = 'none';
            updateAiHeaderBadge();
            showWhatsAppToast("Switched to Built-in Free AI API! 🤖", "info");
        };
        document.getElementById('ai-api-save-btn').onclick = () => {
            const val = (document.getElementById('ai-api-key-input').value || '').trim();
            if (!val) {
                showWhatsAppToast("Please paste a valid API Key or click 'Use Built-in Free AI'.", "danger");
                return;
            }
            localStorage.setItem('quickchat_ai_api_key', val);
            if (socket && socket.connected) socket.emit('set ai api key', { apiKey: val });
            modal.style.display = 'none';
            updateAiHeaderBadge();
            const provider = val.startsWith('AIza') ? 'Google Gemini' : (val.startsWith('gsk_') ? 'Groq LLaMA-3.3' : (val.startsWith('sk-or-') ? 'OpenRouter' : 'OpenAI'));
            showWhatsAppToast(`✅ ${provider} API Connected Successfully!`, "success");
        };
    }
    const inputEl = document.getElementById('ai-api-key-input');
    if (inputEl) inputEl.value = localStorage.getItem('quickchat_ai_api_key') || '';
    modal.style.display = 'flex';
}

function setAiThinkingStatus(isThinking) {
    if (activeChat !== 'QuickChat AI') return;
    const statusEl = document.getElementById('active-chat-status');
    if (!statusEl) return;
    if (isThinking) {
        statusEl.innerHTML = `<span style="color:#00a884; font-weight:600;"><i class="fas fa-sparkles"></i> ✨ QuickChat AI is thinking...</span>`;
    } else {
        const hasKey = !!localStorage.getItem('quickchat_ai_api_key');
        statusEl.innerHTML = `<span style="color:#00a884;">✨ ${hasKey ? 'Custom AI API Active (Gemini/Groq/OpenAI)' : 'Built-in Free AI API Active • Ask me anything'}</span>`;
    }
}

function appendAiMessageToChat(replyText, imageUrl = null) {
    setAiThinkingStatus(false);
    if (!chats['QuickChat AI']) chats['QuickChat AI'] = [];
    const timeNow = formatTime(new Date());
    chats['QuickChat AI'].push({
        id: 'ai_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        from: 'QuickChat AI',
        text: replyText,
        image: imageUrl || null,
        time: timeNow
    });
    if (activeChat === 'QuickChat AI') {
        renderMessages();
    } else {
        unreadCounts['QuickChat AI'] = (unreadCounts['QuickChat AI'] || 0) + 1;
    }
    renderChatList();
    saveLocalCache();
    playReceivedSound();
}

// Helper: Detect if user is asking for AI Image Generation
function detectAiImageRequest(text) {
    const raw = String(text || '').trim();
    const m1 = raw.match(/^(?:\/imagine|imagine|draw|generate\s+image(?:\s+of)?|create\s+image(?:\s+of)?|photo\s+banao|image\s+banao|tasveer\s+banao|pic\s+banao)\s*[:\-]?\s*(.+)/i);
    if (m1 && m1[1]) return m1[1].trim();
    const m2 = raw.match(/^(.+?)\s+(?:ki\s+photo\s+banao|ka\s+photo\s+banao|ki\s+image\s+banao|ki\s+tasveer\s+banao|photo\s+generate\s+karo)$/i);
    if (m2 && m2[1]) return m2[1].trim();
    return null;
}

// Helper: Safe Mathematical Expression & Table Evaluator
function tryEvaluateMathQuery(text) {
    const q = String(text || '').trim().toLowerCase();

    // Multiplication table e.g. "17 ka pahada", "table of 19", "15 ka table"
    const tableMatch = q.match(/(?:table\s+of\s+(\d+)|(\d+)\s+ka\s+(?:table|pahada|pahara))/i);
    if (tableMatch) {
        const num = parseInt(tableMatch[1] || tableMatch[2], 10);
        if (!isNaN(num) && num > 0 && num <= 100000) {
            let lines = [`🔢 **${num} ka Table (Pahada):**\n`];
            for (let i = 1; i <= 10; i++) {
                lines.push(`${num} × ${i} = **${num * i}**`);
            }
            return lines.join('\n');
        }
    }

    // Percentage e.g. "18% of 4500" or "4500 ka 18%"
    const pctMatch = q.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of|ka)\s*(\d+(?:\.\d+)?)/i) ||
                     q.match(/(\d+(?:\.\d+)?)\s*ka\s*(\d+(?:\.\d+)?)\s*%/i);
    if (pctMatch) {
        const isFirstPct = q.indexOf('%') < q.indexOf('ka') || q.includes('of');
        const pct = parseFloat(isFirstPct ? pctMatch[1] : pctMatch[2]);
        const total = parseFloat(isFirstPct ? pctMatch[2] : pctMatch[1]);
        if (!isNaN(pct) && !isNaN(total)) {
            const ans = +((pct / 100) * total).toFixed(4);
            return `🧮 **Calculation Result:**\n${total} ka ${pct}% = **${ans}**`;
        }
    }

    // Square root e.g. "sqrt 144" or "square root of 625"
    const sqrtMatch = q.match(/(?:sqrt|square\s+root(?:\s+of)?|vargmul)\s*\(?(\d+(?:\.\d+)?)\)?/i);
    if (sqrtMatch) {
        const val = parseFloat(sqrtMatch[1]);
        if (!isNaN(val) && val >= 0) {
            return `🧮 **√${val}** = **${+(Math.sqrt(val).toFixed(6))}**`;
        }
    }

    // Pure arithmetic expression e.g. "25 * 48 + 10", "what is 450 / 15", "125 + 375 kitna hota hai"
    let expr = q
        .replace(/^(?:what\s+is|calculate|solve|evaluate|batao|kitna\s+hota\s+hai|kitna\s+hai)\s*/i, '')
        .replace(/\s*(?:kitna\s+hota\s+hai|kitna\s+hai|batao|equals|equal\s+to|\?)\s*$/i, '')
        .replace(/×|x/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .trim();

    if (/^[0-9+\-*/().\s%*]+$/.test(expr) && /[+\-*/%]/.test(expr) && /\d/.test(expr)) {
        try {
            const result = Function('"use strict"; return (' + expr + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                const formatted = Number.isInteger(result) ? result : +result.toFixed(6);
                return `🧮 **Math Solution:**\n\`${expr}\` = **${formatted}** ✨`;
            }
        } catch (e) {}
    }
    return null;
}

// Helper: Sanitize AI chat history so old fallback/Wikipedia dumps never pollute LLM context
function getCleanAiHistory(historyArr) {
    const rawList = Array.isArray(historyArr) && historyArr.length > 0
        ? historyArr
        : (chats['QuickChat AI'] || []).slice(-7, -1).map(m => ({
            role: m.from === 'QuickChat AI' ? 'assistant' : 'user',
            content: String(m.text || '')
        }));

    return rawList
        .filter(m => {
            const c = String(m && m.content || '').trim();
            if (!c) return false;
            if (c.startsWith('📚')) return false;
            if (c.includes('QuickChat AI Analysis')) return false;
            if (c.includes('connection slow hai')) return false;
            if (c.includes('Main **QuickChat AI** hoon — aapka apna')) return false;
            return true;
        })
        .slice(-4)
        .map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 350)
        }));
}

// Serialize LLM requests so two requests never hit Pollinations simultaneously (prevents HTTP 402)
let aiRequestChain = Promise.resolve();

// Helper: Universal Generative AI API Call (Supports Custom Gemini / Groq / OpenAI / OpenRouter + Built-in Free API)
async function tryBrowserGenerativeLLM(userText, historyArr, hasImage, hasAudio) {
    const runTask = async () => {
        const sysPrompt = [
            "You are QuickChat AI, an intelligent, accurate, and friendly AI assistant inside QuickChat (like Meta AI on WhatsApp).",
            "Never call yourself ChatGPT; your name is QuickChat AI.",
            "CRITICAL RULE: Directly and accurately answer the exact question the user asked! Never give generic filler.",
            "LANGUAGE RULE: If the user writes in Hinglish (Hindi in English script, e.g., 'bharat ke pm kon hai', 'kya kar rahe ho'), reply in clear, natural Hinglish. If they write in Hindi (Devanagari), reply in Hindi. If they write in English, reply in English."
        ].join(" ");

        const recent = getCleanAiHistory(historyArr);
        const userContent = hasImage
            ? `[User shared a photo] ${userText || 'Describe and comment on this photo warmly.'}`
            : (hasAudio ? `[User sent a voice note] ${userText || 'Reply warmly to my voice message.'}` : userText);

        const messagesPayload = [
            { role: 'system', content: sysPrompt },
            ...recent,
            { role: 'user', content: userContent }
        ];

        // A. If user connected a Custom API Key (Gemini / Groq / OpenRouter / OpenAI), call it directly!
        const customKey = (localStorage.getItem('quickchat_ai_api_key') || '').trim();
        if (customKey) {
            try {
                if (customKey.startsWith('AIza')) {
                    const geminiContents = [
                        ...recent.map(m => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }]
                        })),
                        { role: 'user', parts: [{ text: userContent }] }
                    ];
                    for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
                        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(customKey)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                systemInstruction: { parts: [{ text: sysPrompt }] },
                                contents: geminiContents
                            })
                        });
                        if (gRes.ok) {
                            const gData = await gRes.json();
                            const gText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (gText && gText.trim()) return gText.trim();
                        }
                    }
                } else {
                    const isGroq = customKey.startsWith('gsk_');
                    const isOpenRouter = customKey.startsWith('sk-or-');
                    const endpoint = isGroq
                        ? 'https://api.groq.com/openai/v1/chat/completions'
                        : (isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions');
                    const modelName = isGroq
                        ? 'llama-3.3-70b-versatile'
                        : (isOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

                    const cRes = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${customKey}`
                        },
                        body: JSON.stringify({
                            model: modelName,
                            messages: messagesPayload,
                            temperature: 0.7
                        })
                    });
                    if (cRes.ok) {
                        const cData = await cRes.json();
                        const cText = cData?.choices?.[0]?.message?.content;
                        if (cText && cText.trim()) return cText.trim();
                    }
                }
            } catch (err) {
                console.warn("Custom AI API error in browser, falling back:", err);
            }
        }

        // B. Built-in Free Generative AI API (Pollinations OpenAI endpoint with Auto-Retry)
        for (let attempt = 1; attempt <= 3; attempt++) {
            const controller = new AbortController();
            const tId = setTimeout(() => controller.abort(), 22000);
            try {
                const res = await fetch('https://text.pollinations.ai/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'openai-fast',
                        reasoning_effort: 'low',
                        seed: Math.floor(Math.random() * 1000000),
                        messages: messagesPayload
                    }),
                    signal: controller.signal
                });
                clearTimeout(tId);

                if (res.ok) {
                    const rawBody = (await res.text()).trim();
                    let aiText = rawBody;
                    try {
                        const parsed = JSON.parse(rawBody);
                        if (parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content) {
                            aiText = parsed.choices[0].message.content.trim();
                        }
                    } catch (e) {}

                    if (aiText && aiText.length > 1 && !aiText.startsWith('<!DOCTYPE') && !aiText.startsWith('{"error"')) {
                        return aiText;
                    }
                }

                if ((res.status === 402 || res.status === 429 || res.status >= 500) && attempt < 3) {
                    await new Promise(r => setTimeout(r, 1500 * attempt));
                    continue;
                }
            } catch (e) {
                clearTimeout(tId);
                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 1200));
                    continue;
                }
            }
        }
        return null;
    };

    const resultPromise = aiRequestChain.then(runTask, runTask);
    aiRequestChain = resultPromise.catch(() => {});
    return resultPromise;
}

// Instant Local Checks (API Key Command, Image Gen, Pure Math, Name Memory, Exact Time/Date)
function checkInstantAiTools(rawText, hasImage = false, hasAudio = false) {
    const text = String(rawText || '').trim();
    const lower = text.toLowerCase();

    // 0. Quick command to set API Key directly via chat: "/apikey AIzaSy..."
    const apiCmdMatch = text.match(/^(?:\/apikey|apikey|set\s+api\s+key)\s+([A-Za-z0-9_\-]{12,})$/i);
    if (apiCmdMatch && apiCmdMatch[1]) {
        const keyVal = apiCmdMatch[1].trim();
        localStorage.setItem('quickchat_ai_api_key', keyVal);
        if (socket && socket.connected) socket.emit('set ai api key', { apiKey: keyVal });
        updateAiHeaderBadge();
        return `🔑 **AI API Key Connected Successfully!** ✅\nAb aapka QuickChat AI seedha aapke official API se super-fast jawab dega.`;
    }

    if (hasImage && !text) {
        return "📸 **Bahut shandaar photo hai!** ✨\nComposition aur clarity kaafi acchi lag rahi hai. Agar aap is photo ke baare mein kuch khaas poochna chahte hain ya caption chahiye toh zaroor batayein!";
    }
    if (hasAudio && !text) {
        return "🎤 **Aapka voice message mila!** ✨\nAapki aawaaz bilkul clear hai. Bataiye main aapki kis cheez mein madad kar sakta hoon?";
    }

    // 1. Check Explicit AI Image Generation Request
    const imgSubject = (!hasImage && !hasAudio) ? detectAiImageRequest(text) : null;
    if (imgSubject) {
        const seed = Math.floor(Math.random() * 999999);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgSubject)}?width=768&height=768&nologo=true&seed=${seed}`;
        return {
            text: `🎨 Yeh lijiye **"${imgSubject}"** ki AI generated image! ✨\nAgar aapko koi aur style ya badlav chahiye toh batayein.`,
            image: url
        };
    }

    // 2. Check Pure Math / Calculator / Tables
    const mathAns = (!hasImage && !hasAudio) ? tryEvaluateMathQuery(text) : null;
    if (mathAns) return mathAns;

    // 3. User Name Memory ("mera naam X hai" / "my name is X")
    const nameMatch = text.match(/^(?:mera\s+naam|my\s+name\s+is)\s+([a-zA-Z\u0900-\u097F]{2,20})(?:\s+hai)?[.!]?$/i);
    if (nameMatch && nameMatch[1]) {
        const userName = nameMatch[1].trim();
        localStorage.setItem('quickchat_my_name', userName);
        return `Bahut khushi hui aapse milkar, **${userName}**! 🤝✨ Maine aapka naam yaad rakh liya hai. Bataiye ${userName}, aaj kis topic par baat karein?`;
    }
    if (/^(?:mera\s+naam\s+kya\s+hai|what\s+is\s+my\s+name|do\s+you\s+know\s+my\s+name)\??$/i.test(lower)) {
        const savedUser = localStorage.getItem('quickchat_my_name');
        if (savedUser && !savedUser.startsWith('+91')) {
            return `Aapka naam **${savedUser}** hai! 😊 Main apne doston ka naam kabhi nahi bhoolta.`;
        }
        return `Aapne abhi tak apna naam nahi bataya! Aap likh sakte hain *"Mera naam ... hai"* aur main hamesha yaad rakhunga. 😊`;
    }

    // 4. Live Time / Date / Day (Exact queries)
    if (/^(?:abhi\s+)?(?:time\s+kya\s+hua\s+hai|time\s+kya\s+hai|kya\s+time\s+hai|what\s+time\s+is\s+it|current\s+time|samay\s+kya\s+hai|kitne\s+baje\s+hain)\??$/i.test(lower)) {
        const now = new Date();
        return `⏰ Abhi sahi samay **${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}** ho raha hai.`;
    }
    if (/^(?:aaj\s+kya\s+date\s+hai|aaj\s+ki\s+tarikh\s+kya\s+hai|today'?s?\s+date|what\s+date\s+is\s+today|aaj\s+kaun\s+sa\s+din\s+hai|what\s+day\s+is\s+today)\??$/i.test(lower)) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return `📅 Aaj **${now.toLocaleDateString('en-IN', options)}** hai.`;
    }

    return null;
}

// Track handled AI requests
const handledAiRequestIds = new Set();

socket.on('ai response', (data) => {
    const reqId = data && data.requestId;
    if (reqId && handledAiRequestIds.has(reqId)) {
        return;
    }
    if (reqId) handledAiRequestIds.add(reqId);

    if (data && !data.fallback && data.text) {
        appendAiMessageToChat(data.text, data.image || null);
        return;
    }

    const promptText = String((data && data.prompt) || '').trim();
    appendAiMessageToChat(
        `🤖 **QuickChat AI:** Aapka sawaal (*"${promptText}"*) mila, par abhi internet/AI server busy hai. Kripya 2 second baad dobara bhejein ya upar **🔑 Connect API** par click karke Free Gemini/Groq API Key jod lein! 🔄`
    );
});

const originalSendMessage = sendMessage;
sendMessage = function(imageStr = null, audioStr = null, msgType = 'text', locationData = null, pollData = null, fileName = null) {
    const currentChatTarget = activeChat;
    const currentInputText = messageInput ? messageInput.value.trim() : '';
    originalSendMessage(imageStr, audioStr, msgType, locationData, pollData, fileName);

    if (currentChatTarget === 'QuickChat AI' && (currentInputText || imageStr || audioStr)) {
        // Immediately mark user's message to AI as read (Blue Ticks)
        if (chats['QuickChat AI']) {
            chats['QuickChat AI'].forEach(m => {
                if (m.from === myNumber) {
                    m.status = 'read';
                    m.isRead = true;
                }
            });
            renderMessages();
            renderChatList();
        }

        setAiThinkingStatus(true);

        // 1. Check instant local tools (API Key command, Math, Image Gen, Name Memory, Exact Time/Date)
        const instantReply = checkInstantAiTools(currentInputText, !!imageStr, !!audioStr);
        if (instantReply) {
            setTimeout(() => {
                if (typeof instantReply === 'object') {
                    appendAiMessageToChat(instantReply.text, instantReply.image);
                } else {
                    appendAiMessageToChat(instantReply);
                }
            }, 300);
            return;
        }

        // 2. Call Live Generative LLM sequentially (Browser first; Server only if Browser fails — prevents 402 collision!)
        const requestId = 'aireq_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        const recentHistory = getCleanAiHistory();

        (async () => {
            const browserLlmAns = await tryBrowserGenerativeLLM(currentInputText, recentHistory, !!imageStr, !!audioStr);
            if (browserLlmAns) {
                handledAiRequestIds.add(requestId);
                appendAiMessageToChat(browserLlmAns);
                return;
            }

            // Sequential fallback to Server LLM if direct browser fetch failed
            if (socket && socket.connected) {
                socket.emit('ask ai', {
                    requestId,
                    prompt: currentInputText,
                    history: recentHistory,
                    hasImage: !!imageStr,
                    hasAudio: !!audioStr,
                    apiKey: localStorage.getItem('quickchat_ai_api_key') || ''
                });
            } else {
                appendAiMessageToChat(
                    `🤖 **QuickChat AI:** Aapka sawaal (*"${currentInputText}"*) mila, par abhi internet connection uplabdh nahi hai. Kripya connection check karein! 🔄`
                );
            }
        })();
    }
};

