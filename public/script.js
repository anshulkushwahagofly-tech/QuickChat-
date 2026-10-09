const socket = io();

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const myNumberInput = document.getElementById('my-number-input');
const loginBtn = document.getElementById('login-btn');
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
let activeChat = null; // Currently selected friend's number
let chats = {}; // Structure: { 'friendNumber': [ {from: '...', text: '...', time: '...'} ] }

// --- LOGIN LOGIC ---
loginBtn.addEventListener('click', () => {
    const num = myNumberInput.value.trim();
    if (num) {
        myNumber = num;
        socket.emit('register', myNumber);
        
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        myDisplayNumber.innerText = "My Num: " + myNumber;
    }
});

myNumberInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
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
        chats[friendNumber] = []; // Initialize empty chat history
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
    
    renderChatList(); // To update the 'active' styling
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

function sendMessage() {
    if (!activeChat) return;
    
    const text = messageInput.value.trim();
    if (text) {
        const timeNow = formatTime(new Date());
        
        // Add to our local chat history
        const msgObj = { from: myNumber, text: text, time: timeNow };
        chats[activeChat].push(msgObj);
        
        // Send to server privately
        socket.emit('private message', { to: activeChat, text: text });
        
        // Update UI
        messageInput.value = '';
        messageInput.dispatchEvent(new Event('input')); // Reset icons
        renderMessages();
        renderChatList(); // Update last message in sidebar
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function renderMessages() {
    if (!activeChat) return;
    
    messagesContainer.innerHTML = `
        <div class="encryption-msg">
            <i class="fas fa-lock"></i> Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
        </div>
    `;
    
    const messages = chats[activeChat] || [];
    
    messages.forEach(msg => {
        const isMe = msg.from === myNumber;
        const msgElement = document.createElement('div');
        msgElement.className = `message ${isMe ? 'sent' : 'received'}`;
        
        let ticksHTML = isMe ? `<i class="fas fa-check-double ticks"></i>` : '';
        
        msgElement.innerHTML = `
            <span class="message-content">${msg.text}</span>
            <div class="message-footer">
                <span class="message-time">${msg.time}</span>
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
    // data: { from: 'senderNumber', to: 'myNumber', text: '...', timestamp: '...' }
    const sender = data.from;
    const timeNow = formatTime(new Date(data.timestamp));
    
    // Initialize chat if doesn't exist
    if (!chats[sender]) {
        chats[sender] = [];
    }
    
    chats[sender].push({ from: sender, text: data.text, time: timeNow });
    
    if (activeChat === sender) {
        renderMessages();
    }
    
    renderChatList();
});

socket.on('user offline', (number) => {
    alert(`The user ${number} is not online right now. They will not receive this message.`);
});
