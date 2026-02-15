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
    console.log('DEBUG: Received newOrder in history:', order); // Debug log
    allOrders.unshift(order); 
    filterAndRenderOrders();
});

// When status changes, trigger a full re-fetch to ensure consistency
socket.on('orderStatusUpdate', (data) => {
    console.log('DEBUG: Order status update received in history:', data); // Debug log
    // Trigger a full re-fetch to ensure the most current and accurate data from the DB
    // This is more robust for order status changes that can affect filtering and display.
    fetchOrderHistory();
    console.log('DEBUG: Triggered full history fetch due to status update.'); // Debug log
});

/* =========================================
   2. FETCH DATA
   ========================================= */
async function fetchOrderHistory() {
    try {
        console.log('DEBUG: Fetching full order history from API...'); // Debug log
        const response = await fetch('/api/order-history');
        if (!response.ok) throw new Error('Failed to fetch order history');
        allOrders = await response.json();
        
        // Sort: Newest orders first
        allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        console.log('DEBUG: Fetched and sorted allOrders:', allOrders); // Debug log
        
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
    const statusFilter = document.getElementById('statusFilter').value; // This is the value from the <select>
    const tableBody = document.getElementById('orderHistoryTableBody');
    const noOrdersMessage = document.getElementById('noOrdersMessage');

    if (!tableBody) return;

    console.log(`DEBUG: Filtering orders. SearchTerm: "${searchTerm}", StatusFilter: "${statusFilter}"`); // Debug log

    // Filter Logic
    const filtered = allOrders.filter(order => {
        // Defensive check: Ensure order.status is a string, default to 'unknown' if not.
        const orderStatusLower = (order.status || 'unknown').toLowerCase(); 

        // 1. Check Status
        // CRITICAL FIX: Ensure both the order status from data and the filter value are converted to lowercase
        // for consistent comparison, preventing issues with case sensitivity or empty strings.
        const matchesStatus = statusFilter ? orderStatusLower === statusFilter.toLowerCase() : true;
        
        // 2. Check Search (Order # or Item Names)
        const itemNames = order.items.map(i => i.name.toLowerCase()).join(' ');
        const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm) || itemNames.includes(searchTerm);
        
        return matchesStatus && matchesSearch;
    });

    console.log('DEBUG: Filtered results:', filtered); // Debug log

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

        // Defensive check: Ensure order.status is a string, default to 'unknown' if not.
        const currentStatus = (order.status || 'unknown').toLowerCase();

        // Determine Badge Class (Matches CSS variables)
        let badgeClass = 'badge-pending'; // default
        if (currentStatus === 'preparing') badgeClass = 'badge-preparing';
        else if (currentStatus === 'completed') badgeClass = 'badge-completed';
        else if (currentStatus === 'cancelled') badgeClass = 'badge-cancelled';
        else if (currentStatus === 'unknown') badgeClass = 'badge-unknown'; // Apply new unknown badge

        console.log(`DEBUG: Rendering order #${order.orderNumber}. Status: ${currentStatus}, Badge Class: ${badgeClass}`); // Debug log

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
            <td><span class="badge badge-status ${badgeClass}">${(order.status || 'UNKNOWN').toUpperCase()}</span></td>
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