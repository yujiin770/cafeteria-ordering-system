document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting the traditional way

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // FOR NOW: We will not do real authentication yet.
    // We will simulate a successful admin login.
    // In a real application, you would send this to the server.
    if (username === 'admin' && password === 'password') {
        alert('Admin login successful!');
        // Redirect to the admin dashboard
        window.location.href = '/views/admin/dashboard.html';
    } else {
        alert('Invalid credentials. Please try again.');
    }
});