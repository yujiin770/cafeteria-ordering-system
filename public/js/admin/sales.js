// Function to load HTML partials (reused from other admin pages)
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

const socket = io(); // Initialize Socket.IO for real-time updates

let salesTrendChart; // Chart.js instance

// DOM elements
const salesFilterForm = document.getElementById('salesFilterForm');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

const totalRevenueSpan = document.getElementById('totalRevenue');
const totalOrdersSpan = document.getElementById('totalOrders');
const avgOrderValueSpan = document.getElementById('avgOrderValue');

const salesTrendChartCanvas = document.getElementById('salesTrendChart');
const salesTrendChartMessage = document.getElementById('salesTrendChartMessage');

const topSellingItemsTableBody = document.getElementById('topSellingItemsTableBody');
const noTopSellingItemsMessage = document.getElementById('noTopSellingItemsMessage');


/* ===========================
   1. Rendering Functions
   =========================== */

function renderOverallSales(data) {
    totalRevenueSpan.textContent = parseFloat(data.totalRevenue || 0).toFixed(2);
    totalOrdersSpan.textContent = data.totalOrders || 0;
    avgOrderValueSpan.textContent = parseFloat(data.avgOrderValue || 0).toFixed(2);
}

function renderSalesTrendChart(labels, data) {
    if (salesTrendChart) {
        salesTrendChart.destroy(); // Destroy existing chart if it exists
    }

    if (!labels || labels.length === 0 || !data || data.length === 0) {
        salesTrendChartCanvas.style.display = 'none';
        salesTrendChartMessage.style.display = 'block';
        return;
    } else {
        salesTrendChartCanvas.style.display = 'block';
        salesTrendChartMessage.style.display = 'none';
    }

    const ctx = salesTrendChartCanvas.getContext('2d');
    salesTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Sales (₱)',
                data: data,
                backgroundColor: 'rgba(56, 189, 248, 0.2)', // Admin primary blue with transparency
                borderColor: 'rgba(56, 189, 248, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
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
                        text: 'Revenue (₱)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
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

function renderTopSellingItemsTable(items) {
    topSellingItemsTableBody.innerHTML = ''; // Clear existing rows

    if (!items || items.length === 0) {
        noTopSellingItemsMessage.style.display = 'block';
        return;
    } else {
        noTopSellingItemsMessage.style.display = 'none';
    }

    items.forEach((item, index) => {
        const row = topSellingItemsTableBody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.itemName}</td>
            <td>${item.totalQuantitySold}</td>
            <td>₱${parseFloat(item.totalRevenueGenerated || 0).toFixed(2)}</td>
        `;
    });
}


/* ===========================
   2. Fetch Sales Data
   =========================== */

async function fetchSalesData(startDate, endDate) {
    try {
        const response = await fetch(`/api/admin/sales-report?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error('Failed to fetch sales report data');
        const data = await response.json();
        console.log('Sales Report Data:', data); // Debugging

        renderOverallSales(data.overallSales);
        renderSalesTrendChart(data.salesTrend.labels, data.salesTrend.data);
        renderTopSellingItemsTable(data.topSellingItems);

    } catch (error) {
        console.error('Error fetching sales data:', error);
        // Display error messages or clear content
        totalRevenueSpan.textContent = '0.00';
        totalOrdersSpan.textContent = '0';
        avgOrderValueSpan.textContent = '0.00';
        renderSalesTrendChart([], []); // Clear chart
        renderTopSellingItemsTable([]); // Clear table
    }
}


/* ===========================
   3. Event Listeners & Initialization
   =========================== */

// Function to display the logged-in username in the sidebar
function displayUsernameInSidebar() {
    const userStr = localStorage.getItem('user');
    const userDisplayElement = document.getElementById('sidebar-user-display');
    if (userStr && userDisplayElement) {
        const user = JSON.parse(userStr);
        userDisplayElement.textContent = `Welcome, ${user.username}!`;
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    // Load sidebar partial
    await loadPartial('sidebar-placeholder', '../partials/sidebar.html');

    // Highlight active link
    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    sidebarLinks.forEach(link => {
        const linkHrefBasename = link.getAttribute('href').split('/').pop();
        if (linkHrefBasename === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    displayUsernameInSidebar();
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

    // Set default filter dates (e.g., last 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Go back 6 days to include today (7 days total)

    startDateInput.value = sevenDaysAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];

    // Initial fetch of sales data
    fetchSalesData(startDateInput.value, endDateInput.value);

    // Event listener for filter form submission
    salesFilterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        fetchSalesData(startDateInput.value, endDateInput.value);
    });

    // Real-time updates via Socket.IO
    socket.on('orderStatusUpdate', (data) => {
        // Only refresh if an order moved to 'completed' status
        if (data.status === 'completed') {
            console.log('🔄 Received orderStatusUpdate (completed). Re-fetching sales data...');
            fetchSalesData(startDateInput.value, endDateInput.value); // Re-fetch with current filters
        }
    });
    // Also listen for new orders if they should immediately impact sales reports (e.g., as 'pending' sales)
    socket.on('newOrder', () => {
        console.log('🔄 Received newOrder. Re-fetching sales data...');
        fetchSalesData(startDateInput.value, endDateInput.value);
    });
});