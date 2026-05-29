const API_BASE = '/api';
let userId = null;
let apiKey = null;
let allBins = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Get user data from localStorage
    userId = localStorage.getItem('userId');
    apiKey = localStorage.getItem('apiKey');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('role');
    const requestCount = localStorage.getItem('requestCount');
    const requestLimit = localStorage.getItem('requestLimit');
    
    // Check if user is logged in
    if (!userId || !apiKey) {
        window.location.href = '/login';
        return;
    }
    
    // Display user info
    document.getElementById('usernameDisplay').textContent = username;
    document.getElementById('userRole').textContent = userRole === 'admin' ? 'Admin' : 'User';
    document.getElementById('userRole').style.background = userRole === 'admin' ? '#dc3545' : '#28a745';
    document.getElementById('userRole').style.color = 'white';
    document.getElementById('requestStats').innerHTML = `<i class="fas fa-chart-line"></i> Requests: ${requestCount}/${requestLimit}`;
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
    
    // Load bins
    loadAllBins();
    setupCreateForm();
    setupModal();
});

// Search function
function searchBins() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allBins.filter(bin => 
        (bin.name && bin.name.toLowerCase().includes(searchTerm)) ||
        bin.id.toLowerCase().includes(searchTerm)
    );
    displayBins(filtered);
}

// Logout function
function logout() {
    localStorage.clear();
    window.location.href = '/login';
}

