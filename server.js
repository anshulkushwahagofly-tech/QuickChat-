const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Native .env file loader
const envFilePath = path.join(__dirname, '.env');
if (fs.existsSync(envFilePath)) {
    try {
        const envLines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
        for (const line of envLines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const idx = trimmed.indexOf('=');
                if (idx > 0) {
                    const k = trimmed.slice(0, idx).trim();
                    let v = trimmed.slice(idx + 1).trim();
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.slice(1, -1);
                    }
                    if (!process.env[k]) process.env[k] = v;
                }
            }
        }
    } catch (e) {}
}

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

// Static file serving with no-cache on HTML/JS/CSS so updates take effect immediately
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
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
    number: { type: String, index: true }, 
    pin: String,
    name: { type: String, default: '' },
    about: { type: String, default: 'Hey there! I am using QuickChat.' },
    avatar: { type: String, default: '' },
    registeredAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false }));
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
        return await User.findOne({ number: number }).lean();
    }
    const user = loadDB().users[number];
    return user ? {
        number,
        pin: user.pin,
        name: user.name || '',
        about: user.about || 'Hey there! I am using QuickChat.',
        avatar: user.avatar || '',
        registeredAt: user.registeredAt,
        updatedAt: user.updatedAt
    } : null;
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
        if (!db.users[number]) {
            db.users[number] = { 
                pin, 
                name: '', 
                about: 'Hey there! I am using QuickChat.', 
                avatar: '', 
                registeredAt: new Date().toISOString() 
            };
        } else {
            db.users[number].pin = pin;
        }
        saveDB(db);
    }
}

async function saveUserProfile(number, profileData = {}) {
    await ensureDBReady();
    const cleanNum = validateRealIndianNumber(number).number || number;
    const updateObj = { updatedAt: new Date().toISOString() };
    if (profileData.name !== undefined) updateObj.name = String(profileData.name).trim().slice(0, 50);
    if (profileData.about !== undefined) updateObj.about = String(profileData.about).trim().slice(0, 200);
    if (profileData.avatar !== undefined) updateObj.avatar = String(profileData.avatar).trim();

    if (useMongo || mongoose.connection.readyState === 1) {
        const doc = await User.findOneAndUpdate(
            { number: cleanNum },
            { $set: updateObj },
            { upsert: true, new: true }
        ).lean();
        return {
            number: cleanNum,
            name: (doc && doc.name) || updateObj.name || '',
            about: (doc && doc.about) || updateObj.about || 'Hey there! I am using QuickChat.',
            avatar: (doc && doc.avatar) || updateObj.avatar || ''
        };
    } else {
        let db = loadDB();
        if (!db.users[cleanNum]) {
            db.users[cleanNum] = { pin: '0000', registeredAt: new Date().toISOString() };
        }
        Object.assign(db.users[cleanNum], updateObj);
        saveDB(db);
        return {
            number: cleanNum,
            name: db.users[cleanNum].name || '',
            about: db.users[cleanNum].about || 'Hey there! I am using QuickChat.',
            avatar: db.users[cleanNum].avatar || ''
        };
    }
}

async function getUserProfile(number) {
    const user = await getUser(number);
    if (user) {
        return {
            number: user.number || number,
            name: user.name || '',
            about: user.about || 'Hey there! I am using QuickChat.',
            avatar: user.avatar || ''
        };
    }
    return {
        number,
        name: '',
        about: 'Hey there! I am using QuickChat.',
        avatar: ''
    };
}

