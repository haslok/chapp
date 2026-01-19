const express = require("express");
const socket = require("socket.io");
const app = express();
const port = process.env.PORT || 3000;

app.use('/libs', express.static(__dirname + '/libs'));

// setup real time server



app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});



const server = app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
const io = socket(server);

const users = {};

io.on("connection", (socket) => {
    console.log("A user connected: " + socket.id);

    socket.on("register", (data) => {
        // Prepare user profile (support both old string-key and new object format for backward compat if needed)
        const publicKey = typeof data === 'string' ? data : data.publicKey;

        users[socket.id] = {
            id: socket.id,
            publicKey: publicKey,
            displayName: data.displayName || `User ${socket.id.substr(0, 4)}`,
            photoURL: data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`
        };
        // Broadcast new user list to all clients
        io.emit("users list", Object.values(users));
    });

    socket.on("private message", ({ to, encrypted, nonce }) => {
        console.log(`Message from ${socket.id} to ${to}`);
        // Forward the message to the specific user
        socket.to(to).emit("private message", {
            from: socket.id,
            encrypted: encrypted,
            nonce: nonce,
            fromKey: users[socket.id]?.publicKey // Send sender's public key for decryption
        });
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected: " + socket.id);
        delete users[socket.id];
        io.emit("users list", Object.values(users));
    });
}); 