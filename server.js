const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;
const SALT_ROUNDS = 10;

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cafeteria_db'
});

db.connect((err) => {
    if (err) {
        console.error('❌ DB Error:', err.stack);
        return;
    }
    console.log('✅ MySQL Connected!');
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
});

// API Endpoints
app.get('/api/menu', (req, res) => {
    db.query('SELECT * FROM menu', (err, results) => {
        if (err) {
            console.error('Menu query error:', err);
            return res.status(500).json({error: 'Database error'});
        }
        res.json(results);
    });
});

// Authentication
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', username);
    
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) {
            console.log('❌ User not found:', username);
            return res.json({success: false, message: 'Invalid credentials'});
        }
        
        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err || !isMatch) {
                console.log('❌ Password mismatch:', username);
                return res.json({success: false, message: 'Invalid credentials'});
            }
            
            console.log(`✅ ${user.role} logged in: ${username}`);
            res.json({
                success: true, 
                user: {
                    id: user.id, 
                    username: user.username, 
                    role: user.role
                }
            });
        });
    });
});

// WebSocket Connection
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);
    
    // Join room based on role
    socket.on('joinRoom', (role) => {
        socket.join(role);
        console.log(`📱 ${socket.id} joined ${role} room`);
    });
    
    // Cashier places order
    socket.on('placeOrder', (orderData) => {
        console.log('🧾 New order from:', socket.id);
        console.log('📦 Order data:', JSON.stringify(orderData, null, 2));
        
        const orderNumber = 'ORD' + Date.now();
        const total = parseFloat(orderData.total) || 0;
        const itemsJson = JSON.stringify(orderData.items || []);
        
        const order = {
            items: itemsJson,
            total: total,
            orderNumber: orderNumber,
            status: 'pending',
            timestamp: new Date()
        };
        
        console.log('💾 Saving order:', orderNumber);
        
        const sql = 'INSERT INTO orders (items, total, orderNumber, status, timestamp) VALUES (?, ?, ?, ?, ?)';
        const values = [order.items, order.total, order.orderNumber, order.status, order.timestamp];
        
        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('❌ Order save ERROR:', err.sqlMessage);
                console.error('❌ Full error:', err);
                return socket.emit('orderError', 'Database error: ' + err.sqlMessage);
            }
            
            console.log(`✅ Order ${orderNumber} SAVED! ID: ${result.insertId}`);
            
            // 🔥 Send to ALL clients (kitchen, admin, cashier)
            const broadcastOrder = { 
                ...order, 
                items: orderData.items // Original objects for display
            };
            
            io.emit('newOrder', broadcastOrder);
            socket.emit('orderPlaced', {orderNumber});
        });
    });
    
    // Kitchen updates status
    socket.on('updateOrderStatus', (data) => {
        console.log('🔄 Status update:', data.orderNumber, '→', data.status);
        
        db.query('UPDATE orders SET status = ? WHERE orderNumber = ?', 
            [data.status, data.orderNumber],
            (err, result) => {
                if (err) {
                    console.error('❌ Status update error:', err);
                    return socket.emit('statusError', err.message);
                }
                
                if (result.affectedRows > 0) {
                    console.log(`✅ Status updated: ${data.orderNumber} → ${data.status}`);
                    io.emit('orderStatusUpdate', data);
                } else {
                    console.log('⚠️ No order found:', data.orderNumber);
                }
            }
        );
    });
    
    socket.on('disconnect', () => {
        console.log('👋 User disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on:`);
    console.log(`   💻 Desktop: http://localhost:${PORT}`);
    console.log(`   📱 Mobile:  http://YOUR_IP:${PORT}`);
    console.log(`   📋 Login:`);
    console.log(`      admin/password    → Admin`);
    console.log(`      cashier1/1234     → Cashier`);
    console.log(`      kitchen1/1234     → Kitchen`);
});
