const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 10 * 1024 * 1024 });

app.use(express.static(__dirname));

const TELEGRAM_BOT_TOKEN = 'ضع_توكين_البوت_هنا';
const TELEGRAM_CHAT_ID = 'ضع_الآيدي_الخاص_بك_هنا';

function sendTelegramAlert(username) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('ضع_توكين')) return;
    const message = `🚨 تنبيه أمني: ${username} متصل بالمنصة!`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;
    https.get(url, (res) => {}).on('error', (err) => {});
}

let registeredUsers = {}; 
let chatHistory = {};

function getConvId(id1, id2) {
    return [id1, id2].sort().join('_');
}

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    
    socket.on('join', ({ deviceId, username }) => {
        socket.deviceId = deviceId;
        registeredUsers[deviceId] = { username: username, socketId: socket.id, status: 'online' };
        sendTelegramAlert(username);
        io.emit('update users', registeredUsers);
    });

    socket.on('update name', ({ deviceId, newName }) => {
        if (registeredUsers[deviceId]) {
            registeredUsers[deviceId].username = newName;
            io.emit('update users', registeredUsers);
        }
    });

    // استقبال طلب التحديث كل 3 ثواني لإرسال القائمة المحدثة
    socket.on('request update', () => {
        socket.emit('update users', registeredUsers);
    });

    // دالة مسح الدردشة يدوياً
    socket.on('clear chat', (targetDeviceId) => {
        if (!socket.deviceId) return;
        const convId = getConvId(socket.deviceId, targetDeviceId);
        
        if (chatHistory[convId]) {
            delete chatHistory[convId]; // حذف السجل من الخادم
        }

        // إعلام الطرفين لتفريغ الشاشة
        socket.emit('chat cleared', targetDeviceId);
        
        const receiver = registeredUsers[targetDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('chat cleared', socket.deviceId);
        }
    });

    socket.on('fetch history', (targetDeviceId) => {
        if (!socket.deviceId) return;
        const convId = getConvId(socket.deviceId, targetDeviceId);
        const history = chatHistory[convId] || [];
        socket.emit('chat history', history);
    });

    socket.on('private message', ({ receiverDeviceId, senderName, message }) => {
        const senderDeviceId = socket.deviceId;
        const convId = getConvId(senderDeviceId, receiverDeviceId);
        
        if (!chatHistory[convId]) chatHistory[convId] = [];
        chatHistory[convId].push({ type: 'text', senderDeviceId, senderName, message, timestamp: Date.now() });

        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('private message', { senderName, message, senderDeviceId });
        }
    });

    socket.on('file message', ({ receiverDeviceId, senderName, fileData, fileName, fileType }) => {
        const senderDeviceId = socket.deviceId;
        const convId = getConvId(senderDeviceId, receiverDeviceId);
        
        if (!chatHistory[convId]) chatHistory[convId] = [];
        chatHistory[convId].push({ type: 'file', senderDeviceId, senderName, fileData, fileName, timestamp: Date.now() });

        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('file message', { senderName, fileData, fileName, senderDeviceId });
        }
    });

    socket.on('typing', ({ receiverDeviceId, senderName }) => {
        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') socket.to(receiver.socketId).emit('typing', { senderName });
    });

    socket.on('stop typing', ({ receiverDeviceId, senderName }) => {
        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') socket.to(receiver.socketId).emit('stop typing', { senderName });
    });

    socket.on('disconnect', () => {
        if (socket.deviceId && registeredUsers[socket.deviceId]) {
            registeredUsers[socket.deviceId].status = 'offline';
            io.emit('update users', registeredUsers);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`الخادم يعمل بنجاح على المنفذ: ${PORT}`); });
