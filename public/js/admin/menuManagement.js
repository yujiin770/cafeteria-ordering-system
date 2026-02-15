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

const socket = io();

let menuItems = [];
let inventoryList = [];
let currentMenuItemIdForRecipe = null;

// DOM Elements - Menu Item Management
const menuItemsTableBody = document.getElementById('menuItemsTableBody');
const noMenuItemsMessage = document.getElementById('noMenuItemsMessage');
const menuItemModal = new bootstrap.Modal(document.getElementById('menuItemModal'));
const menuItemModalLabel = document.getElementById('menuItemModalLabel');
const menuItemForm = document.getElementById('menuItemForm');
const menuItemIdInput = document.getElementById('menuItemId');
const itemNameInput = document.getElementById('itemName');
const itemPriceInput = document.getElementById('itemPrice');

// NEW: Image upload related DOM elements
const itemImageFileInput = document.getElementById('itemImageFile');
const imagePreview = document.getElementById('imagePreview');
const existingImageUrlInput = document.getElementById('existingImageUrl');
const clearImageCheckbox = document.getElementById('clearImageCheckbox');
const clearImageContainer = document.getElementById('clearImageContainer');


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
   1. Image Preview Logic
   =========================== */
itemImageFileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.style.backgroundImage = `url(${e.target.result})`;
            imagePreview.innerHTML = ''; // Clear "No Image" text
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.style.backgroundImage = 'none';
        imagePreview.innerHTML = '<span class="text-muted">No Image</span>';
    }
    // If a new image is selected, disable "Clear existing image" checkbox
    clearImageCheckbox.checked = false;
    clearImageCheckbox.disabled = !!file; // Disable if a file is chosen
});

clearImageCheckbox.addEventListener('change', function() {
    if (this.checked) {
        itemImageFileInput.value = ''; // Clear file input
        imagePreview.style.backgroundImage = 'none';
        imagePreview.innerHTML = '<span class="text-muted">No Image</span>';
    } else {
        // If unchecking, and there was an existing image, show it
        if (existingImageUrlInput.value) {
            imagePreview.style.backgroundImage = `url(${existingImageUrlInput.value})`;
            imagePreview.innerHTML = '';
        }
    }
});


/* ===========================
   2. Fetch & Render Menu Items
   =========================== */
async function fetchMenuItems() {
    try {
        const response = await fetch('/api/admin/menu');
        if (!response.ok) throw new Error('Failed to fetch menu items');
        menuItems = await response.json();
        renderMenuItems();
    } catch (error) {
        console.error('Error fetching menu items:', error);
        menuItemsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-4">
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
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` : 'No Image'}
            </td>
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
   3. Fetch & Render Inventory for Recipe Dropdown
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
        option.textContent = `${item.item_name} (${item.unit})`;
        ingredientSelect.appendChild(option);
    });
}

/* ===========================
   4. Recipe Ingredients Management
   =========================== */

async function fetchIngredientsForMenuItem(menuItemId) {
    if (!menuItemId) {
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
        menuItemIngredientsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-3">Error loading ingredients.</td></tr>`;
    }
}

