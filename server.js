const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store connected users: { 'phoneNumber': socket.id }
const connectedUsers = {};
const socketToPhone = {};

io.on('connection', (socket) => {
    
    // User logs in with their number
    socket.on('register', (phoneNumber) => {
        connectedUsers[phoneNumber] = socket.id;
        socketToPhone[socket.id] = phoneNumber;
        console.log(`User registered: ${phoneNumber} with socket ${socket.id}`);
        socket.emit('registered', phoneNumber);
    });

    // Handle private messages
    socket.on('private message', (data) => {
        // data: { to: 'receiverNumber', text: 'hello' }
        const senderNumber = socketToPhone[socket.id];
        const receiverSocketId = connectedUsers[data.to];

        const messageObj = {
            from: senderNumber,
            to: data.to,
            text: data.text,
            timestamp: new Date().toISOString()
        };

        // Send to receiver if online
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('private message', messageObj);
        } else {
            socket.emit('user offline', data.to);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const phoneNumber = socketToPhone[socket.id];
        if (phoneNumber) {
            delete connectedUsers[phoneNumber];
            delete socketToPhone[socket.id];
            console.log(`User disconnected: ${phoneNumber}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
