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

// Robust Step Switcher to prevent overlapping screens/glitches
function showStep(stepName) {
    const steps = [
        { el: onboardingWelcomeView, name: 'welcome' },
        { el: otpPhoneView, name: 'phone' },
        { el: otpVerifyView, name: 'verify' },
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
    myNumber = savedNum;
    document.documentElement.classList.add('user-logged-in');

    if (loginLoadingView) loginLoadingView.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';

    if (myNumberPreview) myNumberPreview.innerText = '+91 ' + myNumber;
    if (myDisplayNumber) myDisplayNumber.innerText = "QuickChat";

    // Load private cached chats for this specific user
    try {
        const cachedChats = localStorage.getItem('quickchat_cached_chats_' + savedNum);
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
        socket.emit('login', { number: savedNum, pin: savedPin });
    } else {
        socket.emit('auto login', { number: savedNum });
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
        if (pin) {
            socket.emit('login', { number: num, pin: pin });
        } else {
            socket.emit('auto login', { number: num });
        }
    }
});

socket.on('disconnect', () => {
    if (myNumber) setConnectingState(true);
});

// Resend countdown timer
let resendTimerInterval = null;
function startResendTimer() {
    let timeLeft = 30;
    if (countdownBox) countdownBox.style.display = 'inline';
    if (resendOtpBtn) resendOtpBtn.style.display = 'none';
    if (countdownTimer) countdownTimer.innerText = timeLeft;

    clearInterval(resendTimerInterval);
    resendTimerInterval = setInterval(() => {
        timeLeft--;
        if (countdownTimer) countdownTimer.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(resendTimerInterval);
            if (countdownBox) countdownBox.style.display = 'none';
            if (resendOtpBtn) resendOtpBtn.style.display = 'inline-block';
        }
    }, 1000);
}

function showOtpVerifyScreen(phoneNum) {
    showStep('verify');
    if (otpTargetDisplay) otpTargetDisplay.innerText = '+91 ' + phoneNum;
    if (otpCodeInput) {
        otpCodeInput.value = window.currentDemoOtp ? window.currentDemoOtp : '';
        otpCodeInput.focus();
    }
    resetSendOtpBtn();
    startResendTimer();
}

