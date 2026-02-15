const socket = io();
let orders = [];
let soundEnabled = false;

/* =================================================================
   SOCKET LOGIC (No backend changes, just listeners)
   ================================================================= */
socket.on('connect', () => {
    console.log('✅ Kitchen Connected to Dashboard'); // Added specific log
    socket.emit('joinRoom', 'kitchen');
});

socket.on('newOrder', (order) => {
    console.log('DEBUG: Received newOrder on dashboard:', order); // Debug log
    if (soundEnabled) playAlert();
    orders.push(order);
    renderOrders();
});

socket.on('orderStatusUpdate', (data) => {
    console.log('DEBUG: Order status update received on dashboard:', data); // Debug log
    const order = orders.find(o => o.orderNumber === data.orderNumber);
    if (order) {
        order.status = data.status;
        renderOrders();
    }
});

/* =================================================================
   RENDER UI
   ================================================================= */
function renderOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    // Filter & Sort
    const activeOrders = orders.filter(o => {
        const currentStatus = (o.status || 'unknown').toLowerCase(); // Defensive check for status
        return currentStatus === 'pending' || currentStatus === 'preparing';
    });
    activeOrders.sort((a, b) => {
        // Priority: Pending first, then by time
        if ((a.status || 'unknown').toLowerCase() === 'pending' && (b.status || 'unknown').toLowerCase() !== 'pending') return -1;
        if ((a.status || 'unknown').toLowerCase() !== 'pending' && (b.status || 'unknown').toLowerCase() === 'pending') return 1;
        return new Date(a.timestamp) - new Date(b.timestamp);
    });

    if (activeOrders.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5 opacity-50">
                <i class="fas fa-check-circle fa-5x mb-3 text-success"></i>
                <h3>All Caught Up!</h3>
                <p>No active orders in the queue.</p>
            </div>`;
        updateCounts();
        return;
    }

    container.innerHTML = activeOrders.map(order => {
        // Defensive check: Ensure order.status is a string, default to 'unknown' if not.
        const currentStatus = (order.status || 'unknown').toLowerCase(); 

        // Determine Styles
        const isPending = currentStatus === 'pending';
        const statusClass = isPending ? 'status-pending' : 'status-preparing';
        const badgeText = isPending ? 'PENDING' : 'PREPARING';
        // The main action button
        const btnText = isPending ? 'Start Preparing' : 'Mark Done';
        const nextStatus = isPending ? 'preparing' : 'completed';
        const timeStr = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Items List
        const itemsHtml = order.items.map(i => `
            <div class="order-item-row">
                <span>${i.name}</span>
                <span class="item-qty">x${i.quantity}</span>
            </div>
        `).join('');

        // Add a Cancel button that only appears for pending or preparing orders
        const cancelButtonHtml = `
            <button class="btn btn-danger btn-sm w-100 mt-2" onclick="confirmCancelOrder('${order.orderNumber}')">
                <i class="fas fa-times-circle me-1"></i> Cancel Order
            </button>`;
        return `
            <div class="col-12 col-md-6 col-lg-4 col-xl-3 ticket-anim">
                <div class="kitchen-ticket ${statusClass}">
                    <div class="ticket-header">
                        <span class="ticket-id">#${order.orderNumber}</span>
                        <span class="ticket-time">${timeStr}</span>
                    </div>
                    <div class="px-3 pt-2">
                        <span class="badge ticket-badge rounded-pill fw-bold" style="font-size:0.75rem;">
                            ${badgeText}
                        </span>
                    </div>
                    <div class="ticket-body">
                        ${itemsHtml}
                    </div>
                    <div class="ticket-footer">
                        <button class="btn-action shadow-sm" onclick="updateStatus('${order.orderNumber}', '${nextStatus}')">
                            ${btnText}
                        </button>
                        ${(currentStatus === 'pending' || currentStatus === 'preparing') ? cancelButtonHtml : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateCounts();
}

// Global scope function for cancel confirmation
window.confirmCancelOrder = function(orderNumber) {
    if (confirm(`Are you sure you want to cancel order #${orderNumber}? This action will revert inventory.`)) {
        console.log(`DEBUG: Sending cancel request for order #${orderNumber}`); // Debug log
        window.updateStatus(orderNumber, 'cancelled');
    }
}

function updateCounts() {
    const counts = { pending: 0, preparing: 0, completed: 0 };
    orders.forEach(o => { 
        // Defensive check for status before counting
        const currentStatus = (o.status || 'unknown').toLowerCase();
        if (currentStatus === 'pending') counts.pending++;
        if (currentStatus === 'preparing') counts.preparing++;
        if (currentStatus === 'completed') counts.completed++;
    });

    setText('pending-count', counts.pending);
    setText('preparing-count', counts.preparing);
    setText('completed-count', counts.completed);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if(el) el.textContent = value;
}

// Global scope for HTML onclick
window.updateStatus = function(orderNumber, status) {
    socket.emit('updateOrderStatus', { orderNumber, status });
};

/* =================================================================
   SETUP & HELPERS
   ================================================================= */

// Clock
setInterval(() => {
    const el = document.getElementById('clock-display');
    if(el) el.textContent = new Date().toLocaleTimeString();
}, 1000);

// Sound
function playAlert() {
    const audio = document.getElementById('alertSound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio needed user interaction first"));
    }
}

async function fetchOrders() {
    try {
        const res = await fetch('/api/orders');
        const data = await res.json(); // Await here for direct assignment
        orders = data; 
        console.log('DEBUG: Fetched initial orders for dashboard:', orders); // Debug log
        renderOrders();
    } catch (e) { console.error(e); }
}

/* =================================================================
   INITIALIZE
   ================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    
    // Sidebar Toggle Logic (The Fix)
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && wrapper) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            wrapper.classList.toggle('toggled');
        });
    }

    // Close sidebar when clicking overlay (Mobile)
    if(overlay && wrapper) {
        overlay.addEventListener('click', () => {
            wrapper.classList.remove('toggled');
        });
    }

    // Sound Toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    if(soundBtn) {
        soundBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            if(soundEnabled) {
                soundBtn.classList.replace('btn-outline-dark', 'btn-warning');
                soundBtn.innerHTML = '<i class="fas fa-volume-up"></i> Sound On';
                playAlert(); 
            } else {
                soundBtn.classList.replace('btn-warning', 'btn-outline-dark');
                soundBtn.innerHTML = '<i class="fas fa-volume-mute"></i> Sound Off';
            }
        });
    }

    fetchOrders();
});