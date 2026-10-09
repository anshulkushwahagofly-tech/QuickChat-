const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Helper to read/write DB
function loadDB() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            return { users: {}, messages: [] };
        }
    }
    return { users: {}, messages: [] };
}

function saveDB(db) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let connectedUsers = {}; // { 'number': socket.id }
let socketToPhone = {};

io.on('connection', (socket) => {
    
    // SIGNUP LOGIC
    socket.on('signup', ({ number, pin }) => {
        let db = loadDB();
        
        if (db.users[number]) {
            return socket.emit('login error', 'Yeh number pehle se registered hai! Kripya Login karein.');
        } 
        
        // Register new user
        db.users[number] = { pin: pin, registeredAt: new Date().toISOString() };
        saveDB(db);

        // Auto login after signup
        connectedUsers[number] = socket.id;
        socketToPhone[socket.id] = number;
        console.log(`User signed up: ${number}`);
        
        socket.emit('login success', { number, history: [] });
    });

    // LOGIN LOGIC
    socket.on('login', ({ number, pin }) => {
        let db = loadDB();
        
        if (!db.users[number]) {
            return socket.emit('login error', 'Account nahi mila! Pehle Sign Up karein.');
        }
        
        if (db.users[number].pin !== pin) {
            return socket.emit('login error', 'Galat PIN! Kripya sahi PIN dalein.');
        }

        // Success Login
        connectedUsers[number] = socket.id;
        socketToPhone[socket.id] = number;
        console.log(`User logged in: ${number}`);
        
        // Send history of this user
        const userMessages = db.messages.filter(m => m.from === number || m.to === number);
        socket.emit('login success', { number, history: userMessages });
    });

    // Handle private messages
    socket.on('private message', (data) => {
        const senderNumber = socketToPhone[socket.id];
        if (!senderNumber) return;

        const messageObj = {
            from: senderNumber,
            to: data.to,
            text: data.text,
            timestamp: new Date().toISOString()
        };

        // Save to DB immediately
        let db = loadDB();
        db.messages.push(messageObj);
        saveDB(db);

        // Send to receiver if online
        const receiverSocketId = connectedUsers[data.to];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('private message', messageObj);
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
    console.log(`Server is running on http://localhost:${PORT}`);
});
