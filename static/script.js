// static/script.js - Complete Fixed Version
const API_BASE = '/api';
let userId = null;
let apiKey = null;
let allBins = [];
let requestCount = 0;
let requestLimit = 300;
let currentViewMode = 'list';
let currentUserRole = null;
let currentUsername = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Get user data from localStorage
    userId = localStorage.getItem('userId');
    apiKey = localStorage.getItem('apiKey');
    currentUsername = localStorage.getItem('username');
    currentUserRole = localStorage.getItem('role');
    requestCount = parseInt(localStorage.getItem('requestCount') || '0');
    requestLimit = parseInt(localStorage.getItem('requestLimit') || '300');
    
    // Check if user is logged in
    if (!userId || !apiKey) {
        window.location.href = '/login';
        return;
    }
    
    // Display user info
    document.getElementById('usernameDisplay').textContent = currentUsername;
    document.getElementById('userRole').textContent = currentUserRole === 'admin' ? 'Admin' : 'User';
    document.getElementById('userRole').style.background = currentUserRole === 'admin' ? '#dc3545' : '#28a745';
    document.getElementById('userRole').style.color = 'white';
    updateRequestStatsDisplay();
    
    // Setup modal close button
    setupModal();
    
    // Load documentation content
    loadDocumentation();
    
    // Load bins
    loadAllBins();
    setupCreateForm();
    
    // Set initial view to list mode
    setViewMode('list');

    // Load users if admin
    if (currentUserRole === 'admin') {
        loadAllUsers();
    }
});

// Setup modal with proper close handlers
function setupModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
        // Remove existing listeners to avoid duplicates
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Load documentation from file
async function loadDocumentation() {
    try {
        const response = await fetch('/static/JSONBINBro_Documentation.txt');
        if (response.ok) {
            const docContent = await response.text();
            window.documentationContent = docContent;
        }
    } catch (error) {
        console.error('Failed to load documentation:', error);
    }
    
    const docsDropdown = document.getElementById('docsContent');
    if (docsDropdown) {
        docsDropdown.innerHTML = `
            <a href="#" onclick="showDocumentation(); return false;">📖 View Documentation</a>
            <a href="#" onclick="downloadDocumentation(); return false;">📥 Download Documentation</a>
        `;
    }
}

function showDocumentation() {
    const content = window.documentationContent || 'Documentation not available. Please contact support.';
    showModal('Documentation', `<pre style="white-space: pre-wrap; font-family: inherit; max-height: 500px; overflow-y: auto;">${escapeHtml(content)}</pre>`);
}

