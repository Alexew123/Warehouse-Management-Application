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

const inventoryLink = document.getElementById('inventory-link');

inventoryLink.addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    inventoryLink.classList.add('active');

    const token = localStorage.getItem('token');

    try {

        const [globalRes, productsRes, warehousesRes] = await Promise.all([
            fetch('http://127.0.0.1:5000/inventory/global', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:5000/inventory/products', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:5000/warehouses/', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const inventory = await globalRes.json();
        const products = await productsRes.json();
        const warehouses = await warehousesRes.json();

        const productOptions = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        const warehouseOptions = warehouses.map(w => `<option value="${w.bind_key}">${w.name}</option>`).join('');
    
        const allLocationsOptions = `<option value="">Headquarters (Main)</option>` + warehouseOptions;

        const tableRows = inventory.map(item => {
            const distribution = item.breakdown.map(b => 
                `<span class="badge">${b.location}: ${b.quantity}</span>`
            ).join(' ');
            
            return `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category}</td>
                    <td>${item.price} RON</td>
                    <td style="font-size: 1.1em; font-weight: bold;">${item.total_quantity}</td>
                    <td>${distribution || '<span style="color:#aaa">Out of Stock</span>'}</td>
                </tr>`;
        }).join('');

        mainContent.innerHTML = `
            <header class="header-flex">
                <h1>Inventory Management</h1>
                <div style="display: flex; gap: 10px;">
                    <button id="openProductModal" class="add-btn" style="background-color: #2ecc71;">+ New Product</button>
                    <button id="openStockModal" class="add-btn">+ Add Stock</button>
                </div>
            </header>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Global Total</th>
                            <th>Distribution</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>

            <div id="productModal" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeProduct">&times;</span>
                    <h2>Create New Product</h2>
                    <form id="createProductForm">
                        <label>Product Name</label>
                        <input type="text" id="prod_name" required placeholder="">
                        
                        <div class="form-row">
                            <div>
                                <label>Category</label>
                                <input type="text" id="prod_cat" required placeholder="e.g. Electronics">
                            </div>
                            <div>
                                <label>Price (RON)</label>
                                <input type="number" id="prod_price" required step="0.01">
                            </div>
                        </div>
                        <button type="submit" class="submit-btn">Create Product</button>
                    </form>
                </div>
            </div>

            <div id="stockModal" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeStock">&times;</span>
                    <h2>Add Stock to Warehouse</h2>
                    <form id="addStockForm">
                        <label>Select Product</label>
                        <select id="stock_prod_id" required>
                            <option value="">-- Choose Product --</option>
                            ${productOptions}
                        </select>

                        <div class="form-row">
                            <div>
                                <label>Warehouse</label>
                                <select id="stock_bind_key">
                                    ${allLocationsOptions}
                                </select>
                            </div>
                            <div>
                                <label>Quantity</label>
                                <input type="number" id="stock_qty" required min="1" value="1">
                            </div>
                        </div>
                        <button type="submit" class="submit-btn">Update Stock</button>
                    </form>
                </div>
            </div>
        `;

        setupModal('productModal', 'openProductModal', 'closeProduct');
        setupModal('stockModal', 'openStockModal', 'closeStock');

        document.getElementById('createProductForm').onsubmit = async (e) => {
            e.preventDefault();
            await postData('http://127.0.0.1:5000/inventory/products', {
                name: document.getElementById('prod_name').value,
                category: document.getElementById('prod_cat').value,
                price: parseFloat(document.getElementById('prod_price').value)
            }, token);
        };

        document.getElementById('addStockForm').onsubmit = async (e) => {
            e.preventDefault();
            const wKey = document.getElementById('stock_bind_key').value;
            await postData('http://127.0.0.1:5000/inventory/stock', {
                product_id: document.getElementById('stock_prod_id').value,
                warehouse_bind_key: wKey === "" ? null : wKey,
                quantity: document.getElementById('stock_qty').value
            }, token);
        };

    } catch (error) {
        console.error(error);
        mainContent.innerHTML = '<p class="error">Failed to load inventory.</p>';
    }
});

function setupModal(modalId, openBtnId, closeBtnId) {
    const modal = document.getElementById(modalId);
    document.getElementById(openBtnId).onclick = () => modal.style.display = "flex";
    document.getElementById(closeBtnId).onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}

async function postData(url, data, token) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert("Success!");
            document.getElementById('inventory-link').click(); // Reload page
        } else {
            const err = await res.json();
            alert("Error: " + err.msg);
        }
    } catch (e) { console.error(e); alert("Request failed"); }
}