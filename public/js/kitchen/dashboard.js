// This function fetches HTML content and injects it into a specified element
async function loadPartial(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Could not load ${filePath}`);
        const text = await response.text();
        const placeholder = document.getElementById(elementId);
        if (placeholder) {
            placeholder.innerHTML = text;
        } else {
            console.warn(`Placeholder element with ID '${elementId}' not found.`);
        }
    } catch (error) {
        console.error('Error loading partial:', error);
    }
}

const socket = io();
let orders = [];

/* 🔌 CONNECT */
socket.on('connect', () => {
    console.log('✅ Kitchen connected');
    socket.emit('joinRoom', 'kitchen');
});

/* 📥 NEW ORDER */
socket.on('newOrder', (order) => {
    orders.unshift(order); // Add new orders to the beginning
    renderOrders();
});

/* 🔄 STATUS UPDATE */
socket.on('orderStatusUpdate', (data) => {
    const order = orders.find(o => o.orderNumber === data.orderNumber);
    if (order) {
        order.status = data.status;
        renderOrders();
    }
});

/* 🧠 RENDER */
function renderOrders() {
    const container = document.getElementById('orders-container');

    if (!container) {
        console.error('Orders container not found!');
        return;
    }

    const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');

    if (activeOrders.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted p-5">
                No active orders
            </div>`;
        updateCounts();
        return;
    }

    container.innerHTML = activeOrders.map(order => `
        <div class="col-md-4 mb-4" id="order-${order.orderNumber}">
            <div class="card order-card order-${order.status}">
                <div class="card-body">
                    <h5 class="fw-bold">${order.orderNumber}</h5>
                    <ul class="list-group mb-3">
                        ${order.items.map(i => `
                            <li class="list-group-item d-flex justify-content-between">
                                ${i.name}
                                <span>x${i.quantity}</span>
                            </li>
                        `).join('')}
                    </ul>

                    <div class="d-flex justify-content-between">
                        <span class="badge bg-secondary">${order.status}</span>

                        ${order.status === 'pending'
                            ? `<button class="btn btn-sm btn-info"
                                onclick="updateStatus('${order.orderNumber}','preparing')">
                                Prepare
                               </button>`
                            : order.status === 'preparing'
                            ? `<button class="btn btn-sm btn-success"
                                onclick="updateStatus('${order.orderNumber}','completed')">
                                Complete
                               </button>`
                            : ''
                        }
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    updateCounts();
}

/* 🔢 COUNTS */
function updateCounts() {
    const counts = { pending: 0, preparing: 0, completed: 0 };

    orders.forEach(o => counts[o.status]++);

    const pendingEl = document.getElementById('pending-count');
    const preparingEl = document.getElementById('preparing-count');
    const completedEl = document.getElementById('completed-count');

    if (pendingEl) pendingEl.textContent = counts.pending;
    if (preparingEl) preparingEl.textContent = counts.preparing;
    if (completedEl) completedEl.textContent = counts.completed;
}

/* 🔧 UPDATE STATUS */
function updateStatus(orderNumber, status) {
    socket.emit('updateOrderStatus', { orderNumber, status });
}

// Function to fetch initial orders from the server
async function fetchOrders() {
    try {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error('Failed to fetch orders');
        const data = await response.json();
        orders = data; // Populate the global orders array
        renderOrders(); // Render them
    } catch (error) {
        console.error('Error fetching initial orders:', error);
        const container = document.getElementById('orders-container');
        if (container) {
            container.innerHTML = `<div class="col-12 text-center text-danger p-5">
                                        Error loading orders. Please refresh.
                                    </div>`;
        }
    }
}


// When the page loads, attach event listeners for sidebar toggling AND fetch initial orders
window.addEventListener('DOMContentLoaded', async () => {
    // Load sidebar partial
    await loadPartial('sidebar-placeholder', '../partials/_kitchen_sidebar.html');

    // Add 'active' class to the current page's sidebar link
    const currentPath = window.location.pathname.split('/').pop(); // Gets 'dashboard.html'
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active'); // Ensure only one is active
        }
    });

    // Sidebar toggle logic
    const sidebar = document.getElementById('sidebar-wrapper');
    const pageContent = document.getElementById('page-content-wrapper'); // Ensure this is correctly retrieved
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const desktopToggleButton = document.getElementById('sidebarToggle');
    if (desktopToggleButton) {
        desktopToggleButton.addEventListener('click', () => {
            if (sidebar && pageContent) { // Check both elements exist
                sidebar.classList.toggle('collapsed');
                pageContent.classList.toggle('sidebar-collapsed'); // RE-ADDED: Toggle class on content wrapper
            }
        });
    }

    const mobileToggleButton = document.getElementById('sidebarCollapseMobile');
    if (mobileToggleButton) {
        mobileToggleButton.addEventListener('click', () => {
            if (sidebar && sidebarOverlay) {
                sidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
            }
        });
    }

    const sidebarCloseButton = document.getElementById('sidebarCollapse');
    if (sidebarCloseButton) {
        sidebarCloseButton.addEventListener('click', () => {
            if (sidebar && sidebarOverlay) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            if (sidebar && sidebarOverlay) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        });
    }

    fetchOrders();
});