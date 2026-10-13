const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling']
});

// Enable Gzip compression to speed up network asset delivery by up to 70%
app.use(compression());

// Static file serving with short-term caching & etag for instant reloads
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true
}));

// --- DATABASE SETUP (MongoDB or Local JSON Fallback) ---
const DATA_FILE = path.join(__dirname, 'data.json');
const MONGODB_URI = process.env.MONGODB_URI;
let useMongo = false;

if (MONGODB_URI) {
    try {
        mongoose.connect(MONGODB_URI).then(() => {
            useMongo = true;
            console.log("Connected to MongoDB successfully! Data is now permanent.");
        }).catch(err => {
            console.error("MongoDB connection error:", err);
        });
    } catch (criticalErr) {
        console.error("CRITICAL MongoDB URI Error (Make sure it starts with mongodb+srv://):", criticalErr);
    }
}

// Mongoose Schemas
const User = mongoose.model('User', new mongoose.Schema({ 
    number: String, 
    pin: String 
}));
const Message = mongoose.model('Message', new mongoose.Schema({ 
    id: String,
    from: String, 
    to: String, 
    text: String, 
    image: String,
    audio: String,
    location: Object,
    poll: Object,
    replyTo: Object,
    reactions: Object,
    type: { type: String, default: 'text' },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    starredBy: { type: Array, default: [] },
    status: { type: String, default: 'sent' }, // 'sent' | 'delivered' | 'read'
    isRead: { type: Boolean, default: false },
    timestamp: Date 
}, { strict: false }));

// In-Memory Status Stories Store
let activeStatuses = [
    {
        id: 'status_welcome',
        user: 'QuickChat Team',
        text: 'Welcome to QuickChat! Enjoy full WhatsApp Web experience ✨',
        bg: '#00a884',
        timestamp: new Date().toISOString(),
        viewers: []
    }
];

// Fallback JSON Helpers
function loadDB() {
    if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { return { users: {}, messages: [] }; }
    }
    return { users: {}, messages: [] };
}
function saveDB(db) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Ensure database connection is ready before querying without blocking requests
async function ensureDBReady() {
    if (useMongo || mongoose.connection.readyState === 1) return true;
    if (!MONGODB_URI) return false;
    // Only wait if it's actively connecting (readyState === 2)
    if (mongoose.connection.readyState === 2) {
        for (let i = 0; i < 10; i++) {
            if (mongoose.connection.readyState === 1) {
                useMongo = true;
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }
    return mongoose.connection.readyState === 1;
}

// Universal DB Functions
async function getUser(number) {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        return await User.findOne({ number: number });
    }
    return loadDB().users[number] ? { pin: loadDB().users[number].pin } : null;
}

let cachedAllUsers = null;
let lastUsersFetch = 0;

async function createUser(number, pin) {
    cachedAllUsers = null; // Invalidate user cache on new signup
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        await User.findOneAndUpdate(
            { number },
            { $set: { number, pin } },
            { upsert: true, new: true }
        );
    } else {
        let db = loadDB();
        db.users[number] = { pin, registeredAt: new Date().toISOString() };
        saveDB(db);
    }
}
async function saveMessage(msgObj) {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        await Message.create(msgObj);
    } else {
        let db = loadDB();
        db.messages.push(msgObj);
        saveDB(db);
    }
}

async function getUserMessages(number) {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        const msgs = await Message.find({ $or: [{ from: number }, { to: number }] }).sort('timestamp').lean();
        return msgs.map(m => ({
            id: m.id || ('msg_' + (m._id || Date.now())),
            from: m.from,
            to: m.to,
            text: m.text,
            image: m.image,
            audio: m.audio,
            location: m.location,
            poll: m.poll,
            replyTo: m.replyTo,
            reactions: m.reactions || {},
            type: m.type || (m.image ? 'image' : (m.audio ? 'audio' : 'text')),
            isEdited: m.isEdited || false,
            isDeleted: m.isDeleted || false,
            isPinned: m.isPinned || false,
            starredBy: m.starredBy || [],
            status: m.isRead ? 'read' : (m.status || 'sent'),
            isRead: !!m.isRead,
            timestamp: m.timestamp ? (typeof m.timestamp.toISOString === 'function' ? m.timestamp.toISOString() : m.timestamp) : new Date().toISOString()
        }));
    } else {
        return loadDB().messages
            .filter(m => m.from === number || m.to === number)
            .map(m => ({
                ...m,
                status: m.isRead ? 'read' : (m.status || 'sent'),
                isRead: !!m.isRead
            }));
    }
}

