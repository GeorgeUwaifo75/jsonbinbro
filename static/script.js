// Add these functions to your existing script.js or replace the relevant parts

// Global variables
let currentUserRole = null;
let currentUsername = null;

// Override the DOMContentLoaded event to properly initialize admin panel
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
    
    // Show/hide admin panel link based on role
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) {
        adminLink.style.display = currentUserRole === 'admin' ? 'inline-block' : 'none';
    }
    
    // Setup modal close button
    setupModal();
    
    // Load documentation content
    loadDocumentation();
    
    // Load bins
    loadAllBins();
    setupCreateForm();
    
    // ALWAYS load users if admin (even if admin panel not visible yet)
    if (currentUserRole === 'admin') {
        console.log('Admin logged in, loading users...');
        loadAllUsers();
    }
});

// Improved showAdminPanel function
function showAdminPanel() {
    if (currentUserRole !== 'admin') {
        showToastMessage('Admin access required', 'error');
        return;
    }
    
    // Hide dashboard, show admin panel
    const dashboardContent = document.getElementById('dashboardContent');
    const adminPanelContent = document.getElementById('adminPanelContent');
    
    if (dashboardContent) {
        dashboardContent.style.display = 'none';
    }
    if (adminPanelContent) {
        adminPanelContent.style.display = 'block';
        adminPanelContent.classList.add('active');
    }
    
    // Reload users to ensure fresh data
    loadAllUsers();
}

// Improved showDashboard function
function showDashboard() {
    const dashboardContent = document.getElementById('dashboardContent');
    const adminPanelContent = document.getElementById('adminPanelContent');
    
    if (dashboardContent) {
        dashboardContent.style.display = 'block';
    }
    if (adminPanelContent) {
        adminPanelContent.style.display = 'none';
        adminPanelContent.classList.remove('active');
    }
}

// Improved loadAllUsers function with better error handling
async function loadAllUsers() {
    if (currentUserRole !== 'admin') {
        console.log('Not admin, skipping user load');
        return;
    }
    
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) {
        console.error('Users table body not found');
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading users...</td></tr>';
    
    try {
        const adminKey = prompt('Enter admin key to access user management:');
        if (!adminKey) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Admin key required to view users.</td></tr>';
            return;
        }
        
        const response = await fetch(`${API_BASE}/admin/users?admin_key=${adminKey}`);
        
        if (response.status === 401) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Invalid admin key. Access denied.</td></tr>';
            showToastMessage('Invalid admin key', 'error');
            return;
        }
        
        if (response.ok) {
            const users = await response.json();
            if (users && users.length > 0) {
                displayUsers(users);
                showToastMessage(`Loaded ${users.length} users`, 'success');
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No users found.</td></tr>';
            }
        } else {
            const error = await response.json();
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Error: ${error.detail || 'Failed to load users'}</td></tr>`;
            showToastMessage('Failed to load users', 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Error loading users. Please check your connection.</td></tr>';
        showToastMessage('Error loading users', 'error');
    }
}

// Improved displayUsers function
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No users found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.email || 'N/A')}</td>
            <td>${user.role || 'user'}</td>
            <td>${user.request_count || 0}</td>
            <td>${user.request_limit || 300}</td>
            <td>
                <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button onclick="toggleUserStatus('${user.id}')" class="btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}" style="margin-right: 5px;">
                    ${user.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="resetUserPassword('${user.id}')" class="btn btn-sm btn-info">
                    Reset Password
                </button>
             </td>
        </tr>
    `).join('');
}

// Make sure all functions are globally accessible
window.showAdminPanel = showAdminPanel;
window.showDashboard = showDashboard;
window.loadAllUsers = loadAllUsers;
window.toggleUserStatus = toggleUserStatus;
window.resetUserPassword = resetUserPassword;