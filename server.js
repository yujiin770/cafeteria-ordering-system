const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const mysql = require('mysql2/promise'); // Using promise-based API for async/await
const bcrypt = require('bcrypt');
const moment = require('moment'); // For date manipulation in analytics

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = 3000;
const SALT_ROUNDS = 10;

// Database Connection (using promise-based API)
let db;
(async () => {
    try {
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'cafeteria_db'
        });
        console.log('✅ MySQL Connected!');
    } catch (err) {
        console.error('❌ DB Error:', err.stack);
        process.exit(1); // Exit if DB connection fails
    }
})();


// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
});

// ============================================
// API Endpoints - General & Cashier
// ============================================
app.get('/api/menu', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM menu ORDER BY name ASC');
        res.json(results);
    } catch (err) {
        console.error('Menu query error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM orders ORDER BY timestamp DESC');
        const parsedResults = results.map(order => ({
            ...order,
            items: JSON.parse(order.items)
        }));
        res.json(parsedResults);
    } catch (err) {
        console.error('Orders query error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

app.get('/api/order-history', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM orders ORDER BY timestamp DESC');
        const parsedResults = results.map(order => ({
            ...order,
            items: JSON.parse(order.items)
        }));
        res.json(parsedResults);
    } catch (err) {
        console.error('Order history query error:', err);
        res.status(500).json({error: 'Database error'});
    }
});


