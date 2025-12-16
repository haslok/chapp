const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');

const express = require('express');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// CORS middleware (for cross-origin requests if needed)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-HTTP-Method-Override');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Handle method override for reverse proxies (some proxies don't pass POST correctly)
app.use((req, res, next) => {
    if (req.headers['x-http-method-override']) {
        req.method = req.headers['x-http-method-override'].toUpperCase();
    }
    next();
});

// Middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware - log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`, {
        method: req.method,
        originalMethod: req.headers['x-http-method-override'] || 'none',
        contentType: req.headers['content-type'],
        body: req.method === 'POST' ? { username: req.body?.username } : ''
    });
    next();
});

// Supabase clients
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const supabase_admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, please try again later' }
});

// Helper functions
async function getUsers() {
    try {
        const { data, error } = await supabase_admin
            .from('users')
            .select('id, username, is_online, created_at, last_seen')
            .order('username', { ascending: true });
        
        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error in getUsers:', err);
        return [];
    }
}

async function createUser(username, password) {
    if (!username || !password) {
        return { error: 'Username and password are required' };
    }

    const payload = {
        username,
        password,
        public_key: 'placeholder-public-key',
        is_online: false,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
    };

    const { data, error } = await supabase_admin
        .from('users')
        .insert(payload)
        .select();
    
    if (error) {
        console.error('Error creating user:', error);
        return { error: error.message };
    }
    return { data };
}

async function loginUser(username, password) {
    try {
        const { data, error } = await supabase_admin
            .from('users')
            .select('id, username, password, is_online, created_at, public_key, last_seen')
            .eq('username', username)
            .eq('password', password);
        
        if (error) {
            console.error('Error logging in user:', error);
            return { error: error.message };
        }
        return { data };
    } catch (err) {
        console.error('Unexpected error in loginUser:', err);
        return { error: err.message };
    }
}

async function updateUserStatus(username, is_online) {
    try {
        const updateData = { 
            is_online: is_online,
            last_seen: new Date().toISOString()
        };

        const { data, error } = await supabase_admin
            .from('users')
            .update(updateData)
            .eq('username', username);
        
        if (error) {
            console.error('Error updating user status:', error);
            return { success: false, error: error.message };
        }
        
        // Broadcast status change via WebSocket
        if (io) {
            io.emit('user-status-changed', { 
                username, 
                is_online,
                timestamp: new Date().toISOString()
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error in updateUserStatus:', error);
        return { success: false, error: error.message };
    }
}

async function getUserStatus(username) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('is_online, last_seen')
            .eq('username', username)
            .single();
        
        if (error) {
            console.error('Error getting user status:', error);
            return null;
        }
        return data;
    } catch (error) {
        console.error('Error in getUserStatus:', error);
        return null;
    }
}

async function getAllOnlineUsers() {
    try {
        const { data, error } = await supabase_admin
            .from('users')
            .select('username, is_online, last_seen, public_key')
            .eq('is_online', true)
            .order('username', { ascending: true });
        
        if (error) {
            console.error('Error getting online users:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Error in getAllOnlineUsers:', error);
        return [];
    }
}

// In-memory map of which sockets belong to which username
// username -> Set<socket.id>
const userSockets = new Map();

// WebSocket connections
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('user-login', async (data) => {
        const { username } = data;
        if (username) {
            // Remember which username is associated with this socket
            socket.username = username;
            let set = userSockets.get(username);
            if (!set) {
                set = new Set();
                userSockets.set(username, set);
            }
            set.add(socket.id);

            await updateUserStatus(username, true);
            
            // Send updated online users list to all clients
            const onlineUsers = await getAllOnlineUsers();
            io.emit('online-users-updated', onlineUsers);
        }
    });
    
    socket.on('user-logout', async (data) => {
        const { username } = data;
        if (username) {
            await updateUserStatus(username, false);
            
            // Remove this socket from the map
            const set = userSockets.get(username);
            if (set) {
                set.delete(socket.id);
                if (set.size === 0) {
                    userSockets.delete(username);
                }
            }
            
            // Send updated online users list to all clients
            const onlineUsers = await getAllOnlineUsers();
            io.emit('online-users-updated', onlineUsers);
        }
    });
    
    socket.on('keep-alive', (data) => {
        const { username } = data;
        if (username) {
            // Update last_seen timestamp
            supabase_admin
                .from('users')
                .update({ last_seen: new Date().toISOString() })
                .eq('username', username)
                .then(() => {
                    socket.emit('keep-alive-ack');
                });
        }
    });
    
    // Encrypted message between users (by username)
    socket.on('encrypted-message', async (data) => {
        try {
            const { to, encryptedData } = data || {};
            if (!to || !encryptedData) return;

            const targets = userSockets.get(to);
            if (!targets || targets.size === 0) return;

            for (const sid of targets) {
                io.to(sid).emit('encrypted-message', {
                    from: socket.username || 'Unknown',
                    encryptedData
                });
            }
        } catch (err) {
            console.error('Error handling encrypted-message:', err);
        }
    });

    socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id);
        if (socket.username) {
            const set = userSockets.get(socket.username);
            if (set) {
                set.delete(socket.id);
                if (set.size === 0) {
                    userSockets.delete(socket.username);
                }
            }
        }
    });
});


// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});

// Login handler function (shared between POST and PUT)
const handleLogin = async (req, res) => {
    console.log(`${req.method} /login received`, { method: req.method, url: req.url, body: { username: req.body?.username } });
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const userResult = await loginUser(username, password);
        
        if (userResult.error) {
            return res.status(400).json({ error: userResult.error });
        }
        
        if (!userResult.data || userResult.data.length === 0) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        
        const user = userResult.data[0];
        
        // Update user status to online
        await updateUserStatus(username, true);
        
        // Get updated online users list
        const onlineUsers = await getAllOnlineUsers();
        
        res.json({ 
            success: true, 
            data: {
                id: user.id,
                username: user.username,
                is_online: true,
                created_at: user.created_at,
                public_key: user.public_key
            },
            onlineUsers: onlineUsers
        });
        
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Failed to login user' });
    }
};

// Login endpoint - POST (primary)
app.post('/login', loginLimiter, handleLogin);

// Login endpoint - PUT (fallback for reverse proxies that block POST)
app.put('/login', loginLimiter, handleLogin);

// Register endpoint
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        const user = await createUser(username, password);
        
        if (user.error) {
            return res.status(400).json({ error: user.error });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update online status endpoint
app.post('/online', async (req, res) => {
    try {
        const { username, is_online } = req.body;
        
        if (!username || typeof is_online !== 'boolean') {
            return res.status(400).json({ 
                error: 'Username and is_online (boolean) are required' 
            });
        }
        
        const result = await updateUserStatus(username, is_online);
        
        if (result.success) {
            const onlineUsers = await getAllOnlineUsers();
            res.json({ 
                success: true, 
                onlineUsers: onlineUsers 
            });
        } else {
            res.status(500).json({ error: result.error });
        }
        
    } catch (error) {
        console.error('Error updating online status:', error);
        res.status(500).json({ error: 'Failed to update online status' });
    }
});

// Get user status
app.get('/api/user-status/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const status = await getUserStatus(username);
        
        if (status) {
            res.json({ success: true, status });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error getting user status:', error);
        res.status(500).json({ error: 'Failed to get user status' });
    }
});

// Get all online users
app.get('/api/online-users', async (req, res) => {
    try {
        const onlineUsers = await getAllOnlineUsers();
        res.json({ success: true, users: onlineUsers });
    } catch (error) {
        console.error('Error getting online users:', error);
        res.status(500).json({ error: 'Failed to get online users' });
    }
});

// Save / update user's public key for encryption
app.post('/api/set-public-key', async (req, res) => {
    try {
        const { username, public_key } = req.body;

        if (!username || !public_key) {
            return res.status(400).json({ error: 'Username and public_key are required' });
        }

        const { error } = await supabase_admin
            .from('users')
            .update({ public_key })
            .eq('username', username);

        if (error) {
            console.error('Error saving public key:', error);
            return res.status(500).json({ error: 'Failed to save public key' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in set-public-key:', error);
        res.status(500).json({ error: 'Failed to save public key' });
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await getUsers();
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/chat/:with', async (req, res) => {
    const chatWith = req.params.with;
    console.log('Chatting with:', chatWith);

    
    
    // Your async logic here
    // Example: Fetch user data from database
    try {
        // const user = await User.findOne({ username: chatWith });
        res.sendFile(__dirname + '/index.html');
    } catch (error) {
        res.status(500).send('Error loading chat');
    }
});
// Access: http://localhost:3000/chat/alice

// Logout endpoint
app.post('/logout', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        const result = await updateUserStatus(username, false);
        
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        onlineUsers: io.engine.clientsCount
    });
});

// Static files (after all routes to avoid conflicts)
// Only serve specific directories, not root directory to avoid route conflicts
if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static(path.join(__dirname, 'public')));
}
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`WebSocket server ready`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing server...');
    
    // Set all users to offline
    try {
        await supabase_admin
            .from('users')
            .update({ is_online: false })
            .neq('is_online', false);
        console.log('All users set to offline');
    } catch (error) {
        console.error('Error setting users offline:', error);
    }
    
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});