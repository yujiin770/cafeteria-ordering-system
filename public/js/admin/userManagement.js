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

let users = []; // Store users locally

// DOM Elements
const usersTableBody = document.getElementById('usersTableBody');
const noUsersMessage = document.getElementById('noUsersMessage');
const userModal = new bootstrap.Modal(document.getElementById('userModal'));
const userModalLabel = document.getElementById('userModalLabel');
const userForm = document.getElementById('userForm');
const userIdInput = document.getElementById('userId');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const roleInput = document.getElementById('role');
const addNewUserBtn = document.getElementById('addNewUserBtn');
const saveUserBtn = document.getElementById('saveUserBtn');

/* ===========================
   1. Fetch & Render Users
   =========================== */
async function fetchUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        users = await response.json();
        renderUsers();
    } catch (error) {
        console.error('Error fetching users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger p-4">
                                            Failed to load users.
                                        </td></tr>`;
    }
}

function renderUsers() {
    usersTableBody.innerHTML = ''; // Clear existing rows

    if (users.length === 0) {
        noUsersMessage.style.display = 'block';
        return;
    } else {
        noUsersMessage.style.display = 'none';
    }

    users.forEach(user => {
        const row = usersTableBody.insertRow();
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>
                <button class="btn btn-sm btn-info edit-user-btn me-2" data-id="${user.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger delete-user-btn" data-id="${user.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
    });

    // Attach event listeners to new buttons
    document.querySelectorAll('.edit-user-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditModal(parseInt(e.currentTarget.dataset.id)));
    });
    document.querySelectorAll('.delete-user-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteUser(parseInt(e.currentTarget.dataset.id)));
    });
}

/* ===========================
   2. CRUD Operations
   =========================== */

// Open modal for adding new user
addNewUserBtn.addEventListener('click', () => {
    userModalLabel.textContent = 'Add New User';
    userForm.reset();
    userIdInput.value = ''; // Clear ID for new user
    passwordInput.required = true; // Password is required for new users
    userModal.show();
});

// Open modal for editing existing user
function openEditModal(id) {
    const user = users.find(u => u.id === id);
    if (user) {
        userModalLabel.textContent = `Edit User: ${user.username}`;
        userIdInput.value = user.id;
        usernameInput.value = user.username;
        roleInput.value = user.role;
        passwordInput.value = ''; // Clear password field for security
        passwordInput.required = false; // Password is not required for edit if not changing
        userModal.show();
    }
}

// Handle form submission (Add/Edit)
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = userIdInput.value;
    const username = usernameInput.value;
    const password = passwordInput.value; // Only send if not empty for edit
    const role = roleInput.value;

    const userData = { username, role };
    if (password) { // Only add password if provided (for new user or if changed for existing)
        userData.password = password;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/users/${id}` : '/api/admin/users';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorData = await response.json(); // Read error message from server
            throw new Error(errorData.error || 'Failed to save user');
        }

        userModal.hide();
        fetchUsers(); // Re-fetch and render
    } catch (error) {
        console.error('Error saving user:', error);
        alert('Failed to save user: ' + error.message);
    }
});

// Delete user
async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    try {
        const response = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json(); // Read error message from server
            throw new Error(errorData.error || 'Failed to delete user');
        }

        fetchUsers(); // Re-fetch and render
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
    }
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
   3. Initialization
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

    // Fetch and render users on page load
    fetchUsers();
});