// =============================================
// API Helpers — all data stored in CSV on server
// =============================================

function apiPost(url, data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(null, resp, xhr.status);
            } catch (e) {
                callback(e, null, xhr.status);
            }
        }
    };
    xhr.send(JSON.stringify(data));
}

function apiGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(null, resp, xhr.status);
            } catch (e) {
                callback(e, null, xhr.status);
            }
        }
    };
    xhr.send();
}

function apiPut(url, data, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(null, resp, xhr.status);
            } catch (e) {
                callback(e, null, xhr.status);
            }
        }
    };
    xhr.send(JSON.stringify(data));
}

// No-op — server initializes CSV files automatically
function initData() {}

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
