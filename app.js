// =============================================
// Data Store — CSV files via File System Access API
// Falls back to localStorage if API unavailable
// =============================================

var USERS_KEY = 'hackathon_users';
var REQUESTS_KEY = 'hackathon_requests';

// File handles for direct CSV read/write
var dataFolderHandle = null;
var usersFileHandle = null;
var requestsFileHandle = null;

// =============================================
// CSV Helpers
// =============================================

function escapeCSVField(val) {
    val = String(val || '');
    if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

function parseCSVLine(line) {
    var fields = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}

function parseCSVText(csvText) {
    var lines = csvText.trim().split('\n');
    if (lines.length < 1) return [];
    var headers = parseCSVLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var values = parseCSVLine(line);
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
            obj[headers[j].trim()] = (values[j] || '').trim();
        }
        rows.push(obj);
    }
    return rows;
}

function arrayToCSV(headers, rows) {
    var csvContent = headers.join(',') + '\n';
    rows.forEach(function(r) {
        var row = headers.map(function(h) { return escapeCSVField(r[h]); });
        csvContent += row.join(',') + '\n';
    });
    return csvContent;
}

// =============================================
// File System Access API — read/write CSV files
// =============================================

function isFileSystemSupported() {
    return typeof window.showDirectoryPicker === 'function';
}

async function connectDataFolder() {
    try {
        dataFolderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        // Try to load existing files or create new ones
        await loadOrCreateUsersCSV();
        await loadOrCreateRequestsCSV();
        localStorage.setItem('csv_connected', 'true');
        return true;
    } catch (e) {
        console.error('Folder access denied or cancelled:', e);
        return false;
    }
}

async function writeToFile(fileHandle, content) {
    var writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

async function readFromFile(fileHandle) {
    var file = await fileHandle.getFile();
    return await file.text();
}

async function loadOrCreateUsersCSV() {
    try {
        usersFileHandle = await dataFolderHandle.getFileHandle('users.csv');
        var content = await readFromFile(usersFileHandle);
        var users = parseCSVText(content);
        if (users.length > 0) {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
    } catch (e) {
        // File doesn't exist, create it with default admin
        usersFileHandle = await dataFolderHandle.getFileHandle('users.csv', { create: true });
        var defaultUsers = [{ email: 'admin@admin.com', password: 'admin123', role: 'admin' }];
        localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
        await writeToFile(usersFileHandle, arrayToCSV(['email', 'password', 'role'], defaultUsers));
    }
}

async function loadOrCreateRequestsCSV() {
    try {
        requestsFileHandle = await dataFolderHandle.getFileHandle('requests.csv');
        var content = await readFromFile(requestsFileHandle);
        var requests = parseCSVText(content);
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    } catch (e) {
        // File doesn't exist, create it
        requestsFileHandle = await dataFolderHandle.getFileHandle('requests.csv', { create: true });
        localStorage.setItem(REQUESTS_KEY, JSON.stringify([]));
        await writeToFile(requestsFileHandle, 'id,teamName,email,description,justification,status,adminComments,submittedDate\n');
    }
}

async function syncUsersToCSV() {
    if (usersFileHandle) {
        try {
            var users = getUsers();
            await writeToFile(usersFileHandle, arrayToCSV(['email', 'password', 'role'], users));
        } catch (e) { console.error('Error writing users.csv:', e); }
    }
}

async function syncRequestsToCSV() {
    if (requestsFileHandle) {
        try {
            var requests = getRequests();
            var headers = ['id', 'teamName', 'email', 'description', 'justification', 'status', 'adminComments', 'submittedDate'];
            await writeToFile(requestsFileHandle, arrayToCSV(headers, requests));
        } catch (e) { console.error('Error writing requests.csv:', e); }
    }
}

// =============================================
// Data Access (localStorage + auto CSV sync)
// =============================================

function initData() {
    if (!localStorage.getItem(USERS_KEY)) {
        var defaultUsers = [
            { email: 'admin@admin.com', password: 'admin123', role: 'admin' }
        ];
        localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    }
    if (!localStorage.getItem(REQUESTS_KEY)) {
        localStorage.setItem(REQUESTS_KEY, JSON.stringify([]));
    }
}

function getUsers() {
    var data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    syncUsersToCSV();
}

function getRequests() {
    var data = localStorage.getItem(REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveRequests(requests) {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    syncRequestsToCSV();
}

// =============================================
// Manual CSV Download / Import (fallback)
// =============================================

function downloadCSV() {
    var requests = getRequests();
    var headers = ['id', 'teamName', 'email', 'description', 'justification', 'status', 'adminComments', 'submittedDate'];
    var csvContent = arrayToCSV(headers, requests);
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'requests_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
}

function importRequestsFromCSV(csvText) {
    var rows = parseCSVText(csvText);
    var requests = rows.filter(function(r) { return r.id && r.teamName; });
    saveRequests(requests);
    return requests.length;
}

// =============================================
// CSV Connection UI Helper
// =============================================

function showConnectCSVBar() {
    if (!isFileSystemSupported()) return;
    if (dataFolderHandle) return; // already connected

    var bar = document.createElement('div');
    bar.id = 'csvConnectBar';
    bar.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;padding:10px 20px;text-align:center;border-radius:6px;margin-bottom:15px;display:flex;align-items:center;justify-content:center;gap:10px;';
    bar.innerHTML = '<span>📁 Connect a folder to auto-save data as CSV files</span>' +
        '<button class="btn btn-small" style="background:#f59e0b;" onclick="handleConnectCSV()">Connect Folder</button>';
    var card = document.querySelector('.card');
    if (card) card.insertBefore(bar, card.firstChild);
}

async function handleConnectCSV() {
    var success = await connectDataFolder();
    if (success) {
        var bar = document.getElementById('csvConnectBar');
        if (bar) {
            bar.style.background = '#d4edda';
            bar.style.borderColor = '#28a745';
            bar.innerHTML = '<span>✅ Connected! Data will auto-save to CSV files in the selected folder.</span>';
            setTimeout(function() { bar.remove(); }, 3000);
        }
        // Reload page data from CSV
        if (typeof loadAdminDashboard === 'function') loadAdminDashboard();
        if (typeof loadUserRequests === 'function') loadUserRequests();
    }
}

// =============================================
// Auth helpers
// =============================================

function checkAuth(requiredRole) {
    var user = sessionStorage.getItem('loggedInUser');
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    var parsed = JSON.parse(user);
    if (requiredRole && parsed.role !== requiredRole) {
        window.location.href = 'index.html';
        return null;
    }
    return parsed;
}

function logout() {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}

// =============================================
// Utility
// =============================================

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
