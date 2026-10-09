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

// Universal DB Functions
async function getUser(number) {
    if (useMongo) return await User.findOne({ number: number });
    return loadDB().users[number] ? { pin: loadDB().users[number].pin } : null;
}

async function createUser(number, pin) {
    if (useMongo) {
        await User.create({ number, pin });
    } else {
        let db = loadDB();
        db.users[number] = { pin, registeredAt: new Date().toISOString() };
        saveDB(db);
    }
}

async function saveMessage(from, to, text, image, timestamp) {
    if (useMongo) {
        await Message.create({ from, to, text, image, timestamp });
    } else {
        let db = loadDB();
        db.messages.push({ from, to, text, image, timestamp: timestamp.toISOString() });
        saveDB(db);
    }
}

async function getUserMessages(number) {
    if (useMongo) {
        const msgs = await Message.find({ $or: [{ from: number }, { to: number }] }).sort('timestamp');
        return msgs.map(m => ({ from: m.from, to: m.to, text: m.text, image: m.image, timestamp: m.timestamp.toISOString() }));
    } else {
        return loadDB().messages.filter(m => m.from === number || m.to === number);
    }
}

// --- SOCKET.IO LOGIC ---
let connectedUsers = {}; // { 'number': socket.id }
let socketToPhone = {};

io.on('connection', (socket) => {
    
    // SIGNUP LOGIC
    socket.on('signup', async ({ number, pin }) => {
        try {
            const existingUser = await getUser(number);
            
            if (existingUser) {
                return socket.emit('login error', 'Yeh number pehle se registered hai! Kripya Login karein.');
            } 
            
            await createUser(number, pin);

            connectedUsers[number] = socket.id;
            socketToPhone[socket.id] = number;
            console.log(`User signed up: ${number}`);
            
            socket.emit('login success', { number, history: [] });
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
            socket.emit('login success', { number, history: userMessages });
        } catch (err) {
            console.error("Login error:", err);
            socket.emit('login error', 'Server error. Please try again.');
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
