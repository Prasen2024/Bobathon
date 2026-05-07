// server.js — Plain JavaScript, Node.js built-in modules only (no npm)
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = 8000;
var DATA_DIR = path.join(__dirname, 'data');
var USERS_CSV = path.join(DATA_DIR, 'users.csv');
var REQUESTS_CSV = path.join(DATA_DIR, 'requests.csv');

// MIME types for static files
var MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// ==================== CSV Helpers ====================

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_CSV)) {
        fs.writeFileSync(USERS_CSV, 'email,password,role\nadmin@admin.com,admin123,admin\n');
    }
    if (!fs.existsSync(REQUESTS_CSV)) {
        fs.writeFileSync(REQUESTS_CSV, 'id,teamName,email,description,justification,status,adminComments,submittedDate\n');
    }
}

// Parse a CSV field that may be quoted
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

function readCSV(filePath) {
    var content = fs.readFileSync(filePath, 'utf8').trim();
    var lines = content.split('\n');
    if (lines.length < 2) return [];
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

function escapeCSVField(val) {
    val = String(val || '');
    if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

function writeCSV(filePath, headers, rows) {
    var lines = [headers.join(',')];
    rows.forEach(function(row) {
        var vals = headers.map(function(h) { return escapeCSVField(row[h]); });
        lines.push(vals.join(','));
    });
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// ==================== Request Body Parser ====================

function parseBody(req, callback) {
    var body = '';
    req.on('data', function(chunk) {
        body += chunk;
        if (body.length > 1e6) { req.destroy(); } // 1MB limit
    });
    req.on('end', function() {
        try {
            callback(null, JSON.parse(body));
        } catch (e) {
            callback(e, null);
        }
    });
}

// ==================== Route Handlers ====================

function handleLogin(req, res) {
    parseBody(req, function(err, data) {
        if (err || !data.email || !data.password) {
            return sendJSON(res, 400, { error: 'Email and password are required' });
        }
        var users = readCSV(USERS_CSV);
        var user = null;
        for (var i = 0; i < users.length; i++) {
            if (users[i].email === data.email && users[i].password === data.password) {
                user = users[i];
                break;
            }
        }
        if (user) {
            sendJSON(res, 200, { success: true, email: user.email, role: user.role });
        } else {
            sendJSON(res, 401, { error: 'Invalid email or password' });
        }
    });
}

function handleRegister(req, res) {
    parseBody(req, function(err, data) {
        if (err || !data.email || !data.password) {
            return sendJSON(res, 400, { error: 'Email and password are required' });
        }
        var users = readCSV(USERS_CSV);
        for (var i = 0; i < users.length; i++) {
            if (users[i].email === data.email) {
                return sendJSON(res, 409, { error: 'User already exists' });
            }
        }
        users.push({ email: data.email, password: data.password, role: 'user' });
        writeCSV(USERS_CSV, ['email', 'password', 'role'], users);
        sendJSON(res, 200, { success: true });
    });
}

function handleGetRequests(req, res, query) {
    var requests = readCSV(REQUESTS_CSV);
    var email = query.email || '';
    var role = query.role || '';
    if (role !== 'admin' && email) {
        requests = requests.filter(function(r) { return r.email === email; });
    }
    sendJSON(res, 200, requests);
}

function handleCreateRequest(req, res) {
    parseBody(req, function(err, data) {
        if (err || !data.teamName || !data.email || !data.description || !data.justification) {
            return sendJSON(res, 400, { error: 'All fields are required' });
        }
        var requests = readCSV(REQUESTS_CSV);
        var newReq = {
            id: Date.now().toString(),
            teamName: data.teamName,
            email: data.email,
            description: data.description,
            justification: data.justification,
            status: 'Pending',
            adminComments: '',
            submittedDate: new Date().toISOString().split('T')[0]
        };
        requests.push(newReq);
        var headers = ['id', 'teamName', 'email', 'description', 'justification', 'status', 'adminComments', 'submittedDate'];
        writeCSV(REQUESTS_CSV, headers, requests);
        sendJSON(res, 200, { success: true, id: newReq.id });
    });
}

function handleUpdateRequest(req, res, id) {
    parseBody(req, function(err, data) {
        if (err) return sendJSON(res, 400, { error: 'Invalid data' });
        var requests = readCSV(REQUESTS_CSV);
        var found = false;
        for (var i = 0; i < requests.length; i++) {
            if (requests[i].id === id) {
                requests[i].status = data.status || requests[i].status;
                requests[i].adminComments = data.adminComments !== undefined ? data.adminComments : requests[i].adminComments;
                found = true;
                break;
            }
        }
        if (!found) return sendJSON(res, 404, { error: 'Request not found' });
        var headers = ['id', 'teamName', 'email', 'description', 'justification', 'status', 'adminComments', 'submittedDate'];
        writeCSV(REQUESTS_CSV, headers, requests);
        sendJSON(res, 200, { success: true });
    });
}

// ==================== HTTP Helpers ====================

function sendJSON(res, status, obj) {
    var body = JSON.stringify(obj);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

function serveStatic(req, res, urlPath) {
    if (urlPath === '/') urlPath = '/index.html';
    var filePath = path.join(__dirname, urlPath);
    // Prevent directory traversal
    if (filePath.indexOf(__dirname) !== 0) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    var ext = path.extname(filePath);
    var contentType = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, function(err, content) {
        if (err) {
            res.writeHead(404); res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

function parseQuery(url) {
    var q = {};
    var idx = url.indexOf('?');
    if (idx === -1) return q;
    var pairs = url.substring(idx + 1).split('&');
    pairs.forEach(function(p) {
        var kv = p.split('=');
        q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return q;
}

// ==================== Server ====================

ensureDataDir();

var server = http.createServer(function(req, res) {
    var urlPath = req.url.split('?')[0];
    var query = parseQuery(req.url);

    // API routes
    if (urlPath === '/api/login' && req.method === 'POST') {
        return handleLogin(req, res);
    }
    if (urlPath === '/api/register' && req.method === 'POST') {
        return handleRegister(req, res);
    }
    if (urlPath === '/api/requests' && req.method === 'GET') {
        return handleGetRequests(req, res, query);
    }
    if (urlPath === '/api/requests' && req.method === 'POST') {
        return handleCreateRequest(req, res);
    }
    // PUT /api/requests/<id>
    var putMatch = urlPath.match(/^\/api\/requests\/(.+)$/);
    if (putMatch && req.method === 'PUT') {
        return handleUpdateRequest(req, res, putMatch[1]);
    }

    // Static files
    serveStatic(req, res, urlPath);
});

server.listen(PORT, function() {
    console.log('Server running at http://localhost:' + PORT);
    console.log('CSV files stored in: ' + DATA_DIR);
});