// ============================================
// API Endpoints - Admin Dashboard Analytics
// ============================================
app.get('/api/admin/dashboard-analytics', async (req, res) => {
    try {
        const today = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const endOfToday = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
        const sevenDaysAgo = moment().subtract(7, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss');

        // Total Sales Today (Completed orders only)
        const [salesResults] = await db.query(
            "SELECT SUM(total) AS totalSales FROM orders WHERE status = 'completed' AND timestamp BETWEEN ? AND ?",
            [today, endOfToday]
        );
        const totalSalesToday = salesResults[0].totalSales || 0;

        // Orders Completed Today
        const [completedOrdersResults] = await db.query(
            "SELECT COUNT(*) AS ordersCompleted FROM orders WHERE status = 'completed' AND timestamp BETWEEN ? AND ?",
            [today, endOfToday]
        );
        const ordersCompletedToday = completedOrdersResults[0].ordersCompleted || 0;

        // Pending Orders (not completed or cancelled)
        const [pendingOrdersResults] = await db.query(
            "SELECT COUNT(*) AS ordersPending FROM orders WHERE status IN ('pending', 'preparing')"
        );
        const ordersPending = pendingOrdersResults[0].ordersPending || 0;

        // Unique Customers Today (Mock for now, needs customer_id in orders for real data)
        const uniqueCustomersToday = Math.floor(Math.random() * 50) + 10;

        // Top Selling Items (Past 7 days)
        const [topSellingItemsResults] = await db.query(
            `SELECT JSON_EXTRACT(items, '$[*].name') AS itemNames, JSON_EXTRACT(items, '$[*].quantity') AS itemQuantities
             FROM orders
             WHERE status = 'completed' AND timestamp >= ?`,
            [sevenDaysAgo]
        );

        const itemCounts = {};
        topSellingItemsResults.forEach(order => {
            try {
                const names = JSON.parse(order.itemNames);
                const quantities = JSON.parse(order.itemQuantities);

                names.forEach((name, index) => {
                    const quantity = parseInt(quantities[index] || 0);
                    itemCounts[name] = (itemCounts[name] || 0) + quantity;
                });
            } catch (e) {
                console.error('Failed to parse item names/quantities from JSON_EXTRACT:', e, order);
            }
        });

        const topSellingItems = Object.entries(itemCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);


        // Sales Data Last 7 Days
        const salesDataLast7Days = {
            labels: [],
            data: []
        };
        for (let i = 6; i >= 0; i--) {
            const day = moment().subtract(i, 'days');
            const dayStart = day.startOf('day').format('YYYY-MM-DD HH:mm:ss');
            const dayEnd = day.endOf('day').format('YYYY-MM-DD HH:mm:ss');

            const [dailySalesResults] = await db.query(
                "SELECT SUM(total) AS dailyTotal FROM orders WHERE status = 'completed' AND timestamp BETWEEN ? AND ?",
                [dayStart, dayEnd]
            );
            salesDataLast7Days.labels.push(day.format('ddd'));
            salesDataLast7Days.data.push(dailySalesResults[0].dailyTotal || 0);
        }

        // Recent Activity (last 5 completed/new orders)
        const [recentActivityResults] = await db.query(
            "SELECT orderNumber, status, timestamp FROM orders ORDER BY timestamp DESC LIMIT 5"
        );
        const recentActivity = recentActivityResults.map(activity => ({
            timestamp: activity.timestamp,
            description: `Order ${activity.orderNumber} is now ${activity.status}.`
        }));


        res.json({
            totalSalesToday,
            ordersCompletedToday,
            ordersPending,
            uniqueCustomersToday,
            topSellingItems,
            salesDataLast7Days,
            recentActivity
        });

    } catch (error) {
        console.error('Error fetching admin dashboard analytics:', error);
        res.status(500).json({ error: 'Database error fetching analytics' });
    }
});


// ============================================
// API Endpoints - Admin Menu Management (CRUD)
// ============================================
// Get all menu items
app.get('/api/admin/menu', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM menu ORDER BY name ASC');
        res.json(results);
    } catch (err) {
        console.error('Admin menu query error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// Add new menu item
app.post('/api/admin/menu', async (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    try {
        const [result] = await db.query('INSERT INTO menu (name, price) VALUES (?, ?)', [name, price]);
        // NEW: Emit WebSocket event after successful add
        io.emit('menuUpdated');
        res.status(201).json({ id: result.insertId, name, price, message: 'Menu item added' });
    } catch (err) {
        console.error('Admin add menu item error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// Update menu item
app.put('/api/admin/menu/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    try {
        const [result] = await db.query('UPDATE menu SET name = ?, price = ? WHERE id = ?', [name, price, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        // NEW: Emit WebSocket event after successful update
        io.emit('menuUpdated');
        res.json({ id, name, price, message: 'Menu item updated' });
    } catch (err) {
        console.error('Admin update menu item error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// Delete menu item
app.delete('/api/admin/menu/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM menu WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        // NEW: Emit WebSocket event after successful delete
        io.emit('menuUpdated');
        res.json({ message: 'Menu item deleted' });
    } catch (err) {
        console.error('Admin delete menu item error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// ============================================
// API Endpoints - Admin Inventory Monitoring (CRUD)
// ============================================
// Get all inventory items
app.get('/api/admin/inventory', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM inventory ORDER BY item_name ASC');
        res.json(results);
    } catch (err) {
        console.error('Admin inventory query error:', err);
        res.status(500).json({ error: 'Database error fetching inventory' });
    }
});

// Add a new inventory item
app.post('/api/admin/inventory', async (req, res) => {
    const { item_name, quantity, unit, low_stock_threshold } = req.body;
    if (!item_name || quantity === undefined || !unit) {
        return res.status(400).json({ error: 'Item name, quantity, and unit are required' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO inventory (item_name, quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?)',
            [item_name, quantity, unit, low_stock_threshold || 10]
        );
        res.status(201).json({ id: result.insertId, item_name, quantity, unit, low_stock_threshold, message: 'Inventory item added' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Inventory item with this name already exists' });
        }
        console.error('Admin add inventory item error:', err);
        res.status(500).json({ error: 'Database error adding inventory item' });
    }
});

// Update an existing inventory item
app.put('/api/admin/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { item_name, quantity, unit, low_stock_threshold } = req.body;
    if (!item_name || quantity === undefined || !unit) {
        return res.status(400).json({ error: 'Item name, quantity, and unit are required' });
    }
    try {
        const [result] = await db.query(
            'UPDATE inventory SET item_name = ?, quantity = ?, unit = ?, low_stock_threshold = ? WHERE id = ?',
            [item_name, quantity, unit, low_stock_threshold || 10, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.json({ id, item_name, quantity, unit, low_stock_threshold, message: 'Inventory item updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Another inventory item with this name already exists' });
        }
        console.error('Admin update inventory item error:', err);
        res.status(500).json({ error: 'Database error updating inventory item' });
    }
});

// Delete an inventory item
app.delete('/api/admin/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM inventory WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.json({ message: 'Inventory item deleted' });
    } catch (err) {
        console.error('Admin delete inventory item error:', err);
        res.status(500).json({ error: 'Database error deleting inventory item' });
    }
});

// ============================================
// API Endpoints - Admin Recipe Management (menu_item_ingredients CRUD)
// ============================================

// Get recipe for a specific menu item
app.get('/api/admin/menu/:menuItemId/ingredients', async (req, res) => {
    const { menuItemId } = req.params;
    try {
        const [results] = await db.query(
            `SELECT mii.id, mii.inventory_item_id, inv.item_name, mii.quantity_needed, mii.unit_needed
             FROM menu_item_ingredients mii
             JOIN inventory inv ON mii.inventory_item_id = inv.id
             WHERE mii.menu_item_id = ?`,
            [menuItemId]
        );
        res.json(results);
    } catch (err) {
        console.error(`Error fetching ingredients for menu item ${menuItemId}:`, err);
        res.status(500).json({ error: 'Database error fetching recipe' });
    }
});

// Add ingredient to a menu item's recipe
app.post('/api/admin/menu/:menuItemId/ingredients', async (req, res) => {
    const { menuItemId } = req.params;
    const { inventory_item_id, quantity_needed, unit_needed } = req.body;
    if (!inventory_item_id || !quantity_needed || !unit_needed) {
        return res.status(400).json({ error: 'Inventory item ID, quantity, and unit are required for an ingredient' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, quantity_needed, unit_needed) VALUES (?, ?, ?, ?)',
            [menuItemId, inventory_item_id, quantity_needed, unit_needed]
        );
        res.status(201).json({ id: result.insertId, menuItemId, inventory_item_id, quantity_needed, unit_needed, message: 'Ingredient added to recipe' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'This ingredient is already part of the menu item\'s recipe' });
        }
        console.error(`Error adding ingredient to menu item ${menuItemId}:`, err);
        res.status(500).json({ error: 'Database error adding ingredient to recipe' });
    }
});

// Update an ingredient in a menu item's recipe
app.put('/api/admin/menu/:menuItemId/ingredients/:ingredientId', async (req, res) => {
    const { menuItemId, ingredientId } = req.params;
    const { inventory_item_id, quantity_needed, unit_needed } = req.body; // inventory_item_id might be updated too

    if (!inventory_item_id || !quantity_needed || !unit_needed) {
        return res.status(400).json({ error: 'Inventory item ID, quantity, and unit are required for an ingredient' });
    }
    try {
        const [result] = await db.query(
            'UPDATE menu_item_ingredients SET inventory_item_id = ?, quantity_needed = ?, unit_needed = ? WHERE id = ? AND menu_item_id = ?',
            [inventory_item_id, quantity_needed, unit_needed, ingredientId, menuItemId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Recipe ingredient not found or does not belong to this menu item' });
        }
        res.json({ id: ingredientId, menuItemId, inventory_item_id, quantity_needed, unit_needed, message: 'Recipe ingredient updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'This ingredient is already part of the menu item\'s recipe' });
        }
        console.error(`Error updating ingredient ${ingredientId} for menu item ${menuItemId}:`, err);
        res.status(500).json({ error: 'Database error updating recipe ingredient' });
    }
});

// Delete an ingredient from a menu item's recipe
app.delete('/api/admin/menu/:menuItemId/ingredients/:ingredientId', async (req, res) => {
    const { menuItemId, ingredientId } = req.params;
    try {
        const [result] = await db.query(
            'DELETE FROM menu_item_ingredients WHERE id = ? AND menu_item_id = ?',
            [ingredientId, menuItemId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Recipe ingredient not found or does not belong to this menu item' });
        }
        res.json({ message: 'Recipe ingredient deleted' });
    } catch (err) {
        console.error(`Error deleting ingredient ${ingredientId} for menu item ${menuItemId}:`, err);
        res.status(500).json({ error: 'Database error deleting recipe ingredient' });
    }
});


// ============================================
// API Endpoints - Admin User Management (CRUD)
// ============================================
// Get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const [results] = await db.query('SELECT id, username, role FROM users ORDER BY username ASC');
        res.json(results);
    } catch (err) {
        console.error('Admin users query error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// Add new user
app.post('/api/admin/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role]);
        res.status(201).json({ id: result.insertId, username, role, message: 'User added' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        console.error('Admin add user error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// Update user
app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;

    if (!username || !role) {
        return res.status(400).json({ error: 'Username and role are required' });
    }

    try {
        let sql = 'UPDATE users SET username = ?, role = ?';
        let values = [username, role];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            sql += ', password = ?';
            values.push(hashedPassword);
        }
        sql += ' WHERE id = ?';
        values.push(id);

        const [result] = await db.query(sql, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ id, username, role, message: 'User updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        console.error('Admin update user error:', err);
        res.status(500).json({error: 'Database error'});
    }
});

// Delete user
app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({error: 'Database error'});
    }
});


// Authentication (existing)
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', username);

    try {
        const [results] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (results.length === 0) {
            console.log('❌ User not found:', username);
            return res.json({success: false, message: 'Invalid credentials'});
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
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
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({success: false, message: 'Server error during login'});
    }
});

// WebSocket Connection (existing, now with inventory deduction)
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    socket.on('joinRoom', (role) => {
        socket.join(role);
        console.log(`📱 ${socket.id} joined ${role} room`);
    });

    socket.on('placeOrder', async (orderData) => { // Made this async
        console.log('🧾 New order from:', socket.id);
        console.log('📦 Order data:', JSON.stringify(orderData, null, 2));

        const orderNumber = 'ORD' + Date.now();
        const total = parseFloat(orderData.total) || 0;
        const itemsJson = JSON.stringify(orderData.items || []);
        const orderTimestamp = new Date();

        try {
            // Check and deduct inventory first
            for (const orderedItem of orderData.items) {
                // Fetch recipe for each menu item
                const [recipe] = await db.query(
                    `SELECT mii.inventory_item_id, mii.quantity_needed, mii.unit_needed, inv.item_name, inv.quantity AS current_stock
                     FROM menu_item_ingredients mii
                     JOIN inventory inv ON mii.inventory_item_id = inv.id
                     WHERE mii.menu_item_id = ?`,
                    [orderedItem.id]
                );

                if (recipe.length === 0) {
                    console.warn(`⚠️ Menu item ID ${orderedItem.id} (${orderedItem.name}) has no recipe defined. Cannot deduct inventory.`);
                    // Optionally, you could throw an error here to prevent the order
                    // throw new Error(`Recipe not defined for ${orderedItem.name}`);
                }

                for (const ingredient of recipe) {
                    const totalNeeded = ingredient.quantity_needed * orderedItem.quantity;
                    if (ingredient.current_stock < totalNeeded) {
                        // Low stock check - respond to client or log
                        console.error(`❌ Insufficient stock for ${ingredient.item_name} (needed: ${totalNeeded} ${ingredient.unit_needed}, available: ${ingredient.current_stock} ${ingredient.unit_needed}) for order ${orderNumber}`);
                        return socket.emit('orderError', `Insufficient stock for ${ingredient.item_name}.`);
                    }

                    // Deduct from inventory
                    await db.query(
                        'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
                        [totalNeeded, ingredient.inventory_item_id]
                    );
                    console.log(`✅ Deducted ${totalNeeded} ${ingredient.unit_needed} of ${ingredient.item_name} from inventory.`);

                    // Check if stock is now below threshold
                    const [updatedStock] = await db.query('SELECT quantity, low_stock_threshold FROM inventory WHERE id = ?', [ingredient.inventory_item_id]);
                    if (updatedStock[0].quantity <= updatedStock[0].low_stock_threshold) {
                        console.warn(`🚨 LOW STOCK ALERT: ${ingredient.item_name} is now at ${updatedStock[0].quantity} ${updatedStock[0].unit_needed}. Threshold: ${updatedStock[0].low_stock_threshold}`);
                        // Emit a socket event to admin for low stock alerts
                        io.to('admin').emit('lowStockAlert', {
                            itemName: ingredient.item_name,
                            currentStock: updatedStock[0].quantity,
                            threshold: updatedStock[0].low_stock_threshold
                        });
                    }
                }
            }

            // If inventory deduction is successful, save the order
            const sql = 'INSERT INTO orders (items, total, orderNumber, status, timestamp) VALUES (?, ?, ?, ?, ?)';
            const values = [itemsJson, total, orderNumber, 'pending', orderTimestamp];
            const [result] = await db.query(sql, values);

            console.log(`✅ Order ${orderNumber} SAVED! ID: ${result.insertId}`);

            const broadcastOrder = {
                id: result.insertId,
                items: orderData.items, // Original objects for display
                total: orderData.total,
                orderNumber: orderNumber,
                status: 'pending',
                timestamp: orderTimestamp
            };

            io.emit('newOrder', broadcastOrder); // Broadcast to all connected clients
            socket.emit('orderPlaced', {orderNumber});

        } catch (error) {
            console.error('❌ Order processing ERROR:', error);
            socket.emit('orderError', 'Order processing failed: ' + error.message);
        }
    });

    socket.on('updateOrderStatus', async (data) => { // Made this async
        console.log('🔄 Status update:', data.orderNumber, '→', data.status);

        try {
            const [result] = await db.query('UPDATE orders SET status = ? WHERE orderNumber = ?',
                [data.status, data.orderNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`✅ Status updated: ${data.orderNumber} → ${data.status}`);
                io.emit('orderStatusUpdate', data); // Broadcast to all connected clients
            } else {
                console.log('⚠️ No order found:', data.orderNumber);
            }
        } catch (err) {
            console.error('❌ Status update error:', err);
            socket.emit('statusError', 'Database error updating status: ' + err.message);
        }
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