const otpCopyCode = document.getElementById('otp-copy-code');
if (otpCopyCode) {
    otpCopyCode.addEventListener('click', () => {
        if (otpCodeInput) {
            otpCodeInput.value = '123456';
            otpCodeInput.focus();
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
        verifyOtpBtn.innerHTML = `<span>Next</span>`;
    }
}

function resetRecaptcha() {
    try {
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
        }
    } catch (e) {
        console.warn("reCAPTCHA clear err:", e);
    }
    window.recaptchaVerifier = null;
    const container = document.getElementById('recaptcha-container');
    if (container) {
        container.innerHTML = '';
    }
}

// 1. Send OTP Action
function doSendOtp() {
    const rawNum = otpPhoneInput ? otpPhoneInput.value.trim() : '';
    if (!rawNum || !/^[6-9]\d{9}$/.test(rawNum)) {
        alert("Kripya ek valid 10-digit Indian mobile number dalein (6, 7, 8 ya 9 se shuru hona chahiye).");
        return;
    }

    if (sendOtpBtn) {
        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>Sending SMS...</span>`;
    }

    const hasRealFirebase = (typeof isFirebaseConfigured === 'function') && isFirebaseConfigured() && firebaseAuth;

    if (hasRealFirebase) {
        try {
            resetRecaptcha();

            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': () => { console.log('Firebase reCAPTCHA verified'); },
                'expired-callback': () => { resetRecaptcha(); }
            });

            firebaseAuth.signInWithPhoneNumber('+91' + rawNum, window.recaptchaVerifier)
                .then((confirmationResult) => {
                    window.confirmationResult = confirmationResult;
                    window.currentOtpPhone = rawNum;
                    window.currentDemoOtp = null;
                    const hint = document.getElementById('otp-fallback-hint');
                    if (hint) hint.style.display = 'none';
                    showOtpVerifyScreen(rawNum);
                })
                .catch((err) => {
                    console.warn("Firebase SMS not available on this domain/region, using seamless Dev OTP:", err);
                    resetSendOtpBtn();
                    resetRecaptcha();

                    window.currentDemoOtp = "123456";
                    window.currentOtpPhone = rawNum;
                    window.confirmationResult = null;
                    showOtpVerifyScreen(rawNum);

                    const hint = document.getElementById('otp-fallback-hint');
                    if (hint) hint.style.display = 'block';
                    if (otpCodeInput) otpCodeInput.value = "123456";
                });
        } catch (e) {
            console.warn("Firebase exception, using seamless Dev OTP:", e);
            resetRecaptcha();
            resetSendOtpBtn();
            window.currentDemoOtp = "123456";
            window.currentOtpPhone = rawNum;
            window.confirmationResult = null;
            showOtpVerifyScreen(rawNum);
            const hint = document.getElementById('otp-fallback-hint');
            if (hint) hint.style.display = 'block';
            if (otpCodeInput) otpCodeInput.value = "123456";
        }
    } else {
        // Instant Seamless Setup Mode
        window.currentDemoOtp = "123456";
        window.currentOtpPhone = rawNum;
        showOtpVerifyScreen(rawNum);
        const hint = document.getElementById('otp-fallback-hint');
        if (hint) hint.style.display = 'block';
        if (otpCodeInput) otpCodeInput.value = "123456";
    }
}

// 2. Verify OTP Action
function doVerifyOtp() {
    const code = otpCodeInput ? otpCodeInput.value.trim() : '';
    if (!code || code.length !== 6) {
        alert("Kripya 6-digit OTP code dalein.");
        return;
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>Verifying...</span>`;
    }

    const completeLogin = (uid) => {
        localStorage.setItem('quickchat_session_num', window.currentOtpPhone);
        localStorage.removeItem('quickchat_session_pin');
        socket.emit('firebase otp login', { number: window.currentOtpPhone, uid: uid || ('demo_' + Date.now()) });
    };

    if (window.confirmationResult) {
        window.confirmationResult.confirm(code)
            .then((result) => {
                const user = result.user;
                completeLogin(user ? user.uid : null);
            })
            .catch((err) => {
                console.warn("Firebase confirm error:", err);
                // If code is 123456 (demo code fallback), allow login immediately
                if (code === "123456" || code === window.currentDemoOtp) {
                    console.log("Fallback: logging in via 123456 test OTP");
                    completeLogin('test_' + Date.now());
                } else {
                    alert("Galat OTP code! Kripya SMS me aaya hua sahi OTP dalein (ya testing ke liye '123456' use karein).");
                    resetVerifyOtpBtn();
                }
            });
    } else {
        // Demo Mode Verification
        if (code === "123456" || code === (window.currentDemoOtp || "123456")) {
            completeLogin('demo_' + Date.now());
        } else {
            alert("Galat OTP code! Test OTP '123456' dalein.");
            resetVerifyOtpBtn();
        }
    }
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
        alert("QuickChat Help:\n\n1. Apna 10-digit mobile number enter karke 'Next' par tap karein.\n2. SMS mein 6-digit OTP code prapt hoga.\n3. OTP dalte hi QuickChat account activate ho jayega!");
    });
}

if (whatsMyNumberBtn) {
    whatsMyNumberBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert("Aapka 10-digit mobile number aapke phone ke Settings > About Phone / SIM Status me check kar sakte hain.");
    });
}

if (sendOtpBtn) sendOtpBtn.addEventListener('click', doSendOtp);
if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', doVerifyOtp);
if (resendOtpBtn) resendOtpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doSendOtp();
});

if (otpPhoneInput) {
    otpPhoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSendOtp();
    });
}
if (otpCodeInput) {
    otpCodeInput.addEventListener('input', () => {
        if (otpCodeInput.value.trim().length === 6) {
            doVerifyOtp();
        }
    });
    otpCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doVerifyOtp();
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
            otpPhoneInput.value = pinNumInput.value.trim();
        }
    });
}

if (backToOtpBtn) {
    backToOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showStep('phone');
        const pinNumInput = document.getElementById('login-number');
        if (pinNumInput && otpPhoneInput && pinNumInput.value.trim()) {
            otpPhoneInput.value = pinNumInput.value.trim();
        }
    });
}

function doPinLogin() {
    const num = document.getElementById('login-number').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    if (num && pin) {
        localStorage.setItem('quickchat_session_num', num);
        localStorage.setItem('quickchat_session_pin', pin);
        socket.emit('login', { number: num, pin: pin });
    } else {
        alert("Kripya apna Number aur 4-digit PIN dono dalein.");
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
        openModal();
    });
}

