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
    const message = `🚨 تنبيه أمني: ${username} سجل الدخول للمنصة!`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;
    https.get(url, (res) => {}).on('error', (err) => {});
}

// سجل المستخدمين الدائم (يحفظ الاسم، حالة الاتصال، والآيدي الحالي)
let registeredUsers = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    
    // عند تسجيل الدخول
    socket.on('join', (username) => {
        // تحديث أو إضافة المستخدم كـ "متصل"
        registeredUsers[username] = {
            socketId: socket.id,
            status: 'online'
        };
        
        sendTelegramAlert(username);
        io.emit('update users', registeredUsers);
    });

    // إرسال رسالة نصية باستخدام اسم المستلم بدلاً من الآيدي
    socket.on('private message', ({ receiverName, senderName, message }) => {
        const receiver = registeredUsers[receiverName];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('private message', {
                senderName: senderName,
                message: message
            });
        }
    });

    // إرسال ملف باستخدام اسم المستلم
    socket.on('file message', ({ receiverName, senderName, fileData, fileName, fileType }) => {
        const receiver = registeredUsers[receiverName];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('file message', {
                senderName: senderName,
                fileData: fileData,
                fileName: fileName,
                fileType: fileType
            });
        }
    });

    socket.on('typing', ({ receiverName, senderName }) => {
        const receiver = registeredUsers[receiverName];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('typing', { senderName: senderName });
        }
    });

    socket.on('stop typing', ({ receiverName, senderName }) => {
        const receiver = registeredUsers[receiverName];
        if (receiver && receiver.status === 'online') {
            socket.to(receiver.socketId).emit('stop typing', { senderName: senderName });
        }
    });

    // عند الانقطاع أو الخروج (تغيير الحالة إلى "غير متصل")
    socket.on('disconnect', () => {
        for (const username in registeredUsers) {
            if (registeredUsers[username].socketId === socket.id) {
                registeredUsers[username].status = 'offline';
                io.emit('update users', registeredUsers);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل بنجاح على المنفذ: ${PORT}`);
});
