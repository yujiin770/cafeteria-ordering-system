// Clear any previous session immediately
localStorage.removeItem('user');

document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    // Get Elements
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const errorDisplay = document.getElementById('error-display');

    // Basic Validation
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    // UI Loading State
    loginBtn.disabled = true;
    if(btnText) btnText.style.display = 'none';
    if(btnLoader) btnLoader.style.display = 'inline-block';
    if(errorDisplay) errorDisplay.style.display = 'none';

    try {
        console.log('Attempting login for:', username);

        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Login Success:', result.user.role);
            
            // Store user session
            localStorage.setItem('user', JSON.stringify(result.user));
            
            // Redirect Logic
            let redirectPath = '';
            if (result.user.role === 'admin') {
                redirectPath = '/views/admin/dashboard.html';
            } else if (result.user.role === 'cashier') {
                redirectPath = '/views/cashier/dashboard.html';
            } else if (result.user.role === 'kitchen') {
                redirectPath = '/views/kitchen/dashboard.html';
            } else {
                alert('Unknown role: ' + result.user.role);
                location.reload();
                return;
            }
            
            // Go to dashboard
            window.location.href = redirectPath;

        } else {
            // Login Failed (Wrong password/username)
            if(errorDisplay) {
                errorDisplay.style.display = 'block';
                errorDisplay.innerText = result.message || 'Invalid credentials';
            } else {
                alert(result.message || 'Invalid credentials');
            }
            
            // Reset Button
            loginBtn.disabled = false;
            if(btnText) btnText.style.display = 'inline-block';
            if(btnLoader) btnLoader.style.display = 'none';
        }

    } catch(err) {
        console.error('Login error:', err);
        if(errorDisplay) {
            errorDisplay.style.display = 'block';
            errorDisplay.innerText = 'Server connection error. Is the server running?';
        } else {
            alert('Server error.');
        }
        
        // Reset Button
        loginBtn.disabled = false;
        if(btnText) btnText.style.display = 'inline-block';
        if(btnLoader) btnLoader.style.display = 'none';
    }
});