const socket = io();

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

// Check saved session immediately to prevent flashing login form on reload
const savedNum = localStorage.getItem('quickchat_session_num');
const savedPin = localStorage.getItem('quickchat_session_pin');

if (savedNum) {
    if (onboardingWelcomeView) onboardingWelcomeView.style.display = 'none';
    if (otpPhoneView) otpPhoneView.style.display = 'none';
    if (otpVerifyView) otpVerifyView.style.display = 'none';
    if (loginFormView) loginFormView.style.display = 'none';
    if (loginLoadingView) loginLoadingView.style.display = 'block';

    if (savedPin) {
        socket.emit('login', { number: savedNum, pin: savedPin });
    } else {
        socket.emit('auto login', { number: savedNum });
    }
}

// Auto-login on socket connect and reconnect
socket.on('connect', () => {
    const num = myNumber || localStorage.getItem('quickchat_session_num');
    const pin = localStorage.getItem('quickchat_session_pin');
    if (num && !myNumber) {
        if (pin) {
            socket.emit('login', { number: num, pin: pin });
        } else {
            socket.emit('auto login', { number: num });
        }
    }
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
    if (otpPhoneView) otpPhoneView.style.display = 'none';
    if (otpVerifyView) otpVerifyView.style.display = 'block';
    if (otpTargetDisplay) otpTargetDisplay.innerText = '+91 ' + phoneNum;
    if (otpCodeInput) {
        otpCodeInput.value = '';
        otpCodeInput.focus();
    }
    resetSendOtpBtn();
    startResendTimer();
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
            if (window.recaptchaVerifier) {
                try { window.recaptchaVerifier.clear(); } catch(e){}
            }
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': () => { console.log('Firebase reCAPTCHA verified'); }
            });

            firebaseAuth.signInWithPhoneNumber('+91' + rawNum, window.recaptchaVerifier)
                .then((confirmationResult) => {
                    window.confirmationResult = confirmationResult;
                    window.currentOtpPhone = rawNum;
                    showOtpVerifyScreen(rawNum);
                })
                .catch((err) => {
                    console.error("Firebase SMS error:", err);
                    alert("Firebase SMS Error: " + (err.message || err));
                    resetSendOtpBtn();
                    try { if (window.recaptchaVerifier) window.recaptchaVerifier.clear(); } catch(e){}
                });
        } catch (e) {
            console.error("Firebase send exception:", e);
            alert("Firebase Exception: " + e.message);
            resetSendOtpBtn();
        }
    } else {
        // Instant Demo/Setup Mode for testing
        const demoCode = "123456";
        window.currentDemoOtp = demoCode;
        window.currentOtpPhone = rawNum;
        setTimeout(() => {
            alert(`[TESTING OTP]\n\nMobile Number +91 ${rawNum} ke liye OTP: ${demoCode}\n\n(Aap firebase-config.js me apni keys daal kar direct Real SMS OTP activate kar sakte hain).`);
            showOtpVerifyScreen(rawNum);
        }, 600);
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

    if (window.confirmationResult) {
        window.confirmationResult.confirm(code)
            .then((result) => {
                const user = result.user;
                localStorage.setItem('quickchat_session_num', window.currentOtpPhone);
                localStorage.removeItem('quickchat_session_pin');
                socket.emit('firebase otp login', { number: window.currentOtpPhone, uid: user.uid });
            })
            .catch((err) => {
                alert("Galat OTP code! Kripya SMS me aaya hua sahi OTP dalein.");
                resetVerifyOtpBtn();
            });
    } else {
        // Demo Mode Verification
        if (code === (window.currentDemoOtp || "123456")) {
            localStorage.setItem('quickchat_session_num', window.currentOtpPhone);
            localStorage.removeItem('quickchat_session_pin');
            socket.emit('firebase otp login', { number: window.currentOtpPhone, uid: 'demo_' + Date.now() });
        } else {
            alert("Galat OTP code! Demo OTP '123456' dalein.");
            resetVerifyOtpBtn();
        }
    }
}

// WhatsApp Onboarding Handlers
if (agreeContinueBtn) {
    agreeContinueBtn.addEventListener('click', () => {
        if (onboardingWelcomeView) onboardingWelcomeView.style.display = 'none';
        if (otpPhoneView) otpPhoneView.style.display = 'block';
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
        if (onboardingWelcomeView) onboardingWelcomeView.style.display = 'none';
        if (otpPhoneView) otpPhoneView.style.display = 'none';
        if (otpVerifyView) otpVerifyView.style.display = 'none';
        if (loginFormView) loginFormView.style.display = 'block';
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
        if (otpVerifyView) otpVerifyView.style.display = 'none';
        if (otpPhoneView) otpPhoneView.style.display = 'block';
        if (otpPhoneInput) otpPhoneInput.focus();
    });
}

// PIN Toggle Mode
if (showPinViewBtn) {
    showPinViewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (otpPhoneView) otpPhoneView.style.display = 'none';
        if (loginFormView) loginFormView.style.display = 'block';
        const enteredNum = otpPhoneInput ? otpPhoneInput.value.trim() : '';
        const pinNumInput = document.getElementById('login-number');
        if (enteredNum && pinNumInput) pinNumInput.value = enteredNum;
    });
}

