const token = localStorage.getItem('token');
if (!token) window.location.href = 'auth.html';

document.getElementById('username-display').textContent = localStorage.getItem('username');
document.getElementById('role-display').textContent = localStorage.getItem('role');

const mainContent = document.getElementById('main-content');
const usersLink = document.getElementById('users-link');
const dashboardLink = document.getElementById('dashboard-link');

usersLink.addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    usersLink.classList.add('active');

    try {
        const [usersRes, warehousesRes] = await Promise.all([
            fetch('http://127.0.0.1:5000/users/', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:5000/warehouses/', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (usersRes.status === 401 || usersRes.status === 422) {
            localStorage.clear(); window.location.href = 'auth.html'; return;
        }

        const users = await usersRes.json();
        const warehouses = await warehousesRes.json();

        const warehouseOptions = warehouses.map(w => 
            `<option value="${w.bind_key}">${w.name}</option>`
        ).join('');

        let tableRows = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td><strong>${user.username}</strong></td>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${user.email}</td>
                <td><span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span></td>
                <td>${user.warehouse}</td>
                
                <td style="text-align: center;">
                    <button class="delete-btn" onclick="deleteUser(${user.id}, '${user.bind_key}')">
                        &times;
                    </button>
                </td>
            </tr>
        `).join('');

        mainContent.innerHTML = `
            <header class="header-flex">
                <h1>User Management</h1>
                <button id="openModalBtn" class="add-btn">+ Add User</button>
            </header>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Full Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Location</th>
                            <th>Action</th> </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>

            <div id="userModal" class="modal">
                <div class="modal-content">
                    <span id="closeModal" class="close">&times;</span>
                    <h2>Add New User</h2>
                    <form id="addUserForm">
                        <label>Username</label>
                        <input type="text" id="new_username" required>
                        
                        <label>Password</label>
                        <input type="password" id="new_password" required>
                        
                        <div class="form-row">
                            <div>
                                <label>First Name</label>
                                <input type="text" id="new_firstname">
                            </div>
                            <div>
                                <label>Last Name</label>
                                <input type="text" id="new_lastname">
                            </div>
                        </div>

                        <label>Email</label>
                        <input type="email" id="new_email">

                        <div class="form-row">
                            <div>
                                <label>Role</label>
                                <select id="new_role">
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label>Warehouse</label>
                                <select id="new_warehouse">
                                    <option value="">Headquarters (Main)</option>
                                    ${warehouseOptions}
                                </select>
                            </div>
                        </div>

                        <button type="submit" class="submit-btn">Create User</button>
                    </form>
                </div>
            </div>
        `;

        const modal = document.getElementById('userModal');
        const openBtn = document.getElementById('openModalBtn');
        const closeBtn = document.getElementById('closeModal');
        const form = document.getElementById('addUserForm');

        openBtn.addEventListener('click', () => modal.style.display = 'flex');
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const wKey = document.getElementById('new_warehouse').value;

            const newUser = {
                username: document.getElementById('new_username').value,
                password: document.getElementById('new_password').value,
                first_name: document.getElementById('new_firstname').value,
                last_name: document.getElementById('new_lastname').value,
                email: document.getElementById('new_email').value,
                role: document.getElementById('new_role').value,
                warehouse_bind_key: wKey === "" ? null : wKey
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
                alert('User created successfully!');
                modal.style.display = 'none';
                form.reset();
                usersLink.click();
            } else {
                const err = await res.json();
                alert('Error: ' + err.msg);
            }
        };

    } catch (error) {
        console.error('Error:', error);
        mainContent.innerHTML = '<p class="error">Failed to load data.</p>';
    }
});

dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    location.reload();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'auth.html';
});

window.deleteUser = async function(userId, bindKey) {
    if (!confirm("Are you sure you want to delete this user?")) {
        return;
    }

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`http://127.0.0.1:5000/users/${userId}?warehouse_bind_key=${bindKey}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            document.getElementById('users-link').click();
        } else {
            const data = await response.json();
            alert("Error: " + data.msg);
        }
    } catch (error) {
        console.error("Delete failed", error);
        alert("Failed to delete user.");
    }
};