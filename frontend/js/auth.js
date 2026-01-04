const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('error-msg');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    errorMsg.style.display = 'none';

    try {
        const response = await fetch('http://127.0.0.1:5000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('full_name', data.full_name);
            localStorage.setItem('location', data.location);

            if (data.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (data.role === 'manager') {
                window.location.href = 'manager.html';
            } else {
                window.location.href = 'employee.html'; 
            }
        } else {
            errorMsg.textContent = data.msg || 'Login failed';
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMsg.textContent = 'Server error';
        errorMsg.style.display = 'block';
    }
});