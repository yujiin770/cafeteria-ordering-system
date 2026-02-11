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

const socket = io(); // MODIFIED: Initialize socket.io here

let menuItems = []; // Store menu items locally
let inventoryList = []; // Store inventory items for recipe dropdown
let currentMenuItemIdForRecipe = null; // To track which menu item's recipe we are editing

// DOM Elements - Menu Item Management
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

// DOM Elements - Recipe Ingredients Management
const recipeIngredientsSection = document.getElementById('recipe-ingredients-section');
const currentMenuItemNameSpan = document.getElementById('currentMenuItemName');
const ingredientForm = document.getElementById('ingredientForm');
const recipeIngredientIdInput = document.getElementById('recipeIngredientId');
const ingredientSelect = document.getElementById('ingredientSelect');
const ingredientQuantityInput = document.getElementById('ingredientQuantityInput');
const ingredientUnitInput = document.getElementById('ingredientUnitInput');
const addUpdateIngredientBtn = document.getElementById('addUpdateIngredientBtn');
const menuItemIngredientsTableBody = document.getElementById('menuItemIngredientsTableBody');
const noIngredientsMessage = document.getElementById('noIngredientsMessage');

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
            <td>₱${parseFloat(item.price).toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-info edit-item-btn me-2" data-id="${item.id}" data-name="${item.name}">
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
        button.addEventListener('click', (e) => {
            openEditModal(parseInt(e.currentTarget.dataset.id), e.currentTarget.dataset.name);
        });
    });
    document.querySelectorAll('.delete-item-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteMenuItem(parseInt(e.currentTarget.dataset.id)));
    });
}

/* ===========================
   2. Fetch & Render Inventory for Recipe Dropdown
   =========================== */
async function fetchInventoryList() {
    try {
        const response = await fetch('/api/admin/inventory');
        if (!response.ok) throw new Error('Failed to fetch inventory list');
        inventoryList = await response.json();
        populateIngredientSelect();
    } catch (error) {
        console.error('Error fetching inventory list:', error);
    }
}

function populateIngredientSelect() {
    ingredientSelect.innerHTML = '<option value="">Select an inventory item...</option>';
    inventoryList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        // Display item name and its unit for clarity
        option.textContent = `${item.item_name} (${item.unit})`;
        ingredientSelect.appendChild(option);
    });
}

/* ===========================
   3. Recipe Ingredients Management
   =========================== */

async function fetchIngredientsForMenuItem(menuItemId) {
    if (!menuItemId) {
        // MODIFIED: Updated colspan to 5 for recipe messages
        menuItemIngredientsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-3">Select a menu item to manage its recipe.</td></tr>';
        noIngredientsMessage.style.display = 'none';
        return;
    }
    try {
        const response = await fetch(`/api/admin/menu/${menuItemId}/ingredients`);
        if (!response.ok) throw new Error('Failed to fetch ingredients for menu item');
        const ingredients = await response.json();
        renderIngredients(ingredients);
    } catch (error) {
        console.error(`Error fetching ingredients for menu item ${menuItemId}:`, error);
        // MODIFIED: Updated colspan to 5 for recipe messages
        menuItemIngredientsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-3">Error loading ingredients.</td></tr>`;
    }
}

