// Check for token immediately
const token = localStorage.getItem('token');
if (!token) window.location.href = 'auth.html';

document.getElementById('username-display').textContent = localStorage.getItem('username');
document.getElementById('role-display').textContent = localStorage.getItem('role');

// --- Navigation Logic ---
const mainContent = document.getElementById('main-content');
const usersLink = document.getElementById('users-link');
const dashboardLink = document.getElementById('dashboard-link');

// 1. "Manage Users" Click Handler
usersLink.addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    usersLink.classList.add('active');

    // 1. Fetch Users
    try {
        const response = await fetch('http://127.0.0.1:5000/users/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 422) {
            localStorage.clear(); window.location.href = 'auth.html'; return;
        }

        const users = await response.json();

        let tableRows = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td><strong>${user.username}</strong></td>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${user.email}</td>
                <td><span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span></td>
            </tr>
        `).join('');

        // 2. Inject HTML with the NEW BUTTON
        mainContent.innerHTML = `
            <header class="header-flex">
                <h1>User Management</h1>
                <button id="openModalBtn" class="add-btn">+ Add User</button>
            </header>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>ID</th><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th></tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;

        // 3. Attach Event Listeners for the Modal
        const modal = document.getElementById('userModal');
        const openBtn = document.getElementById('openModalBtn');
        const closeBtn = document.getElementById('closeModal');
        const form = document.getElementById('addUserForm');

        // Open Modal
        openBtn.addEventListener('click', () => modal.style.display = 'block');
        
        // Close Modal
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        // 4. Handle Form Submission (Create User)
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const newUser = {
                username: document.getElementById('new_username').value,
                password: document.getElementById('new_password').value,
                first_name: document.getElementById('new_firstname').value,
                last_name: document.getElementById('new_lastname').value,
                email: document.getElementById('new_email').value,
                role: document.getElementById('new_role').value
            };

            const res = await fetch('http://127.0.0.1:5000/users/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newUser)
            });

            if (res.ok) {
                alert('User created!');
                modal.style.display = 'none';
                form.reset();
                usersLink.click(); // Reload the list
            } else {
                const err = await res.json();
                alert('Error: ' + err.msg);
            }
        };

    } catch (error) {
        console.error('Error:', error);
        mainContent.innerHTML = '<p class="error">Failed to load users.</p>';
    }
});

// 2. "Dashboard" Click Handler (To go back)
dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    location.reload(); // Simple way to reset to dashboard view
});

// Logout Logic
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'auth.html';
});