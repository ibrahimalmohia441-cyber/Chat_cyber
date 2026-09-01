const socket = io();

let myDeviceId = localStorage.getItem('cyber_chat_device_id');
if (!myDeviceId) {
    myDeviceId = 'DEV_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('cyber_chat_device_id', myDeviceId);
}

let myName = localStorage.getItem('cyber_chat_username') || '';
let currentChatUser = { deviceId: '', name: '' };
let typingTimeout = null;

const screens = {
    login: document.getElementById('login-screen'),
    users: document.getElementById('users-screen'),
    chat: document.getElementById('chat-screen')
};
const title = document.getElementById('header-title');
const backBtn = document.getElementById('back-btn');
const settingsBtn = document.getElementById('settings-btn');

if ("Notification" in window && Notification.permission !== "granted") {
    try { Notification.requestPermission(); } catch(e) {}
}

window.onload = function() {
    if (myName) {
        document.getElementById('username-input').value = myName;
        joinApp();
    }
};

function joinApp() {
    const inputName = document.getElementById('username-input').value.trim();
    if (inputName) {
        myName = inputName;
        localStorage.setItem('cyber_chat_username', myName);
        socket.emit('join', { deviceId: myDeviceId, username: myName });
        
        screens.login.style.display = 'none';
        screens.users.style.display = 'flex';
        title.innerText = 'عقد الشبكة المسجلة';
        settingsBtn.style.display = 'block';
    } else {
        alert('الرجاء إدخال اسم أو كود تعريفي!');
    }
}

function openSettings() {
    const newName = prompt("⚙️ الإعدادات\n\nأدخل اسم المستخدم الجديد:", myName);
    if (newName && newName.trim() !== "" && newName.trim() !== myName) {
        myName = newName.trim();
        localStorage.setItem('cyber_chat_username', myName);
        socket.emit('update name', { deviceId: myDeviceId, newName: myName });
        alert("تم تحديث اسمك بنجاح!");
    }
}

socket.on('update users', (users) => {
    const ul = document.getElementById('users-list');
    ul.innerHTML = ''; 

    let count = 0;
    for (let targetDeviceId in users) {
        if (targetDeviceId !== myDeviceId) {
            count++;
            const user = users[targetDeviceId];
            const initial = user.username.charAt(0).toUpperCase();
            const statusIndicator = user.status === 'online' 
                ? '<span style="color: #00ff66;">🟢 متصل الآن</span>' 
                : '<span style="color: #94a3b8;">⚪ غير متصل</span>';

            let li = document.createElement('li');
            li.className = 'user-item';
            li.innerHTML = `
                <div class="user-avatar" style="${user.status === 'offline' ? 'border-color:#94a3b8; color:#94a3b8;' : ''}">${initial}</div>
                <div class="user-info" style="flex:1;">
                    <div class="user-name" style="${user.status === 'offline' ? 'color:#94a3b8;' : ''}">${user.username}</div>
                    <div class="user-status">${statusIndicator}</div>
                </div>
            `;
            li.onclick = () => openChat(targetDeviceId, user.username);
            ul.appendChild(li);
        }
    }
    if(count === 0) {
        ul.innerHTML = '<div class="empty-msg">لا يوجد مستخدمين آخرين في قاعدة البيانات...</div>';
    }
});

function openChat(deviceId, name) {
    currentChatUser = { deviceId: deviceId, name: name };
    screens.users.style.display = 'none';
    screens.chat.style.display = 'flex';
    title.innerText = `CHANNEL: ${name}`;
    backBtn.style.display = 'block';
    settingsBtn.style.display = 'none';
    
    document.getElementById('messages').innerHTML = '';
    document.getElementById('typing-indicator').innerText = '';
    
    // طلب سجل المحادثة من الخادم
    socket.emit('fetch history', deviceId);
}

// استقبال وعرض سجل المحادثة
socket.on('chat history', (history) => {
    document.getElementById('messages').innerHTML = '';
    history.forEach(msg => {
        const isMe = msg.senderDeviceId === myDeviceId;
        const className = isMe ? 'msg-me' : 'msg-other';
        const senderNameDisplay = isMe ? 'أنت' : msg.senderName;
        
        if (msg.type === 'text') {
            appendTextMessage(senderNameDisplay, msg.message, className);
        } else if (msg.type === 'file') {
            appendFileMessage(senderNameDisplay, msg.fileName, msg.fileData, className);
        }
    });
});

function goBack() {
    screens.chat.style.display = 'none';
    screens.users.style.display = 'flex';
    title.innerText = 'عقد الشبكة المسجلة';
    backBtn.style.display = 'none';
    settingsBtn.style.display = 'block';
    currentChatUser = { deviceId: '', name: '' };
}

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

function showBrowserNotification(titleText, bodyText) {
    try {
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification(titleText, { body: bodyText, icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913994.png' });
        }
    } catch(e) {}
}

const msgInput = document.getElementById('msg-input');
if (msgInput) {
    msgInput.addEventListener('input', () => {
        if (!currentChatUser.deviceId) return;
        socket.emit('typing', { receiverDeviceId: currentChatUser.deviceId, senderName: myName });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop typing', { receiverDeviceId: currentChatUser.deviceId, senderName: myName });
        }, 1500);
    });
}

socket.on('typing', (data) => {
    if (currentChatUser.name === data.senderName) {
        document.getElementById('typing-indicator').innerText = 'جاري الكتابة... ✍️';
    }
});

socket.on('stop typing', (data) => {
    if (currentChatUser.name === data.senderName) {
        document.getElementById('typing-indicator').innerText = '';
    }
});

document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const msg = msgInput.value.trim();
    if (msg && currentChatUser.deviceId) {
        socket.emit('private message', { receiverDeviceId: currentChatUser.deviceId, senderName: myName, message: msg });
        socket.emit('stop typing', { receiverDeviceId: currentChatUser.deviceId, senderName: myName });
        appendTextMessage('أنت', msg, 'msg-me');
        msgInput.value = '';
    }
});

function sendFile(event) {
    const file = event.target.files[0];
    if (!file || !currentChatUser.deviceId) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileData = e.target.result;
        socket.emit('file message', {
            receiverDeviceId: currentChatUser.deviceId,
            senderName: myName,
            fileData: fileData,
            fileName: file.name,
            fileType: file.type
        });
        appendFileMessage('أنت', file.name, fileData, 'msg-me');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

socket.on('private message', (data) => {
    try {
        if (currentChatUser.deviceId === data.senderDeviceId) {
            document.getElementById('typing-indicator').innerText = '';
            appendTextMessage(data.senderName, data.message, 'msg-other');
        } else {
            alert(`🚨 تنبيه أمني: رسالة جديدة من [ ${data.senderName} ]\n\n💬 محتوى الرسالة:\n"${data.message}"`);
        }
        playNotificationSound();
        showBrowserNotification(`رسالة من ${data.senderName}`, data.message);
    } catch(err) { console.error(err); }
});

socket.on('file message', (data) => {
    try {
        if (currentChatUser.deviceId === data.senderDeviceId) {
            document.getElementById('typing-indicator').innerText = '';
            appendFileMessage(data.senderName, data.fileName, data.fileData, 'msg-other');
        } else {
            alert(`🚨 تنبيه أمني: ملف مرفق جديد من [ ${data.senderName} ]\n\n📁 اسم الملف: ${data.fileName}`);
        }
        playNotificationSound();
        showBrowserNotification(`ملف من ${data.senderName}`, data.fileName);
    } catch(err) { console.error(err); }
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
