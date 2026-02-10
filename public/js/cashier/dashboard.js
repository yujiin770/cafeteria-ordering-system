const socket = io();
let menu = []; // Stores all menu items fetched from the server
let currentOrder = []; // Stores items currently in the cashier's order

// Get DOM elements
const menuItemsContainer = document.getElementById('menu-items-container');
const orderItemsList = document.getElementById('order-items-list');
const orderTotalSpan = document.getElementById('order-total');
const itemCountBadge = document.getElementById('item-count');
const placeOrderBtn = document.getElementById('place-order-btn');
const clearOrderBtn = document.getElementById('clear-order-btn');
const emptyOrderMessage = document.getElementById('empty-order-message');
const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
const receiptContent = document.getElementById('receipt-content');
const receiptOrderNumberSpan = document.getElementById('receiptOrderNumber');


/* ===========================
   1. Initial Setup & Data Fetching
   =========================== */

// Fetch menu items when the page loads or when updated
async function fetchMenu() {
    try {
        const response = await fetch('/api/menu');
        if (!response.ok) throw new Error('Failed to fetch menu items');
        menu = await response.json();
        displayMenu();
    } catch (error) {
        console.error('Error fetching menu:', error);
        menuItemsContainer.innerHTML = `<div class="col-12 text-center text-danger p-5">
                                            Failed to load menu. Please refresh.
                                        </div>`;
    }
}

// Display menu items in the UI
function displayMenu() {
    menuItemsContainer.innerHTML = ''; // Clear loading message

    if (menu.length === 0) {
        menuItemsContainer.innerHTML = `<div class="col-12 text-center text-muted p-5">No menu items available.</div>`;
        return;
    }

    menu.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-md-4 col-sm-6 mb-3';
        col.innerHTML = `
            <div class="card h-100 menu-item-card shadow-sm" data-item-id="${item.id}">
                <div class="card-body text-center d-flex flex-column justify-content-between">
                    <h5 class="card-title mb-1">${item.name}</h5>
                    <p class="card-text text-muted">$${parseFloat(item.price).toFixed(2)}</p>
                    <button class="btn btn-primary btn-sm mt-2 add-to-order-btn" data-item-id="${item.id}">
                        Add to Order
                    </button>
                </div>
            </div>`;
        menuItemsContainer.appendChild(col);
    });

    // Attach click listeners to "Add to Order" buttons
    // Re-attach listeners every time the menu is displayed to ensure they work for new items
    document.querySelectorAll('.add-to-order-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const itemId = parseInt(event.target.dataset.itemId);
            addToOrder(itemId);
        });
    });
}


/* ===========================
   2. Order Management (Client-side)
   =========================== */

// Add item to current order
function addToOrder(itemId) {
    const existingItemIndex = currentOrder.findIndex(item => item.id === itemId);

    if (existingItemIndex > -1) {
        currentOrder[existingItemIndex].quantity++;
    } else {
        const menuItem = menu.find(item => item.id === itemId);
        if (menuItem) {
            currentOrder.push({ ...menuItem, quantity: 1 });
        }
    }
    updateOrderDisplay();
}

// Remove item from current order
function removeFromOrder(itemId) {
    const existingItemIndex = currentOrder.findIndex(item => item.id === itemId);

    if (existingItemIndex > -1) {
        if (currentOrder[existingItemIndex].quantity > 1) {
            currentOrder[existingItemIndex].quantity--;
        } else {
            currentOrder.splice(existingItemIndex, 1); // Remove item if quantity is 1
        }
    }
    updateOrderDisplay();
}

// Clear all items from current order
function clearOrder() {
    currentOrder = [];
    updateOrderDisplay();
}

