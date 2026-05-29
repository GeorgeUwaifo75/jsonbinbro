// script.js
// API Configuration
const BASE_URL = 'https://jsonbinbro.onrender.com/api/bins';
const BIN_ID = '6a198bf1966f596be2a747e2';

// DOM elements
let currentApiKey = null;
let currentEditIndex = null;
let allClassmates = [];

// DOM elements
const authSection = document.getElementById('auth-section');
const appContent = document.getElementById('app-content');
const authForm = document.getElementById('auth-form');
const apiKeyInput = document.getElementById('api-key-input');
const form = document.getElementById('classmate-form');
const firstNameInput = document.getElementById('first-name');
const lastNameInput = document.getElementById('last-name');
const professionInput = document.getElementById('profession');
const telephoneInput = document.getElementById('telephone');
const ageInput = document.getElementById('age');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const recordCountSpan = document.getElementById('record-count');
const formTitle = document.getElementById('form-title');

// Helper: Fetch data from JSONBinBro
async function fetchClassmates() {
    if (!currentApiKey) return [];
    
    try {
        const API_ENDPOINT = `${BASE_URL}/${BIN_ID}`;
        const response = await fetch(`${API_ENDPOINT}?api_key=${currentApiKey}`);
        
        if (response.status === 401) {
            throw new Error('Invalid or expired API key. Please re-authenticate.');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // The data structure: { data: { allusers: [...] } }
        const classmates = result.data?.allusers || [];
        allClassmates = Array.isArray(classmates) ? classmates : [];
        
        renderTable();
        updateRecordCount();
        return allClassmates;
    } catch (error) {
        console.error('Fetch error:', error);
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">⚠️ Failed to load data. ${error.message}<br>Please check your connection and API credentials.</td></tr>`;
        return [];
    }
}

// Helper: Update entire BIN on server
async function updateBin(dataArray) {
    if (!currentApiKey) return false;
    
    try {
        const API_ENDPOINT = `${BASE_URL}/${BIN_ID}`;
        const payload = { allusers: dataArray };
        
        const response = await fetch(`${API_ENDPOINT}?api_key=${currentApiKey}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.status === 401) {
            throw new Error('Invalid or expired API key. Please re-authenticate.');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Update failed: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        // Update local data with the server response
        allClassmates = result.data?.allusers || dataArray;
        renderTable();
        updateRecordCount();
        resetForm();
        
        return true;
    } catch (error) {
        console.error('Update error:', error);
        alert(`Error saving data to server: ${error.message}\nPlease try again.`);
        return false;
    }
}

// Render table based on search filter
function renderTable() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let filteredClassmates = [...allClassmates];
    
    if (searchTerm) {
        filteredClassmates = allClassmates.filter(person => 
            (person.fname?.toLowerCase() || '').includes(searchTerm) ||
            (person.lname?.toLowerCase() || '').includes(searchTerm) ||
            (person.profession?.toLowerCase() || '').includes(searchTerm) ||
            (person.telephone || '').includes(searchTerm)
        );
    }
    
    if (filteredClassmates.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">👥 No classmates found. Add one above!</td></tr>`;
        return;
    }
    
    let html = '';
    filteredClassmates.forEach((person) => {
        // Find the actual index in allClassmates for edit/delete operations
        const actualIndex = allClassmates.findIndex(p => 
            p.fname === person.fname && 
            p.lname === person.lname && 
            p.telephone === person.telephone
        );
        
        html += `
            <tr>
                <td>${escapeHtml(person.fname || '')}</td>
                <td>${escapeHtml(person.lname || '')}</td>
                <td>${escapeHtml(person.profession || '')}</td>
                <td>${escapeHtml(person.telephone || '')}</td>
                <td>${person.age || ''}</td>
                <td class="action-cell">
                    <button class="edit-btn" data-index="${actualIndex}">✏️ Edit</button>
                    <button class="delete-btn" data-index="${actualIndex}">🗑️ Delete</button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
    
    // Attach event listeners to edit/delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            if (!isNaN(idx)) editClassmate(idx);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            if (!isNaN(idx) && confirm('Delete this classmate permanently?')) {
                await deleteClassmate(idx);
            }
        });
    });
}

// Escape HTML to prevent injection
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateRecordCount() {
    const total = allClassmates.length;
    recordCountSpan.textContent = `📋 Total: ${total} classmate${total !== 1 ? 's' : ''}`;
}

// Reset form after save/cancel
function resetForm() {
    form.reset();
    currentEditIndex = null;
    formTitle.textContent = 'Add New Classmate';
    saveBtn.textContent = '💾 Save Classmate';
    cancelBtn.style.display = 'inline-flex';
    if (firstNameInput) firstNameInput.focus();
}

// Fill form for editing
function editClassmate(index) {
    if (index < 0 || index >= allClassmates.length) return;
    
    const classmate = allClassmates[index];
    firstNameInput.value = classmate.fname || '';
    lastNameInput.value = classmate.lname || '';
    professionInput.value = classmate.profession || '';
    telephoneInput.value = classmate.telephone || '';
    ageInput.value = classmate.age || '';
    
    currentEditIndex = index;
    formTitle.textContent = '✏️ Edit Classmate';
    saveBtn.textContent = '🔄 Update Classmate';
    cancelBtn.style.display = 'inline-flex';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Delete classmate
async function deleteClassmate(index) {
    if (index < 0 || index >= allClassmates.length) return;
    
    const newClassmates = [...allClassmates];
    newClassmates.splice(index, 1);
    const success = await updateBin(newClassmates);
    
    if (success && currentEditIndex !== null) {
        // If we were editing a deleted one, cancel edit mode
        if (currentEditIndex === index || index < currentEditIndex) {
            resetForm();
        } else if (currentEditIndex > index) {
            currentEditIndex--;
        }
    }
}

// Save or update classmate
async function saveClassmate(event) {
    event.preventDefault();
    
    // Validation
    const fname = firstNameInput.value.trim();
    const lname = lastNameInput.value.trim();
    const profession = professionInput.value.trim();
    const telephone = telephoneInput.value.trim();
    const age = parseInt(ageInput.value);
    
    if (!fname || !lname || !profession || !telephone) {
        alert('Please fill all fields: First Name, Last Name, Profession, and Telephone.');
        return;
    }
    
    if (isNaN(age) || age < 1 || age > 120) {
        alert('Please enter a valid age between 1 and 120.');
        return;
    }
    
    const newClassmate = {
        fname: fname,
        lname: lname,
        profession: profession,
        telephone: telephone,
        age: age
    };
    
    let updatedList;
    if (currentEditIndex !== null) {
        // Update existing
        updatedList = [...allClassmates];
        updatedList[currentEditIndex] = newClassmate;
    } else {
        // Add new
        updatedList = [...allClassmates, newClassmate];
    }
    
    const success = await updateBin(updatedList);
    if (success) {
        resetForm();
    }
}

// Cancel editing
function cancelEdit() {
    resetForm();
}

// Refresh data from server
async function refreshData() {
    if (!currentApiKey) {
        alert('Please authenticate first');
        return;
    }
    tableBody.innerHTML = `<tr><td colspan="6" class="loading-message">🔄 Refreshing...</td></tr>`;
    await fetchClassmates();
}

// Authentication handler
async function handleAuth(event) {
    event.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        alert('Please enter your API key');
        return;
    }
    
    // Test the API key by trying to fetch the bin
    currentApiKey = apiKey;
    tableBody.innerHTML = `<tr><td colspan="6" class="loading-message">🔐 Authenticating and loading data...</td></tr>`;
    
    try {
        const API_ENDPOINT = `${BASE_URL}/${BIN_ID}`;
        const response = await fetch(`${API_ENDPOINT}?api_key=${currentApiKey}`);
        
        if (response.status === 401) {
            throw new Error('Invalid API key');
        }
        
        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.status}`);
        }
        
        // Store API key in localStorage for convenience
        localStorage.setItem('jsonbinbro_api_key', currentApiKey);
        
        // Hide auth section and show main app
        authSection.style.display = 'none';
        appContent.style.display = 'block';
        
        // Load the data
        await fetchClassmates();
        
    } catch (error) {
        console.error('Auth error:', error);
        alert(`Authentication failed: ${error.message}\nPlease check your API key and try again.`);
        currentApiKey = null;
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">❌ Authentication failed. Please check your API key.</td></tr>`;
    }
}

// Check for saved API key on load
function checkSavedApiKey() {
    const savedApiKey = localStorage.getItem('jsonbinbro_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        // Auto-authenticate
        handleAuth(new Event('submit'));
    }
}

// Event listeners
authForm.addEventListener('submit', handleAuth);
form.addEventListener('submit', saveClassmate);
cancelBtn.addEventListener('click', cancelEdit);
refreshBtn.addEventListener('click', refreshData);
searchInput.addEventListener('input', () => renderTable());

// Check for saved API key on page load
checkSavedApiKey();