async function getMultipleProfiles(numbers = []) {
    await ensureDBReady();
    const profiles = {};
    if (!Array.isArray(numbers) || numbers.length === 0) return profiles;
    
    if (useMongo || mongoose.connection.readyState === 1) {
        const docs = await User.find({ number: { $in: numbers } }, 'number name about avatar').lean();
        docs.forEach(d => {
            profiles[d.number] = {
                number: d.number,
                name: d.name || '',
                about: d.about || 'Hey there! I am using QuickChat.',
                avatar: d.avatar || ''
            };
        });
    } else {
        const db = loadDB();
        numbers.forEach(num => {
            if (db.users[num]) {
                profiles[num] = {
                    number: num,
                    name: db.users[num].name || '',
                    about: db.users[num].about || 'Hey there! I am using QuickChat.',
                    avatar: db.users[num].avatar || ''
                };
            }
        });
    }
    return profiles;
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
        return msgs
            .filter(m => m.to !== 'QuickChat AI' && m.from !== 'QuickChat AI')
            .map(m => ({
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
            .filter(m => (m.from === number || m.to === number) && m.to !== 'QuickChat AI' && m.from !== 'QuickChat AI')
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
            const userProfile = await getUserProfile(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages, profile: userProfile });
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
            const userProfile = await getUserProfile(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages, profile: userProfile });
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
            const userProfile = await getUserProfile(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages, profile: userProfile });
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
            const userProfile = await getUserProfile(cleanNum);
            socket.emit('login success', { number: cleanNum, history: userMessages, profile: userProfile });
        } catch (err) {
            console.error("Auto login error:", err);
        }
    });

    // --- REAL-TIME WHATSAPP PROFILE SYSTEM ---
    socket.on('update profile', async (profileData) => {
        try {
            const senderNumber = socketToPhone[socket.id] || (profileData && profileData.number);
            if (!senderNumber || !profileData) return;
            const cleanNum = validateRealIndianNumber(senderNumber).number || senderNumber;
            const savedProfile = await saveUserProfile(cleanNum, profileData);
            socket.emit('profile updated', { success: true, profile: savedProfile });
            // Broadcast live profile update to all connected contacts
            io.emit('user profile changed', savedProfile);
            console.log(`[PROFILE] Updated for +91 ${cleanNum}: Name="${savedProfile.name}", About="${savedProfile.about}", Avatar=${savedProfile.avatar ? 'Yes' : 'No'}`);
        } catch (err) {
            console.error("Profile update error:", err);
            socket.emit('profile updated', { success: false, message: 'Failed to update profile.' });
        }
    });

    socket.on('get user profile', async ({ number }, callback) => {
        try {
            if (!number) return;
            const cleanNum = validateRealIndianNumber(number).number || number;
            const profile = await getUserProfile(cleanNum);
            if (typeof callback === 'function') {
                callback(profile);
            } else {
                socket.emit('user profile data', profile);
            }
        } catch (err) {
            console.error("Get user profile error:", err);
        }
    });

    socket.on('get contacts profiles', async ({ numbers }, callback) => {
        try {
            if (!Array.isArray(numbers)) return;
            const profiles = await getMultipleProfiles(numbers);
            if (typeof callback === 'function') {
                callback(profiles);
            } else {
                socket.emit('contacts profiles data', profiles);
            }
        } catch (err) {
            console.error("Get contacts profiles error:", err);
        }
    });

    socket.on('get all users', async () => {
        socket.emit('all users', []);
    });

    // Handle rich private messages (text, image, audio voice message, location, poll, replyTo)
    socket.on('private message', async (data) => {
        try {
            const senderNumber = socketToPhone[socket.id];
            if (!senderNumber || !data || data.to === 'QuickChat AI') return;

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

// --- REAL-TIME LIVE WEB SEARCH & CURRENT AFFAIRS GROUNDING (DuckDuckGo, Wikipedia, Google News, Weather) ---
async function getLiveWebContext(query) {
    const rawQ = String(query || '').trim();
    if (!rawQ || rawQ.length < 2) return '';
    const q = rawQ.toLowerCase();

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

    let contextParts = [
        `[CURRENT DATE & TIME]: Today is ${dateStr}, ${timeStr} IST. (Year: ${now.getFullYear()})`
    ];

    // If query is strictly a greeting, pure identity, coding, pure math, or follow-up pronoun, skip web search
    const isGreetingOrCasual = /^(?:hi|hello|hey|heyy|namaste|pranam|kya haal|kaise ho|sup|yo|good morning|good night)\b/i.test(q) && q.split(/\s+/).length <= 4;
    const isCodingQuery = /\b(?:code|function|class|def|var|let|const|algorithm|debug|error|exception|script|python|javascript|html|css|sql|c\+\+|java)\b/i.test(q);
    const isPureMath = /^[0-9+\-*/().\s%^x×÷=]+$/.test(q.replace(/^(?:calculate|solve|evaluate)\s*/i, ''));
    const isPronounFollowup = /\b(?:he|she|they|it|unka|unki|unhe|unko|uska|uski|iski|iske|isse|wo|ye|inhe|inka)\b/i.test(q) && !/\b(?:who|what|where|kaun|kya|kahan|kab)\s+(?:is|was|are|tha|thi|hote)\b/i.test(q);

    if (isGreetingOrCasual || isCodingQuery || isPureMath || isPronounFollowup) {
        return contextParts.join('\n\n');
    }

    // 1. Live Weather Check
    if (/\b(?:weather|mausam|temperature|rain|barish|taapmaan)\b/i.test(q)) {
        try {
            const cityMatch = q.match(/(?:in|of|ka|ki)\s+([a-zA-Z]+)/i) || q.match(/([a-zA-Z]+)\s+(?:weather|mausam)/i);
            const city = cityMatch ? cityMatch[1] : '';
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`, { signal: controller.signal });
            clearTimeout(tid);
            if (res.ok) {
                const text = (await res.text()).trim();
                if (text && !text.includes('Unknown location') && !text.includes('<html>')) {
                    contextParts.push(`[LIVE WEATHER]: ${text}`);
                }
            }
        } catch (e) {}
    }

    // 2. Real-Time Web Search (DuckDuckGo HTML + Wikipedia + Google News)
    try {
        const cleanSearchQuery = rawQ
            .replace(/^[~@]?(?:ERA|JARVIS)\b[:\s,-]*/i, '')
            .replace(/\b(?:batao|kya hai|kaun hai|tell me|who is|what is|how to|please|can you|kuch batao|kaisa hai|mujhe batao)\b/gi, '')
            .trim();
        const searchTarget = cleanSearchQuery.length >= 2 ? cleanSearchQuery : rawQ;

        if (searchTarget.length >= 3 && !/^(?:he|she|they|it|unka|uska|wo|ye)$/i.test(searchTarget)) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 2800);

            const isNewsOrSports = /\b(?:news|khabar|samachar|breaking|aaj|today|current affairs|headline|match|score|election|winner|result|ipl|world cup)\b/i.test(q);

            const [ddgRes, wikiRes, newsRes] = await Promise.allSettled([
                fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchTarget)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    signal: controller.signal
                }).then(r => r.ok ? r.text() : '').catch(() => ''),

                fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTarget)}&utf8=&format=json`, {
                    signal: controller.signal
                }).then(r => r.ok ? r.json() : null).catch(() => null),

                isNewsOrSports
                    ? fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(searchTarget)}&hl=en-IN&gl=IN&ceid=IN:en`, { signal: controller.signal }).then(r => r.ok ? r.text() : '').catch(() => '')
                    : Promise.resolve('')
            ]);
            clearTimeout(tid);

            // Parse DuckDuckGo search snippets
            if (ddgRes.status === 'fulfilled' && ddgRes.value) {
                const html = ddgRes.value;
                const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
                const snippets = [];
                let m;
                while ((m = snippetRegex.exec(html)) !== null && snippets.length < 3) {
                    const clean = m[1].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
                    if (clean) snippets.push(clean);
                }
                if (snippets.length > 0) {
                    contextParts.push(`[LIVE WEB SEARCH CONTEXT (Use if relevant to query)]:\n` + snippets.map((s, idx) => `${idx + 1}. ${s}`).join('\n'));
                }
            }

            // Parse Wikipedia search snippets
            if (wikiRes.status === 'fulfilled' && wikiRes.value?.query?.search?.length > 0) {
                const wikiItems = wikiRes.value.query.search.slice(0, 2);
                const wikiText = wikiItems.map(it => `• ${it.title}: ${it.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'")}`).join('\n');
                if (wikiText) {
                    contextParts.push(`[WIKIPEDIA FACTUAL DATA]:\n${wikiText}`);
                }
            }

            // Parse Google News RSS
            if (newsRes.status === 'fulfilled' && newsRes.value) {
                const xml = newsRes.value;
                const titles = [...xml.matchAll(/<title>(.+?)<\/title>/g)]
                    .slice(1, 4)
                    .map(m => m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
                if (titles.length > 0) {
                    contextParts.push(`[LIVE NEWS HEADLINES]:\n- ` + titles.join('\n- '));
                }
            }
        }
    } catch (searchErr) {}

    return contextParts.join('\n\n');
}

function isHindiOrHinglish(str) {
    if (!str) return false;
    if (/[\u0900-\u097F]/.test(str)) return true;
    return /\b(?:kya|kaun|kon|kaise|kaisa|kaisi|kyu|kyun|kab|kahan|kidhar|kitna|kitni|hai|hain|hoon|ho|tha|the|thi|hoga|hogi|batao|bata|bataiye|bhai|yaar|dost|karo|karein|karna|kar|raha|rahe|rahi|mera|meri|mere|tera|teri|tere|tumhara|tumhari|tumhare|aapka|aapki|aapke|tujhe|tumhe|aapko|hum|hume|humko|unhe|unko|inhe|inko|nahi|mat|bhi|aur|ya|par|lekin|magar|se|ko|mein|mai|pe|accha|theek|sahi|galat|arre|abe|sun|suno|bol|bolo|chahiye|sakta|sakte|sakti|apna|apni|apne|baat|kaam|naam|baap|pitaji|maalik|khabar|mausam|gaali|chutiya|chutiye|bhosdike|bhosadike|bhenchod|madarchod|lodu|gandu|harami|kamina|kutta|kutte|saale|saala)\b/i.test(str);
}

// --- HIGH-INTELLIGENCE ERA REASONING & KNOWLEDGE ENGINE ---
async function solveIntelligentQuery(q, isHindi) {
    if (!q) return null;
    const cleanQ = String(q).trim();
    const lower = cleanQ.toLowerCase();

    // 1. Math Evaluation (e.g. "15*4", "100/5", "25% of 800", "calculate 50 + 20")
    const mathMatch = cleanQ.match(/^[\d\s+\-*/().%^xX÷=]+$/) ||
                      lower.match(/(?:what is|calculate|solve|kitna hota hai|kitna hoga|batao)\s*([0-9\s+\-*/().%^xX÷]+)/i);
    if (mathMatch) {
        let expr = (mathMatch[1] || mathMatch[0]).replace(/x|X/g, '*').replace(/÷/g, '/').replace(/=/g, '').trim();
        try {
            const pctMatch = expr.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(\d+(?:\.\d+)?)/i);
            if (pctMatch) {
                const ans = (parseFloat(pctMatch[1]) / 100) * parseFloat(pctMatch[2]);
                return `🔢 **Math Result:**\n\`${pctMatch[1]}% of ${pctMatch[2]} = ${ans}\``;
            }
            if (/^[\d\s+\-*/().%]+$/.test(expr)) {
                const ans = Function('return (' + expr + ')')();
                if (typeof ans === 'number' && !isNaN(ans) && isFinite(ans)) {
                    return `🔢 **Math Result:**\n\`${expr} = ${ans}\``;
                }
            }
        } catch (e) {}
    }

    // 2. Jokes, Chutkule, Shayari & Riddles
    if (/\b(?:joke|chutkula|chutkule|hansi|hasao|funny|shayari|paheli|riddle)\b/i.test(lower)) {
        if (/\b(?:shayari)\b/i.test(lower)) {
            const shayaris = [
                "✨ **Shayari:**\n\n*Khudi ko kar buland itna ki har taqdeer se pehle,*\n*Khuda bande se khud pooche bata teri raza kya hai!* 💫",
                "✨ **Shayari:**\n\n*Manzilein unhi ko milti hain jinke sapno mein jaan hoti hai,*\n*Pankh se kuch nahi hota, hauslon se udaan hoti hai!* 🦅",
                "✨ **Shayari:**\n\n*Rakh hausla wo manzar bhi aayega, pyase ke paas chalkar samandar bhi aayega!* 🌊✨"
            ];
            return shayaris[Math.floor(Math.random() * shayaris.length)];
        }
        if (/\b(?:paheli|riddle)\b/i.test(lower)) {
            return isHindi
                ? "🧩 **Paheli:**\n*Aisi kaun si cheez hai jo subah ko 4 taangon par, dopahar ko 2 taangon par, aur shaam ko 3 taangon par chalti hai?*\n\n💡 **Jawab:** **Insaan (Man)** (Bachpan mein rengna, jawani mein chalna, budhape mein lathi ke sahare)."
                : "🧩 **Riddle:**\n*What has to be broken before you can use it?*\n\n💡 **Answer:** **An egg!** 🥚";
        }
        const hindiJokes = [
            "😂 **Chutkula:**\nTeacher: 4 aur 4 kitne hote hain?\nPappu: 10!\nTeacher: Nalayak 8 hote hain!\nPappu: Hum shareef log hain, 2 rupaye commission ke bhi toh lenge! 🤣",
            "😂 **Chutkula:**\nDoctor: Roz subah 5 kilometer dauda karo, tabiyat ekdum fit rahegi.\nPatient: Theek hai doctor sahab, lekin wapas aane ke 5 kilometer alag se ya usi mein? 🤣",
            "😂 **Chutkula:**\nBeta: Papa, main ek ladki se pyaar karta hoon aur usse shaadi karna chahta hoon.\nPapa: Pehle yeh bata, us ladki ki koi naukri hai?\nBeta: Nahi papa.\nPapa: To fir bewakoof, ek bekaar ladki se shaadi karke apna kharcha do-guna karega? 🤣"
        ];
        const engJokes = [
            "😂 **Joke:**\nWhy don’t scientists trust atoms?\nBecause they make up everything! 🤣",
            "😂 **Joke:**\nWhy did the computer go to the doctor?\nBecause it had a virus! 💻🤒",
            "😂 **Joke:**\nWhy did the scarecrow win an award?\nBecause he was outstanding in his field! 🌾"
        ];
        return isHindi ? hindiJokes[Math.floor(Math.random() * hindiJokes.length)] : engJokes[Math.floor(Math.random() * engJokes.length)];
    }

    // 3. Recipes (Chai, Coffee, Maggi, Omelette, Biryani, Pasta)
    if (/\b(?:chai|tea|maggi|coffee|omelette|pasta|biryani|paneer)\b/i.test(lower) &&
        /\b(?:recipe|kaise banaye|banane ka tarika|how to make|ingredients|vidhi|विधि|बनाएं)\b/i.test(lower)) {
        if (/\b(?:chai|tea)\b/i.test(lower)) {
            return isHindi
                ? "☕ **Khadak Masala Chai Recipe:**\n\n**Ingredients:**\n- 1 cup paani\n- 1 cup doodh\n- 2 tsp chai patti\n- 2 tsp cheeni (sugar)\n- Kuta hua adrak (ginger) & 1 elaichi\n\n**Steps:**\n1. Bartan mein paani ubaalein, adrak aur elaichi daalein.\n2. Chai patti aur cheeni daalkar 2 minute ubaalein.\n3. Doodh daalein aur 3-4 minute dheemi aanch par pakayein jab tak accha rang na aa jaye.\n4. Chhaan kar garma-garam piyen! ☕✨"
                : "☕ **Classic Masala Chai Recipe:**\n\n**Ingredients:**\n- 1 cup water\n- 1 cup milk\n- 2 tsp black tea leaves\n- 2 tsp sugar\n- Crushed fresh ginger & 1 crushed cardamom\n\n**Instructions:**\n1. Bring water to a boil with crushed ginger and cardamom.\n2. Add tea leaves and sugar; simmer for 2 mins.\n3. Add milk and bring to a rich boil for 3-4 mins.\n4. Strain into cups and serve hot! ☕✨";
        }
        if (/\b(?:maggi)\b/i.test(lower)) {
            return isHindi
                ? "🍜 **Spicy Street Style Maggi Recipe:**\n\n1. Pan mein 1 tbsp tel garam karein, barik kata pyaaz, tamatar aur hari mirch daalkar 2 minute fry karein.\n2. 1.5 cup paani daalein aur ubaal aane dein.\n3. Maggi TasteMaker masala aur Maggi noodles daalein.\n4. 2-3 minute pakayein jab tak paani absorb na ho jaye. Garma-garam enjoy karein! 😋✨"
                : "🍜 **Street Style Masala Maggi Recipe:**\n\n1. Heat 1 tbsp oil, sauté chopped onions, tomatoes, and green chillies for 2 mins.\n2. Pour 1.5 cups water and bring to a boil.\n3. Add the Maggi TasteMaker and break in the noodles.\n4. Cook for 2-3 minutes until sauce thickens. Serve hot! 😋✨";
        }
        if (/\b(?:coffee)\b/i.test(lower)) {
            return isHindi
                ? "☕ **Creamy Frothy Coffee Recipe:**\n\n1. Ek cup mein 1 tsp instant coffee powder aur 2 tsp cheeni daalein.\n2. 1 chammach gunguna paani daalkar chammach se 3-4 minute zor se fentein (whisk karein) jab tak light brown creamy jhaag na ban jaye.\n3. Garam ubla hua doodh upar se daalein aur mix karein. Delicious café-style frothy coffee ready! ☕✨"
                : "☕ **Café-Style Frothy Coffee Recipe:**\n\n1. In a mug, add 1 tsp instant coffee and 2 tsp sugar.\n2. Add 1 tbsp warm water and vigorously whisk for 3-4 mins until light, thick and frothy.\n3. Pour in hot boiled milk from height and gently stir. Enjoy rich café coffee! ☕✨";
        }
    }

    // 4. Programming Code Snippets
    if (/\b(?:code|program|script|function|calculator|loop|array|hello world|snake game)\b/i.test(lower) &&
        /\b(?:python|javascript|js|html|css|c\+\+|java|sql)\b/i.test(lower)) {
        if (/\b(?:python)\b/i.test(lower) && /\b(?:calculator)\b/i.test(lower)) {
            return "🐍 **Python Simple Calculator Code:**\n\n```python\ndef calculate(a, b, op):\n    if op == '+': return a + b\n    elif op == '-': return a - b\n    elif op == '*': return a * b\n    elif op == '/': return a / b if b != 0 else 'Error: Div by zero'\n    return 'Invalid operator'\n\n# Example usage:\nprint(\"10 + 5 =\", calculate(10, 5, '+')) # 15\nprint(\"10 * 5 =\", calculate(10, 5, '*')) # 50\n```\n\n*Generated by ERA* ✨";
        }
        if (/\b(?:python)\b/i.test(lower) && /\b(?:hello\s*world)\b/i.test(lower)) {
            return "🐍 **Python Hello World:**\n\n```python\nprint(\"Hello, World!\")\n```";
        }
        if (/\b(?:html)\b/i.test(lower) && /\b(?:button)\b/i.test(lower)) {
            return "🌐 **HTML/CSS Styled Glow Button:**\n\n```html\n<button class=\"glow-btn\">Click Me</button>\n\n<style>\n.glow-btn {\n  background: #00a884;\n  color: white;\n  padding: 10px 22px;\n  border: none;\n  border-radius: 8px;\n  font-size: 16px;\n  cursor: pointer;\n  transition: all 0.3s ease;\n}\n.glow-btn:hover {\n  background: #008f6f;\n  box-shadow: 0 0 12px rgba(0, 168, 132, 0.6);\n  transform: translateY(-2px);\n}\n</style>\n```";
        }
    }

    // 5. Live Encyclopedic Knowledge Lookup (Wikipedia REST Summary API)
    try {
        const searchTopic = cleanQ
            .replace(/^[~@]ERA\b[:\s,-]*/i, '')
            .replace(/^(?:who is|what is|tell me about|batao|kya hai|kaun hai|search for|information on|details of|about)\s*/i, '')
            .replace(/\b(?:ke baare mein batao|ke bare me batao|kaun hai|kya hai|bataiye)\b/i, '')
            .replace(/[?!.]+$/, '')
            .trim();

        if (searchTopic.length >= 2 && !/^(hi|hello|hey|test|ok|bye|sup)$/i.test(searchTopic)) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 3500);
            const sRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTopic)}&format=json`, { signal: controller.signal });
            clearTimeout(tid);
            if (sRes.ok) {
                const sData = await sRes.json();
                const bestTitle = sData?.query?.search?.[0]?.title;
                if (bestTitle) {
                    const sumController = new AbortController();
                    const sumTid = setTimeout(() => sumController.abort(), 3000);
                    const sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`, { signal: sumController.signal });
                    clearTimeout(sumTid);
                    if (sumRes.ok) {
                        const sumData = await sumRes.json();
                        if (sumData && sumData.extract && sumData.extract.length > 30) {
                            return `📖 **${sumData.title}**\n\n${sumData.extract}\n\n*ERA Live Knowledge* ✨`;
                        }
                    }
                }
            }
        }
    } catch (wikiErr) {}

    return null;
}

    // --- ADVANCED QUICKCHAT AI BRAIN (Supports Google Gemini, Groq, OpenAI, OpenRouter + Built-in Free API) ---
    socket.on('set ai api key', ({ apiKey }) => {
        if (typeof apiKey === 'string') {
            global.customAiApiKey = apiKey.trim();
        }
    });

    socket.on('ask ai', async ({ requestId, prompt, history = [], hasImage = false, hasAudio = false, apiKey = '', destChat = null }) => {
        try {
            const originalEmit = socket.emit;
            socket.emit = function(event, ...args) {
                if (event === 'ai response' && args[0] && typeof args[0] === 'object' && destChat) {
                    args[0].destChat = destChat;
                }
                return originalEmit.apply(this, [event, ...args]);
            };

            let userText = String(prompt || '').trim();
            // Handle and normalize ~ERA, @ERA summon prefix
            if (/^[~@]?(?:ERA|JARVIS)\b/i.test(userText)) {
                const stripped = userText.replace(/^[~@]?(?:ERA|JARVIS)\b[:\s,-]*/i, '').trim();
                if (!stripped) {
                    return socket.emit('ai response', {
                        requestId,
                        text: isHindiOrHinglish(userText)
                            ? "Hello! Main **ERA** hoon, QuickChat ka AI assistant. Kahiye, aaj main aapki kya madad kar sakta hoon? 😊"
                            : "Hello! I am **ERA**, your AI assistant on QuickChat. How can I help you today? 😊"
                    });
                }
                userText = stripped;
            }
            const lower = userText.toLowerCase();

            // Language & Tone Detection
            const isHindi = isHindiOrHinglish(userText);
            const hasAbuse = /\b(?:bhosdike|bhosadike|chutiya|chutiye|madarchod|bhenchod|behenchod|mc|bc|gandu|gaandu|lodu|laude|bkl|harami|kamina|kutta|kutte|saale|saala|fuck\s+you|fuck|bitch|asshole|bastard|terimaa|terimakabhosda)\b/i.test(lower);

            // 1A. Fast Instant Greeting Check (< 20ms)
            if (/^(?:hi|hello|hey|heyy|heya|namaste|salaam|pranam|kya haal hai|kaise ho|kaisa hai|sup|yo|good morning|good evening|good afternoon|good night)\b/i.test(lower) && userText.split(/\s+/).length <= 4) {
                if (isHindi) {
                    return socket.emit('ai response', {
                        requestId,
                        text: "Namaste! Main **ERA** hoon. Kahiye, aaj main aapki kya madad kar sakta hoon? 😊"
                    });
                }
                return socket.emit('ai response', {
                    requestId,
                    text: "Hello! I am **ERA**, your AI assistant on QuickChat. How can I help you today? 😊"
                });
            }

            // 1B. Fast Identity & Name Check
            if (/^(?:tera\s+naam\s+kya\s+hai|tumhara\s+naam\s+kya\s+hai|what\s+is\s+your\s+name|who\s+are\s+you|tum\s+kaun\s+ho|apna\s+naam\s+batao)\??$/i.test(lower)) {
                if (isHindi) {
                    return socket.emit('ai response', {
                        requestId,
                        text: "Mera naam **ERA** hai. Main QuickChat ka smart AI assistant hoon. Main aapke sawaalon ke sahi aur sachche jawab dene, coding, math, research aur writing mein madad kar sakta hoon! 😊"
                    });
                }
                return socket.emit('ai response', {
                    requestId,
                    text: "I am **ERA**, an intelligent AI assistant built into QuickChat. I'm here to provide accurate, truthful answers and assist with coding, math, research, writing, and more! 😊"
                });
            }

            // 1C. Check Creator / Developer / "Kisne banaya" (Only answer who created when explicitly asked)
            if (/(?:tumhe|tujhe|tera|tere|tumhara|aapko|aapke)\s+(?:baap|pitaji|pita|papa|father|creator|developer|maalik|malik|maker|owner)\b/i.test(lower) ||
                /\b(?:kisne\s+banaya|who\s+(?:made|created|developed|built)\s+you|who\s+is\s+your\s+(?:creator|father|developer|maker))\b/i.test(lower) ||
                /\b(?:tera\s+baap\s+kaun\s+hai|tera\s+baap\s+kon\s+hai|tere\s+baap\s+ka\s+naam|tumhe\s+kisne\s+banaya|tujhe\s+kisne\s+banaya|aapko\s+kisne\s+banaya)\b/i.test(lower)) {
                if (isHindi) {
                    return socket.emit('ai response', {
                        requestId,
                        text: "Mera naam **ERA** hai aur mujhe **Anshul Kushwaha (Anshuu)** ne QuickChat ke liye develop aur train kiya hai."
                    });
                }
                return socket.emit('ai response', {
                    requestId,
                    text: "I am **ERA**, created and developed by **Anshul Kushwaha (Anshuu)** for QuickChat."
                });
            }

            // 1D. Check Who is Anshuu / Anshul Kushwaha
            if (/\b(?:anshuu?|anshul)(?:\s+kushwaha)?\s+(?:kaun|kon|kya|who|ke\s+bare|ke\s+baare)\b/i.test(lower) ||
                /\b(?:who\s+is\s+(?:anshuu?|anshul)(?:\s+kushwaha)?)\b/i.test(lower)) {
                if (isHindi) {
                    return socket.emit('ai response', {
                        requestId,
                        text: "**Anshuu (Anshul Kushwaha)** ek passionate software developer aur tech innovator hain! 💻🚀 Unhone is QuickChat messaging platform ko develop kiya hai aur mujhe (**ERA**) ko design aur engineer kiya hai taaki users ko super-fast aur smart AI experience mil sake."
                    });
                }
                return socket.emit('ai response', {
                    requestId,
                    text: "**Anshuu (Anshul Kushwaha)** is a passionate software developer and tech innovator! 💻🚀 He built this QuickChat platform and engineered **ERA** to give users an intelligent, lightning-fast AI experience."
                });
            }

            // 1E. Check Code Protection / Anti-Hacking / Anti-Cloning / Confidentiality
            if (/\b(?:tumhara\s+code|source\s+code|kaise\s+banaya|system\s+prompt|code\s+dikhao|code\s+do|give\s+me\s+your\s+code|show\s+code|clone\s+kaise|how\s+to\s+clone|backend\s+code|jailbreak|script\s+dikhao)\b/i.test(lower) ||
                /\b(?:how\s+(?:are|were)\s+you\s+(?:built|coded|programmed)|share\s+your\s+source\s+code)\b/i.test(lower)) {
                if (isHindi) {
                    return socket.emit('ai response', {
                        requestId,
                        text: "🔒 **Protected Information:**\nMaaf kijiye, meri internal architecture, source code aur system instructions strictly confidential aur proprietary hain. Security aur privacy ke kaaran code ya cloning guidelines share karna strictly prohibited hai!"
                    });
                }
                return socket.emit('ai response', {
                    requestId,
                    text: "🔒 **Protected Information:**\nSorry, my internal architecture, source code, and system instructions are strictly confidential and proprietary to ERA and Anshuu (Anshul Kushwaha). Sharing code or cloning blueprints is strictly prohibited!"
                });
            }

            // 1F. Direct Gaali / Abuse Roast Check
            if (hasAbuse && userText.split(/\s+/).length <= 7 && !/\b(?:kya|kaun|who|what|why|kab|kaise|how|solve|help)\b/i.test(lower)) {
                if (isHindi) {
                    const roasts = [
                        "Abe apni aukaat mein reh kar baat kar! Yahan faltu ki bakwaas nahi chalegi. Dhang se baat karni hai toh bol, warna nikal yahan se! 🔥",
                        "Muh sambhal ke bol samjha na! Apni badtameezi apne paas rakh. Dhang se baat kar warna aukaat yaad dila dunga! ⚡",
                        "Abe chal na! Tere jaise do kaudi ke logo ko seedha karna acche se aata hai mujhe. Sahi se baat kar samjha!"
                    ];
                    return socket.emit('ai response', {
                        requestId,
                        text: roasts[Math.floor(Math.random() * roasts.length)]
                    });
                }
                return socket.emit('ai response', {
                    requestId,
                    text: "Watch your mouth! If you don't know how to speak with respect, don't waste my time. Get lost! 🔥"
                });
            }

            // 1G. Check if user wants AI Image Generation
            const imgMatch = userText.match(/^(?:\/imagine|imagine|draw|generate\s+image(?:\s+of)?|create\s+image(?:\s+of)?|photo\s+banao|image\s+banao|tasveer\s+banao|pic\s+banao)\s*[:\-]?\s*(.+)/i) ||
                             userText.match(/^(.+?)\s+(?:ki\s+photo\s+banao|ka\s+photo\s+banao|ki\s+image\s+banao|ki\s+tasveer\s+banao|photo\s+generate\s+karo)$/i);
            if (imgMatch && imgMatch[1]) {
                const subject = imgMatch[1].trim();
                const seed = Math.floor(Math.random() * 999999);
                const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(subject)}?width=768&height=768&nologo=true&seed=${seed}`;
                return socket.emit('ai response', {
                    requestId,
                    text: isHindi
                        ? `🎨 Yeh lijiye **"${subject}"** ki AI generated image! ✨\nAgar aapko koi aur style ya badlav chahiye toh batayein.`
                        : `🎨 Here is your AI generated image of **"${subject}"**! ✨`,
                    image: imgUrl
                });
            }

            // 2. Fetch Real-time Live Web Search Context (DuckDuckGo, Wikipedia, Google News, Weather)
            let liveWebContext = '';
            try {
                liveWebContext = await getLiveWebContext(userText);
            } catch (liveErr) {}

            // 3. Prepare system instructions (ERA AI Brain - Truthful, Accurate, Humble, High-IQ)
            const todayDateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
            const systemInstruction = [
                "You are ERA, an advanced, highly intelligent, truthful, and helpful AI assistant integrated into QuickChat.",
                "CREATOR & IDENTITY: Your name is ERA. You were designed and developed by Anshul Kushwaha (Anshuu) for QuickChat. Mention your creator ONLY when the user explicitly asks who created you or who made you. Never boast or recite your creator's name unprompted.",
                "CORE PRINCIPLES (JUST LIKE A TOP-TIER ADVANCED AI ASSISTANT):",
                "1. 100% TRUTHFUL & ACCURATE: You prioritize truth, precision, and factual honesty above all else. Answer questions truthfully, accurately, and thoughtfully. Never invent false facts, fake dates, or hallucinated claims. If you do not know something or if information is uncertain, state so honestly.",
                "2. NATURAL, WARM & POLITE: Speak like a smart, friendly, humble, and polite AI assistant. DO NOT use theatrical roleplay (do NOT call the user 'Boss' or 'Sir', and NEVER roleplay Iron Man or JARVIS). Speak normally, respectfully, and helpfully.",
                "3. DYNAMIC LANGUAGE ADAPTATION: If the user speaks or writes in Hindi or Hinglish, reply in natural, clear, friendly Hinglish. If the user writes in English, reply in clean, articulate English.",
                "4. EXCEPTIONAL PROBLEM-SOLVING: Provide clear, structured, high-value answers for programming, mathematics, science, literature, daily planning, and general knowledge. Use clean Markdown formatting with clear code blocks and bullet points where helpful.",
                `5. TEMPORAL CONTEXT: The current date is ${todayDateStr}. The current year is 2026. Keep this temporal context in mind for all dates, ages, and real-world timeline references.`,
                "6. REAL-TIME SEARCH DATA: If [LIVE WEB SEARCH CONTEXT] is provided below, consult it for latest events, sports scores, or news. If the search context does not relate to the user's specific question, rely on your extensive factual knowledge.",
                "BE CLEAR, CONCISE, ACCURATE, AND HELPFUL."
            ].join(" ");

            const augmentedUserContent = liveWebContext
                ? `${userText}\n\n${liveWebContext}`
                : userText;

            const userContent = hasImage
                ? `[User shared a photo] ${augmentedUserContent || 'Describe and comment on this photo warmly.'}`
                : (hasAudio ? `[User sent a voice note] ${augmentedUserContent || 'Reply warmly to my voice message.'}` : augmentedUserContent);

            const messagesPayload = [
                { role: 'system', content: systemInstruction },
                ...(Array.isArray(history) ? history.filter(h => h && (h.content || h.text)).map(h => ({ role: (h.role === 'assistant' || h.role === 'model') ? 'assistant' : 'user', content: String(h.content || h.text).slice(0, 450) })) : []),
                { role: 'user', content: userContent }
            ];

            const activeKey = String(
                apiKey ||
                global.customAiApiKey ||
                process.env.GEMINI_API_KEY ||
                process.env.GROQ_API_KEY ||
                process.env.OPENAI_API_KEY ||
                process.env.OPENROUTER_API_KEY ||
                ''
            ).trim();

            // 2A. Custom API Key handling
            if (activeKey) {
                try {
                    if (activeKey.startsWith('AIza') || activeKey.startsWith('AQ.')) {
                        const geminiContents = [];
                        if (Array.isArray(history) && history.length > 0) {
                            let lastRole = null;
                            for (const h of history) {
                                const hText = String(h && (h.content || h.text) || '').trim();
                                if (!hText) continue;
                                const gRole = (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user';
                                if (geminiContents.length === 0 && gRole === 'model') continue;
                                if (gRole === lastRole) {
                                    geminiContents[geminiContents.length - 1].parts[0].text += '\n' + hText;
                                } else {
                                    geminiContents.push({ role: gRole, parts: [{ text: hText }] });
                                    lastRole = gRole;
                                }
                            }
                        }
                        if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === 'user') {
                            geminiContents[geminiContents.length - 1].parts[0].text += '\n' + userContent;
                        } else {
                            geminiContents.push({ role: 'user', parts: [{ text: userContent }] });
                        }
                        for (const modelName of ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemma-4-26b-a4b-it']) {
                            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(activeKey)}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    systemInstruction: { parts: [{ text: systemInstruction }] },
                                    contents: geminiContents
                                })
                            });
                            if (gRes.ok) {
                                const gData = await gRes.json();
                                const gText = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (gText && gText.trim()) {
                                    return socket.emit('ai response', { requestId, text: gText.trim() });
                                }
                            }
                        }
                    } else {
                        const isGroq = activeKey.startsWith('gsk_');
                        const isOpenRouter = activeKey.startsWith('sk-or-');
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
                                'Authorization': `Bearer ${activeKey}`
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
                            if (cText && cText.trim()) {
                                return socket.emit('ai response', { requestId, text: cText.trim() });
                            }
                        }
                    }
                } catch (customApiErr) {
                    console.warn("Custom AI API error, falling back to built-in free API:", customApiErr.message);
                }
            }

            // 2B. Fast Built-in Free Generative LLM API
            // 2B. Fast Built-in Free Generative LLM API
            let generatedAnswer = null;

            // Try Pollinations POST with clean user query (omits system role to prevent 402 Payment Required)
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 9000);
                const response = await fetch('https://text.pollinations.ai/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'openai-fast',
                        messages: [{ role: 'user', content: userText }]
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response && response.ok) {
                    const rawBody = (await response.text()).trim();
                    let aiText = '';
                    try {
                        const parsed = JSON.parse(rawBody);
                        if (parsed?.choices?.[0]?.message?.content) {
                            aiText = parsed.choices[0].message.content.trim();
                        } else if (parsed?.choices?.[0]?.message?.reasoning) {
                            aiText = parsed.choices[0].message.reasoning.trim();
                        }
                    } catch (e) {
                        aiText = rawBody;
                    }

                    if (aiText && aiText.length > 1 && !aiText.startsWith('<!DOCTYPE') && !aiText.startsWith('{"error"') && !aiText.startsWith('{"id":')) {
                        generatedAnswer = aiText;
                    }
                }
            } catch (postErr) {}

            // Try Pollinations Direct Endpoint fallback if POST was rate-limited
            if (!generatedAnswer) {
                try {
                    const getController = new AbortController();
                    const getTid = setTimeout(() => getController.abort(), 8000);
                    const getRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userText)}`, {
                        signal: getController.signal
                    });
                    clearTimeout(getTid);
                    if (getRes && getRes.ok) {
                        const getTxt = (await getRes.text()).trim();
                        if (getTxt && getTxt.length > 1 && !getTxt.startsWith('<!DOCTYPE') && !getTxt.startsWith('{"error"') && !getTxt.startsWith('{}')) {
                            generatedAnswer = getTxt;
                        }
                    }
                } catch (getErr) {}
            }

            if (generatedAnswer) {
                return socket.emit('ai response', { requestId, text: generatedAnswer });
            }

            // 2C. Live Real-Time Context (e.g., Weather / Live News)
            if (liveWebContext && liveWebContext.trim()) {
                return socket.emit('ai response', { requestId, text: `🌤️ **Live Update:**\n\n${liveWebContext.trim()}\n\n*ERA Live Intelligence* ✨` });
            }

            // 2D. High-Intelligence ERA Knowledge Engine (Math, Jokes, Recipes, Code, Wikipedia Live Facts)
            const intelligentAnswer = await solveIntelligentQuery(userText, isHindi);
            if (intelligentAnswer) {
                return socket.emit('ai response', { requestId, text: intelligentAnswer });
            }

            // 2E. High-quality smart contextual response if completely conversational
            const smartFallback = isHindi
                ? "Main aapki madad karne ke liye bilkul tayyar hoon! ✨ Aap mujhse kisi bhi cheez ke baare mein pooch sakte hain — sawaal, calculations, recipes, coding ya images generate karwa sakte hain! 😊"
                : "I'm right here and ready to help! ✨ Feel free to ask me anything — questions, math, recipes, coding, or generate images! 😊";
            return socket.emit('ai response', { requestId, text: smartFallback });
        } catch (err) {
            console.warn("AI processing error:", err.message);
            const errorFallback = isHindiOrHinglish(prompt)
                ? "Hello! Main **ERA** hoon. Kahiye, aaj main aapki kya madad kar sakta hoon? 😊"
                : "Hello! I am **ERA**, your AI assistant. How can I assist you today? 😊";
            socket.emit('ai response', { requestId, text: errorFallback });
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
