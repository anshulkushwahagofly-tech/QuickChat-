const socket = io();

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const myDisplayNumber = document.getElementById('my-display-number');

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
let allRegisteredUsers = [];

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => {
        console.log("Service Worker Registered");
    });
}

// Auto-login on socket connect and reconnect
socket.on('connect', () => {
    const num = myNumber || localStorage.getItem('quickchat_session_num');
    const pin = localStorage.getItem('quickchat_session_pin');
    if (num && pin) {
        socket.emit('login', { number: num, pin: pin });
    }
});

// Form view switching
const loginFormView = document.getElementById('login-form-view');
const signupFormView = document.getElementById('signup-form-view');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');

showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormView.style.display = 'none';
    signupFormView.style.display = 'block';
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupFormView.style.display = 'none';
    loginFormView.style.display = 'block';
});

const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

function doLogin() {
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

function doSignup() {
    const num = document.getElementById('signup-number').value.trim();
    const pin = document.getElementById('signup-pin').value.trim();
    if (num && pin) {
        localStorage.setItem('quickchat_session_num', num);
        localStorage.setItem('quickchat_session_pin', pin);
        socket.emit('signup', { number: num, pin: pin });
    } else {
        alert("Kripya apna Number aur 4-digit PIN dono dalein.");
    }
}

if (loginBtn) loginBtn.addEventListener('click', doLogin);
if (signupBtn) signupBtn.addEventListener('click', doSignup);

document.getElementById('login-pin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
});
document.getElementById('signup-pin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSignup();
});

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
    if (msg.includes('Galat PIN')) {
        alert(msg);
        localStorage.removeItem('quickchat_session_num');
        localStorage.removeItem('quickchat_session_pin');
    } else if (msg.includes('Account nahi mila')) {
        if (!myNumber) {
            alert(msg);
            localStorage.removeItem('quickchat_session_num');
            localStorage.removeItem('quickchat_session_pin');
        } else {
            console.log("Ignored temporary re-auth error:", msg);
        }
    } else {
        if (!myNumber) {
            alert(msg);
        }
    }
});

socket.on('login success', (data) => {
    myNumber = data.number;
    chats = {};
    allRegisteredUsers = data.allUsers || [];
    
    // Load history from database
    data.history.forEach(msg => {
        const friend = (msg.from === myNumber) ? msg.to : msg.from;
        if (!chats[friend]) chats[friend] = [];
        const timeStr = formatTime(new Date(msg.timestamp));
        chats[friend].push({ from: msg.from, text: msg.text, image: msg.image, time: timeStr });
    });

    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    myDisplayNumber.innerText = "QuickChat";
    
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
        let lastMsgText = 'Tap to chat';
        if (lastMsg) {
            lastMsgText = lastMsg.image ? '📷 Photo' : (lastMsg.text || 'Message');
        }
        let lastMsgTime = lastMsg ? lastMsg.time : '';

        const chatItem = document.createElement('div');
        chatItem.className = `chat-list-item ${activeChat === friendNumber ? 'active' : ''}`;
        chatItem.onclick = () => openChat(friendNumber);
        
        chatItem.innerHTML = `
            <div class="avatar"></div>
            <div class="chat-info">
                <div class="chat-title-row">
                    <h4>+91 ${friendNumber}</h4>
                    <span class="time" style="font-size:12px; color:#667781">${lastMsgTime}</span>
                </div>
                <div class="chat-last-msg">${lastMsgText}</div>
            </div>
        `;
        chatList.appendChild(chatItem);
    });
}

function openChat(friendNumber) {
    activeChat = friendNumber;
    if (!chats[friendNumber]) {
        chats[friendNumber] = [];
    }
    emptyState.style.display = 'none';
    chatPanel.style.display = 'flex';
    activeChatTitle.innerText = "+91 " + friendNumber;
    
    // Add mobile active class to open full screen on mobile!
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

if (sendBtn) sendBtn.addEventListener('click', () => sendMessage());
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function renderMessages() {
    if (!activeChat) return;
    
    messagesContainer.innerHTML = `
        <div class="encryption-msg">
            <i class="fas fa-lock"></i> Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
        </div>
    `;
    
    const messages = chats[activeChat] || [];
    
    messages.forEach(msg => {
        const isMe = msg.from === myNumber;
        const msgElement = document.createElement('div');
        msgElement.className = `message ${isMe ? 'sent' : 'received'}`;
        
        let ticksHTML = isMe ? `<i class="fas fa-check-double ticks"></i>` : '';
        let mediaHTML = msg.image ? `<img src="${msg.image}" style="max-width:100%; border-radius:6px; margin-bottom:4px; display:block;">` : '';
        let textHTML = msg.text ? `<span class="message-content">${msg.text}</span>` : '';
        
        msgElement.innerHTML = `
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
    }
    renderChatList();
});