async function loadAllBins() {
    try {
        const response = await fetch(`${API_BASE}/bins?user_id=${userId}&api_key=${apiKey}`);
        if (response.ok) {
            allBins = await response.json();
            // Ensure bins is an array
            if (Array.isArray(allBins)) {
                displayBins(allBins);
                updateStats(allBins);
            } else {
                displayBins([]);
                updateStats([]);
            }
        } else if (response.status === 401) {
            console.error('Session expired');
            showError('Session expired. Please login again.');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            const error = await response.json();
            console.error('Failed to load bins:', error);
            showError('Failed to load bins: ' + (error.detail || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading bins:', error);
        showError('Failed to load bins. Please check your connection.');
    }
}

function updateStats(bins) {
    const totalBins = bins.length;
    const publicBins = bins.filter(b => !b.is_private).length;
    const privateBins = bins.filter(b => b.is_private).length;
    
    const totalBinsEl = document.getElementById('totalBins');
    const publicBinsEl = document.getElementById('publicBins');
    const privateBinsEl = document.getElementById('privateBins');
    
    if (totalBinsEl) totalBinsEl.textContent = totalBins;
    if (publicBinsEl) publicBinsEl.textContent = publicBins;
    if (privateBinsEl) privateBinsEl.textContent = privateBins;
}

function displayBins(bins) {
    const binsList = document.getElementById('binsList');
    const baseUrl = window.location.origin;
    
    if (!binsList) return;
    
    if (!bins || bins.length === 0) {
        binsList.innerHTML = '<div class="loading">No bins found. Create your first bin!</div>';
        return;
    }
    
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
            <div class="access-links">
                <label><i class="fas fa-link"></i> Access Links:</label>
                <div class="link-container">
                    <input type="text" value="${baseUrl}/api/bins/${bin.id}?api_key=${apiKey}" readonly>
                    <button class="btn btn-sm btn-info" onclick="copyToClipboard('${baseUrl}/api/bins/${bin.id}?api_key=${apiKey}', 'API Link')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="link-container">
                    <input type="text" value="Bin ID: ${bin.id}" readonly>
                    <button class="btn btn-sm btn-info" onclick="copyToClipboard('${bin.id}', 'Bin ID')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="bin-actions">
                <button onclick="viewBin('${bin.id}')" class="btn btn-secondary btn-sm">
                    <i class="fas fa-eye"></i> View
                </button>
                <button onclick="editBin('${bin.id}')" class="btn btn-warning btn-sm">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteBin('${bin.id}')" class="btn btn-danger btn-sm">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function setupCreateForm() {
    const form = document.getElementById('createForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
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
            
            if (response.ok) {
                const bin = await response.json();
                showSuccess(`Bin created successfully! ID: ${bin.id}`);
                document.getElementById('createForm').reset();
                document.getElementById('jsonData').value = '{"message": "Hello World!"}';
                loadAllBins();
                
                // Update request count in localStorage
                const newRequestCount = parseInt(localStorage.getItem('requestCount') || '0') + 1;
                localStorage.setItem('requestCount', newRequestCount);
                const requestStatsEl = document.getElementById('requestStats');
                if (requestStatsEl) {
                    const requestLimit = localStorage.getItem('requestLimit') || '300';
                    requestStatsEl.innerHTML = `<i class="fas fa-chart-line"></i> Requests: ${newRequestCount}/${requestLimit}`;
                }
            } else {
                const error = await response.json();
                showError(error.detail || 'Failed to create bin');
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                showError('Invalid JSON format. Please check your syntax.');
            } else {
                showError(error.message || 'Failed to create bin');
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
                    <div class="link-container">
                        <input type="text" value="${bin.id}" readonly style="flex:1;">
                        <button class="btn btn-sm btn-info" onclick="copyToClipboard('${bin.id}', 'Bin ID')">Copy</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" value="${escapeHtml(bin.name || 'Unnamed')}" readonly style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                </div>
                <div class="form-group">
                    <label>API Endpoint:</label>
                    <div class="link-container">
                        <input type="text" value="${baseUrl}/api/bins/${bin.id}?api_key=${apiKey}" readonly style="flex:1;">
                        <button class="btn btn-sm btn-info" onclick="copyToClipboard('${baseUrl}/api/bins/${bin.id}?api_key=${apiKey}', 'API Link')">Copy</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Data Type:</label>
                    <input type="text" value="${Array.isArray(bin.data) ? 'Array' : typeof bin.data}" readonly style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                </div>
                <div class="form-group">
                    <label>Data:</label>
                    <pre style="background:#f8f9fa;padding:10px;border-radius:5px;overflow-x:auto;max-height:400px;">${JSON.stringify(bin.data, null, 2)}</pre>
                </div>
                <div class="form-group">
                    <label>Created:</label>
                    <input type="text" value="${new Date(bin.created_at).toLocaleString()}" readonly style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                </div>
                <div class="form-group">
                    <label>Views:</label>
                    <input type="text" value="${bin.access_count}" readonly style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                </div>
            `);
        } else {
            showError('Failed to load bin');
        }
    } catch (error) {
        showError('Error accessing bin');
    }
}

async function editBin(id) {
    try {
        const response = await fetch(`${API_BASE}/bins/${id}?api_key=${apiKey}`);
        if (!response.ok) throw new Error('Failed to fetch bin');
        
        const bin = await response.json();
        
        showModal('Edit Bin', `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" id="editName" value="${escapeHtml(bin.name || '')}" style="width:100%;padding:8px;border:2px solid #e0e0e0;border-radius:5px;">
            </div>
            <div class="form-group">
                <label>JSON Data:</label>
                <textarea id="editData" rows="10" style="width:100%;font-family:monospace;padding:8px;border:2px solid #e0e0e0;border-radius:5px;">${JSON.stringify(bin.data, null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="editPrivate" ${bin.is_private ? 'checked' : ''}> Private Bin
                </label>
            </div>
            <button onclick="submitEdit('${id}')" class="btn btn-primary">Save Changes</button>
        `);
    } catch (error) {
        showError('Failed to load bin for editing');
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
        
        if (response.ok) {
            showSuccess('Bin updated successfully');
            closeModal();
            loadAllBins();
        } else {
            const error = await response.json();
            showError(error.detail || 'Failed to update bin');
        }
    } catch (error) {
        showError('Invalid JSON format');
    }
}

async function deleteBin(id) {
    if (!confirm('Are you sure you want to delete this bin? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/bins/${id}?api_key=${apiKey}`, { 
            method: 'DELETE' 
        });
        
        if (response.ok) {
            showSuccess('Bin deleted successfully');
            loadAllBins();
        } else {
            showError('Failed to delete bin');
        }
    } catch (error) {
        showError('Error deleting bin');
    }
}

// Modal functions
let modal = null;

function setupModal() {
    modal = document.getElementById('modal');
    if (modal) {
        const closeBtn = document.getElementsByClassName('close')[0];
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }
        window.onclick = (event) => {
            if (event.target === modal) modal.style.display = 'none';
        };
    }
}

function showModal(title, content) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (modalTitle) modalTitle.innerHTML = title;
    if (modalBody) modalBody.innerHTML = content;
    if (modal) modal.style.display = 'block';
}

function closeModal() {
    if (modal) modal.style.display = 'none';
}

function copyToClipboard(text, field) {
    navigator.clipboard.writeText(text);
    showSuccess(`${field} copied to clipboard!`);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(errorDiv, container.firstChild);
        setTimeout(() => errorDiv.remove(), 3000);
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(successDiv, container.firstChild);
        setTimeout(() => successDiv.remove(), 3000);
    } else {
        alert(message);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}