function renderIngredients(ingredients) {
    menuItemIngredientsTableBody.innerHTML = '';
    if (ingredients.length === 0) {
        noIngredientsMessage.style.display = 'block';
        menuItemIngredientsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-3">No ingredients found for this menu item.</td></tr>';
        return;
    } else {
        noIngredientsMessage.style.display = 'none';
    }

    ingredients.forEach(ingredient => {
        const row = menuItemIngredientsTableBody.insertRow();
        const displayCurrentStock = ingredient.current_stock !== undefined && ingredient.current_stock !== null ? ingredient.current_stock : 'N/A';
        const displayInventoryUnit = ingredient.inventory_unit !== undefined && ingredient.inventory_unit !== null ? ingredient.inventory_unit : '';
        
        const lowStockThreshold = ingredient.low_stock_threshold || 0;
        const lowStockStatus = (ingredient.current_stock !== undefined && ingredient.current_stock !== null && ingredient.current_stock <= lowStockThreshold && lowStockThreshold > 0)
                               ? '<span class="badge bg-danger ms-2">LOW STOCK!</span>' 
                               : '';

        row.innerHTML = `
            <td>${ingredient.item_name}</td>
            <td>${ingredient.quantity_needed}</td>
            <td>${ingredient.unit_needed}</td>
            <td>${displayCurrentStock} ${displayInventoryUnit} ${lowStockStatus}</td>
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
                e.currentTarget.dataset.unit
            );
        });
    });

    document.querySelectorAll('.delete-recipe-ingredient-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteRecipeIngredient(parseInt(e.currentTarget.dataset.id)));
    });
}

ingredientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipeIngredientId = recipeIngredientIdInput.value;
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
        recipeIngredientIdInput.value = '';
        addUpdateIngredientBtn.textContent = 'Add';
        fetchIngredientsForMenuItem(menuItemId);
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

        fetchIngredientsForMenuItem(menuItemId);
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        alert(`Error deleting ingredient: ${error.message}`);
    }
}


/* ===========================
   5. Menu Item CRUD Operations
   =========================== */

// Open modal for adding new item
addNewMenuItemBtn.addEventListener('click', () => {
    menuItemModalLabel.textContent = 'Add New Menu Item';
    menuItemForm.reset();
    menuItemIdInput.value = '';
    existingImageUrlInput.value = ''; // Clear existing image URL
    itemImageFileInput.value = ''; // Clear file input
    imagePreview.style.backgroundImage = 'none'; // Clear image preview
    imagePreview.innerHTML = '<span class="text-muted">No Image</span>'; // Reset text
    clearImageCheckbox.checked = false; // Uncheck clear image
    clearImageCheckbox.disabled = true; // Disable until an image is loaded
    clearImageContainer.style.display = 'none'; // Hide clear image option

    currentMenuItemIdForRecipe = null;
    currentMenuItemNameSpan.textContent = '';
    recipeIngredientsSection.style.display = 'none';
    
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
        existingImageUrlInput.value = item.image_url || ''; // Store existing image URL

        // Display existing image or placeholder
        if (item.image_url) {
            imagePreview.style.backgroundImage = `url(${item.image_url})`;
            imagePreview.innerHTML = '';
            clearImageContainer.style.display = 'block'; // Show clear option
            clearImageCheckbox.disabled = false; // Enable clear checkbox
        } else {
            imagePreview.style.backgroundImage = 'none';
            imagePreview.innerHTML = '<span class="text-muted">No Image</span>';
            clearImageContainer.style.display = 'none'; // Hide clear option
            clearImageCheckbox.disabled = true; // Disable clear checkbox
        }
        itemImageFileInput.value = ''; // Clear file input
        clearImageCheckbox.checked = false; // Ensure checkbox is unchecked on edit


        currentMenuItemIdForRecipe = item.id;
        currentMenuItemNameSpan.textContent = item.name;
        recipeIngredientsSection.style.display = 'block';

        fetchIngredientsForMenuItem(item.id);
        fetchInventoryList();
        
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
    const imageFile = itemImageFileInput.files[0];
    const clearImage = clearImageCheckbox.checked;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('existing_image_url', existingImageUrlInput.value); // Always send existing URL

    if (imageFile) {
        formData.append('image', imageFile);
    } else if (clearImage) {
        formData.append('clear_image', 'true');
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';

    try {
        const response = await fetch(url, {
            method: method,
            // DO NOT set 'Content-Type' header with FormData; the browser sets it automatically
            body: formData 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save menu item');
        }

        const result = await response.json();
        
        if (!id) {
            menuItemIdInput.value = result.id;
            currentMenuItemIdForRecipe = result.id;
            currentMenuItemNameSpan.textContent = name;
            recipeIngredientsSection.style.display = 'block';
            menuItemModalLabel.textContent = `Edit Menu Item: ${name}`;
            alert('Menu item saved! You can now add ingredients.');
        } else {
            alert('Menu item details updated!');
        }
        fetchMenuItems();
        if (id) {
             menuItemModal.hide();
        }

    } catch (error) {
        console.error('Error saving menu item:', error);
        alert('Failed to save menu item: ' + error.message);
    }
});


// Delete menu item
async function deleteMenuItem(id) {
    if (!confirm('Are you sure you want to delete this menu item? This will also remove all associated recipe ingredients and its image.')) {
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

        fetchMenuItems();
    } catch (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item: ' + error.message);
    }
}


/* ===========================
   6. Initialization & Socket.IO
   =========================== */
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

    // Fetch and render menu items on page load
    fetchMenuItems();
    fetchInventoryList();

    socket.on('menuUpdated', () => {
        console.log('🔄 Received menuUpdated event. Re-fetching menu...');
        fetchMenuItems();
    });

    socket.on('inventoryUpdated', () => {
        console.log('🔄 Received inventoryUpdated event. Re-fetching inventory list for recipes...');
        fetchInventoryList();
        if (menuItemModal._isShown && currentMenuItemIdForRecipe) {
             fetchIngredientsForMenuItem(currentMenuItemIdForRecipe);
        }
    });

    // Handle modal close to ensure state is reset or refreshed
    menuItemModal._element.addEventListener('hidden.bs.modal', () => {
        currentMenuItemIdForRecipe = null;
        recipeIngredientsSection.style.display = 'none';
        currentMenuItemNameSpan.textContent = '';
        menuItemForm.reset();
        ingredientForm.reset();
        recipeIngredientIdInput.value = '';
        addUpdateIngredientBtn.textContent = 'Add';

        // Also reset image specific inputs
        existingImageUrlInput.value = '';
        itemImageFileInput.value = '';
        imagePreview.style.backgroundImage = 'none';
        imagePreview.innerHTML = '<span class="text-muted">No Image</span>';
        clearImageCheckbox.checked = false;
        clearImageCheckbox.disabled = true;
        clearImageContainer.style.display = 'none';
    });
});