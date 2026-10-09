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

let myNumber = '';
let activeChat = null; 
let chats = {}; 

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => {
        console.log("Service Worker Registered");
    });
}

const savedNum = localStorage.getItem('quickchat_session_num');
const savedPin = localStorage.getItem('quickchat_session_pin');

if (savedNum && savedPin) {
    socket.emit('login', { number: savedNum, pin: savedPin });
}

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
    console.log("Attempting login with", num, pin);
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
    console.log("Attempting signup with", num, pin);
    if (num && pin) {
        localStorage.setItem('quickchat_session_num', num);
        localStorage.setItem('quickchat_session_pin', pin);
        socket.emit('signup', { number: num, pin: pin });
    } else {
        alert("Kripya apna Number aur 4-digit PIN dono dalein.");
    }
}

if (loginBtn) {
    loginBtn.addEventListener('click', doLogin);
}

if (signupBtn) {
    signupBtn.addEventListener('click', doSignup);
}

// Add Enter key support
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
    alert(msg);
    localStorage.removeItem('quickchat_session_num');
    localStorage.removeItem('quickchat_session_pin');
});

socket.on('login success', (data) => {
    myNumber = data.number;
    chats = {}; // Reset local chats
    
    // Load history from database
    data.history.forEach(msg => {
        const friend = (msg.from === myNumber) ? msg.to : msg.from;
        if (!chats[friend]) chats[friend] = [];
        const timeStr = formatTime(new Date(msg.timestamp));
        chats[friend].push({ from: msg.from, text: msg.text, time: timeStr });
    });

    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    myDisplayNumber.innerText = "My Num: " + myNumber;
    
    renderChatList();
});

// --- NEW CHAT LOGIC ---
newChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const friendNumber = newChatInput.value.trim();
        if (friendNumber && friendNumber !== myNumber) {
            startChat(friendNumber);
            newChatInput.value = '';
        }
    }
});

function startChat(friendNumber) {
    if (!chats[friendNumber]) {
        chats[friendNumber] = []; 
    }
    openChat(friendNumber);
}

function renderChatList() {
    chatList.innerHTML = '';
    
    for (const friendNumber in chats) {
        const messages = chats[friendNumber];
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        let lastMsgText = lastMsg ? lastMsg.text : 'No messages yet';
        let lastMsgTime = lastMsg ? lastMsg.time : '';

        const chatItem = document.createElement('div');
        chatItem.className = `chat-list-item ${activeChat === friendNumber ? 'active' : ''}`;
        chatItem.onclick = () => openChat(friendNumber);
        
        chatItem.innerHTML = `
            <div class="avatar"></div>
            <div class="chat-info">
                <div class="chat-title-row">
                    <h4>${friendNumber}</h4>
                    <span class="time" style="font-size:12px; color:#667781">${lastMsgTime}</span>
                </div>
                <div class="chat-last-msg">${lastMsgText}</div>
            </div>
        `;
        chatList.appendChild(chatItem);
    }
}

function openChat(friendNumber) {
    activeChat = friendNumber;
    emptyState.style.display = 'none';
    chatPanel.style.display = 'flex';
    activeChatTitle.innerText = friendNumber;
    
    renderChatList(); 
    renderMessages();
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
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
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

sendBtn.addEventListener('click', () => sendMessage());
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function renderMessages() {
    if (!activeChat) return;
    
    messagesContainer.innerHTML = `
        <div class="encryption-msg">
            <i class="fas fa-lock"></i> Messages are end-to-end encrypted. No one outside of this chat, not even QuickChat, can read or listen to them.
        </div>
    `;
    
    const messages = chats[activeChat] || [];
    
    messages.forEach(msg => {
        const isMe = msg.from === myNumber;
        const msgElement = document.createElement('div');
        msgElement.className = `message ${isMe ? 'sent' : 'received'}`;
        
        let ticksHTML = isMe ? `<i class="fas fa-check-double ticks"></i>` : '';
        let mediaHTML = msg.image ? `<img src="${msg.image}" style="max-width:100%; border-radius:5px; margin-bottom:5px; display:block;">` : '';
        let textHTML = msg.text ? `<span class="message-content">${msg.text}</span>` : '';
        
        msgElement.innerHTML = `
            ${mediaHTML}
            ${textHTML}
            <div class="message-footer" style="${(!msg.text && msg.image) ? 'position:absolute; bottom:5px; right:10px; background:rgba(0,0,0,0.5); border-radius:10px; padding:2px 5px;' : ''}">
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