function downloadDocumentation() {
    if (window.documentationContent) {
        const blob = new Blob([window.documentationContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'JSONBINBro_Documentation.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToastMessage('Documentation downloaded!', 'success');
    } else {
        showToastMessage('Documentation not available', 'error');
    }
}

function showContact() {
    showModal('Contact Us', `
        <div class="contact-info">
            <p><i class="fas fa-envelope"></i> Email: geocorpsys@gmail.com</p>
            <p><i class="fab fa-paypal"></i> PayPal: uwaifo_victor@yahoo.com</p>
            <p><i class="fab fa-telegram"></i> Telegram: @GeorgeUwaifo</p>
            <p><i class="fas fa-credit-card"></i> PayStack: Available via API</p>
            <hr>
            <p>For support inquiries, please email us or reach out on Telegram.</p>
        </div>
    `);
}

function showPayment() {
    showModal('Payment Options', `
        <div class="payment-info">
            <h3>Upgrade Your Request Limit</h3>
            <table style="width:100%; border-collapse: collapse;">
                <tr style="background:#f0f0f0;">
                    <th style="padding:10px;">Level</th>
                    <th style="padding:10px;">Additional Requests</th>
                    <th style="padding:10px;">Price (USD)</th>
                </tr>
                <tr><td style="padding:8px; border-bottom:1px solid #ddd;">1</td><td style="padding:8px; border-bottom:1px solid #ddd;">2,000</td><td style="padding:8px; border-bottom:1px solid #ddd;">$2.00</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #ddd;">2</td><td style="padding:8px; border-bottom:1px solid #ddd;">5,000</td><td style="padding:8px; border-bottom:1px solid #ddd;">$3.50</td></tr>
                <tr><td style="padding:8px;">3</td><td style="padding:8px;">10,000</td><td style="padding:8px;">$6.00</td></tr>
            </table>
            <hr>
            <p><strong>Payment Methods:</strong></p>
            <ul>
                <li>PayPal: uwaifo_victor@yahoo.com</li>
                <li>TonWallet (Telegram): @GeorgeUwaifo</li>
                <li>PayStack: Contact for integration</li>
            </ul>
            <p>After payment, contact support with your transaction ID to upgrade your plan.</p>
        </div>
    `);
}

function showProfile() {
    showModal('Edit Profile', `
        <div class="profile-form">
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="profileUsername" value="${currentUsername}" readonly style="background:#f0f0f0; width:100%; padding:8px;">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="profileEmail" placeholder="Enter your email" style="width:100%; padding:8px;">
            </div>
            <div class="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input type="password" id="profilePassword" placeholder="Enter new password" style="width:100%; padding:8px;">
            </div>
            <div class="form-group">
                <label>Confirm Password</label>
                <input type="password" id="profileConfirmPassword" placeholder="Confirm new password" style="width:100%; padding:8px;">
            </div>
            <button onclick="updateProfile()" class="btn btn-primary" style="margin-top:10px;">Save Changes</button>
        </div>
    `);
}

async function updateProfile() {
    const email = document.getElementById('profileEmail')?.value;
    const password = document.getElementById('profilePassword')?.value;
    const confirmPassword = document.getElementById('profileConfirmPassword')?.value;
    
    if (password && password !== confirmPassword) {
        showToastMessage('Passwords do not match', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/user/${userId}/profile?api_key=${apiKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: password || undefined })
        });
        
        if (response.ok) {
            showToastMessage('Profile updated successfully!', 'success');
            closeModal();
            if (password) {
                showToastMessage('Please login again with your new password.', 'info');
                setTimeout(() => logout(), 2000);
            }
        } else {
            const error = await response.json();
            showToastMessage(error.detail || 'Failed to update profile', 'error');
        }
    } catch (error) {
        showToastMessage('Error updating profile', 'error');
    }
}

function showDashboard() {
    document.getElementById('dashboardContent').style.display = 'block';
    document.getElementById('adminPanelContent').style.display = 'none';
}

function showAdminPanel() {
    if (currentUserRole !== 'admin') {
        showToastMessage('Admin access required', 'error');
        return;
    }
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('adminPanelContent').style.display = 'block';
    loadAllUsers();
}

async function loadAllUsers() {
    if (currentUserRole !== 'admin') return;
    
    try {
        const adminKey = prompt('Enter admin key:');
        const response = await fetch(`${API_BASE}/admin/users?admin_key=${adminKey}`);
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        } else {
            showToastMessage('Failed to load users', 'error');
        }
    } catch (error) {
        showToastMessage('Error loading users', 'error');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${user.role}</td>
            <td>${user.request_count}</td>
            <td>${user.request_limit}</td>
            <td>
                <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
             </td>
            <td>
                <button onclick="toggleUserStatus('${user.id}')" class="btn btn-sm btn-warning">
                    ${user.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="resetUserPassword('${user.id}')" class="btn btn-sm btn-info">Reset Password</button>
             </td>
        </tr>
    `).join('');
}

async function toggleUserStatus(userIdToToggle) {
    const adminKey = prompt('Enter admin key to confirm:');
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userIdToToggle}/toggle?admin_key=${adminKey}`, {
            method: 'PUT'
        });
        if (response.ok) {
            showToastMessage('User status updated', 'success');
            loadAllUsers();
        } else {
            showToastMessage('Failed to update user status', 'error');
        }
    } catch (error) {
        showToastMessage('Error updating user status', 'error');
    }
}

