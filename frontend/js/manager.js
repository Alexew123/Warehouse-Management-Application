const token = localStorage.getItem('token');
const userLocation = localStorage.getItem('location');

if (!token) window.location.href = 'auth.html';

document.getElementById('username-display').textContent = localStorage.getItem('full_name');
document.getElementById('role-display').textContent = localStorage.getItem('role');
document.getElementById('location-display').textContent = (userLocation === 'main') ? "Headquarters" : userLocation.toUpperCase();

const mainContent = document.getElementById('main-content');
const inventoryLink = document.getElementById('inventory-link');
const transfersLink = document.getElementById('transfers-link');
const dashboardLink = document.getElementById('dashboard-link');


document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'auth.html';
});

dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    location.reload();
});

inventoryLink.addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    inventoryLink.classList.add('active');

    try {
        const [globalRes, productsRes] = await Promise.all([
            fetch('http://127.0.0.1:5000/inventory/global', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:5000/inventory/products', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const inventory = await globalRes.json();
        const products = await productsRes.json();
        const productOptions = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        const tableRows = inventory.map(item => {

            const distribution = item.breakdown.map(b => {
                const badgeColor = b.quantity < 5 ? '#e74c3c' : '#bdc3c7';
                const textColor = b.quantity < 5 ? 'white' : 'black';
                return `<span class="badge" style="background:${badgeColor}; color:${textColor}">${b.location}: ${b.quantity}</span>`;
            }).join(' ');
            
            return `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category}</td>
                    <td><span class="badge">${item.total_quantity} Global</span></td>
                    <td>${distribution}</td>
                </tr>`;
        }).join('');

        mainContent.innerHTML = `
            <header class="header-flex">
                <h1>Warehouse Inventory</h1>
                <button id="openStockModal" class="add-btn">+ Add Stock to ${userLocation.toUpperCase()}</button>
            </header>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Total Quantity</th>
                            <th>Distribution</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>

            <div id="stockModal" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeStock">&times;</span>
                    <h2>Receive Stock</h2>
                    <form id="addStockForm">
                        <label>Select Product</label>
                        <select id="stock_prod_id" required>
                            <option value="">-- Choose Product --</option>
                            ${productOptions}
                        </select>
                        <label>Quantity Received</label>
                        <input type="number" id="stock_qty" required min="1" value="1">
                        <button type="submit" class="submit-btn">Update Inventory</button>
                    </form>
                </div>
            </div>
        `;

        setupModal('stockModal', 'openStockModal', 'closeStock');

        document.getElementById('addStockForm').onsubmit = async (e) => {
            e.preventDefault();
            const myBindKey = (userLocation === 'main') ? null : userLocation;
            await postData('http://127.0.0.1:5000/inventory/stock', {
                product_id: document.getElementById('stock_prod_id').value,
                warehouse_bind_key: myBindKey,
                quantity: document.getElementById('stock_qty').value
            }, token);
        };

    } catch (error) {
        console.error(error);
        mainContent.innerHTML = '<p class="error">Failed to load inventory.</p>';
    }
});


transfersLink.addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    transfersLink.classList.add('active');

    const token = localStorage.getItem('token');
    const myLocation = localStorage.getItem('location');

    try {
        // Fetch Data
        const [transfersRes, productsRes, warehousesRes, employeesRes] = await Promise.all([
            fetch(`http://127.0.0.1:5000/transfers/?location=${myLocation}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:5000/inventory/products', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:5000/warehouses/', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`http://127.0.0.1:5000/transfers/employees?location=${myLocation}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const transfers = await transfersRes.json();
        const products = await productsRes.json();
        const warehouses = await warehousesRes.json();
        const employees = await employeesRes.json();

        // Helpers
        const empMap = {}; employees.forEach(e => empMap[e.id] = e.name);
        const productOptions = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        const remoteOptions = warehouses.filter(w => w.bind_key !== myLocation).map(w => `<option value="${w.bind_key}">${w.name}</option>`).join('');
        const employeeOptions = employees.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

        const transferRows = transfers.map(t => {
            let actionBtn = '';
            let handlerInfo = '<span style="color:#999">-</span>';

            // --- Handler Display ---
            if(t.source === myLocation && t.sender_id) handlerInfo = `Sender: <strong>${empMap[t.sender_id] || t.sender_id}</strong>`;
            else if (t.destination === myLocation && t.receiver_id) handlerInfo = `Receiver: <strong>${empMap[t.receiver_id] || t.receiver_id}</strong>`;

            // ================= BUTTON LOGIC (THE FIX) =================
            
            // 1. I am the DESTINATION (Receiving Goods)
            if (t.destination === myLocation) {
                // A. Standard Push: Someone sent me items. I need to Approve.
                if (t.status === 'PENDING' && t.sender_id) {
                    actionBtn = `<button class="action-btn btn-approve" onclick="openApproveModal(${t.id}, 'approve')" title="Approve">✓</button> 
                                 <button class="action-btn btn-deny" onclick="denyTransfer(${t.id})">✕</button>`;
                } 
                // B. Pull Request: I requested items. I must WAIT for them to approve.
                else if (t.status === 'PENDING' && !t.sender_id) {
                    actionBtn = `<span class="badge status-pending">Waiting Approval</span>`;
                }
                // C. Approved/In-Transit but I haven't assigned a Receiver yet.
                else if (!t.receiver_id && (t.status === 'APPROVED' || t.status === 'IN_TRANSIT')) {
                    handlerInfo = `<span style="color:red; font-weight:bold;">Unassigned</span>`;
                    actionBtn = `<button class="add-btn" style="font-size:12px; padding:4px;" onclick="openApproveModal(${t.id}, 'assign_receiver')">Assign Staff</button>`;
                } 
                else {
                    actionBtn = `<span class="badge status-${t.status.toLowerCase()}">${t.status}</span>`;
                }
            }
            
            // 2. I am the SOURCE (Sending Goods)
            else if (t.source === myLocation) {
                // A. Pull Request: Someone requested items FROM me. I need to Approve (by assigning sender).
                if (t.status === 'PENDING' && !t.sender_id) {
                    // Reverted to Green Checkmark as requested
                    actionBtn = `<button class="action-btn btn-approve" onclick="openApproveModal(${t.id}, 'assign_sender')" title="Approve & Assign Sender">✓</button>
                                 <button class="action-btn btn-deny" onclick="denyTransfer(${t.id})">✕</button>`;
                } 
                // B. Standard Push: I sent a request. I must WAIT.
                else if (t.status === 'PENDING' && t.sender_id) {
                    actionBtn = `<span class="badge status-pending">Waiting Approval</span>`;
                }
                else {
                    actionBtn = `<span class="badge status-${t.status.toLowerCase()}">${t.status}</span>`;
                }
            }

            const direction = (t.source === myLocation) ? "Outgoing ➔" : "Incoming ⬅";

            return `
                <tr>
                    <td>${t.created_at}</td>
                    <td><strong>${t.product_name}</strong> (x${t.quantity})</td>
                    <td>${direction} <br> <small>${t.source} to ${t.destination}</small></td>
                    <td>${handlerInfo}</td>
                    <td style="text-align: center;">${actionBtn}</td>
                </tr>
            `;
        }).join('');

        mainContent.innerHTML = `
            <header class="header-flex">
                <h1>Transfer Requests</h1>
                <button id="openTransferModal" class="add-btn">Create Transfer</button>
            </header>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Date</th><th>Item</th><th>Direction</th><th>Handler</th><th>Status/Action</th></tr>
                    </thead>
                    <tbody>${transferRows}</tbody>
                </table>
            </div>

            <div id="transferModal" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeTransfer">&times;</span>
                    <h2>Create Transfer</h2>
                    <form id="createTransferForm">
                        <label>Transfer Type</label>
                        <select id="t_type_select" style="margin-bottom: 15px; font-weight:bold; background-color:#f9f9f9;">
                            <option value="send">Outgoing (Push Items)</option>
                            <option value="request">Incoming (Request Items)</option>
                        </select>

                        <label>Product</label>
                        <select id="t_prod" required>${productOptions}</select> <span id="stock_display" style="font-size:0.9em; margin-left:10px;"></span>

                        <label id="lbl_target">Destination Warehouse</label>
                        <select id="t_target" required>${remoteOptions}</select>

                        <div class="form-row">
                            <div><label>Quantity</label><input type="number" id="t_qty" min="1" value="1" required></div>
                        </div>

                        <div id="sender_group">
                            <label>Assign Sender (My Staff)</label>
                            <select id="t_sender"><option value="">-- Select --</option>${employeeOptions}</select>
                        </div>
                        
                        <label>Note</label><input type="text" id="t_note">
                        <button type="submit" class="submit-btn">Submit</button>
                    </form>
                </div>
            </div>

            <div id="approveModal" class="modal">
                <div class="modal-content">
                    <span class="close" id="closeApprove">&times;</span>
                    <h2 id="modalTitle">Action Required</h2>
                    <p id="modalDesc">Select the employee responsible for this task.</p>
                    <form id="approveTransferForm">
                        <input type="hidden" id="appr_transfer_id">
                        <input type="hidden" id="appr_action">
                        <label>Select Employee</label>
                        <select id="appr_employee" required>
                            <option value="">-- Select Employee --</option>
                            ${employeeOptions} 
                        </select>
                        <button type="submit" class="submit-btn" style="background-color: #27ae60;">Confirm</button>
                    </form>
                </div>
            </div>
        `;

        setupModal('transferModal', 'openTransferModal', 'closeTransfer');
        setupModal('approveModal', null, 'closeApprove');

        // Logic: Dropdown Change
        const typeSelect = document.getElementById('t_type_select');
        const lblTarget = document.getElementById('lbl_target');
        const senderGroup = document.getElementById('sender_group');
        const senderSelect = document.getElementById('t_sender');
        const stockDisplay = document.getElementById('stock_display');

        function updateFormUI() {
            const isSend = typeSelect.value === 'send';
            if (isSend) {
                lblTarget.textContent = "Destination Warehouse";
                senderGroup.style.display = "block";
                senderSelect.setAttribute('required', 'required');
                stockDisplay.textContent = ""; 
            } else {
                lblTarget.textContent = "Source Warehouse (Request From)";
                senderGroup.style.display = "none";
                senderSelect.removeAttribute('required');
                senderSelect.value = "";
                stockDisplay.textContent = ""; 
            }
        }
        typeSelect.addEventListener('change', () => { updateFormUI(); doStockCheck(); });

        // Logic: Stock Check
        const prodSelect = document.getElementById('t_prod');
        const targetSelect = document.getElementById('t_target');

        async function doStockCheck() {
            const prodId = prodSelect.value;
            const isSend = typeSelect.value === 'send';
            const warehouseToCheck = isSend ? myLocation : targetSelect.value;
            
            if (!prodId || !warehouseToCheck) return;

            stockDisplay.textContent = "Checking...";
            try {
                const res = await fetch(`http://127.0.0.1:5000/transfers/check_stock?product_id=${prodId}&warehouse=${warehouseToCheck}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                stockDisplay.innerHTML = `Available at ${warehouseToCheck.toUpperCase()}: <strong>${data.quantity}</strong>`;
                stockDisplay.style.color = data.quantity > 0 ? "#27ae60" : "#e74c3c";
            } catch (e) { stockDisplay.textContent = ""; }
        }

        prodSelect.addEventListener('change', doStockCheck);
        targetSelect.addEventListener('change', doStockCheck);

        // Submit: Create
        document.getElementById('createTransferForm').onsubmit = async (e) => {
            e.preventDefault();
            const isSend = typeSelect.value === 'send';
            const source = isSend ? myLocation : document.getElementById('t_target').value;
            const destination = isSend ? document.getElementById('t_target').value : myLocation;
            const senderId = isSend ? document.getElementById('t_sender').value : null;

            await postData('http://127.0.0.1:5000/transfers/', {
                product_id: document.getElementById('t_prod').value,
                quantity: document.getElementById('t_qty').value,
                source: source,
                destination: destination,
                sender_id: senderId,
                note: document.getElementById('t_note').value
            }, token);
        };

        // Submit: Approve/Assign
        document.getElementById('approveTransferForm').onsubmit = async (e) => {
            e.preventDefault();
            const tId = document.getElementById('appr_transfer_id').value;
            const empId = document.getElementById('appr_employee').value;
            const action = document.getElementById('appr_action').value;

            let url = '', body = {};

            if (action === 'assign_receiver') {
                url = `http://127.0.0.1:5000/transfers/${tId}/assign`;
                body = { receiver_id: empId };
            } else if (action === 'assign_sender') {
                url = `http://127.0.0.1:5000/transfers/${tId}/assign_sender`;
                body = { sender_id: empId };
            } else {
                url = `http://127.0.0.1:5000/transfers/${tId}/respond`;
                body = { action: 'approve', receiver_id: empId };
            }

            try {
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                if(res.ok) document.getElementById('transfers-link').click();
                else alert("Action failed");
            } catch(e) { console.error(e); }

            document.getElementById('approveModal').style.display = 'none';
        };

    } catch (error) {
        console.error(error);
        mainContent.innerHTML = '<p class="error">Failed to load transfers.</p>';
    }
});

window.openApproveModal = function(id, action) {
    document.getElementById('appr_transfer_id').value = id;
    document.getElementById('appr_action').value = action;
    
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDesc');

    if (action === 'assign_sender') {
        title.innerText = "Approve Request";
        desc.innerText = "Assign the employee who will SHIP these items.";
    } else if (action === 'assign_receiver') {
        title.innerText = "Assign Receiver";
        desc.innerText = "Assign the employee who will RECEIVE these items.";
    } else {
        title.innerText = "Approve Transfer";
        desc.innerText = "Assign the employee who will RECEIVE these items.";
    }
    
    document.getElementById('approveModal').style.display = 'flex';
};

async function postData(url, data, token) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert("Success!");
            const activeLink = document.querySelector('.sidebar a.active');
            if(activeLink) activeLink.click();
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        } else {
            const err = await res.json();
            alert("Error: " + err.msg);
        }
    } catch (e) { console.error(e); }
}

function setupModal(modalId, openBtnId, closeBtnId) {
    const modal = document.getElementById(modalId);
    const openBtn = document.getElementById(openBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    
    if (modal && openBtn) {
        openBtn.onclick = () => {
             modal.style.display = "flex";
             if(modalId === 'transferModal') {
                 document.getElementById('t_type_select').value = 'send';
                 document.getElementById('t_type_select').dispatchEvent(new Event('change'));
             }
        };
    }
    
    if (modal && closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}


window.denyTransfer = async function(id) {
    const reason = prompt("Enter reason for denial:");
    if (reason !== null) {
        const token = localStorage.getItem('token');
        await fetch(`http://127.0.0.1:5000/transfers/${id}/respond`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'deny', note: reason })
        });
        document.getElementById('transfers-link').click();
    }
};