// Update the display of the current order list, total, and item count
function updateOrderDisplay() {
    orderItemsList.innerHTML = '';
    let total = 0;
    let itemCount = 0;

    if (currentOrder.length === 0) {
        emptyOrderMessage.style.display = 'block';
        placeOrderBtn.disabled = true;
    } else {
        emptyOrderMessage.style.display = 'none';
        placeOrderBtn.disabled = false;
        currentOrder.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemCount += item.quantity;

            const listItem = document.createElement('div');
            listItem.className = 'list-group-item';
            listItem.innerHTML = `
                <div>
                    ${item.name} <span class="text-muted">x${item.quantity}</span>
                </div>
                <div class="d-flex align-items-center">
                    <span class="me-2">$${itemTotal.toFixed(2)}</span>
                    <button class="btn btn-outline-danger btn-sm me-1 remove-one-btn" data-item-id="${item.id}">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="btn btn-outline-primary btn-sm add-one-btn" data-item-id="${item.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
            orderItemsList.appendChild(listItem);
        });
    }

    orderTotalSpan.textContent = total.toFixed(2);
    itemCountBadge.textContent = `(${itemCount} items)`;

    // Attach event listeners for +/- buttons in the order list
    // Re-attach listeners every time the order display is updated
    document.querySelectorAll('.remove-one-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const itemId = parseInt(event.currentTarget.dataset.itemId);
            removeFromOrder(itemId);
        });
    });

    document.querySelectorAll('.add-one-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const itemId = parseInt(event.currentTarget.dataset.itemId);
            addToOrder(itemId);
        });
    });
}


/* ===========================
   3. Order Placement (WebSocket)
   =========================== */

// Event listener for placing an order
placeOrderBtn.addEventListener('click', () => {
    if (currentOrder.length === 0) {
        alert('Please add items to the order first.');
        return;
    }

    const orderData = {
        items: currentOrder.map(item => ({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price), // Ensure price is number
            quantity: item.quantity
        })),
        total: parseFloat(orderTotalSpan.textContent) // Get total from display
    };

    socket.emit('placeOrder', orderData);
    placeOrderBtn.disabled = true; // Disable button while order is processing
    placeOrderBtn.textContent = 'Placing Order...';
});


// Socket.IO event handler for successful order placement
socket.on('orderPlaced', (data) => {
    alert(`✅ Order ${data.orderNumber} placed successfully!`);
    generateReceipt(data.orderNumber); // Generate receipt
    clearOrder(); // Clear the current order after successful placement

    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Place Order';
});

// Socket.IO event handler for order errors
socket.on('orderError', (msg) => {
    alert('❌ Order placement failed: ' + msg);
    console.error('Order error:', msg);
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Place Order';
});


/* ===========================
   4. Receipt Generation
   =========================== */

function generateReceipt(orderNumber) {
    const now = new Date();
    let receiptText = `
    ========================================
        CAFETERIA ORDERING SYSTEM
    ========================================
    Order Number: ${orderNumber}
    Date: ${now.toLocaleDateString()}
    Time: ${now.toLocaleTimeString()}
    ----------------------------------------
    Item             Qty   Price    Total
    ----------------------------------------`;

    currentOrder.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const itemName = item.name.padEnd(15).substring(0, 15); // Pad and truncate
        const itemQty = String(item.quantity).padStart(3);
        const itemPrice = `$${parseFloat(item.price).toFixed(2).padStart(6)}`;
        const itemLineTotal = `$${itemTotal.toFixed(2).padStart(7)}`;
        receiptText += `\n${itemName} ${itemQty} ${itemPrice} ${itemLineTotal}`;
    });

    receiptText += `
    ----------------------------------------
    TOTAL:                             $${orderTotalSpan.textContent.padStart(7)}
    ========================================
    Thank You for your order!
    ========================================
    `;

    receiptOrderNumberSpan.textContent = `(#${orderNumber})`;
    receiptContent.textContent = receiptText;
    receiptModal.show(); // Show the receipt modal
}


/* ===========================
   5. Event Listeners & Initialization
   =========================== */

clearOrderBtn.addEventListener('click', clearOrder);


// NEW: Socket.IO listener for menu updates from Admin
socket.on('menuUpdated', () => {
    console.log('🔄 Received menuUpdated event. Re-fetching menu...');
    fetchMenu(); // Re-fetch the menu to get the latest changes
});


// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    fetchMenu();
    updateOrderDisplay(); // Initialize empty order display
});