async function resetUserPassword(userIdToReset) {
    if (!confirm('Reset this user\'s password to "password01"?')) return;
    const adminKey = prompt('Enter admin key to confirm:');
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userIdToReset}/reset-password?admin_key=${adminKey}`, {
            method: 'POST'
        });
        if (response.ok) {
            showToastMessage('Password reset to "password01"', 'success');
        } else {
            showToastMessage('Failed to reset password', 'error');
        }
    } catch (error) {
        showToastMessage('Error resetting password', 'error');
    }
}

function updateRequestStatsDisplay() {
    const percentUsed = (requestCount / requestLimit) * 100;
    let statusClass = '';
    if (percentUsed >= 90) {
        statusClass = 'request-danger';
    } else if (percentUsed >= 70) {
        statusClass = 'request-warning';
    }
    const statsElement = document.getElementById('requestStats');
    if (statsElement) {
        statsElement.className = statusClass;
        statsElement.innerHTML = `<i class="fas fa-chart-line"></i> Requests: ${requestCount}/${requestLimit}`;
    }
}

function showToastMessage(message, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast-message');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    let bgColor = '#28a745';
    let icon = 'fa-check-circle';
    
    if (type === 'error') {
        bgColor = '#dc3545';
        icon = 'fa-exclamation-circle';
    } else if (type === 'warning') {
        bgColor = '#ffc107';
        icon = 'fa-exclamation-triangle';
    } else if (type === 'info') {
        bgColor = '#17a2b8';
        icon = 'fa-info-circle';
    }
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${bgColor};
        color: ${type === 'warning' ? '#333' : 'white'};
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast && toast.remove) {
            toast.remove();
        }
    }, 3000);
}

async function refreshUserData() {
    try {
        const response = await fetch(`${API_BASE}/user/${userId}?api_key=${apiKey}`);
        if (response.ok) {
            const userData = await response.json();
            requestCount = userData.request_count;
            requestLimit = userData.request_limit;
            localStorage.setItem('requestCount', requestCount);
            localStorage.setItem('requestLimit', requestLimit);
            updateRequestStatsDisplay();
        }
    } catch (error) {
        console.error('Failed to refresh user data:', error);
    }
}

function setViewMode(mode) {
    currentViewMode = mode;
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    
    if (mode === 'grid') {
        if (gridBtn) gridBtn.classList.add('active');
        if (listBtn) listBtn.classList.remove('active');
        const binsList = document.getElementById('binsList');
        if (binsList) binsList.className = 'bins-grid';
    } else {
        if (listBtn) listBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
        const binsList = document.getElementById('binsList');
        if (binsList) binsList.className = 'bins-list-view';
    }
    displayBins(allBins);
}

async function loadAllBins() {
    try {
        const response = await fetch(`${API_BASE}/bins?user_id=${userId}&api_key=${apiKey}`);
        if (response.ok) {
            allBins = await response.json();
            if (Array.isArray(allBins)) {
                displayBins(allBins);
                updateStats(allBins);
            } else {
                displayBins([]);
                updateStats([]);
            }
            await refreshUserData();
        } else if (response.status === 401) {
            showToastMessage('Session expired. Please login again.', 'error');
            setTimeout(() => window.location.href = '/login', 2000);
        } else if (response.status === 403) {
            const error = await response.json();
            showToastMessage(error.detail || 'Request limit exceeded.', 'error');
        } else {
            const error = await response.json();
            showToastMessage('Failed to load bins: ' + (error.detail || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error loading bins:', error);
        showToastMessage('Failed to load bins. Please check your connection.', 'error');
    }
}

function updateStats(bins) {
    const totalBins = bins.length;
    const publicBins = bins.filter(b => !b.is_private).length;
    const privateBins = bins.filter(b => b.is_private).length;
}

function displayBins(bins) {
    const binsList = document.getElementById('binsList');
    const baseUrl = window.location.origin;
    
    if (!binsList) return;
    
    if (!bins || bins.length === 0) {
        binsList.innerHTML = '<div class="loading">No bins found. Create your first bin!</div>';
        return;
    }
    
    if (currentViewMode === 'grid') {
        binsList.innerHTML = bins.map((bin) => `
            <div class="bin-card">
                <div class="${bin.is_private ? 'private-badge' : 'public-badge'}">
                    ${bin.is_private ? '<i class="fas fa-lock"></i> Private' : '<i class="fas fa-unlock"></i> Public'}
                </div>
                <h3><i class="fas fa-${bin.is_private ? 'lock' : 'folder-open'}"></i> ${escapeHtml(bin.name || 'Unnamed Bin')}</h3>
                <div class="bin-data">
                    <pre>${JSON.stringify(bin.data, null, 2).substring(0, 300)}${JSON.stringify(bin.data, null, 2).length > 300 ? '...' : ''}</pre>
                </div>
                <div class="bin-meta">
                    <span><i class="far fa-calendar-alt"></i> ${new Date(bin.created_at).toLocaleDateString()}</span>
                    <span><i class="fas fa-eye"></i> ${bin.access_count} views</span>
                </div>
                <div class="bin-actions">
                    <button onclick="viewBin('${bin.id}')" class="btn btn-secondary btn-sm"><i class="fas fa-eye"></i> View</button>
                    <button onclick="editBin('${bin.id}')" class="btn btn-warning btn-sm"><i class="fas fa-edit"></i> Edit</button>
                    <button onclick="deleteBin('${bin.id}')" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
        `).join('');
    } else {
        binsList.innerHTML = bins.map((bin) => `
            <div class="bin-list-item">
                <div class="bin-list-info">
                    <div class="bin-list-name">${escapeHtml(bin.name || 'Unnamed Bin')}</div>
                    <div class="bin-list-id">ID: ${bin.id}</div>
                    <div style="margin-top:5px; font-size:12px; color:#666;">
                        <span>${new Date(bin.created_at).toLocaleDateString()}</span> | 
                        <span>${bin.access_count} views</span> | 
                        <span>${bin.is_private ? 'Private' : 'Public'}</span>
                    </div>
                </div>
                <div class="bin-list-actions">
                    <button onclick="viewBin('${bin.id}')" class="btn btn-secondary btn-sm"><i class="fas fa-eye"></i></button>
                    <button onclick="editBin('${bin.id}')" class="btn btn-warning btn-sm"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteBin('${bin.id}')" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }
}