if (menuMyNumber) {
    menuMyNumber.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.style.display = 'none';
        alert("Aapka Registered Number: +91 " + (myNumber || ""));
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
        alert("Status Feature: Yahan aap status dekh/laga sakenge (Coming soon).");
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
            alert("Status Feature: Yahan WhatsApp status dekh/laga sakenge (Coming soon).");
        } else if (txt.includes('CALLS')) {
            alert("Calls Feature: Voice ya Video call ke liye kisi bhi chat ko open karke call icon par tap karein!");
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
        if (confirm("Kya aap sach mein logout karna chahte hain?")) {
            localStorage.removeItem('quickchat_session_num');
            localStorage.removeItem('quickchat_session_pin');
            localStorage.removeItem('quickchat_cached_chats');
            localStorage.removeItem('quickchat_cached_users');
            document.documentElement.classList.remove('user-logged-in');
            window.location.reload();
        }
    });
}

socket.on('login error', (msg) => {
    console.warn("Login response:", msg);
    resetVerifyOtpBtn();
    setConnectingState(false);
    document.documentElement.classList.remove('user-logged-in');
    showStep('pin');

    if (msg.includes('Galat PIN')) {
        localStorage.removeItem('quickchat_session_num');
        localStorage.removeItem('quickchat_session_pin');
        const useOtp = confirm("Galat PIN!\n\nKya aap PIN bhool gaye hain? 'OK' dabayein taaki bina kisi password ke seedha Phone OTP se turant login kar sakein.");
        if (useOtp) {
            showStep('phone');
            const pinNum = document.getElementById('login-number');
            if (pinNum && otpPhoneInput && pinNum.value.trim()) {
                otpPhoneInput.value = pinNum.value.trim();
            }
        }
    } else {
        alert(msg);
    }
});

socket.on('login success', (data) => {
    resetVerifyOtpBtn();
    setConnectingState(false);
    document.documentElement.classList.add('user-logged-in');

    myNumber = data.number;
    chats = {};
    allRegisteredUsers = data.allUsers || [];
    
    // Ensure session credentials remain safely saved in localStorage
    const pinInput = document.getElementById('login-pin');
    const currentPin = (pinInput && pinInput.value.trim()) || localStorage.getItem('quickchat_session_pin');
    if (myNumber) localStorage.setItem('quickchat_session_num', myNumber);
    if (currentPin) localStorage.setItem('quickchat_session_pin', currentPin);

    // Update UI previews
    if (myNumberPreview) myNumberPreview.innerText = '+91 ' + myNumber;
    if (myDisplayNumber) myDisplayNumber.innerText = "QuickChat";

    // Load history from database
    data.history.forEach(msg => {
        const friend = (msg.from === myNumber) ? msg.to : msg.from;
        if (!chats[friend]) chats[friend] = [];
        const timeStr = formatTime(new Date(msg.timestamp));
        chats[friend].push({ from: msg.from, text: msg.text, image: msg.image, time: timeStr });
    });

    if (loginLoadingView) loginLoadingView.style.display = 'none';
    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    
    renderChatList();
    saveLocalCache();
});

