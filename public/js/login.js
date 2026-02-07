document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Logging in...';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('user', JSON.stringify(result.user));
            console.log(`✅ Login success: ${result.user.role}`);
            
            // Redirect based on role
            const rolePath = result.user.role === 'admin' ? 'admin' : 
                           result.user.role === 'cashier' ? 'cashier' : 'kitchen';
            
            window.location.href = `/views/${rolePath}/dashboard.html`;
        } else {
            alert(result.message || 'Login failed!');
        }
    } catch(err) {
        console.error('Login error:', err);
        alert('Server error. Is XAMPP running?');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Login';
    }
});
