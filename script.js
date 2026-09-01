const socket = io();
let myId = '';
let currentChatUser = { id: '', name: '' };

const screens = {
    login: document.getElementById('login-screen'),
    users: document.getElementById('users-screen'),
    chat: document.getElementById('chat-screen')
};
const title = document.getElementById('header-title');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');

// التحقق مما إذا كان الاسم مخزناً مسبقاً عند فتح الصفحة
window.onload = function() {
    const savedName = localStorage.getItem('cyber_chat_username');
    if (savedName) {
        document.getElementById('username-input').value = savedName;
        joinApp(); // الدخول التلقائي
    }
};

function joinApp() {
    const name = document.getElementById('username-input').value.trim();
    if (name) {
        // حفظ الاسم في ذاكرة المتصفح المحلية
        localStorage.setItem('cyber_chat_username', name);

        socket.emit('join', name);
        screens.login.style.display = 'none';
        screens.users.style.display = 'flex';
        title.innerText ='☠الكتيبه٤☠';
        logoutBtn.style.display = 'block'; // إظهار زر الخروج
    } else {
        alert('الرجاء إدخال اسم أو كود تعريفي!');
    }
}

// دالة إلغاء الاتصال وتغيير الاسم
function logout() {
    localStorage.removeItem('cyber_chat_username');
    location.reload(); // إعادة تحميل الصفحة لإظهار شاشة الدخول من جديد
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
    logoutBtn.style.display = 'none'; // إخفاء زر الخروج مؤقتاً داخل الشات
    document.getElementById('messages').innerHTML = '';
}

function goBack() {
    screens.chat.style.display = 'none';
    screens.users.style.display = 'flex';
    title.innerText = '☠الكتيبه ٤☠';
    backBtn.style.display = 'none';
    logoutBtn.style.display = 'block'; // إرجاع زر الخروج
    currentChatUser = { id: '', name: '' };
}

document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('msg-input');
    const msg = input.value.trim();
    
    if (msg && currentChatUser.id) {
        socket.emit('private message', { receiverId: currentChatUser.id, message: msg });
        appendTextMessage('أنت', msg, 'msg-me');
        input.value = '';
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

socket.on('private message', (data) => {
    if (currentChatUser.id === data.senderId) {
        appendTextMessage(data.senderName, data.message, 'msg-other');
    } else {
        alert(`تنبيه أمني: رسالة جديدة من ${data.senderName}`);
    }
});

socket.on('file message', (data) => {
    if (currentChatUser.id === data.senderId) {
        appendFileMessage(data.senderName, data.fileName, data.fileData, 'msg-other');
    } else {
        alert(`تنبيه أمني: ملف جديد تم استقباله من ${data.senderName}`);
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
    
    const textNode = document.createTextNode(text);
    div.appendChild(textNode);
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
