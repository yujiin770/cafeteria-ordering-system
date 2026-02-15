const socket = io();
let orders = [];
let soundEnabled = false;

/* =================================================================
   SOCKET LOGIC (No backend changes, just listeners)
   ================================================================= */
socket.on('connect', () => {
    console.log('✅ Kitchen Connected');
    socket.emit('joinRoom', 'kitchen');
});

socket.on('newOrder', (order) => {
    if (soundEnabled) playAlert();
    orders.push(order);
    renderOrders();
});

socket.on('orderStatusUpdate', (data) => {
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
    const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
    activeOrders.sort((a, b) => {
        // Priority: Pending first, then by time
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
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
        // Determine Styles
        const isPending = order.status === 'pending';
        const statusClass = isPending ? 'status-pending' : 'status-preparing';
        const badgeText = isPending ? 'PENDING' : 'PREPARING';
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
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateCounts();
}

function updateCounts() {
    const counts = { pending: 0, preparing: 0, completed: 0 };
    orders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });

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
        orders = await res.json();
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