function setupCreateForm() {
    const form = document.getElementById('createForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (requestCount >= requestLimit) {
            showToastMessage('❌ Request limit exceeded! Please upgrade your plan to create more bins.', 'error');
            return;
        }
        
        const name = document.getElementById('binName').value;
        const dataText = document.getElementById('jsonData').value;
        const isPrivate = document.getElementById('isPrivate').checked;
        
        try {
            const data = JSON.parse(dataText);
            const response = await fetch(`${API_BASE}/bins?user_id=${userId}&api_key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data, is_private: isPrivate })
            });
            
            if (response.status === 403) {
                const error = await response.json();
                showToastMessage(error.detail || 'Request limit exceeded.', 'error');
                return;
            }
            
            if (response.ok) {
                const bin = await response.json();
                showToastMessage(`✅ Bin created successfully!`, 'success');
                document.getElementById('createForm').reset();
                document.getElementById('jsonData').value = '{"message": "Hello World!"}';
                await loadAllBins();
            } else {
                const error = await response.json();
                showToastMessage(error.detail || 'Failed to create bin', 'error');
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                showToastMessage('Invalid JSON format. Please check your syntax.', 'error');
            } else {
                showToastMessage(error.message || 'Failed to create bin', 'error');
            }
        }
    });
}

async function viewBin(id) {
    try {
        const response = await fetch(`${API_BASE}/bins/${id}?api_key=${apiKey}`);
        if (response.ok) {
            const bin = await response.json();
            const baseUrl = window.location.origin;
            showModal('View Bin', `
                <div class="form-group">
                    <label>Bin ID:</label>
                    <div><code>${bin.id}</code></div>
                </div>
                <div class="form-group">
                    <label>Name:</label>
                    <div><strong>${escapeHtml(bin.name || 'Unnamed')}</strong></div>
                </div>
                <div class="form-group">
                    <label>API Endpoint:</label>
                    <div><code style="word-break:break-all;">${baseUrl}/api/bins/${bin.id}?api_key=${apiKey}</code></div>
                </div>
                <div class="form-group">
                    <label>Data:</label>
                    <pre style="background:#f8f9fa;padding:10px;border-radius:5px;overflow-x:auto;max-height:400px;">${JSON.stringify(bin.data, null, 2)}</pre>
                </div>
                <div class="form-group">
                    <label>Created:</label>
                    <div>${new Date(bin.created_at).toLocaleString()}</div>
                </div>
                <div class="form-group">
                    <label>Views:</label>
                    <div>${bin.access_count}</div>
                </div>
            `);
        } else {
            showToastMessage('Failed to load bin', 'error');
        }
    } catch (error) {
        showToastMessage('Error accessing bin', 'error');
    }
}

async function editBin(id) {
    if (requestCount >= requestLimit) {
        showToastMessage('❌ Request limit exceeded! Please upgrade your plan to edit bins.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/bins/${id}?api_key=${apiKey}`);
        if (!response.ok) throw new Error('Failed to fetch bin');
        
        const bin = await response.json();
        
        showModal('Edit Bin', `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" id="editName" value="${escapeHtml(bin.name || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:5px;">
            </div>
            <div class="form-group">
                <label>JSON Data:</label>
                <textarea id="editData" rows="10" style="width:100%;font-family:monospace;padding:8px;border:1px solid #ddd;border-radius:5px;">${JSON.stringify(bin.data, null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="editPrivate" ${bin.is_private ? 'checked' : ''}> Private Bin
                </label>
            </div>
            <button onclick="submitEdit('${id}')" class="btn btn-primary">Save Changes</button>
        `);
    } catch (error) {
        showToastMessage('Failed to load bin for editing', 'error');
    }
}

