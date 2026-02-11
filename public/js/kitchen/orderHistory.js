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

// Socket.IO (optional for history, but good to have if you want real-time updates for all orders)
const socket = io();
let allOrders = []; // Store all fetched orders to enable client-side filtering

/* 🔌 CONNECT - Join room if needed for real-time history updates */
socket.on('connect', () => {
    console.log('✅ Kitchen connected to Socket.IO for history');
    socket.emit('joinRoom', 'kitchen');
});

/* 🔄 Real-time updates (Optional: If you want history to update live) */
socket.on('newOrder', (order) => {
    allOrders.unshift(order); // Add new orders to the beginning
    filterAndRenderOrders();
});

socket.on('orderStatusUpdate', (data) => {
    const order = allOrders.find(o => o.orderNumber === data.orderNumber);
    if (order) {
        order.status = data.status;
        filterAndRenderOrders();
    }
});


function renderOrderHistory(filteredOrders) {
    const tableBody = document.getElementById('orderHistoryTableBody');
    const noOrdersMessage = document.getElementById('noOrdersMessage');

    tableBody.innerHTML = ''; // Clear existing rows

    if (filteredOrders.length === 0) {
        noOrdersMessage.style.display = 'block';
        tableBody.style.display = 'none'; // Hide tbody when no orders
        return;
    } else {
        noOrdersMessage.style.display = 'none';
        tableBody.style.display = 'table-row-group'; // Show tbody
    }

    filteredOrders.forEach(order => {
        const row = tableBody.insertRow();
        row.className = `table-row-status-${order.status}`; // For potential styling

        const orderNumCell = row.insertCell();
        orderNumCell.textContent = order.orderNumber;

        const itemsCell = row.insertCell();
        itemsCell.innerHTML = order.items.map(item => `${item.name} x${item.quantity}`).join('<br>');

        const totalCell = row.insertCell();
        // FIX: Ensure order.total is a number before calling toFixed
        const orderTotal = parseFloat(order.total); // Convert to float
        totalCell.textContent = `₱${isNaN(orderTotal) ? '0.00' : orderTotal.toFixed(2)}`; // Changed $ to ₱, Handle NaN
        
        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="badge bg-${getStatusBadgeClass(order.status)}">${order.status}</span>`;

        const timestampCell = row.insertCell();
        timestampCell.textContent = new Date(order.timestamp).toLocaleString();
    });
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'pending': return 'warning text-dark';
        case 'preparing': return 'info';
        case 'completed': return 'success';
        case 'cancelled': return 'danger';
        default: return 'secondary';
    }
}

/* 🔄 Fetch Order History from Server */
async function fetchOrderHistory() {
    try {
        const response = await fetch('/api/order-history'); // Call the new API endpoint
        if (!response.ok) throw new Error('Failed to fetch order history');
        const data = await response.json();
        allOrders = data; // Store all orders for client-side filtering
        filterAndRenderOrders();
    } catch (error) {
        console.error('Error fetching order history:', error);
        const tableBody = document.getElementById('orderHistoryTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-4">
                                        Error loading order history. Please refresh.
                                    </td></tr>`;
        }
    }
}

/* 🔍 Filter and Render Orders */
function filterAndRenderOrders() {
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = allOrders;

    // Filter by status
    if (statusFilter) {
        filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by search term (order number or item name)
    if (searchTerm) {
        filtered = filtered.filter(order =>
            order.orderNumber.toLowerCase().includes(searchTerm) ||
            (order.items && order.items.some(item => item.name.toLowerCase().includes(searchTerm)))
        );
    }

    renderOrderHistory(filtered);
}

// Function to display the logged-in username in the sidebar
function displayUsernameInSidebar() {
    const userStr = localStorage.getItem('user');
    const userDisplayElement = document.getElementById('sidebar-user-display');
    if (userStr && userDisplayElement) {
        const user = JSON.parse(userStr);
        userDisplayElement.textContent = `Welcome, ${user.username}!`;
    }
}


// When the page loads
window.addEventListener('DOMContentLoaded', async () => {
    // Load sidebar partial
    await loadPartial('sidebar-placeholder', '../partials/_kitchen_sidebar.html');

    // Add 'active' class to the current page's sidebar link
    const currentPath = window.location.pathname.split('/').pop(); // Gets 'orderHistory.html'
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active'); // Ensure only one is active
        }
    });

    // Display username in sidebar
    displayUsernameInSidebar();

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

    // Add event listeners for search and filter (these are already correct)
    document.getElementById('orderSearch').addEventListener('input', filterAndRenderOrders);
    document.getElementById('statusFilter').addEventListener('change', filterAndRenderOrders);
    document.getElementById('searchButton').addEventListener('click', (e) => {
        e.preventDefault();
        filterAndRenderOrders();
    });
    document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('orderSearch').value = '';
        document.getElementById('statusFilter').value = '';
        filterAndRenderOrders();
    });

    // Initial fetch of order history
    fetchOrderHistory();
});