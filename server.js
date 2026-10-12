const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

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
    from: String, 
    to: String, 
    text: String, 
    image: String,
    timestamp: Date 
}));

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

// Ensure database connection is ready before querying
async function ensureDBReady() {
    if (MONGODB_URI && mongoose.connection.readyState !== 1) {
        for (let i = 0; i < 30; i++) {
            if (mongoose.connection.readyState === 1) {
                useMongo = true;
                return true;
            }
            await new Promise(r => setTimeout(r, 200));
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

async function createUser(number, pin) {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        await User.create({ number, pin });
    } else {
        let db = loadDB();
        db.users[number] = { pin, registeredAt: new Date().toISOString() };
        saveDB(db);
    }
}

async function saveMessage(from, to, text, image, timestamp) {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        await Message.create({ from, to, text, image, timestamp });
    } else {
        let db = loadDB();
        db.messages.push({ from, to, text, image, timestamp: timestamp.toISOString() });
        saveDB(db);
    }
}

async function getUserMessages(number) {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        const msgs = await Message.find({ $or: [{ from: number }, { to: number }] }).sort('timestamp');
        return msgs.map(m => ({ from: m.from, to: m.to, text: m.text, image: m.image, timestamp: m.timestamp.toISOString() }));
    } else {
        return loadDB().messages.filter(m => m.from === number || m.to === number);
    }
}

async function getAllUsers() {
    await ensureDBReady();
    if (useMongo || mongoose.connection.readyState === 1) {
        const users = await User.find({}, 'number');
        return users.map(u => u.number);
    } else {
        const db = loadDB();
        return Object.keys(db.users);
    }
}

// --- SMS OTP SETUP (Fast2SMS Gateway) ---
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const pendingOTPs = {}; // { '9876543210': { otp: '4829', expiresAt: Date.now() + 5*60*1000 } }

async function sendSMSViaFast2SMS(number, otp) {
    if (!FAST2SMS_API_KEY) {
        console.log(`[FAST2SMS INFO] Key not set. Demo OTP for ${number}: ${otp}`);
        return { success: true, devMode: true };
    }
    try {
        const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_API_KEY}&variables_values=${otp}&route=otp&numbers=${number}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'cache-control': 'no-cache' }
        });
        const data = await response.json();
        console.log("Fast2SMS API Response:", data);
        if (data.return === true || data.status_code === 200) {
            return { success: true };
        } else {
            return { success: false, message: data.message || 'SMS send failed' };
        }
    } catch (err) {
        console.error("Fast2SMS Network Error:", err);
        return { success: false, message: err.message };
    }
}

// --- SOCKET.IO LOGIC ---
let connectedUsers = {}; // { 'number': socket.id }
let socketToPhone = {};

io.on('connection', (socket) => {
    
    // SEND OTP LOGIC
    socket.on('send-otp', async ({ number }) => {
        try {
            const cleanNum = (number || '').trim();
            if (!/^[6-9]\d{9}$/.test(cleanNum)) {
                return socket.emit('otp-error', 'Kripya ek valid 10-digit Indian mobile number enter karein (6, 7, 8 ya 9 se shuru hona chahiye).');
            }

            const existingUser = await getUser(cleanNum);
            if (existingUser) {
                return socket.emit('otp-error', 'Yeh number pehle se registered hai! Kripya Login karein.');
            }

            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            pendingOTPs[cleanNum] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

            const result = await sendSMSViaFast2SMS(cleanNum, otp);
            if (result.success) {
                if (result.devMode) {
                    socket.emit('otp-sent', { 
                        number: cleanNum, 
                        devOtp: otp,
                        message: `Testing OTP: ${otp} (Fast2SMS API key set karne par yeh SMS phone par aayega)` 
                    });
                } else {
                    socket.emit('otp-sent', { 
                        number: cleanNum, 
                        message: 'OTP aapke mobile number par SMS ke zariye bhej diya gaya hai!' 
                    });
                }
            } else {
                socket.emit('otp-error', 'SMS bhejne mein dikkat: ' + (result.message || 'Please try again'));
            }
        } catch (err) {
            console.error("send-otp error:", err);
            socket.emit('otp-error', 'Server error. Kripya dobara try karein.');
        }
    });

    // SIGNUP WITH OTP LOGIC
    socket.on('signup', async ({ number, otp, pin }) => {
        try {
            const cleanNum = (number || '').trim();
            const cleanOtp = (otp || '').trim();
            const cleanPin = (pin || '').trim();

            if (!cleanNum || !cleanOtp || !cleanPin) {
                return socket.emit('signup error', 'Sabhi details bharna zaroori hai.');
            }

            const record = pendingOTPs[cleanNum];
            if (!record) {
                return socket.emit('signup error', 'Pehle "Send OTP" par click karein.');
            }
            if (Date.now() > record.expiresAt) {
                delete pendingOTPs[cleanNum];
                return socket.emit('signup error', 'OTP expire ho gaya hai! Kripya naya OTP mangwayein.');
            }
            if (record.otp !== cleanOtp) {
                return socket.emit('signup error', 'Galat OTP! Kripya sahi OTP dalein.');
            }

            // OTP verified successfully
            delete pendingOTPs[cleanNum];

            await createUser(cleanNum, cleanPin);

            connectedUsers[cleanNum] = socket.id;
            socketToPhone[socket.id] = cleanNum;
            console.log(`User signed up with verified OTP: ${cleanNum}`);
            
            const allUsers = await getAllUsers();
            socket.emit('login success', { number: cleanNum, history: [], allUsers });
            io.emit('all users', allUsers);
        } catch (err) {
            console.error("Signup error:", err);
            socket.emit('signup error', 'Server error. Please try again.');
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

    socket.on('get all users', async () => {
        try {
            const allUsers = await getAllUsers();
            socket.emit('all users', allUsers);
        } catch (err) {
            console.error("Error getting users:", err);
        }
    });

    // Handle private messages
    socket.on('private message', async (data) => {
        try {
            const senderNumber = socketToPhone[socket.id];
            if (!senderNumber) return;

            const timestamp = new Date();
            const textToSave = data.text || '';
            const imageToSave = data.image || '';
            
            // Save to DB
            await saveMessage(senderNumber, data.to, textToSave, imageToSave, timestamp);

            const messageObj = {
                from: senderNumber,
                to: data.to,
                text: textToSave,
                image: imageToSave,
                timestamp: timestamp.toISOString()
            };

            // Send to receiver if online
            const receiverSocketId = connectedUsers[data.to];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private message', messageObj);
            }
        } catch (err) {
            console.error("Message error:", err);
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