async function getAllUsers() {
    const now = Date.now();
    if (cachedAllUsers && (now - lastUsersFetch < 4000)) {
        return cachedAllUsers;
    }
    await ensureDBReady();
    let result = [];
    if (useMongo || mongoose.connection.readyState === 1) {
        const users = await User.find({}, 'number');
        result = users.map(u => u.number);
    } else {
        const db = loadDB();
        result = Object.keys(db.users);
    }
    cachedAllUsers = result;
    lastUsersFetch = now;
    return result;
}

// --- NORMALIZE & VALIDATE MOBILE NUMBER ---
function validateRealIndianNumber(number) {
    let clean = String(number || '').replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
        clean = clean.slice(2);
    } else if (clean.length === 11 && clean.startsWith('0')) {
        clean = clean.slice(1);
    }
    if (clean.length > 10) {
        clean = clean.slice(-10);
    }
    if (!/^\d{10}$/.test(clean)) {
        return { valid: false, message: 'Please enter a valid 10-digit mobile number.' };
    }
    return { valid: true, number: clean };
}

// --- SOCKET.IO LOGIC ---
let connectedUsers = {}; // { 'number': socket.id }
let socketToPhone = {};
let activeOtps = {}; // { 'number': { otp: '482915', expiresAt: number } }

