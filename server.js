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

// سجل المستخدمين يعتمد الآن على معرف الجهاز (deviceId)
let registeredUsers = {}; 

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    
    // عند تسجيل الدخول باستخدام معرف الجهاز
    socket.on('join', ({ deviceId, username }) => {
        socket.deviceId = deviceId; // حفظ المعرف في الجلسة الحالية
        
        registeredUsers[deviceId] = {
            username: username,
            socketId: socket.id,
            status: 'online'
        };
        
        sendTelegramAlert(username);
        io.emit('update users', registeredUsers);
    });

    // عند تغيير الاسم من الإعدادات
    socket.on('update name', ({ deviceId, newName }) => {
        if (registeredUsers[deviceId]) {
            registeredUsers[deviceId].username = newName;
            io.emit('update users', registeredUsers);
        }
    });

    socket.on('private message', ({ receiverDeviceId, senderName, message }) => {
        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('private message', { senderName, message });
        }
    });

    socket.on('file message', ({ receiverDeviceId, senderName, fileData, fileName, fileType }) => {
        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('file message', { senderName, fileData, fileName, fileType });
        }
    });

    socket.on('typing', ({ receiverDeviceId, senderName }) => {
        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('typing', { senderName });
        }
    });

    socket.on('stop typing', ({ receiverDeviceId, senderName }) => {
        const receiver = registeredUsers[receiverDeviceId];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('stop typing', { senderName });
        }
    });

    socket.on('disconnect', () => {
        if (socket.deviceId && registeredUsers[socket.deviceId]) {
            registeredUsers[socket.deviceId].status = 'offline';
            io.emit('update users', registeredUsers);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل بنجاح على المنفذ: ${PORT}`);
});
