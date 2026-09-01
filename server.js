const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const https = require('https'); // لإرسال طلبات تليجرام

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 10 * 1024 * 1024
});

app.use(express.static(__dirname));

// ===== إعدادات بوت تليجرام =====
const TELEGRAM_BOT_TOKEN ='8918778873:AAFz5F_lVYacFyfNO3iwJPQMO-LxOV-xgOM';
const TELEGRAM_CHAT_ID = '1244133291';

function sendTelegramAlert(username) {
    if (TELEGRAM_BOT_TOKEN.includes('ضع_توكين')) return; // للتنبيه فقط إذا لم تضف البيانات بعد
    
    const message = `🚨 تنبيه أمني: عقدة جديدة انضمت للمنصة!\n👤 اسم المستخدم: ${username}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;

    https.get(url, (res) => {
        // تم الإرسال بنجاح
    }).on('error', (err) => {
        console.error('خطأ في إرسال تنبيه تليجرام:', err.message);
    });
}
// ===============================

let activeUsers = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    
    socket.on('join', (username) => {
        activeUsers[socket.id] = username;
        
        // إرسال تنبيه لتليجرام عند تسجيل الدخول
        sendTelegramAlert(username);

        io.emit('update users', activeUsers);
    });

    socket.on('private message', ({ receiverId, message }) => {
        socket.to(receiverId).emit('private message', {
            senderId: socket.id,
            senderName: activeUsers[socket.id],
            message: message,
            type: 'text'
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

    socket.on('disconnect', () => {
        if(activeUsers[socket.id]){
            delete activeUsers[socket.id];
            io.emit('update users', activeUsers);
        }
    });
});

server.listen(3000, () => {
    console.log('الخادم يعمل الآن على الرابط: http://localhost:3000');
});
