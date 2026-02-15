const socket = io();
let menu = []; 
let currentOrder = []; 

// Wait for HTML to load before running logic
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const menuItemsContainer = document.getElementById('menu-items-container');
    const orderItemsList = document.getElementById('order-items-list');
    const orderTotalSpan = document.getElementById('order-total');
    const itemCountBadge = document.getElementById('item-count');
    const emptyState = document.getElementById('empty-state');
    const menuSearch = document.getElementById('menuSearch');

    // Buttons
    const prePlaceOrderBtn = document.getElementById('pre-place-order-btn');
    const confirmPlaceOrderBtn = document.getElementById('confirm-place-order-btn');
    const clearOrderBtn = document.getElementById('clear-order-btn');

    // Modals & Toast
    const confirmationModalElement = document.getElementById('confirmationModal');
    const receiptModalElement = document.getElementById('receiptModal');
    
    // Check if modals exist before creating Bootstrap instances to prevent other errors
    const confirmationModal = confirmationModalElement ? new bootstrap.Modal(confirmationModalElement) : null;
    const receiptModal = receiptModalElement ? new bootstrap.Modal(receiptModalElement) : null;
    
    const toastEl = document.getElementById('errorToast');
    const toastMsg = document.getElementById('toast-msg');
    const bsToast = toastEl ? new bootstrap.Toast(toastEl) : null;

    // Specific Elements inside Modals
    const confirmModalTotal = document.getElementById('confirm-modal-total');
    const receiptContent = document.getElementById('receipt-content');
    const receiptOrderNumber = document.getElementById('receiptOrderNumber');

    // --- Initial Fetch ---
    fetchMenu();
    updateOrderDisplay();

    // --- Event Listeners (Safe Guarded) ---

    // 1. Search Filter
    if (menuSearch) {
        menuSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = menu.filter(item => item.name.toLowerCase().includes(term));
            renderMenu(filtered);
        });
    }

    // 2. Clear Order
    if (clearOrderBtn) {
        clearOrderBtn.addEventListener('click', () => {
            if(currentOrder.length > 0 && confirm("Clear current order?")) {
                currentOrder = [];
                updateOrderDisplay();
            }
        });
    }

    // 3. Trigger Confirmation Modal
    if (prePlaceOrderBtn) {
        prePlaceOrderBtn.addEventListener('click', () => {
            if (currentOrder.length === 0) {
                showToast("Order is empty!");
                return;
            }
            // Update text inside modal
            const total = document.getElementById('order-total').innerText;
            if(confirmModalTotal) confirmModalTotal.innerText = `₱${total}`;
            if(confirmationModal) confirmationModal.show();
        });
    }

    // 4. Final Submit
    if (confirmPlaceOrderBtn) {
        confirmPlaceOrderBtn.addEventListener('click', () => {
            // Re-calculate total from logic, not just UI text
            let total = 0;
            currentOrder.forEach(item => {
                total += (item.price * item.quantity);
            });
            
            const orderData = {
                items: currentOrder,
                total: total
            };

            // UI Feedback
            confirmPlaceOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            confirmPlaceOrderBtn.disabled = true;

            // Emit to Backend
            socket.emit('placeOrder', orderData);
        });
    }

    // --- Functions ---

    async function fetchMenu() {
        try {
            const response = await fetch('/api/menu');
            if (!response.ok) throw new Error('Failed to fetch');
            menu = await response.json();
            renderMenu(menu);
        } catch (error) {
            console.error(error);
            if(menuItemsContainer) menuItemsContainer.innerHTML = `<div class="col-12 text-center text-danger">Failed to load menu.</div>`;
        }
    }

    function renderMenu(items) {
        if (!menuItemsContainer) return;
        menuItemsContainer.innerHTML = '';
        
        if (items.length === 0) {
            menuItemsContainer.innerHTML = `<div class="col-12 text-center text-muted">No items found.</div>`;
            return;
        }

        items.forEach(item => {
            // Create Card HTML
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-4 col-xl-3';
            col.innerHTML = `
                <div class="menu-item-card h-100" data-id="${item.id}">
                    <div class="card-img-wrapper">
                        <img src="${item.image_url || '/images/default-food.jpg'}" class="card-img-top" alt="${item.name}">
                    </div>
                    <div class="p-3">
                        <h6 class="fw-bold mb-1 text-truncate">${item.name}</h6>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <span class="text-primary fw-bold">₱${parseFloat(item.price).toFixed(2)}</span>
                            <button class="btn btn-sm btn-light rounded-circle text-primary">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            // Add click event manually to the element
            col.querySelector('.menu-item-card').addEventListener('click', () => addToOrder(item.id));
            menuItemsContainer.appendChild(col);
        });
    }

    // Expose functions to global scope only if necessary, or keep them internal
    window.addToOrder = function(id) {
        const item = menu.find(i => i.id === id);
        if (!item) return;

        const existing = currentOrder.find(i => i.id === id);
        if (existing) {
            existing.quantity++;
        } else {
            currentOrder.push({ ...item, quantity: 1 });
        }
        updateOrderDisplay();
    };

    window.removeFromOrder = function(id) {
        const index = currentOrder.findIndex(i => i.id === id);
        if (index > -1) {
            if (currentOrder[index].quantity > 1) {
                currentOrder[index].quantity--;
            } else {
                currentOrder.splice(index, 1);
            }
        }
        updateOrderDisplay();
    };

    function updateOrderDisplay() {
        if (!orderItemsList) return;
        
        orderItemsList.innerHTML = '';
        let total = 0;
        let count = 0;

        if (currentOrder.length === 0) {
            if(emptyState) emptyState.style.display = 'flex';
            if(prePlaceOrderBtn) prePlaceOrderBtn.disabled = true;
        } else {
            if(emptyState) emptyState.style.display = 'none';
            if(prePlaceOrderBtn) prePlaceOrderBtn.disabled = false;

            currentOrder.forEach(item => {
                const lineTotal = item.price * item.quantity;
                total += lineTotal;
                count += item.quantity;

                const div = document.createElement('div');
                div.className = 'order-item';
                div.id = `order-item-${item.id}`;
                div.innerHTML = `
                    <div class="d-flex flex-column" style="width: 50%;">
                        <span class="fw-bold text-truncate">${item.name}</span>
                        <small class="text-muted">₱${parseFloat(item.price).toFixed(2)} each</small>
                    </div>
                    <div class="fw-bold text-dark" style="width: 20%;">₱${lineTotal.toFixed(2)}</div>
                    <div class="order-qty-controls bg-white border rounded-pill p-1 d-flex align-items-center">
                        <button class="btn btn-xs btn-light text-danger remove-btn"><i class="fas fa-minus"></i></button>
                        <span class="mx-2 fw-bold" style="font-size: 0.9rem; min-width: 15px; text-align: center;">${item.quantity}</span>
                        <button class="btn btn-xs btn-light text-success add-btn"><i class="fas fa-plus"></i></button>
                    </div>
                `;
                
                // Add listeners
                div.querySelector('.remove-btn').addEventListener('click', () => window.removeFromOrder(item.id));
                div.querySelector('.add-btn').addEventListener('click', () => window.addToOrder(item.id));
                
                orderItemsList.appendChild(div);
            });
        }

        if(orderTotalSpan) orderTotalSpan.innerText = total.toFixed(2);
        if(itemCountBadge) itemCountBadge.innerText = count;
    }

    function showToast(message, bgClass = 'bg-danger') {
        if (!bsToast) return;
        if(toastMsg) toastMsg.innerText = message;
        if(toastEl) toastEl.className = `toast align-items-center text-white border-0 shadow ${bgClass}`;
        bsToast.show();
    }

    // --- Socket Events (Inside DOMContentLoaded to access vars) ---
    
    socket.on('menuUpdated', () => {
        showToast('Menu updated by Admin', 'bg-info');
        fetchMenu();
    });

    socket.on('orderPlaced', (data) => {
        if(confirmationModal) confirmationModal.hide();
        
        // Reset Button
        if(confirmPlaceOrderBtn) {
            confirmPlaceOrderBtn.innerHTML = 'Yes, Confirm!';
            confirmPlaceOrderBtn.disabled = false;
        }

        // Generate Receipt
        generateReceipt(data.orderNumber);
        
        // Clear Data
        currentOrder = [];
        updateOrderDisplay();
        
        // Show Success Modal
        if(receiptModal) receiptModal.show();
    });

    socket.on('orderError', (msg) => {
        if(confirmationModal) confirmationModal.hide();
        if(confirmPlaceOrderBtn) {
            confirmPlaceOrderBtn.innerHTML = 'Yes, Confirm!';
            confirmPlaceOrderBtn.disabled = false;
        }
        showToast(msg);
    });

    function generateReceipt(orderNum) {
        const date = new Date().toLocaleString();
        let html = `ORDER #: ${orderNum}\nDATE: ${date}\n--------------------------------\n`;
        
        // Using currentOrder logic before clearing it (or pass it from backend)
        // Note: In socket.on('orderPlaced'), we clear currentOrder AFTER calling this, 
        // but if backend data doesn't return items, we rely on current state.
        // Ideally backend sends items back. Assuming currentOrder is still valid here.
        
        // However, we just cleared it in previous lines? 
        // Wait, in socket.on above: generateReceipt -> then currentOrder = []. Correct.
        
        currentOrder.forEach(item => {
            const total = (item.price * item.quantity).toFixed(2);
            html += `${item.name} x${item.quantity}`.padEnd(20) + `₱${total}\n`;
        });
        
        html += `--------------------------------\n`;
        html += `TOTAL: ₱${document.getElementById('order-total').innerText}\n`;
        html += `\nTHANK YOU FOR DINING!`;
        
        if(receiptOrderNumber) receiptOrderNumber.innerText = orderNum;
        if(receiptContent) receiptContent.innerText = html;
    }

});