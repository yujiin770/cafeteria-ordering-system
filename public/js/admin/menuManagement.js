// Function to load HTML partials (duplicated for each page that uses the sidebar)
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

let menuItems = []; // Store menu items locally

// DOM Elements
const menuItemsTableBody = document.getElementById('menuItemsTableBody');
const noMenuItemsMessage = document.getElementById('noMenuItemsMessage');
const menuItemModal = new bootstrap.Modal(document.getElementById('menuItemModal'));
const menuItemModalLabel = document.getElementById('menuItemModalLabel');
const menuItemForm = document.getElementById('menuItemForm');
const menuItemIdInput = document.getElementById('menuItemId');
const itemNameInput = document.getElementById('itemName');
const itemPriceInput = document.getElementById('itemPrice');
const addNewMenuItemBtn = document.getElementById('addNewMenuItemBtn');
const saveMenuItemBtn = document.getElementById('saveMenuItemBtn');

/* ===========================
   1. Fetch & Render Menu Items
   =========================== */
async function fetchMenuItems() {
    try {
        const response = await fetch('/api/admin/menu');
        if (!response.ok) throw new Error('Failed to fetch menu items');
        menuItems = await response.json();
        renderMenuItems();
    } catch (error) {
        console.error('Error fetching menu items:', error);
        menuItemsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger p-4">
                                            Failed to load menu items.
                                        </td></tr>`;
    }
}

function renderMenuItems() {
    menuItemsTableBody.innerHTML = ''; // Clear existing rows

    if (menuItems.length === 0) {
        noMenuItemsMessage.style.display = 'block';
        return;
    } else {
        noMenuItemsMessage.style.display = 'none';
    }

    menuItems.forEach(item => {
        const row = menuItemsTableBody.insertRow();
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>$${parseFloat(item.price).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-info edit-item-btn me-2" data-id="${item.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger delete-item-btn" data-id="${item.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
    });

    // Attach event listeners to new buttons
    document.querySelectorAll('.edit-item-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditModal(parseInt(e.currentTarget.dataset.id)));
    });
    document.querySelectorAll('.delete-item-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteMenuItem(parseInt(e.currentTarget.dataset.id)));
    });
}

/* ===========================
   2. CRUD Operations
   =========================== */

// Open modal for adding new item
addNewMenuItemBtn.addEventListener('click', () => {
    menuItemModalLabel.textContent = 'Add New Menu Item';
    menuItemForm.reset();
    menuItemIdInput.value = ''; // Clear ID for new item
    menuItemModal.show();
});

// Open modal for editing existing item
function openEditModal(id) {
    const item = menuItems.find(i => i.id === id);
    if (item) {
        menuItemModalLabel.textContent = `Edit Menu Item: ${item.name}`;
        menuItemIdInput.value = item.id;
        itemNameInput.value = item.name;
        itemPriceInput.value = parseFloat(item.price).toFixed(2);
        menuItemModal.show();
    }
}

// Handle form submission (Add/Edit)
menuItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = menuItemIdInput.value;
    const name = itemNameInput.value;
    const price = parseFloat(itemPriceInput.value);

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price })
        });

        if (!response.ok) throw new Error('Failed to save menu item');

        menuItemModal.hide();
        fetchMenuItems(); // Re-fetch and render
    } catch (error) {
        console.error('Error saving menu item:', error);
        alert('Failed to save menu item: ' + error.message);
    }
});

// Delete menu item
async function deleteMenuItem(id) {
    if (!confirm('Are you sure you want to delete this menu item?')) {
        return;
    }
    try {
        const response = await fetch(`/api/admin/menu/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete menu item');

        fetchMenuItems(); // Re-fetch and render
    } catch (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item: ' + error.message);
    }
}


/* ===========================
   3. Initialization
   =========================== */
window.addEventListener('DOMContentLoaded', async () => {
    // Load sidebar partial
    await loadPartial('sidebar-placeholder', '../partials/sidebar.html');

    // Highlight active link
    const currentPath = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Sidebar toggle logic
    const sidebar = document.getElementById('sidebar-wrapper');
    const pageContent = document.getElementById('page-content-wrapper');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const desktopToggleButton = document.getElementById('sidebarToggle');
    if (desktopToggleButton) {
        desktopToggleButton.addEventListener('click', () => {
            if (sidebar && pageContent) {
                sidebar.classList.toggle('collapsed');
                pageContent.classList.toggle('sidebar-collapsed'); // CRITICAL: Toggle class on content wrapper
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

    // Fetch and render menu items on page load
    fetchMenuItems();
});