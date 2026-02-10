// Function to load HTML partials (duplicated for each page)
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

let inventoryItems = []; // Store inventory items locally

// DOM Elements
const inventoryItemsTableBody = document.getElementById('inventoryItemsTableBody');
const noInventoryItemsMessage = document.getElementById('noInventoryItemsMessage');
const inventoryItemModal = new bootstrap.Modal(document.getElementById('inventoryItemModal'));
const inventoryItemModalLabel = document.getElementById('inventoryItemModalLabel');
const inventoryItemForm = document.getElementById('inventoryItemForm');
const inventoryItemIdInput = document.getElementById('inventoryItemId');
const inventoryItemNameInput = document.getElementById('inventoryItemName');
const inventoryItemQuantityInput = document.getElementById('inventoryItemQuantity');
const inventoryItemUnitInput = document.getElementById('inventoryItemUnit');
const inventoryLowStockThresholdInput = document.getElementById('inventoryLowStockThreshold');
const addNewInventoryItemBtn = document.getElementById('addNewInventoryItemBtn');
const saveInventoryItemBtn = document.getElementById('saveInventoryItemBtn');

/* ===========================
   1. Fetch & Render Inventory Items
   =========================== */
async function fetchInventoryItems() {
    try {
        const response = await fetch('/api/admin/inventory');
        if (!response.ok) throw new Error('Failed to fetch inventory items');
        inventoryItems = await response.json();
        renderInventoryItems();
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        inventoryItemsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger p-4">
                                            Failed to load inventory items.
                                        </td></tr>`;
    }
}

function renderInventoryItems() {
    inventoryItemsTableBody.innerHTML = ''; // Clear existing rows

    if (inventoryItems.length === 0) {
        noInventoryItemsMessage.style.display = 'block';
        return;
    } else {
        noInventoryItemsMessage.style.display = 'none';
    }

    inventoryItems.forEach(item => {
        const row = inventoryItemsTableBody.insertRow();
        const isLowStock = item.quantity <= item.low_stock_threshold;
        row.className = isLowStock ? 'table-warning' : ''; // Highlight low stock items

        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.item_name}</td>
            <td>${item.quantity} ${item.unit} ${isLowStock ? '<span class="badge bg-danger ms-2">LOW STOCK!</span>' : ''}</td>
            <td>${item.unit}</td>
            <td>${item.low_stock_threshold}</td>
            <td>${new Date(item.last_updated).toLocaleString()}</td>
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
        button.addEventListener('click', (e) => deleteInventoryItem(parseInt(e.currentTarget.dataset.id)));
    });
}

/* ===========================
   2. CRUD Operations
   =========================== */

// Open modal for adding new item
addNewInventoryItemBtn.addEventListener('click', () => {
    inventoryItemModalLabel.textContent = 'Add New Inventory Item';
    inventoryItemForm.reset();
    inventoryItemIdInput.value = ''; // Clear ID for new item
    inventoryItemQuantityInput.value = 0; // Default quantity
    inventoryLowStockThresholdInput.value = 10; // Default threshold
    inventoryItemModal.show();
});

// Open modal for editing existing item
function openEditModal(id) {
    const item = inventoryItems.find(i => i.id === id);
    if (item) {
        inventoryItemModalLabel.textContent = `Edit Inventory Item: ${item.item_name}`;
        inventoryItemIdInput.value = item.id;
        inventoryItemNameInput.value = item.item_name;
        inventoryItemQuantityInput.value = item.quantity;
        inventoryItemUnitInput.value = item.unit;
        inventoryLowStockThresholdInput.value = item.low_stock_threshold;
        inventoryItemModal.show();
    }
}

// Handle form submission (Add/Edit)
inventoryItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = inventoryItemIdInput.value;
    const item_name = inventoryItemNameInput.value;
    const quantity = parseInt(inventoryItemQuantityInput.value);
    const unit = inventoryItemUnitInput.value;
    const low_stock_threshold = parseInt(inventoryLowStockThresholdInput.value);

    const itemData = { item_name, quantity, unit, low_stock_threshold };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/inventory/${id}` : '/api/admin/inventory';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        if (!response.ok) {
            const errorData = await response.json(); // Read error message from server
            throw new Error(errorData.error || 'Failed to save inventory item');
        }

        inventoryItemModal.hide();
        fetchInventoryItems(); // Re-fetch and render
    } catch (error) {
        console.error('Error saving inventory item:', error);
        alert('Failed to save inventory item: ' + error.message);
    }
});

// Delete inventory item
async function deleteInventoryItem(id) {
    if (!confirm('Are you sure you want to delete this inventory item?')) {
        return;
    }
    try {
        const response = await fetch(`/api/admin/inventory/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete inventory item');
        }

        fetchInventoryItems(); // Re-fetch and render
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        alert('Failed to delete inventory item: ' + error.message);
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

    // Sidebar toggle logic (from dashboard.js, duplicated for this page)
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

    // Fetch and render inventory items on page load
    fetchInventoryItems();
});