function renderIngredients(ingredients) {
    menuItemIngredientsTableBody.innerHTML = '';
    if (ingredients.length === 0) {
        noIngredientsMessage.style.display = 'block';
        // MODIFIED: Updated colspan to 5 for empty message
        menuItemIngredientsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-3">No ingredients found for this menu item.</td></tr>';
        return;
    } else {
        noIngredientsMessage.style.display = 'none';
    }

    ingredients.forEach(ingredient => {
        const row = menuItemIngredientsTableBody.insertRow();
        // Check if current_stock is valid, default to 'N/A' if undefined/null
        const displayCurrentStock = ingredient.current_stock !== undefined && ingredient.current_stock !== null ? ingredient.current_stock : 'N/A';
        // Use inventory_unit for current stock, and unit_needed for the recipe unit
        const displayInventoryUnit = ingredient.inventory_unit !== undefined && ingredient.inventory_unit !== null ? ingredient.inventory_unit : '';
        
        // Determine low stock status based on inventory item's low_stock_threshold
        const lowStockThreshold = ingredient.low_stock_threshold || 0; // Use threshold from API result
        const lowStockStatus = (ingredient.current_stock !== undefined && ingredient.current_stock !== null && ingredient.current_stock <= lowStockThreshold && lowStockThreshold > 0)
                               ? '<span class="badge bg-danger ms-2">LOW STOCK!</span>' 
                               : '';

        row.innerHTML = `
            <td>${ingredient.item_name}</td>
            <td>${ingredient.quantity_needed}</td>
            <td>${ingredient.unit_needed}</td> <!-- This is the unit needed for the recipe -->
            <td>${displayCurrentStock} ${displayInventoryUnit} ${lowStockStatus}</td> <!-- MODIFIED: Display Current Stock with its own unit and low stock badge -->
            <td>
                <button class="btn btn-sm btn-info edit-recipe-ingredient-btn me-2"
                        data-id="${ingredient.id}"
                        data-inventory-item-id="${ingredient.inventory_item_id}"
                        data-quantity="${ingredient.quantity_needed}"
                        data-unit="${ingredient.unit_needed}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger delete-recipe-ingredient-btn" data-id="${ingredient.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
    });

    document.querySelectorAll('.edit-recipe-ingredient-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            editRecipeIngredient(
                parseInt(e.currentTarget.dataset.id),
                parseInt(e.currentTarget.dataset.inventoryItemId),
                parseFloat(e.currentTarget.dataset.quantity),
                e.currentTarget.dataset.unit // This is unit_needed
            );
        });
    });

    document.querySelectorAll('.delete-recipe-ingredient-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteRecipeIngredient(parseInt(e.currentTarget.dataset.id)));
    });
}

// Handle Add/Update Ingredient Form Submission
ingredientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipeIngredientId = recipeIngredientIdInput.value; // Will be empty for add
    const menuItemId = currentMenuItemIdForRecipe;
    const inventory_item_id = parseInt(ingredientSelect.value);
    const quantity_needed = parseFloat(ingredientQuantityInput.value);
    const unit_needed = ingredientUnitInput.value;

    if (!menuItemId) {
        alert('Please save the menu item details first.');
        return;
    }
    if (!inventory_item_id || isNaN(quantity_needed) || quantity_needed <= 0 || !unit_needed) {
        alert('Please select an inventory item, enter a valid quantity, and unit.');
        return;
    }


    const ingredientData = { inventory_item_id, quantity_needed, unit_needed };
    const method = recipeIngredientId ? 'PUT' : 'POST';
    const url = recipeIngredientId
        ? `/api/admin/menu/${menuItemId}/ingredients/${recipeIngredientId}`
        : `/api/admin/menu/${menuItemId}/ingredients`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ingredientData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to ${recipeIngredientId ? 'update' : 'add'} ingredient`);
        }

        ingredientForm.reset();
        recipeIngredientIdInput.value = ''; // Clear for next add
        addUpdateIngredientBtn.textContent = 'Add';
        fetchIngredientsForMenuItem(menuItemId); // Re-fetch and render recipe
    } catch (error) {
        console.error('Error saving ingredient:', error);
        alert(`Error saving ingredient: ${error.message}`);
    }
});


function editRecipeIngredient(ingredientId, inventoryItemId, quantity, unit) {
    recipeIngredientIdInput.value = ingredientId;
    ingredientSelect.value = inventoryItemId;
    ingredientQuantityInput.value = quantity;
    ingredientUnitInput.value = unit;
    addUpdateIngredientBtn.textContent = 'Update';
}