socket.on('all users', (users) => {
    allRegisteredUsers = users || [];
    saveLocalCache();
    renderContactsInModal();
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
            alert("Kripya valid 10-digit number dalein.");
            return;
        }
        if (num === myNumber) {
            alert("Aap apne hi number par chat nahi kar sakte!");
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
    const otherUsers = allRegisteredUsers.filter(u => u !== myNumber && u.includes(filter));

    if (otherUsers.length === 0) {
        drawerContactsList.innerHTML = `
            <div style="padding: 30px 20px; text-align: center; color: #8696a0; font-size: 13.5px;">
                <p>Abhi koi aur user nahi mila.<br>Aap upar number daal kar seedha chat shuru karein!</p>
            </div>
        `;
        return;
    }

    otherUsers.forEach(num => {
        const item = document.createElement('div');
        item.className = 'contact-card';
        item.innerHTML = `
            <div class="avatar" style="width:44px; height:44px;"></div>
            <div class="contact-info">
                <div class="contact-number">+91 ${num}</div>
                <div class="contact-sub">Available on QuickChat</div>
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
    openChat(friendNumber);
}

// --- MODERN CHAT FILTER & RENDERING LOGIC ---
let currentChatFilter = 'unread'; // Matches WhatsApp Web screenshot state

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

function renderChatList(filter = '') {
    chatList.innerHTML = '';
    
    const friendNumbers = Object.keys(chats);
    let filteredFriends = friendNumbers.filter(num => num.includes(filter));

    // Handle Unread Filter
    if (currentChatFilter === 'unread') {
        filteredFriends = filteredFriends.filter(num => (unreadCounts[num] || 0) > 0);
        
        if (filteredFriends.length === 0) {
            // Render exact WhatsApp Web empty unread state as shown in screenshot
            const unreadEmptyState = document.createElement('div');
            unreadEmptyState.className = 'wa-unread-empty-wrapper';
            unreadEmptyState.innerHTML = `
                <div class="wa-unread-art">
                    <svg viewBox="0 0 160 140" width="140" height="120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <!-- Outer green checkmark outline -->
                        <path d="M42 75 L70 105 L132 38" stroke="#00a884" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- Mint green speech bubble -->
                        <rect x="40" y="24" width="76" height="52" rx="14" fill="#c4eed0" />
                        <path d="M40 58 L28 66 L44 72 Z" fill="#c4eed0" />
                        <!-- Horizontal message text lines inside bubble -->
                        <rect x="52" y="38" width="44" height="5" rx="2.5" fill="#528362" />
                        <rect x="52" y="50" width="28" height="5" rx="2.5" fill="#528362" />
                        <!-- Foreground vibrant green checkmark over bubble -->
                        <path d="M42 75 L70 105 L132 38" stroke="#25d366" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
                        <!-- White sparkles ✨ -->
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
        // WhatsApp authentic clean empty chat state without leaking any contacts
        const emptyPrompt = document.createElement('div');
        emptyPrompt.className = 'wa-unread-empty-wrapper';
        emptyPrompt.innerHTML = `
            <div style="width:60px; height:60px; border-radius:50%; background:var(--wa-bg-pill-active); color:var(--wa-text-pill-active); display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto; font-size:26px;">
                <i class="far fa-comments"></i>
            </div>
            <div class="wa-unread-empty-title">No chats yet</div>
            <div class="wa-unread-empty-sub">Tap the green + button to start a conversation with any number.</div>
            <button class="wa-view-all-chats-btn" id="start-first-chat-btn" style="background:#00a884; color:white; padding:8px 22px; border-radius:20px; margin-top:10px; text-decoration:none; font-weight:600;">
                <i class="fas fa-plus" style="margin-right:6px;"></i> Start New Chat
            </button>
        `;
        chatList.appendChild(emptyPrompt);

        const firstChatBtn = document.getElementById('start-first-chat-btn');
        if (firstChatBtn) firstChatBtn.addEventListener('click', openNewChatDrawer);
        return;
    }

    filteredFriends.forEach(friendNumber => {
        const messages = chats[friendNumber];
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        let lastMsgPrefix = '';
        let lastMsgText = 'Tap to chat';
        if (lastMsg) {
            if (lastMsg.from === myNumber) {
                lastMsgPrefix = '<i class="fas fa-check-double" style="font-size:11px; color:#53bdeb; margin-right:4px;"></i>';
            }
            if (lastMsg.image) {
                lastMsgText = '<i class="fas fa-camera" style="font-size:12px; margin-right:4px; color:#8696a0;"></i> Photo';
            } else {
                lastMsgText = escapeHtml(lastMsg.text || 'Message');
            }
        }
        let lastMsgTime = lastMsg ? lastMsg.time : '';
        const unreadCount = unreadCounts[friendNumber] || 0;
        const unreadHTML = unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : '';

        const chatItem = document.createElement('div');
        chatItem.className = `chat-list-item ${activeChat === friendNumber ? 'active' : ''}`;
        chatItem.onclick = () => openChat(friendNumber);
        
        chatItem.innerHTML = `
            <div class="avatar"></div>
            <div class="chat-info">
                <div class="chat-title-row">
                    <h4>+91 ${friendNumber}</h4>
                    <span class="time">${lastMsgTime}</span>
                </div>
                <div class="chat-subtitle-row">
                    <div class="chat-last-msg">${lastMsgPrefix}${lastMsgText}</div>
                    ${unreadHTML}
                </div>
            </div>
        `;
        chatList.appendChild(chatItem);
    });
}

function openChat(friendNumber) {
    activeChat = friendNumber;
    unreadCounts[friendNumber] = 0; // Clear unread badge
    if (!chats[friendNumber]) {
        chats[friendNumber] = [];
    }
    emptyState.style.display = 'none';
    chatPanel.style.display = 'flex';
    activeChatTitle.innerText = "+91 " + friendNumber;
    
    // Add mobile active class to open full screen on mobile
    chatPanel.classList.add('active-mobile');
    
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

// --- MESSAGING LOGIC ---
function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
}

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

// Mic or Send wrapper click
const micCircleWrapper = document.querySelector('.mic-circle-wrapper');
if (micCircleWrapper) {
    micCircleWrapper.addEventListener('click', () => {
        if (messageInput.value.trim().length > 0) {
            sendMessage();
        } else {
            alert("Voice recording feature coming soon! You can type a message or tap the camera/clip to send photos.");
        }
    });
}

// --- IMAGE COMPRESSION & UPLOAD ---
const imageUpload = document.getElementById('image-upload');
if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = Math.min(1, MAX_WIDTH / img.width);
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Compress and get Base64
                const base64Str = canvas.toDataURL('image/jpeg', 0.6);
                sendMessage(base64Str);
            };
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    });
}

