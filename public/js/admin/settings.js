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

// const socket = io(); // Settings typically don't need real-time updates as frequently as orders/inventory

// DOM elements
const settingsForm = document.getElementById('settingsForm');
const restaurantNameInput = document.getElementById('restaurant_name');
const currencySymbolInput = document.getElementById('currency_symbol');
const taxRateInput = document.getElementById('tax_rate');
const settingsMessage = document.getElementById('settingsMessage');


/* ===========================
   1. Fetch & Render Settings
   =========================== */

async function fetchSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        console.log('Fetched Settings:', data); // Debugging

        // Populate form fields
        restaurantNameInput.value = data.restaurant_name || '';
        currencySymbolInput.value = data.currency_symbol || '';
        taxRateInput.value = parseFloat(data.tax_rate || 0).toFixed(2);

    } catch (error) {
        console.error('Error fetching settings:', error);
        settingsMessage.innerHTML = '<div class="alert alert-danger">Failed to load settings. Please try again.</div>';
    }
}

/* ===========================
   2. Update Settings
   =========================== */

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedSettings = {
        restaurant_name: restaurantNameInput.value,
        currency_symbol: currencySymbolInput.value,
        tax_rate: parseFloat(taxRateInput.value).toFixed(2) // Ensure it's a number and formatted
    };

    try {
        const response = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedSettings)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update settings');
        }

        settingsMessage.innerHTML = '<div class="alert alert-success">Settings saved successfully!</div>';
        // Re-fetch to ensure consistency and clear any temporary messages
        setTimeout(() => {
            fetchSettings();
            settingsMessage.innerHTML = ''; // Clear message after a delay
        }, 2000);

    } catch (error) {
        console.error('Error saving settings:', error);
        settingsMessage.innerHTML = `<div class="alert alert-danger">Error saving settings: ${error.message}</div>`;
    }
});


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

    // Display username in sidebar
    displayUsernameInSidebar();

    // Sidebar toggle logic (from other admin pages)
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

    // Initial fetch of settings data
    fetchSettings();

    // Real-time updates for settings (less critical, but can be added if a setting changes affects other live pages)
    // For instance, if currency symbol changes, other pages showing prices might need to refresh.
    // This example focuses on the settings page itself.
    // If you implement a 'settingsUpdated' socket event on the server, you could listen for it here:
    // socket.on('settingsUpdated', () => {
    //     console.log('🔄 Received settingsUpdated event. Re-fetching settings...');
    //     fetchSettings();
    // });
});