async function deleteRecipeIngredient(ingredientId) {
    if (!confirm('Are you sure you want to remove this ingredient from the recipe?')) {
        return;
    }

    const menuItemId = currentMenuItemIdForRecipe;
    try {
        const response = await fetch(`/api/admin/menu/${menuItemId}/ingredients/${ingredientId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete ingredient from recipe');
        }

        fetchIngredientsForMenuItem(menuItemId); // Re-fetch and render recipe
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        alert(`Error deleting ingredient: ${error.message}`);
    }
}


/* ===========================
   4. Menu Item CRUD Operations
   =========================== */

// Open modal for adding new item
addNewMenuItemBtn.addEventListener('click', () => {
    menuItemModalLabel.textContent = 'Add New Menu Item';
    menuItemForm.reset(); // Clear menu item form
    menuItemIdInput.value = ''; // Clear ID for new item
    currentMenuItemIdForRecipe = null; // No menu item ID for recipe yet
    currentMenuItemNameSpan.textContent = '';
    recipeIngredientsSection.style.display = 'none'; // Hide recipe section for new item
    
    // Clear ingredient form as well
    ingredientForm.reset();
    recipeIngredientIdInput.value = '';
    addUpdateIngredientBtn.textContent = 'Add';

    menuItemModal.show();
});

// Open modal for editing existing item
function openEditModal(id, name) {
    const item = menuItems.find(i => i.id === id);
    if (item) {
        menuItemModalLabel.textContent = `Edit Menu Item: ${item.name}`;
        menuItemIdInput.value = item.id;
        itemNameInput.value = item.name;
        itemPriceInput.value = parseFloat(item.price).toFixed(2);

        currentMenuItemIdForRecipe = item.id; // Set for recipe management
        currentMenuItemNameSpan.textContent = item.name;
        recipeIngredientsSection.style.display = 'block'; // Show recipe section

        fetchIngredientsForMenuItem(item.id); // Load existing ingredients
        fetchInventoryList(); // Ensure inventory list is up-to-date for dropdown
        
        // Clear ingredient form for new additions
        ingredientForm.reset();
        recipeIngredientIdInput.value = '';
        addUpdateIngredientBtn.textContent = 'Add';

        menuItemModal.show();
    }
}

// Handle form submission (Add/Edit Menu Item Details)
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save menu item');
        }

        const result = await response.json();
        
        // If it was a new item, update the modal to reflect its ID and enable recipe management
        if (!id) {
            menuItemIdInput.value = result.id;
            currentMenuItemIdForRecipe = result.id;
            currentMenuItemNameSpan.textContent = name;
            recipeIngredientsSection.style.display = 'block';
            menuItemModalLabel.textContent = `Edit Menu Item: ${name}`; // Change title
            alert('Menu item saved! You can now add ingredients.');
        } else {
            alert('Menu item details updated!');
        }
        fetchMenuItems(); // Re-fetch and render main menu table
        // Do NOT hide modal immediately for new items, let user add ingredients
        if (id) { // Only hide if editing existing item
             menuItemModal.hide();
        }

    } catch (error) {
        console.error('Error saving menu item:', error);
        alert('Failed to save menu item: ' + error.message);
    }
});


// Delete menu item
async function deleteMenuItem(id) {
    if (!confirm('Are you sure you want to delete this menu item? This will also remove all associated recipe ingredients.')) {
        return;
    }
    try {
        const response = await fetch(`/api/admin/menu/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete menu item');
        }

        fetchMenuItems(); // Re-fetch and render
    } catch (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item: ' + error.message);
    }
}


/* ===========================
   5. Initialization & Socket.IO
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
    const userStr = localStorage.getItem('user');
    const userDisplayElement = document.getElementById('sidebar-user-display');
    if (userStr && userDisplayElement) {
        const user = JSON.parse(userStr);
        userDisplayElement.textContent = `Welcome, ${user.username}!`;
    }


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
    fetchInventoryList(); // Also fetch inventory for recipe dropdown

    // Socket.IO for real-time menu updates (e.g., if another admin updates menu)
    socket.on('menuUpdated', () => {
        console.log('🔄 Received menuUpdated event. Re-fetching menu...');
        fetchMenuItems();
    });

    // MODIFIED: Listen for inventory updates from the server
    socket.on('inventoryUpdated', () => {
        console.log('🔄 Received inventoryUpdated event. Re-fetching inventory list for recipes...');
        fetchInventoryList(); // Refresh inventory dropdown
        // If the menu item modal is open, re-fetch ingredients too in case a required ingredient was deleted/modified
        if (menuItemModal._isShown && currentMenuItemIdForRecipe) {
             fetchIngredientsForMenuItem(currentMenuItemIdForRecipe);
        }
    });

    // Handle modal close to ensure state is reset or refreshed
    menuItemModal._element.addEventListener('hidden.bs.modal', () => {
        currentMenuItemIdForRecipe = null;
        recipeIngredientsSection.style.display = 'none'; // Hide recipe section
        currentMenuItemNameSpan.textContent = '';
        menuItemForm.reset();
        ingredientForm.reset();
        recipeIngredientIdInput.value = '';
        addUpdateIngredientBtn.textContent = 'Add';
    });
});