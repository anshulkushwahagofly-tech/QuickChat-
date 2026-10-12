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
        await User.create({ number, pin });
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
            timestamp: m.timestamp ? (typeof m.timestamp.toISOString === 'function' ? m.timestamp.toISOString() : m.timestamp) : new Date().toISOString()
        }));
    } else {
        return loadDB().messages.filter(m => m.from === number || m.to === number);
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

// --- REAL INDIAN MOBILE NUMBER VALIDATOR ---
function validateRealIndianNumber(number) {
    const clean = (number || '').trim();
    // 1. Must be exactly 10 digits
    if (!/^\d{10}$/.test(clean)) {
        return { valid: false, message: 'Mobile number exactly 10-digits ka hona chahiye.' };
    }
    // 2. Must start with 6, 7, 8, or 9 (Indian telecom standard)
    if (!/^[6-9]/.test(clean)) {
        return { valid: false, message: 'Invalid Number! Real Indian mobile number sirf 6, 7, 8 ya 9 se shuru hota hai.' };
    }
    // 3. Block all repeating identical digits (e.g. 9999999999, 8888888888, 7777777777)
    if (/^(\d)\1{9}$/.test(clean)) {
        return { valid: false, message: 'Dummy number (jaise 9999999999 ya 7777777777) allowed nahi hai. Apna real mobile number dalein.' };
    }
    // 4. Block trivial fake sequence numbers
    const fakeNumbers = ['1234567890', '0123456789', '9876543210', '9898989898', '8989898989', '7878787878'];
    if (fakeNumbers.includes(clean)) {
        return { valid: false, message: 'Dummy sequence number allowed nahi hai. Kripya apna real number dalein.' };
    }
    // 5. Block numbers with more than 5 identical digits in a row
    if (/(\d)\1{5}/.test(clean)) {
        return { valid: false, message: 'Fake number detect hua. Kripya apna real mobile number dalein.' };
    }
    return { valid: true, number: clean };
}

// --- SOCKET.IO LOGIC ---
let connectedUsers = {}; // { 'number': socket.id }
let socketToPhone = {};

io.on('connection', (socket) => {
    
    // SIGNUP LOGIC (Strict Real Number Verification)
    socket.on('signup', async ({ number, pin }) => {
        try {
            const validation = validateRealIndianNumber(number);
            if (!validation.valid) {
                return socket.emit('login error', validation.message);
            }
            const cleanNum = validation.number;

            const cleanPin = (pin || '').trim();
            if (!cleanPin || cleanPin.length !== 4) {
                return socket.emit('login error', 'Kripya 4-digit PIN banayein.');
            }

            const existingUser = await getUser(cleanNum);
            if (existingUser) {
                return socket.emit('login error', 'Yeh number pehle se registered hai! Kripya Login karein.');
            }

            await createUser(cleanNum, cleanPin);

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;
            console.log(`Real user signed up: ${cleanNum}`);
            
            const allUsers = await getAllUsers();
            socket.emit('login success', { number: cleanNum, history: [], allUsers });
            io.emit('all users', allUsers);
        } catch (err) {
            console.error("Signup error:", err);
            socket.emit('login error', 'Server error. Please try again.');
        }
    });

    // LOGIN LOGIC
    socket.on('login', async ({ number, pin }) => {
        try {
            const existingUser = await getUser(number);
            
            if (!existingUser) {
                return socket.emit('login error', 'Account nahi mila! Pehle Sign Up karein.');
            }
            
            if (existingUser.pin !== pin) {
                return socket.emit('login error', 'Galat PIN! Kripya sahi PIN dalein.');
            }

            connectedUsers[number] = socket.id;
            socketToPhone[socket.id] = number;
            console.log(`User logged in: ${number}`);
            
            const userMessages = await getUserMessages(number);
            const allUsers = await getAllUsers();
            socket.emit('login success', { number, history: userMessages, allUsers });
            io.emit('all users', allUsers);
        } catch (err) {
            console.error("Login error:", err);
            socket.emit('login error', 'Server error. Please try again.');
        }
    });

    // FIREBASE OTP VERIFIED LOGIN / REGISTER
    socket.on('firebase otp login', async ({ number, uid }) => {
        try {
            const validation = validateRealIndianNumber(number);
            if (!validation.valid) {
                return socket.emit('login error', validation.message);
            }
            const cleanNum = validation.number;

            let existingUser = await getUser(cleanNum);
            if (!existingUser) {
                // Register verified user with OTP
                await createUser(cleanNum, 'OTP_VERIFIED_' + (uid ? uid.substring(0, 10) : 'OK'));
                console.log(`Real user registered via Phone OTP: ${cleanNum}`);
            } else {
                console.log(`User logged in via Phone OTP: ${cleanNum}`);
            }

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;

            const userMessages = await getUserMessages(cleanNum);
            const allUsers = await getAllUsers();
            socket.emit('login success', { number: cleanNum, history: userMessages, allUsers });
            io.emit('all users', allUsers);
        } catch (err) {
            console.error("Firebase OTP Login error:", err);
            socket.emit('login error', 'OTP verification server error.');
        }
    });

    // AUTO LOGIN (Session Persistence across reload)
    socket.on('auto login', async ({ number }) => {
        try {
            if (!number) return socket.emit('login error', 'Invalid session number');
            const cleanNum = (number || '').trim();
            let existingUser = await getUser(cleanNum);
            if (!existingUser) {
                // If local storage has verified session but server restarted, re-create user
                await createUser(cleanNum, 'OTP_VERIFIED_RECONNECT');
                console.log(`Re-created user session on reconnect: ${cleanNum}`);
            }

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;
            console.log(`User auto-reconnected: ${cleanNum}`);

            const userMessages = await getUserMessages(cleanNum);
            const allUsers = await getAllUsers();
            socket.emit('login success', { number: cleanNum, history: userMessages, allUsers });
            io.emit('all users', allUsers);
        } catch (err) {
            console.error("Auto login error:", err);
            socket.emit('login error', 'Auto login error');
        }
    });

    socket.on('get all users', async () => {
        try {
            const allUsers = await getAllUsers();
            socket.emit('all users', allUsers);
        } catch (err) {
            console.error("Error getting users:", err);
        }
    });

    // Handle rich private messages (text, image, audio voice message, location, poll, replyTo)
    socket.on('private message', async (data) => {
        try {
            const senderNumber = socketToPhone[socket.id];
            if (!senderNumber) return;

            const timestamp = new Date();
            const msgId = data.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

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
                timestamp: timestamp.toISOString()
            };

            // Save to DB
            await saveMessage(messageObj);

            // Echo back to sender with confirmed ID
            socket.emit('message sent', messageObj);

            // Send to receiver if online
            const receiverSocketId = connectedUsers[data.to];
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

    // Read Receipts (Blue Ticks)
    socket.on('mark read', ({ from }) => {
        const myNumber = socketToPhone[socket.id];
        if (!myNumber || !from) return;
        const senderSocketId = connectedUsers[from];
        if (senderSocketId) {
            io.to(senderSocketId).emit('messages read', { by: myNumber });
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
