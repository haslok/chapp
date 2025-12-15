document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let socket = null;
    let currentUsername = null;
    let isOnline = false;
    let keepAliveInterval = null;
    let selectedChatUser = null;
    const userPublicKeys = {};
    
    // مساعدات عامة
    const setCurrentUser = (username) => {
        localStorage.setItem('currentUser', username);
        currentUsername = username;
    };
    
    const getCurrentUser = () => localStorage.getItem('currentUser');
    
    const clearCurrentUser = () => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userId');
        currentUsername = null;
    };
    
    // WebSocket functions
    const connectWebSocket = () => {
        if (socket) {
            socket.disconnect();
        }
        
        socket = io();
        
        socket.on('connect', () => {
            console.log('WebSocket connected');
            
            if (currentUsername) {
                // Notify server that user is online
                socket.emit('user-login', { username: currentUsername });
                
                // Start keep-alive
                startKeepAlive();
            }
        });
        
        socket.on('user-status-changed', (data) => {
            console.log('User status changed:', data);
            updateUserStatusUI(data.username, data.is_online);
            showNotification(`${data.username} is now ${data.is_online ? 'online' : 'offline'}`);
        });
        
        socket.on('online-users-updated', (users) => {
            console.log('Online users updated:', users);
            updateOnlineUsersList(users);
            updateOnlineCount(users.length);
        });

        // استقبال الرسائل المشفرة (إن وُجدت) وربطها بواجهة الدردشة
        socket.on('encrypted-message', (data) => {
            const { from, encryptedData } = data || {};
            if (!encryptedData) return;

            if (!window.chatCrypto || !window.chatCrypto.enabled) {
                appendChatMessage(`${from}: [encrypted message]`, 'system');
                return;
            }

            const plainText = window.chatCrypto.decryptMessage(
                encryptedData.senderPublicKey,
                encryptedData
            );

            if (plainText) {
                appendChatMessage(`${from}: ${plainText}`, 'user');
            } else {
                appendChatMessage(`${from}: [failed to decrypt message]`, 'system');
            }
        });
        
        socket.on('keep-alive-ack', () => {
            console.log('Keep-alive acknowledged');
        });
        
        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            stopKeepAlive();
        });
        
        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            showError('Connection lost. Attempting to reconnect...', false);
        });
    };
    
    const startKeepAlive = () => {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
        }
        
        keepAliveInterval = setInterval(() => {
            if (socket && socket.connected && currentUsername) {
                socket.emit('keep-alive', { username: currentUsername });
            }
        }, 30000); // كل 30 ثانية
    };
    
    const stopKeepAlive = () => {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
    };
    
    const disconnectWebSocket = () => {
        if (socket) {
            if (currentUsername) {
                socket.emit('user-logout', { username: currentUsername });
            }
            socket.disconnect();
            socket = null;
        }
        stopKeepAlive();
    };
    
    // مساعدات واجهة المستخدم
    const setupPasswordToggle = (toggleId, inputId) => {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);
        if (!toggle || !input) return;
        const icon = toggle.querySelector('i');
    
        toggle.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
            this.style.transform = 'translateY(-50%) scale(1.15)';
            setTimeout(() => (this.style.transform = 'translateY(-50%) scale(1)'), 180);
        });
    };
    
    const addFocusEffects = () => {
        const inputs = document.querySelectorAll('.input-container input');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.style.transform = 'translateY(-2px)';
            });
            input.addEventListener('blur', function() {
                this.parentElement.style.transform = 'translateY(0)';
            });
        });
    };
    
    // دالة لعرض الأخطاء
    const showError = (message, isSuccess = false) => {
        // إزالة أي رسالة خطأ سابقة
        const existingError = document.querySelector('.alert-message');
        if (existingError) existingError.remove();
        
        // إنشاء عنصر الرسالة الجديدة
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-message ${isSuccess ? 'alert-success' : 'alert-error'}`;
        alertDiv.innerHTML = `
            <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
            <button class="alert-close"><i class="fas fa-times"></i></button>
        `;
        
        // إضافة الرسالة قبل النموذج
        const form = document.querySelector('.login-form') || document.querySelector('.register-form');
        if (form) {
            form.prepend(alertDiv);
            
            // إضافة حدث لإغلاق الرسالة
            alertDiv.querySelector('.alert-close').addEventListener('click', () => {
                alertDiv.remove();
            });
            
            // إزالة تلقائية بعد 5 ثواني
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    };
    
    // دالة لتحديث حالة المستخدم في الواجهة
    const updateUserStatusUI = (username, isOnline) => {
        const userElements = document.querySelectorAll(`[data-username="${username}"]`);
        
        userElements.forEach(element => {
            const statusIndicator = element.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
                statusIndicator.title = isOnline ? 'Online' : 'Offline';
            }
            
            const statusText = element.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = isOnline ? 'Online' : 'Offline';
            }
        });
    };

    function setReciver(el){
        const username = el.dataset.username;

        // إزالة التحديد السابق ثم تمييز المختار
        document
            .querySelectorAll('.online-user.user-selected')
            .forEach(node => node.classList.remove('user-selected'));

        el.classList.add('user-selected');

        // حفظ الاختيار حتى لا يضيع بعد إعادة بناء القائمة
        selectedChatUser = username;
        localStorage.setItem('selectedChatUser', username);

        window.location.href = `/chat/${username}`;
    }
    
    // دالة لتحديث قائمة المستخدمين المتصلين
    const updateOnlineUsersList = (users) => {
        const onlineList = document.getElementById('onlineUsersList');
        if (!onlineList) return;
        
        onlineList.innerHTML = '';
        
        if (users.length === 0) {
            onlineList.innerHTML = '<div class="no-users">No users online</div>';
            return;
        }
    
        const selected = selectedChatUser;

        users.forEach(user => {
            // حفظ مفتاح التشفير العام لكل مستخدم إن وجد
            if (user.public_key) {
                userPublicKeys[user.username] = user.public_key;
            }

            const userElement = document.createElement('div');
            userElement.className = 'online-user';
            userElement.dataset.username = user.username;
            userElement.onclick = () => setReciver(userElement);
            userElement.innerHTML = `
                <div class="user-info">
                    <span class="username">${user.username}</span>
                    <div class="status-indicator ${user.is_online ? 'online' : 'offline'}"></div>
                </div>
                <span class="status-text">${user.is_online ? 'Online' : 'Offline'}</span>
            `;
            // إعادة تمييز العنصر المختار سابقاً
            if (selected && selected === user.username) {
                userElement.classList.add('user-selected');
            }
            onlineList.appendChild(userElement);
        });
    };
    
    // دالة لتحديث عدد المستخدمين المتصلين
    const updateOnlineCount = (count) => {
        const onlineCountElement = document.getElementById('onlineCount');
        if (onlineCountElement) {
            onlineCountElement.textContent = `${count} online`;
        }
    };
    
    // دالة لعرض الإشعارات
    const showNotification = (message) => {
        // Check if browser supports notifications
        if (!('Notification' in window)) return;
        
        // Request permission if not granted
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Show notification if permission granted
        if (Notification.permission === 'granted' && document.hidden) {
            new Notification('Chat App', {
                body: message,
                icon: '/favicon.ico'
            });
        }
        
        // Also show in-app notification
        showInAppNotification(message);
    };
    
    const showInAppNotification = (message) => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'in-app-notification';
        notificationDiv.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notificationDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notificationDiv.classList.add('fade-out');
            setTimeout(() => {
                if (notificationDiv.parentElement) {
                    notificationDiv.remove();
                }
            }, 300);
        }, 3000);
    };
    
    // دالة للتسجيل الخروج
    const logout = async () => {
        if (currentUsername) {
            try {
                // Update status on server
                await fetch('/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUsername })
                });
            } catch (error) {
                console.error('Error during logout:', error);
            }
        }
        
        // Disconnect WebSocket
        disconnectWebSocket();
        
        // Clear local storage
        clearCurrentUser();
        
        // Redirect to login page
        window.location.href = '/login';
    };
    
    // إضافة CSS للرسائل والإشعارات
    const addCustomStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .alert-message {
                padding: 15px 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                animation: slideDown 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                position: relative;
            }
            
            .alert-error {
                background: linear-gradient(135deg, #ff4757, #ff3838);
                color: white;
            }
            
            .alert-success {
                background: linear-gradient(135deg, #2ed573, #1dd1a1);
                color: white;
            }
            
            .alert-message i:first-child {
                font-size: 18px;
                margin-right: 10px;
            }
            
            .alert-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                padding: 5px;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            
            .alert-close:hover {
                opacity: 1;
            }
            
            .in-app-notification {
                position: fixed;
                top: 20px;  
                right: 20px;
                background: #333;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 1000;
                animation: slideInRight 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            
            .in-app-notification.fade-out {
                animation: fadeOut 0.3s ease forwards;
            }
            
            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
                margin-left: 5px;
            }
            
            .status-indicator.online {
                background-color: #2ed573;
                box-shadow: 0 0 5px #2ed573;
            }
            
            .status-indicator.offline {
                background-color: #ff4757;
                box-shadow: 0 0 5px #ff4757;
            }
            
            .online-user {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 15px;
                margin-bottom: 8px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                transition: transform 0.2s;
            }
            
            .online-user:hover {
                transform: translateX(5px);
            }
            
            .user-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .no-users {
                text-align: center;
                color: #666;
                padding: 20px;
                font-style: italic;
            }
            
            .logout-btn {
                background: linear-gradient(135deg, #ff4757, #ff3838);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: transform 0.2s;
            }
            
            .logout-btn:hover {
                transform: scale(1.05);
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes fadeOut {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    };
    
    // إضافة تأثيرات التركيز
    addFocusEffects();
    addCustomStyles();

    // تأكد من تزامن المستخدم المحدد مع مسار الصفحة
    const syncSelectedChatUser = () => {
        const match = window.location.pathname.match(/^\/chat\/([^/]+)\/?$/);
        if (match && match[1]) {
            selectedChatUser = decodeURIComponent(match[1]);
            localStorage.setItem('selectedChatUser', selectedChatUser);
        } else {
            selectedChatUser = null;
            localStorage.removeItem('selectedChatUser');
        }
    };
    syncSelectedChatUser();

    // ضبط المستخدم الحالي عند التحميل
    currentUsername = getCurrentUser();
    
    // التحقق من صفحة login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // تلقيم اسم المستخدم المحفوظ إذا كان موجوداً
        const savedUser = getCurrentUser();
        if (savedUser) {
            const usernameInput = document.getElementById('loginUsername');
            if (usernameInput) {
                usernameInput.value = savedUser;
            }
        }
        
        const submitBtn = loginForm.querySelector('.submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnIcon = submitBtn.querySelector('.btn-icon');
        let isSubmitting = false;
    
        setupPasswordToggle('toggleLoginPassword', 'loginPassword');
    
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (isSubmitting) return;
            
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const remember = document.getElementById('remember').checked;
    
            if (!username || !password) {
                showError('Please fill in all fields');
                return;
            }
    
            isSubmitting = true;
            btnText.textContent = 'Signing In...';
            btnIcon.className = 'fas fa-spinner fa-spin btn-icon';
            submitBtn.disabled = true;
    
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                console.log('Login response:', result);
    
                if (result.error) {
                    showError(result.error);
                    clearCurrentUser();
                } 
                else if (result.success) {
                    let userData;
                    
                    if (result.data) {
                        userData = result.data;
                    }
                    
                    if (userData && userData.username) {
                        // حفظ بيانات المستخدم
                        setCurrentUser(userData.username);
                        localStorage.setItem('userId', userData.id);
                        
                        // Connect to WebSocket
                        connectWebSocket();
                        
                        // عرض رسالة نجاح
                        showError(`Welcome back, ${userData.username}! Login successful.`, true);
                        
                        // الانتقال بعد 2 ثانية
                        setTimeout(() => {
                            if (!remember) {
                                loginForm.reset();
                            }
                            window.location.href = '/';
                        }, 2000);
                    } else {
                        showError('Login failed: Invalid user data received');
                    }
                } 
                else {
                    showError('Login failed. Please try again.');
                }
            } 
            catch (err) {
                console.error('Login error:', err);
                showError('Network error. Please check your connection.');
            } 
            finally {
                isSubmitting = false;
                btnText.textContent = 'Sign In';
                btnIcon.className = 'fas fa-arrow-right btn-icon';
                submitBtn.disabled = false;
            }
        });
    }
    
    // Register form logic
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const submitBtn = registerForm.querySelector('.submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnIcon = registerForm.querySelector('.btn-icon');

        setupPasswordToggle('toggleRegisterPassword', 'registerPassword');
        setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');

        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!username || !password || !confirmPassword) {
                alert('Please fill in all fields.');
                return;
            }
            if (username.length < 3) {
                alert('Username must be at least 3 characters.');
                return;
            }
            if (password.length < 6) {
                alert('Password must be at least 6 characters.');
                return;
            }
            if (password !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }

            btnText.textContent = 'Creating...';
            btnIcon.className = 'fas fa-spinner fa-spin btn-icon';
            submitBtn.disabled = true;

            setTimeout(async () => {
                try {
                    const response = await fetch('/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (!response.ok || data.error) {
                        alert(data.error || 'Registration failed. Please try again.');
                        return;
                    }
                    alert('Account created successfully! You can now log in.');
                    registerForm.reset();
                    window.location.href = 'login.html';
                } catch (err) {
                    console.error('Register error', err);
                    alert('Network error. Please try again.');
                } finally {
                    btnText.textContent = 'Register';
                    btnIcon.className = 'fas fa-arrow-right btn-icon';
                    submitBtn.disabled = false;
                }
            }, 800);
        });
    }
    
    // Home page logic
    const currentUserLabel = document.getElementById('currentUser');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    // helper to add message to chat UI (used for send/receive)
    const appendChatMessage = (text, type = 'user') => {
        if (!chatMessages) return;
        const wrapper = document.createElement('div');
        wrapper.className = `message${type === 'system' ? ' message--system' : ''}`;
        wrapper.innerHTML = `<p>${text}</p>`;
        chatMessages.appendChild(wrapper);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    
    if (currentUserLabel) {
        const currentUser = getCurrentUser();
        
        if (currentUser) {
            currentUserLabel.textContent = `Logged in as ${currentUser}`;
            
            // Connect to WebSocket if not already connected
            if (!socket || !socket.connected) {
                connectWebSocket();
            }
            
            // Add logout button
            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'logout-btn';
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
            logoutBtn.addEventListener('click', logout);
            
            currentUserLabel.parentElement.appendChild(logoutBtn);
            
            // Fetch initial online users
            fetch('/api/online-users')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        updateOnlineUsersList(data.users);
                        updateOnlineCount(data.users.length);
                    }
                })
                .catch(error => console.error('Error fetching online users:', error));
        } else {
            currentUserLabel.textContent = 'Not logged in';
        }
    }
    
    // Chat functionality (supports optional end-to-end encryption when a user is selected)
    if (chatMessages && messageInput && sendButton) {
        const sendMessage = () => {
            const text = messageInput.value.trim();
            const user = getCurrentUser() || 'Guest';
            if (!text) return;

            const recipient = selectedChatUser;

            // إذا كان هناك مستخدم محدد ولدينا مفاتيح وتشفير مفعّل، نحاول إرسال رسالة مشفرة
            if (
                recipient &&
                window.chatCrypto &&
                window.chatCrypto.enabled &&
                socket &&
                socket.connected
            ) {
                const recipientKey = userPublicKeys[recipient];

                if (recipientKey) {
                    const encryptedData = window.chatCrypto.encryptMessage(recipientKey, text);

                    if (encryptedData) {
                        socket.emit('encrypted-message', {
                            to: recipient,
                            encryptedData
                        });

                        appendChatMessage(`You → ${recipient}: ${text}`, 'user');
                    } else {
                        appendChatMessage('Failed to encrypt message, sending locally only.', 'system');
                        appendChatMessage(`${user}: ${text}`, 'user');
                    }
                } else {
                    appendChatMessage(`No public key for ${recipient}, sending locally only.`, 'system');
                    appendChatMessage(`${user}: ${text}`, 'user');
                }
            } else {
                // لا يوجد مستلم محدد أو التشفير غير مفعّل → رسالة محلية فقط
                appendChatMessage(`${user}: ${text}`, 'user');
            }

            messageInput.value = '';
        };

        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentUsername) {
            // Reconnect WebSocket if it was disconnected
            if (!socket || !socket.connected) {
                connectWebSocket();
            }
        }
    });
    
    // Handle window close/refresh
    window.addEventListener('beforeunload', (e) => {
        if (currentUsername) {
            // Update status to offline
            fetch('/online', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: currentUsername, 
                    is_online: false 
                }),
                keepalive: true // هذا يساعد في إرسال الطلب حتى عند إغلاق الصفحة
            }).catch(error => console.error('Error updating status on close:', error));
            
            // Disconnect WebSocket
            disconnectWebSocket();
        }
    });
    
    // Check user status periodically (every 60 seconds)
    if (currentUsername) {
        setInterval(() => {
            if (currentUsername) {
                fetch(`/api/user-status/${currentUsername}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            console.log('User status:', data.status);
                        }
                    })
                    .catch(error => console.error('Error checking user status:', error));
            }
        }, 60000);
    }

    // ================== Optional encryption support (Cryption class) ==================
    // This class is self‑contained and does NOT change existing chat behavior.
    // You can use `window.chatCrypto` manually to encrypt/decrypt messages if you want.
    class Cryption {
        constructor() {
            if (typeof nacl === 'undefined' || !nacl.box || !nacl.util) {
                console.warn('Cryption: tweetnacl or tweetnacl-util not loaded. Encryption will not work.');
                this.enabled = false;
                return;
            }
            this.enabled = true;
            this.encryptionKeyPair = nacl.box.keyPair();
            this.signatureKeyPair = nacl.sign.keyPair();
            console.log('Cryption: keys generated');
        }

        getPublicKey() {
            if (!this.enabled) return null;
            return nacl.util.encodeBase64(this.encryptionKeyPair.publicKey);
        }

        getSignPublicKey() {
            if (!this.enabled) return null;
            return nacl.util.encodeBase64(this.signatureKeyPair.publicKey);
        }

        encryptMessage(recipientPublicKey, message) {
            if (!this.enabled) {
                console.warn('Cryption: encryptMessage called but crypto is disabled');
                return null;
            }
            try {
                const recipientKey = nacl.util.decodeBase64(recipientPublicKey);
                const nonce = nacl.randomBytes(nacl.box.nonceLength);
                const messageBytes = nacl.util.decodeUTF8(message);

                const encrypted = nacl.box(
                    messageBytes,
                    nonce,
                    recipientKey,
                    this.encryptionKeyPair.secretKey
                );

                return {
                    nonce: nacl.util.encodeBase64(nonce),
                    encrypted: nacl.util.encodeBase64(encrypted),
                    senderPublicKey: this.getPublicKey(),
                    timestamp: Date.now()
                };
            } catch (err) {
                console.error('Cryption: error encrypting message:', err);
                return null;
            }
        }

        decryptMessage(senderPublicKey, encryptedData) {
            if (!this.enabled) {
                console.warn('Cryption: decryptMessage called but crypto is disabled');
                return null;
            }
            try {
                const senderKey = nacl.util.decodeBase64(senderPublicKey);
                const nonce = nacl.util.decodeBase64(encryptedData.nonce);
                const encrypted = nacl.util.decodeBase64(encryptedData.encrypted);

                const decrypted = nacl.box.open(
                    encrypted,
                    nonce,
                    senderKey,
                    this.encryptionKeyPair.secretKey
                );

                if (decrypted === null) {
                    return null;
                }
                return nacl.util.encodeUTF8(decrypted);
            } catch (err) {
                console.error('Cryption: error decrypting data:', err);
                return null;
            }
        }

        signMessage(message) {
            if (!this.enabled) {
                console.warn('Cryption: signMessage called but crypto is disabled');
                return null;
            }
            try {
                const messageBytes = nacl.util.decodeUTF8(message);
                const signature = nacl.sign.detached(
                    messageBytes,
                    this.signatureKeyPair.secretKey
                );
                return nacl.util.encodeBase64(signature);
            } catch (error) {
                console.error('Cryption: signing error:', error);
                return null;
            }
        }

        verifySignature(message, signature, signerPublicKey) {
            if (!this.enabled) {
                console.warn('Cryption: verifySignature called but crypto is disabled');
                return false;
            }
            try {
                const messageBytes = nacl.util.decodeUTF8(message);
                const signatureBytes = nacl.util.decodeBase64(signature);
                const signerKey = nacl.util.decodeBase64(signerPublicKey);

                return nacl.sign.detached.verify(
                    messageBytes,
                    signatureBytes,
                    signerKey
                );
            } catch (error) {
                console.error('Cryption: verification error:', error);
                return false;
            }
        }
    }

    // Expose a single shared instance you can use elsewhere
    window.chatCrypto = new Cryption();

    // عند تسجيل الدخول ووجود مكتبة التشفير، نحفظ المفتاح العام في السيرفر (Supabase)
    if (window.chatCrypto && window.chatCrypto.enabled && currentUsername) {
        const pubKey = window.chatCrypto.getPublicKey();
        if (pubKey) {
            fetch('/api/set-public-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUsername, public_key: pubKey })
            }).catch(err => console.error('Failed to save public key:', err));
        }
    }
}); 