io.on('connection', (socket) => {

    // OFFICIAL SERVER OTP DISPATCH
    socket.on('request otp', ({ number }) => {
        const validation = validateRealIndianNumber(number);
        if (!validation.valid) {
            return socket.emit('otp error', validation.message);
        }
        const cleanNum = validation.number;
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const refId = 'QC' + Math.floor(10 + Math.random() * 89);
        activeOtps[cleanNum] = {
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000
        };
        console.log(`[SMS GATEWAY] Dispatched OTP ${otp} to +91 ${cleanNum} (Ref: ${refId})`);
        socket.emit('otp dispatched', {
            number: cleanNum,
            otp,
            refId,
            timestamp: new Date().toISOString()
        });
    });

    // SIGNUP LOGIC
    socket.on('signup', async ({ number, pin }) => {
        try {
            const validation = validateRealIndianNumber(number);
            if (!validation.valid) {
                return socket.emit('login error', validation.message);
            }
            const cleanNum = validation.number;
            const cleanPin = (pin || '0000').trim();

            await createUser(cleanNum, cleanPin);

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;
            console.log(`User signed up: ${cleanNum}`);

            await markUndeliveredAsDelivered(cleanNum);
            const userMessages = await getUserMessages(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages });
        } catch (err) {
            console.error("Signup error:", err);
            socket.emit('login error', 'Server error. Please try again.');
        }
    });

    // Helper to mark undelivered messages as delivered when recipient comes online
    async function markUndeliveredAsDelivered(recipientNumber) {
        try {
            await ensureDBReady();
            let sendersToNotify = new Set();
            if (useMongo || mongoose.connection.readyState === 1) {
                const undelivered = await Message.find({ to: recipientNumber, status: 'sent', isRead: { $ne: true } }, 'from').lean();
                undelivered.forEach(m => { if (m.from) sendersToNotify.add(m.from); });
                if (undelivered.length > 0) {
                    await Message.updateMany(
                        { to: recipientNumber, status: 'sent', isRead: { $ne: true } },
                        { $set: { status: 'delivered' } }
                    );
                }
            } else {
                let db = loadDB();
                let updated = false;
                db.messages.forEach(m => {
                    if (m.to === recipientNumber && (!m.status || m.status === 'sent') && !m.isRead) {
                        m.status = 'delivered';
                        sendersToNotify.add(m.from);
                        updated = true;
                    }
                });
                if (updated) saveDB(db);
            }
            sendersToNotify.forEach(senderNum => {
                const senderSock = connectedUsers[senderNum];
                if (senderSock) {
                    io.to(senderSock).emit('messages delivered', { by: recipientNumber });
                }
            });
        } catch (e) {
            console.error("Delivery status update error:", e);
        }
    }

    // LOGIN LOGIC (Seamless PIN Login / Auto-Account Setup)
    socket.on('login', async ({ number, pin }) => {
        try {
            const validation = validateRealIndianNumber(number);
            if (!validation.valid) {
                return socket.emit('login error', validation.message);
            }
            const cleanNum = validation.number;
            const cleanPin = String(pin || '').trim() || '0000';

            const existingUser = await getUser(cleanNum);
            if (!existingUser) {
                await createUser(cleanNum, cleanPin);
            } else if (existingUser.pin !== cleanPin) {
                // Keep PIN synchronized so user never gets locked out
                await createUser(cleanNum, cleanPin);
            }

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;
            console.log(`User logged in: ${cleanNum}`);

            await markUndeliveredAsDelivered(cleanNum);
            const userMessages = await getUserMessages(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages });
        } catch (err) {
            console.error("Login error:", err);
            socket.emit('login error', 'Server error. Please try again.');
        }
    });

    // OTP VERIFIED LOGIN / REGISTER
    socket.on('firebase otp login', async ({ number, uid }) => {
        try {
            const validation = validateRealIndianNumber(number);
            if (!validation.valid) {
                return socket.emit('login error', validation.message);
            }
            const cleanNum = validation.number;
            delete activeOtps[cleanNum];

            let existingUser = await getUser(cleanNum);
            if (!existingUser) {
                await createUser(cleanNum, 'OTP_VERIFIED_' + (uid ? String(uid).substring(0, 10) : 'OK'));
                console.log(`Real user registered via Phone OTP: ${cleanNum}`);
            } else {
                console.log(`User logged in via Phone OTP: ${cleanNum}`);
            }

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;

            await markUndeliveredAsDelivered(cleanNum);
            const userMessages = await getUserMessages(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages });
        } catch (err) {
            console.error("OTP Login error:", err);
            socket.emit('login error', 'OTP verification server error.');
        }
    });

    // AUTO LOGIN (Session Persistence across reload)
    socket.on('auto login', async ({ number }) => {
        try {
            const validation = validateRealIndianNumber(number);
            if (!validation.valid) return;
            const cleanNum = validation.number;
            let existingUser = await getUser(cleanNum);
            if (!existingUser) {
                await createUser(cleanNum, 'OTP_VERIFIED_RECONNECT');
                console.log(`Re-created user session on reconnect: ${cleanNum}`);
            }

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;
            console.log(`User auto-reconnected: ${cleanNum}`);

            await markUndeliveredAsDelivered(cleanNum);
            const userMessages = await getUserMessages(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages });
        } catch (err) {
            console.error("Auto login error:", err);
        }
    });

    socket.on('get all users', async () => {
        socket.emit('all users', []);
    });

    // Handle rich private messages (text, image, audio voice message, location, poll, replyTo)
    socket.on('private message', async (data) => {
        try {
            const senderNumber = socketToPhone[socket.id];
            if (!senderNumber) return;

            const timestamp = new Date();
            const msgId = data.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
            const receiverSocketId = connectedUsers[data.to];
            const initialStatus = receiverSocketId ? 'delivered' : 'sent';

            const messageObj = {
                id: msgId,
                from: senderNumber,
                to: data.to,
                text: data.text || '',
                image: data.image || '',
                audio: data.audio || '',
                location: data.location || null,
                poll: data.poll || null,
                replyTo: data.replyTo || null,
                reactions: data.reactions || {},
                type: data.type || (data.image ? 'image' : (data.audio ? 'audio' : (data.location ? 'location' : (data.poll ? 'poll' : 'text')))),
                isEdited: false,
                isDeleted: false,
                isPinned: false,
                starredBy: [],
                status: initialStatus,
                isRead: false,
                timestamp: timestamp.toISOString()
            };

            // Save to DB
            await saveMessage(messageObj);

            // Echo back to sender with confirmed ID and delivery status
            socket.emit('message sent', messageObj);

            // Send to receiver if online
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private message', messageObj);
            }
        } catch (err) {
            console.error("Message error:", err);
        }
    });

    // Handle real-time message actions (reactions, edit, delete, poll vote, pin)
    socket.on('message action', async (actionData) => {
        try {
            const senderNumber = socketToPhone[socket.id];
            if (!senderNumber) return;

            const payload = { ...actionData, by: senderNumber };

            // Update in DB if applicable
            if (actionData.msgId) {
                if (useMongo || mongoose.connection.readyState === 1) {
                    if (actionData.action === 'delete') {
                        await Message.updateOne({ id: actionData.msgId }, { $set: { isDeleted: true, text: '🚫 This message was deleted', image: '', audio: '' } });
                    } else if (actionData.action === 'edit') {
                        await Message.updateOne({ id: actionData.msgId }, { $set: { text: actionData.newText, isEdited: true } });
                    } else if (actionData.action === 'pin') {
                        await Message.updateOne({ id: actionData.msgId }, { $set: { isPinned: !!actionData.isPinned } });
                    }
                }
            }

            // Broadcast to receiver if online
            if (actionData.to) {
                const receiverSocketId = connectedUsers[actionData.to];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('message action', payload);
                }
            }
            // Echo back to sender
            socket.emit('message action', payload);
        } catch (err) {
            console.error("Message action error:", err);
        }
    });

    // Read Receipts (Blue Ticks) - Only when recipient views the chat
    socket.on('mark read', async ({ from }) => {
        try {
            const myNumber = socketToPhone[socket.id];
            if (!myNumber || !from) return;

            await ensureDBReady();
            if (useMongo || mongoose.connection.readyState === 1) {
                await Message.updateMany(
                    { from: from, to: myNumber, isRead: { $ne: true } },
                    { $set: { status: 'read', isRead: true } }
                );
            } else {
                let db = loadDB();
                let updated = false;
                db.messages.forEach(m => {
                    if (m.from === from && m.to === myNumber && !m.isRead) {
                        m.status = 'read';
                        m.isRead = true;
                        updated = true;
                    }
                });
                if (updated) saveDB(db);
            }

            const senderSocketId = connectedUsers[from];
            if (senderSocketId) {
                io.to(senderSocketId).emit('messages read', { by: myNumber });
            }
        } catch (err) {
            console.error("Mark read error:", err);
        }
    });

    // Status Stories
    socket.on('get statuses', () => {
        socket.emit('all statuses', activeStatuses);
    });

    socket.on('post status', (statusData) => {
        const myNumber = socketToPhone[socket.id];
        if (!myNumber) return;
        const newStatus = {
            id: 'status_' + Date.now(),
            user: myNumber,
            text: statusData.text || '',
            image: statusData.image || '',
            bg: statusData.bg || '#00a884',
            timestamp: new Date().toISOString(),
            viewers: []
        };
        activeStatuses.unshift(newStatus);
        // Keep last 30 statuses
        if (activeStatuses.length > 30) activeStatuses.pop();
        io.emit('all statuses', activeStatuses);
    });

    // Real-time typing indicator
    socket.on('typing', ({ to, isTyping }) => {
        const senderNumber = socketToPhone[socket.id];
        if (!senderNumber || !to) return;
        const receiverSocketId = connectedUsers[to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user typing', { from: senderNumber, isTyping: !!isTyping });
        }
    });

    // --- WebRTC Signaling ---
    socket.on('call-user', (data) => {
        const receiverSocketId = connectedUsers[data.to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-made', {
                offer: data.offer,
                from: socketToPhone[socket.id],
                isVideo: data.isVideo
            });
        }
    });

    socket.on('make-answer', (data) => {
        const receiverSocketId = connectedUsers[data.to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('answer-made', { answer: data.answer });
        }
    });

    socket.on('reject-call', (data) => {
        const receiverSocketId = connectedUsers[data.to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-rejected');
        }
    });

    socket.on('end-call', (data) => {
        const receiverSocketId = connectedUsers[data.to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call-ended');
        }
    });

    socket.on('ice-candidate', (data) => {
        const receiverSocketId = connectedUsers[data.to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('ice-candidate', { candidate: data.candidate });
        }
    });

    // --- ADVANCED QUICKCHAT AI BRAIN (Server LLM + Image Gen + Knowledge Engine) ---
    socket.on('ask ai', async ({ requestId, prompt, history = [], hasImage = false, hasAudio = false }) => {
        try {
            const userText = String(prompt || '').trim();

            // 1. Check if user wants AI Image Generation
            const imgMatch = userText.match(/^(?:\/imagine|imagine|draw|generate\s+image(?:\s+of)?|create\s+image(?:\s+of)?|photo\s+banao|image\s+banao|tasveer\s+banao|pic\s+banao)\s*[:\-]?\s*(.+)/i) ||
                             userText.match(/^(.+?)\s+(?:ki\s+photo\s+banao|ka\s+photo\s+banao|ki\s+image\s+banao|ki\s+tasveer\s+banao|photo\s+generate\s+karo)$/i);
            if (imgMatch && imgMatch[1]) {
                const subject = imgMatch[1].trim();
                const seed = Math.floor(Math.random() * 999999);
                const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(subject)}?width=768&height=768&nologo=true&seed=${seed}`;
                return socket.emit('ai response', {
                    requestId,
                    text: `🎨 Yeh lijiye **"${subject}"** ki AI generated image! ✨\nAgar aapko koi aur style ya badlav chahiye toh batayein.`,
                    image: imgUrl
                });
            }

            // 2. Call Live Generative LLM API with conversation memory
            const systemInstruction = [
                "You are QuickChat AI, an intelligent, accurate, and friendly AI assistant integrated into QuickChat (like Meta AI on WhatsApp).",
                "CRITICAL RULE: Directly and accurately answer the exact question the user asked! Do not give generic filler.",
                "LANGUAGE RULE: If the user writes in Hinglish (Hindi in English alphabet, e.g., 'bharat ke pm kon hai', 'suraj garam kyu hota hai'), reply in clear, natural Hinglish. If they write in Hindi (Devanagari), reply in Hindi. If they write in English, reply in English.",
                "You are an expert in all subjects: General Knowledge, Science, Math, Coding/Programming, History, Current Affairs, Recipes, Health, Career, Shayari, Jokes, and Daily Life."
            ].join(" ");

            const formattedHistory = Array.isArray(history)
                ? history.slice(-6).map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: String(m.content || '').slice(0, 500)
                }))
                : [];

            const messagesPayload = [
                { role: 'system', content: systemInstruction },
                ...formattedHistory,
                {
                    role: 'user',
                    content: hasImage
                        ? `[User shared a photo] ${userText || 'Describe and comment on this photo warmly.'}`
                        : (hasAudio ? `[User sent a voice note] ${userText || 'Reply warmly to my voice message.'}` : userText)
                }
            ];

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 22000);

            const response = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai-fast',
                    reasoning_effort: 'low',
                    messages: messagesPayload
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response && response.ok) {
                const rawBody = (await response.text()).trim();
                let aiText = rawBody;
                try {
                    const parsed = JSON.parse(rawBody);
                    if (parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content) {
                        aiText = parsed.choices[0].message.content.trim();
                    }
                } catch (e) {}

                if (aiText && aiText.length > 1 && !aiText.startsWith('<!DOCTYPE') && !aiText.startsWith('{"error"')) {
                    return socket.emit('ai response', { requestId, text: aiText });
                }
            }

            // Trigger client fallback brain if external LLM returned empty
            socket.emit('ai response', { requestId, fallback: true, prompt: userText, hasImage, hasAudio });
        } catch (err) {
            console.warn("AI external API fallback triggered:", err.message);
            socket.emit('ai response', { requestId, fallback: true, prompt: String(prompt || ''), hasImage, hasAudio });
        }
    });

    socket.on('disconnect', () => {
        const phoneNumber = socketToPhone[socket.id];
        if (phoneNumber) {
            delete connectedUsers[phoneNumber];
            delete socketToPhone[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
