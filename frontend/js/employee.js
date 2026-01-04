const token = localStorage.getItem('token');
const userLocation = localStorage.getItem('location');


if (!token) window.location.href = 'auth.html';

document.getElementById('username-display').textContent = localStorage.getItem('full_name') || localStorage.getItem('username');
document.getElementById('location-display').textContent = (userLocation === 'main') ? "Headquarters" : userLocation.toUpperCase();

const mainContent = document.getElementById('main-content');
const tasksLink = document.getElementById('tasks-link');
const inventoryLink = document.getElementById('inventory-link');
const dashboardLink = document.getElementById('dashboard-link');

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'auth.html';
});

dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    location.reload();
});


tasksLink.addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    tasksLink.classList.add('active');

    try {
        const response = await fetch('http://127.0.0.1:5000/transfers/tasks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.error("Server Error:", response.status);
            mainContent.innerHTML = `<p class="error">Error loading tasks (Status: ${response.status})</p>`;
            return;
        }

        const tasks = await response.json();

        const taskRows = tasks.map(t => {
            let actionBtn = '';
            let rowClass = '';
            const statusBadge = `<span class="badge status-${t.status.toLowerCase()}">${t.status}</span>`;

            if (t.my_role === 'sender' && t.status === 'APPROVED') {
                actionBtn = `<button class="add-btn" style="background-color: #f39c12; border: none;" onclick="processTransfer(${t.id}, 'send')">Ship Items</button>`;
                rowClass = 'style="background-color: #fff8e1"'; 
            }
            else if (t.my_role === 'receiver' && t.status === 'IN_TRANSIT') {
                actionBtn = `<button class="add-btn" style="background-color: #27ae60; border: none;" onclick="processTransfer(${t.id}, 'receive')">Confirm Receipt</button>`;
                rowClass = 'style="background-color: #e8f8f5"'; 
            }
            else {
                actionBtn = statusBadge;
            }

            const description = t.my_role === 'sender' 
                ? `Send to <strong>${t.destination.toUpperCase()}</strong>`
                : `Receive from <strong>${t.source.toUpperCase()}</strong>`;

            const noteHtml = t.note ? `<br><small style="color: #666; font-style: italic;">Note: ${t.note}</small>` : '';

            return `
                <tr ${rowClass}>
                    <td>${t.id}</td>
                    <td><strong>${t.product_name}</strong> (x${t.quantity})</td>
                    <td>${description} ${noteHtml}</td>
                    <td style="text-align: center;">${actionBtn}</td>
                </tr>
            `;
        }).join('');

        mainContent.innerHTML = `
            <header>
                <h1>My Transfer Tasks</h1>
            </header>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Item</th>
                            <th>Task Description</th>
                            <th>Action / Status</th>
                        </tr>
                    </thead>
                    <tbody>${taskRows.length ? taskRows : '<tr><td colspan="4">No active tasks found.</td></tr>'}</tbody>
                </table>
            </div>
        `;

    } catch (error) {
        console.error(error);
        mainContent.innerHTML = '<p class="error">Failed to load tasks.</p>';
    }
});

if (inventoryLink) {
    inventoryLink.addEventListener('click', async (e) => {
        e.preventDefault();
        document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
        inventoryLink.classList.add('active');

        try {
            const res = await fetch(`http://127.0.0.1:5000/inventory/local?location=${userLocation}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to load inventory");

            const stock = await res.json();

            const rows = stock.map(item => {
                const qtyStyle = item.quantity < 5 ? 'color: #e74c3c; font-weight: bold;' : '';
                const qtyBadge = item.quantity < 5 ? 'Low' : 'In Stock';

                return `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.category}</td>
                        <td style="${qtyStyle}">${item.quantity}</td>
                        <td><span class="badge" style="background:#eee; color:#333">${qtyBadge}</span></td>
                    </tr>
                `;
            }).join('');

            mainContent.innerHTML = `
                <header>
                    <h1>${userLocation.toUpperCase()} Inventory</h1>
                    <p>Current stock levels at this facility.</p>
                </header>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Category</th>
                                <th>Quantity</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length ? rows : '<tr><td colspan="4">Warehouse is empty.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error(error);
            mainContent.innerHTML = `<p class="error">Error loading inventory data.</p>`;
        }
    });
}

window.processTransfer = async function(id, action) {
    const confirmMsg = action === 'send' 
        ? "Confirm shipment? This will deduct stock from your warehouse." 
        : "Confirm receipt? This will add stock to your warehouse.";

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`http://127.0.0.1:5000/transfers/${id}/process`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ action: action })
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.msg);
            document.getElementById('tasks-link').click(); 
        } else {
            const err = await res.json();
            alert("Error: " + err.msg);
        }
    } catch (e) {
        console.error(e);
        alert("Action failed.");
    }
};