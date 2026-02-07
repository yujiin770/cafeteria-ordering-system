const express = require('express');
const http = require('http');
const path = require('path'); // Import the 'path' module
const { Server } = require("socket.io");
const mysql = require('mysql');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Database Connection for XAMPP ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cafeteria_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err.stack);
        return;
    }
    console.log('Successfully connected to MySQL database (XAMPP).');
});

// --- Middleware ---
// Serve static files (HTML, CSS, client-side JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Routing ---
// When a user visits the root URL, send them the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});


// --- WebSocket Connection Logic ---
io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected with socket ID:', socket.id);
    });

    // We will add more event listeners here later
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});