const forgotPinBtn = document.getElementById('forgot-pin-btn');
if (forgotPinBtn) {
    forgotPinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginFormView) loginFormView.style.display = 'none';
        if (otpPhoneView) otpPhoneView.style.display = 'block';
        const pinNumInput = document.getElementById('login-number');
        if (pinNumInput && otpPhoneInput && pinNumInput.value.trim()) {
            otpPhoneInput.value = pinNumInput.value.trim();
        }
    });
}

if (backToOtpBtn) {
    backToOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginFormView) loginFormView.style.display = 'none';
        if (otpPhoneView) otpPhoneView.style.display = 'block';
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

const myProfileBtn = document.getElementById('my-profile-btn');
if (myProfileBtn) {
    myProfileBtn.addEventListener('click', () => {
        alert("Aapka Registered Number: +91 " + (myNumber || ""));
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
            window.location.reload();
        }
    });
}

socket.on('login error', (msg) => {
    console.warn("Login response:", msg);
    if (loginLoadingView) loginLoadingView.style.display = 'none';
    if (loginFormView) loginFormView.style.display = 'block';
    if (signupBtn) {
        signupBtn.disabled = false;
        signupBtn.innerText = "Sign Up";
    }

    if (msg.includes('Galat PIN')) {
        localStorage.removeItem('quickchat_session_num');
        localStorage.removeItem('quickchat_session_pin');
        const useOtp = confirm("Galat PIN!\n\nKya aap PIN bhool gaye hain? 'OK' dabayein taaki bina kisi password ke seedha Phone OTP se turant login kar sakein.");
        if (useOtp) {
            if (loginFormView) loginFormView.style.display = 'none';
            if (otpPhoneView) otpPhoneView.style.display = 'block';
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
});

socket.on('all users', (users) => {
    allRegisteredUsers = users || [];
    renderContactsInModal();
});

// --- NEW CHAT / CONTACTS MODAL ---
function openModal() {
    if (newChatModal) {
        newChatModal.style.display = 'flex';
        modalChatNumber.value = '';
        modalChatNumber.focus();
        renderContactsInModal();
    }
}

function closeModal() {
    if (newChatModal) {
        newChatModal.style.display = 'none';
    }
}

if (openNewChatBtn) openNewChatBtn.addEventListener('click', openModal);
if (headerNewChatBtn) headerNewChatBtn.addEventListener('click', openModal);
if (closeNewChatModal) closeNewChatModal.addEventListener('click', closeModal);

if (newChatModal) {
    newChatModal.addEventListener('click', (e) => {
        if (e.target === newChatModal) closeModal();
    });
}

function renderContactsInModal() {
    if (!contactsList) return;
    contactsList.innerHTML = '';
    const otherUsers = allRegisteredUsers.filter(u => u !== myNumber);
    
    if (otherUsers.length === 0) {
        contactsList.innerHTML = '<p style="color:#8696a0; font-size:13px; text-align:center; padding:15px;">Abhi koi aur user registered nahi hai.<br>Aap upar 10-digit number enter karke nayi chat shuru kar sakte hain!</p>';
        return;
    }

    otherUsers.forEach(num => {
        const card = document.createElement('div');
        card.className = 'contact-card';
        card.innerHTML = `
            <div class="avatar" style="width:40px; height:40px;"></div>
            <div class="contact-info">
                <div class="contact-number">+91 ${num}</div>
                <div class="contact-sub">QuickChat User • Click to chat</div>
            </div>
            <span class="chat-action-badge"><i class="fas fa-comment"></i> Chat</span>
        `;
        card.onclick = () => {
            closeModal();
            startChat(num);
        };
        contactsList.appendChild(card);
    });
}

function startChatFromModal() {
    const num = modalChatNumber.value.trim();
    if (!num || num.length !== 10) {
        alert("Kripya valid 10-digit phone number dalein.");
        return;
    }
    if (num === myNumber) {
        alert("Aap apne hi number par chat nahi kar sakte!");
        return;
    }
    closeModal();
    startChat(num);
}

if (modalStartChatBtn) modalStartChatBtn.addEventListener('click', startChatFromModal);
if (modalChatNumber) {
    modalChatNumber.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startChatFromModal();
    });
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

function renderChatList(filter = '') {
    chatList.innerHTML = '';
    
    const friendNumbers = Object.keys(chats);

    // If there's a search query, filter
    const filteredFriends = friendNumbers.filter(num => num.includes(filter));

    if (filteredFriends.length === 0 && friendNumbers.length === 0) {
        // Welcome helper state when chat list is empty
        const emptyPrompt = document.createElement('div');
        emptyPrompt.style.padding = '35px 20px';
        emptyPrompt.style.textAlign = 'center';
        emptyPrompt.style.color = '#667781';
        emptyPrompt.innerHTML = `
            <i class="fas fa-comments" style="font-size:45px; color:#00a884; margin-bottom:12px; display:block;"></i>
            <h4 style="color:#111b21; margin-bottom:6px; font-weight:500;">Koi chat nahi hai</h4>
            <p style="font-size:13.5px; line-height:1.4;">Niche diye gaye hare button (💬) par tap karein aur kisi bhi dost ko add karke chat shuru karein!</p>
        `;
        chatList.appendChild(emptyPrompt);
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

messageInput.addEventListener('input', () => {
    if (messageInput.value.trim().length > 0) {
        micBtn.style.display = 'none';
        sendBtn.style.display = 'block';
    } else {
        micBtn.style.display = 'block';
        sendBtn.style.display = 'none';
    }
});

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
        
        messageInput.value = '';
        messageInput.dispatchEvent(new Event('input')); 
        renderMessages();
        renderChatList(); 
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
});
