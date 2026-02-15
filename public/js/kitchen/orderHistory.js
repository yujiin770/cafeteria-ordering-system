// Function to load partial HTML (Sidebar)
async function loadPartial(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Could not load ${filePath}`);
        const text = await response.text();
        const placeholder = document.getElementById(elementId);
        if (placeholder) placeholder.innerHTML = text;
    } catch (error) {
        console.error('Error loading partial:', error);
    }
}

const socket = io();
let allOrders = []; // Store all fetched orders for filtering

/* =========================================
   1. SOCKET CONNECTION & REAL-TIME UPDATES
   ========================================= */
socket.on('connect', () => {
    console.log('✅ Kitchen connected to History');
    socket.emit('joinRoom', 'kitchen');
});

// When a new order comes in, add it to top and refresh
socket.on('newOrder', (order) => {
    allOrders.unshift(order); 
    filterAndRenderOrders();
});

// When status changes, update the specific order and refresh
socket.on('orderStatusUpdate', (data) => {
    const order = allOrders.find(o => o.orderNumber === data.orderNumber);
    if (order) {
        order.status = data.status;
        filterAndRenderOrders();
    }
});

/* =========================================
   2. FETCH DATA
   ========================================= */
async function fetchOrderHistory() {
    try {
        const response = await fetch('/api/order-history');
        if (!response.ok) throw new Error('Failed to fetch order history');
        allOrders = await response.json();
        
        // Sort: Newest orders first
        allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        filterAndRenderOrders();
    } catch (error) {
        console.error('Error fetching order history:', error);
        const tableBody = document.getElementById('orderHistoryTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-4">
                                        Error loading history. Please check connection.
                                    </td></tr>`;
        }
    }
}

/* =========================================
   3. RENDER & FILTER LOGIC
   ========================================= */
function filterAndRenderOrders() {
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const tableBody = document.getElementById('orderHistoryTableBody');
    const noOrdersMessage = document.getElementById('noOrdersMessage');

    if (!tableBody) return;

    // Filter Logic
    const filtered = allOrders.filter(order => {
        // 1. Check Status
        const matchesStatus = statusFilter ? order.status === statusFilter : true;
        
        // 2. Check Search (Order # or Item Names)
        const itemNames = order.items.map(i => i.name.toLowerCase()).join(' ');
        const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm) || itemNames.includes(searchTerm);
        
        return matchesStatus && matchesSearch;
    });

    // Clear Table
    tableBody.innerHTML = '';

    // Handle Empty State
    if (filtered.length === 0) {
        if (noOrdersMessage) noOrdersMessage.style.display = 'block';
        return;
    } else {
        if (noOrdersMessage) noOrdersMessage.style.display = 'none';
    }

    // Render Rows
    filtered.forEach(order => {
        const row = document.createElement('tr');
        row.className = 'history-row-anim'; // Animation class from CSS

        // Format Date (e.g., 10/25/2023 2:30 PM)
        const dateObj = new Date(order.timestamp);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Determine Badge Class (Matches CSS variables)
        let badgeClass = 'badge-pending'; // default
        if (order.status === 'preparing') badgeClass = 'badge-preparing';
        if (order.status === 'completed') badgeClass = 'badge-completed';
        if (order.status === 'cancelled') badgeClass = 'badge-cancelled';

        // Format Items List
        const itemsListHtml = order.items.map(item => 
            `<li>${item.name} <span class="fw-bold text-dark">x${item.quantity}</span></li>`
        ).join('');

        // Calculate Total safely
        const totalAmount = parseFloat(order.total) || 0;

        row.innerHTML = `
            <td><span class="fw-bold text-dark">#${order.orderNumber}</span></td>
            <td><small class="text-muted">${dateStr}</small></td>
            <td>
                <ul class="item-list-small mb-0">
                    ${itemsListHtml}
                </ul>
            </td>
            <td class="fw-bold text-dark">₱${totalAmount.toFixed(2)}</td>
            <td><span class="badge badge-status ${badgeClass}">${order.status.toUpperCase()}</span></td>
        `;

        tableBody.appendChild(row);
    });
}

/* =========================================
   4. INITIALIZATION
   ========================================= */
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Load Sidebar
    await loadPartial('sidebar-placeholder', '../partials/_kitchen_sidebar.html');

    // 2. Sidebar Toggle Logic (Fixes the burger menu issue)
    const menuToggle = document.getElementById('menu-toggle');
    const wrapper = document.getElementById('wrapper');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle && wrapper) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            wrapper.classList.toggle('toggled');
        });
    }

    if (overlay && wrapper) {
        overlay.addEventListener('click', () => {
            wrapper.classList.remove('toggled');
        });
    }

    // 3. Highlight Active Sidebar Link
    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 4. Update Header Date
    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 5. Event Listeners for Filters
    const searchInput = document.getElementById('orderSearch');
    const statusSelect = document.getElementById('statusFilter');
    const refreshBtn = document.getElementById('refreshBtn');

    if (searchInput) searchInput.addEventListener('input', filterAndRenderOrders);
    if (statusSelect) statusSelect.addEventListener('change', filterAndRenderOrders);
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Add spinning effect to icon
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin me-1"></i> Refreshing...';
            fetchOrderHistory().then(() => {
                setTimeout(() => {
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Refresh';
                }, 500);
            });
        });
    }

    // 6. Initial Fetch
    fetchOrderHistory();
});