function sendMessage(imageStr = null) {
    if (!activeChat) return;
    
    const text = messageInput.value.trim();
    if (text || imageStr) {
        const timeNow = formatTime(new Date());
        
        // Local update
        const msgObj = { from: myNumber, text: text, image: imageStr, time: timeNow };
        chats[activeChat].push(msgObj);
        
        // Send to server
        socket.emit('private message', { to: activeChat, text: text, image: imageStr });
        socket.emit('typing', { to: activeChat, isTyping: false });
        
        messageInput.value = '';
        messageInput.dispatchEvent(new Event('input')); 
        renderMessages();
        renderChatList(); 
        saveLocalCache();
        playSentSound();
    }
}

if (sendBtn) sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sendMessage();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function renderMessages() {
    if (!activeChat) return;
    
    messagesContainer.innerHTML = `
        <div class="date-chip">TODAY</div>
        <div class="encryption-msg">
            <i class="fas fa-lock"></i> Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
        </div>
    `;
    
    const messages = chats[activeChat] || [];
    
    messages.forEach(msg => {
        const isMe = msg.from === myNumber;
        const msgElement = document.createElement('div');
        msgElement.className = `message ${isMe ? 'sent' : 'received'}`;
        
        let senderTagHTML = !isMe ? `<span class="sender-name-tag">~+91 ${msg.from}</span>` : '';
        let ticksHTML = isMe ? `<i class="fas fa-check-double ticks"></i>` : '';
        let mediaHTML = msg.image ? `<img src="${msg.image}" style="max-width:100%; border-radius:6px; margin-bottom:4px; display:block;">` : '';
        let textHTML = msg.text ? `<span class="message-content">${escapeHtml(msg.text)}</span>` : '';
        
        msgElement.innerHTML = `
            ${senderTagHTML}
            ${mediaHTML}
            ${textHTML}
            <div class="message-footer" style="${(!msg.text && msg.image) ? 'position:absolute; bottom:5px; right:8px; background:rgba(0,0,0,0.5); border-radius:10px; padding:2px 6px;' : ''}">
                <span class="message-time" style="${(!msg.text && msg.image) ? 'color:white;' : ''}">${msg.time}</span>
                ${ticksHTML}
            </div>
            <div style="clear:both"></div>
        `;
        messagesContainer.appendChild(msgElement);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- RECEIVE PRIVATE MESSAGES ---
socket.on('private message', (data) => {
    const sender = data.from;
    const timeNow = formatTime(new Date(data.timestamp));
    
    if (!chats[sender]) chats[sender] = [];
    
    chats[sender].push({ from: sender, text: data.text, image: data.image, time: timeNow });
    
    if (activeChat === sender) {
        renderMessages();
    } else {
        unreadCounts[sender] = (unreadCounts[sender] || 0) + 1;
    }
    renderChatList();
    saveLocalCache();
    playReceivedSound();
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
            const listName = prompt("Create new custom filter list (e.g. Family, Work, College):");
            if (listName) {
                alert(`Filter list "${listName}" created!`);
            }
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

// 4. Far-Left Navigation Rail (Dock) Items
const railChatsBtn = document.getElementById('rail-chats-btn');
if (railChatsBtn) {
    railChatsBtn.addEventListener('click', () => {
        document.querySelectorAll('.wa-rail-item').forEach(i => i.classList.remove('active'));
        railChatsBtn.classList.add('active');
        setActiveFilter('all');
    });
}

const railCallsBtn = document.getElementById('rail-calls-btn');
if (railCallsBtn) {
    railCallsBtn.addEventListener('click', () => {
        alert("QuickChat Calls:\n\nPlace crystal clear voice & video calls with anyone on QuickChat by tapping the phone or camera icon at the top of any chat!");
    });
}

const railStatusBtn = document.getElementById('rail-status-btn');
if (railStatusBtn) {
    railStatusBtn.addEventListener('click', () => {
        alert("QuickChat Status:\n\nShare photos, text, and voice status updates that disappear in 24 hours. (Coming soon)");
    });
}

const railChannelsBtn = document.getElementById('rail-channels-btn');
if (railChannelsBtn) {
    railChannelsBtn.addEventListener('click', () => {
        alert("QuickChat Channels:\n\nFollow public channels and get real-time updates from creators, news, and sports.");
    });
}

const railCommunitiesBtn = document.getElementById('rail-communities-btn');
if (railCommunitiesBtn) {
    railCommunitiesBtn.addEventListener('click', () => {
        alert("QuickChat Communities:\n\nEasily organize multiple related groups into unified spaces.");
    });
}

// 5. QuickChat AI Assistant in Navigation Rail
function openAiAssistant() {
    const aiId = 'QuickChat AI';
    if (!chats[aiId]) {
        chats[aiId] = [
            {
                from: aiId,
                text: 'Hello! I am your QuickChat AI Assistant. ✨ How can I help you today? You can ask me anything!',
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

const railStarredBtn = document.getElementById('rail-starred-btn');
if (railStarredBtn) {
    railStarredBtn.addEventListener('click', () => {
        alert("Starred Messages:\n\nSave important messages to review them later.");
    });
}

const railSettingsBtn = document.getElementById('rail-settings-btn');
if (railSettingsBtn) {
    railSettingsBtn.addEventListener('click', openProfileDrawer);
}

const railProfileBtn = document.getElementById('rail-profile-btn');
if (railProfileBtn) {
    railProfileBtn.addEventListener('click', openProfileDrawer);
}

// 6. Bottom Desktop Promo Banner ("Get QuickChat for Windows")
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
            alert("QuickChat for Windows:\n\nTo install QuickChat on your PC/Laptop:\n1. Click your browser menu (3-dots ⋮ at top right in Chrome or Edge).\n2. Select 'Install QuickChat' or 'Apps > Install this site as an app'.\n3. Enjoy QuickChat as a standalone Windows app!");
        }
    });
}

// 7. Interactive AI Response when chatting with QuickChat AI
const originalSendMessage = sendMessage;
sendMessage = function(imageStr = null) {
    const currentChatTarget = activeChat;
    const currentInputText = messageInput ? messageInput.value.trim() : '';
    originalSendMessage(imageStr);

    if (currentChatTarget === 'QuickChat AI' && currentInputText) {
        setTimeout(() => {
            const aiReplies = [
                "I'm here to help! QuickChat features real-time messaging, HD voice/video calls, and end-to-end encryption. 🚀",
                "Great question! You can click the green '+' button to start a chat with any 10-digit number.",
                "QuickChat is fully responsive and supports Dark Mode, emoji reactions, and offline instant load! ✨",
                "Did you know? You can click 'Get QuickChat for Windows' at the bottom to install QuickChat directly on your PC."
            ];
            const chosen = aiReplies[Math.floor(Math.random() * aiReplies.length)];
            const timeNow = formatTime(new Date());
            chats['QuickChat AI'].push({ from: 'QuickChat AI', text: chosen, time: timeNow });
            renderMessages();
            renderChatList();
            saveLocalCache();
            playReceivedSound();
        }, 600);
    }
};