async function submitEdit(id) {
    const name = document.getElementById('editName').value;
    const dataText = document.getElementById('editData').value;
    const isPrivate = document.getElementById('editPrivate').checked;
    
    try {
        const data = JSON.parse(dataText);
        const response = await fetch(`${API_BASE}/bins/${id}?api_key=${apiKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data, is_private: isPrivate })
        });
        
        if (response.status === 403) {
            const error = await response.json();
            showToastMessage(error.detail || 'Request limit exceeded.', 'error');
            return;
        }
        
        if (response.ok) {
            showToastMessage('✅ Bin updated successfully!', 'success');
            closeModal();
            await loadAllBins();
        } else {
            const error = await response.json();
            showToastMessage(error.detail || 'Failed to update bin', 'error');
        }
    } catch (error) {
        showToastMessage('Invalid JSON format', 'error');
    }
}

async function deleteBin(id) {
    if (!confirm('⚠️ Are you sure you want to delete this bin? This action cannot be undone.')) return;
    
    if (requestCount >= requestLimit) {
        showToastMessage('❌ Request limit exceeded! Please upgrade your plan to delete bins.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/bins/${id}?api_key=${apiKey}`, { 
            method: 'DELETE' 
        });
        
        if (response.status === 403) {
            const error = await response.json();
            showToastMessage(error.detail || 'Request limit exceeded.', 'error');
            return;
        }
        
        if (response.ok) {
            showToastMessage('✅ Bin deleted successfully!', 'success');
            await loadAllBins();
        } else {
            showToastMessage('Failed to delete bin', 'error');
        }
    } catch (error) {
        showToastMessage('Error deleting bin', 'error');
    }
}

function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (modalTitle) modalTitle.innerHTML = title;
    if (modalBody) modalBody.innerHTML = content;
    if (modal) modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
}

function copyToClipboard(text, field) {
    navigator.clipboard.writeText(text);
    showToastMessage(`${field} copied to clipboard!`, 'success');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function logout() {
    localStorage.clear();
    window.location.href = '/login';
}

// Make all functions available globally
window.setViewMode = setViewMode;
window.showDashboard = showDashboard;
window.showAdminPanel = showAdminPanel;
window.showDocumentation = showDocumentation;
window.downloadDocumentation = downloadDocumentation;
window.showContact = showContact;
window.showPayment = showPayment;
window.showProfile = showProfile;
window.updateProfile = updateProfile;
window.toggleUserStatus = toggleUserStatus;
window.resetUserPassword = resetUserPassword;
window.viewBin = viewBin;
window.editBin = editBin;
window.deleteBin = deleteBin;
window.submitEdit = submitEdit;
window.copyToClipboard = copyToClipboard;
window.logout = logout;
window.closeModal = closeModal;