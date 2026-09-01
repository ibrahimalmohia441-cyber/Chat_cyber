const socket = io();
let myId = '';
let currentChatUser = { id: '', name: '' };
let typingTimeout = null;

const screens = {
    login: document.getElementById('login-screen'),
    users: document.getElementById('users-screen'),
    chat: document.getElementById('chat-screen')
};
const title = document.getElementById('header-title');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');

// طلب إذن الإشعارات بأمان بدون أن يتسبب في إيقاف السكربت
if ("Notification" in window && Notification.permission !== "granted") {
    try {
        Notification.requestPermission();
    } catch(e) {}
}

window.onload = function() {
    const savedName = localStorage.getItem('cyber_chat_username');
    if (savedName) {
        document.getElementById('username-input').value = savedName;
        joinApp();
    }
};

function joinApp() {
    const name = document.getElementById('username-input').value.trim();
    if (name) {
        localStorage.setItem('cyber_chat_username', name);
        socket.emit('join', name);
        screens.login.style.display = 'none';
        screens.users.style.display = 'flex';
        title.innerText = 'عقد الشبكة المتصلة';
        logoutBtn.style.display = 'block';
    } else {
        alert('الرجاء إدخال اسم أو كود تعريفي!');
    }
}

function logout() {
    localStorage.removeItem('cyber_chat_username');
    location.reload();
}

socket.on('update users', (users) => {
    myId = socket.id;
    const ul = document.getElementById('users-list');
    ul.innerHTML = ''; 

    let count = 0;
    for (let id in users) {
        if (id !== myId) {
            count++;
            const userName = users[id];
            const initial = userName.charAt(0).toUpperCase();
            
            // تحديث المعرّف تلقائياً إذا أُعيد اتصال الشخص الذي تحادثه
            if (currentChatUser.name && currentChatUser.name === userName) {
                currentChatUser.id = id;
            }

            let li = document.createElement('li');
            li.className = 'user-item';
            li.innerHTML = `
                <div class="user-avatar">${initial}</div>
                <div class="user-info" style="flex:1;">
                    <div class="user-name">${userName}</div>
                    <div class="user-status">[SECURE_CONNECTED]</div>
                </div>
            `;
            li.onclick = () => openChat(id, userName);
            ul.appendChild(li);
        }
    }

    if(count === 0) {
        ul.innerHTML = '<div class="empty-msg">لا توجد عقد أخرى متصلة بالنظام حالياً...</div>';
    }
});

function openChat(id, name) {
    currentChatUser = { id: id, name: name };
    screens.users.style.display = 'none';
    screens.chat.style.display = 'flex';
    title.innerText = `CHANNEL: ${name}`;
    backBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('typing-indicator').innerText = '';
}

function goBack() {
    screens.chat.style.display = 'none';
    screens.users.style.display = 'flex';
    title.innerText = 'عقد الشبكة المتصلة';
    backBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    currentChatUser = { id: '', name: '' };
}

// دالة تشغيل الصوت المضمونة
function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch(e) {}
}

// دالة الإشعارات المحمية من أخطاء متصفحات أندرويد
function showBrowserNotification(titleText, bodyText) {
    try {
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification(titleText, {
                body: bodyText,
                icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913994.png'
            });
        }
    } catch(e) {}
}

// إدارة مؤشر الكتابة
const msgInput = document.getElementById('msg-input');
if (msgInput) {
    msgInput.addEventListener('input', () => {
        if (!currentChatUser.id) return;
        socket.emit('typing', { receiverId: currentChatUser.id });
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop typing', { receiverId: currentChatUser.id });
        }, 1500);
    });
}

socket.on('typing', (data) => {
    if (currentChatUser.id === data.senderId || currentChatUser.name === data.senderName) {
        document.getElementById('typing-indicator').innerText = 'جاري الكتابة... ✍️';
    }
});

socket.on('stop typing', (data) => {
    if (currentChatUser.id === data.senderId || currentChatUser.name === data.senderName) {
        document.getElementById('typing-indicator').innerText = '';
    }
});

// إرسال رسالة نصية
document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const msg = msgInput.value.trim();
    
    if (msg && currentChatUser.id) {
        socket.emit('private message', { receiverId: currentChatUser.id, message: msg });
        socket.emit('stop typing', { receiverId: currentChatUser.id });
        appendTextMessage('أنت', msg, 'msg-me');
        msgInput.value = '';
    }
});

function sendFile(event) {
    const file = event.target.files[0];
    if (!file || !currentChatUser.id) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileData = e.target.result;
        socket.emit('file message', {
            receiverId: currentChatUser.id,
            fileData: fileData,
            fileName: file.name,
            fileType: file.type
        });
        appendFileMessage('أنت', file.name, fileData, 'msg-me');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

// استقبال الرسائل النصية المحمي
socket.on('private message', (data) => {
    try {
        if (currentChatUser.id === data.senderId || currentChatUser.name === data.senderName) {
            document.getElementById('typing-indicator').innerText = '';
            appendTextMessage(data.senderName, data.message, 'msg-other');
        } else {
            alert(`تنبيه أمني: رسالة جديدة من ${data.senderName}`);
        }
        playNotificationSound();
        showBrowserNotification(`رسالة من ${data.senderName}`, data.message);
    } catch(err) {
        console.error("خطأ أثناء استقبال الرسالة:", err);
    }
});

// استقبال الملفات المحمي
socket.on('file message', (data) => {
    try {
        if (currentChatUser.id === data.senderId || currentChatUser.name === data.senderName) {
            document.getElementById('typing-indicator').innerText = '';
            appendFileMessage(data.senderName, data.fileName, data.fileData, 'msg-other');
        } else {
            alert(`تنبيه أمني: ملف جديد تم استقباله من ${data.senderName}`);
        }
        playNotificationSound();
        showBrowserNotification(`ملف من ${data.senderName}`, data.fileName);
    } catch(err) {
        console.error("خطأ أثناء استقبال الملف:", err);
    }
});

function appendTextMessage(sender, text, className) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message-bubble ${className}`;
    
    if(className === 'msg-other') {
        const senderSpan = document.createElement('span');
        senderSpan.className = 'msg-sender';
        senderSpan.innerText = sender;
        div.appendChild(senderSpan);
    }
    
    div.appendChild(document.createTextNode(text));
    messages.appendChild(div);
    messages.scrollTo(0, messages.scrollHeight);
}

function appendFileMessage(sender, fileName, fileData, className) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message-bubble ${className}`;
    
    if(className === 'msg-other') {
        const senderSpan = document.createElement('span');
        senderSpan.className = 'msg-sender';
        senderSpan.innerText = sender;
        div.appendChild(senderSpan);
    }
    
    const fileLink = document.createElement('a');
    fileLink.className = 'file-attachment';
    fileLink.href = fileData;
    fileLink.download = fileName;
    fileLink.innerHTML = `📁 ملف مرفق: ${fileName} <br><small style="color:#00ff66;">[اضغط للتحميل]</small>`;
    
    div.appendChild(fileLink);
    messages.appendChild(div);
    messages.scrollTo(0, messages.scrollHeight);
}
