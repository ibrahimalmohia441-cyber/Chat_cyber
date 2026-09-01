const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 10 * 1024 * 1024
});

app.use(express.static(__dirname));

const TELEGRAM_BOT_TOKEN = 'ضع_توكين_البوت_هنا';
const TELEGRAM_CHAT_ID = 'ضع_الآيدي_الخاص_بك_هنا';

function sendTelegramAlert(username) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('ضع_توكين')) return;
    const message = `🚨 تنبيه أمني: عقدة جديدة انضمت للمنصة!\n👤 اسم المستخدم: ${username}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;
    https.get(url, (res) => {}).on('error', (err) => {});
}

let activeUsers = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    
    socket.on('join', (username) => {
        activeUsers[socket.id] = username;
        sendTelegramAlert(username);
        io.emit('update users', activeUsers);
    });

    socket.on('private message', ({ receiverId, message }) => {
        socket.to(receiverId).emit('private message', {
            senderId: socket.id,
            senderName: activeUsers[socket.id],
            message: message
        });
    });

    socket.on('file message', ({ receiverId, fileData, fileName, fileType }) => {
        socket.to(receiverId).emit('file message', {
            senderId: socket.id,
            senderName: activeUsers[socket.id],
            fileData: fileData,
            fileName: fileName,
            fileType: fileType
        });
    });

    socket.on('typing', ({ receiverId }) => {
        socket.to(receiverId).emit('typing', { senderId: socket.id });
    });

    socket.on('stop typing', ({ receiverId }) => {
        socket.to(receiverId).emit('stop typing', { senderId: socket.id });
    });

    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            delete activeUsers[socket.id];
            io.emit('update users', activeUsers);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل بنجاح على المنفذ: ${PORT}`);
});
