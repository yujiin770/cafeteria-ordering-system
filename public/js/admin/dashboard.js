// Function to load HTML partials
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

// Socket.IO for real-time updates (if implemented later)
const socket = io();

// Chart.js instance
let salesChart;

/* ===========================
   1. Rendering Functions (Defined first)
   =========================== */
function renderTopSellingItems(items) {
    const topSellingItemsList = document.getElementById('topSellingItems');
    topSellingItemsList.innerHTML = '';
    if (!items || items.length === 0) {
        topSellingItemsList.innerHTML = '<li class="list-group-item text-muted text-center">No top selling items yet.</li>';
        return;
    }
    items.forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            ${item.name}
            <span class="badge bg-primary rounded-pill">${item.count} sold</span>
        `;
        topSellingItemsList.appendChild(listItem);
    });
}

function renderSalesChart(salesData) {
    const ctx = document.getElementById('salesChart');
    const chartMessage = document.getElementById('salesChartMessage');

    if (!salesData || salesData.labels.length === 0) {
        ctx.style.display = 'none';
        chartMessage.style.display = 'block';
        return;
    } else {
        ctx.style.display = 'block';
        chartMessage.style.display = 'none';
    }

    if (salesChart) {
        salesChart.destroy(); // Destroy existing chart if it exists
    }

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: salesData.labels, // e.g., ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            datasets: [{
                label: 'Total Sales (₱)',
                data: salesData.data, // e.g., [120, 190, 300, 170, 250, 310, 280]
                backgroundColor: 'rgba(13, 110, 253, 0.2)', // Primary blue with transparency
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3 // Smooth lines
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Sales (₱)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Day'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Sales: ₱${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderRecentActivity(activity) {
    const recentActivityList = document.getElementById('recentActivity');
    recentActivityList.innerHTML = '';
    if (!activity || activity.length === 0) {
        recentActivityList.innerHTML = '<li class="list-group-item text-muted text-center">No recent activity.</li>';
        return;
    }
    activity.forEach(entry => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.innerHTML = `
            <small class="text-muted">${new Date(entry.timestamp).toLocaleString()}</small><br>
            <strong>${entry.description}</strong>
        `;
        recentActivityList.appendChild(listItem);
    });
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


/* ===========================
   2. Fetch Analytics Data (Calls rendering functions)
   =========================== */
async function fetchAnalyticsData() {
    try {
        const response = await fetch('/api/admin/dashboard-analytics');
        if (!response.ok) throw new Error('Failed to fetch analytics data');
        const data = await response.json();
        console.log('Analytics Data:', data); // Debugging

        // Update summary cards
        document.getElementById('totalSalesToday').textContent = parseFloat(data.totalSalesToday || 0).toFixed(2);
        document.getElementById('ordersCompleted').textContent = data.ordersCompletedToday || 0;
        document.getElementById('ordersPending').textContent = data.ordersPending || 0;
        document.getElementById('uniqueCustomers').textContent = data.uniqueCustomersToday || 0;

        // Render Top Selling Items
        renderTopSellingItems(data.topSellingItems);

        // Render Sales Chart
        renderSalesChart(data.salesDataLast7Days);

        // Render Recent Activity (assuming it's part of the data)
        renderRecentActivity(data.recentActivity);

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        // Display error message or default values
        document.getElementById('salesChartMessage').style.display = 'block';
    }
}


/* ===========================
   3. Sidebar & Page Initialization
   =========================== */
window.addEventListener('DOMContentLoaded', async () => {
    // Load sidebar partial
    await loadPartial('sidebar-placeholder', '../partials/sidebar.html');

    // Highlight active link
    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    sidebarLinks.forEach(link => {
        const linkHrefBasename = link.getAttribute('href').split('/').pop(); // Extract filename from href
        if (linkHrefBasename === currentPath) { // Correct comparison
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Display username in sidebar
    displayUsernameInSidebar();

    // Sidebar toggle logic (similar to kitchen)
    const sidebar = document.getElementById('sidebar-wrapper');
    const pageContent = document.getElementById('page-content-wrapper');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const desktopToggleButton = document.getElementById('sidebarToggle');
    if (desktopToggleButton) {
        desktopToggleButton.addEventListener('click', () => {
            if (sidebar && pageContent) {
                sidebar.classList.toggle('collapsed');
                pageContent.classList.toggle('sidebar-collapsed');
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

    // Fetch analytics data when the dashboard loads
    fetchAnalyticsData();
});

// Socket.IO for real-time updates (example - not fully implemented in server.js yet for admin)
socket.on('newOrder', (order) => {
    console.log('Admin received new order via WebSocket:', order);
    // You might want to update pending orders count or a real-time activity feed here
    fetchAnalyticsData(); // Re-fetch all data to update counts
});

socket.on('orderStatusUpdate', (data) => {
    console.log('Admin received order status update via WebSocket:', data);
    // You might want to update pending/completed orders count here
    fetchAnalyticsData(); // Re-fetch all data to update counts
});