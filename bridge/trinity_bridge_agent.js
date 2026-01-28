/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  TRINITY PRIME - SOVEREIGN BRIDGE AGENT v2.0                                  ║
 * ║  Authority 11.0 | Commander Bobby Don McWilliams II                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  HYBRID ARCHITECTURE:                                                         ║
 * ║  • WebSocket (8080) - Local Trinity UI control                                ║
 * ║  • HTTP (8765) - File serving for external AI (Gemini via Cloudflare)         ║
 * ║  • Security: Auth tokens, command whitelist, read-only external               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const PROJECT_ROOT = "P:\\SOVEREIGN_APPS\\RightAtHomeBnB";
const WS_PORT = 8180;      // Trinity UI WebSocket
const HTTP_PORT = 8765;    // External AI HTTP

const AUTH_TOKEN = crypto.randomBytes(16).toString('hex');

const ALLOWED_COMMANDS = [
    'npm run build', 'npm run dev', 'npm run test', 'npm run lint',
    'npx prisma generate', 'npx prisma db push',
    'git status', 'git log --oneline -10', 'git diff --stat'
];

const SKIP_DIRS = ['node_modules', '.git', '__pycache__', 'dist', '.next', '.cache', 'venv'];
const ALLOWED_EXT = ['.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', 
                     '.yml', '.prisma', '.sql', '.css', '.html', '.txt'];

console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║  TRINITY PRIME - SOVEREIGN BRIDGE v2.0 | ECHO OMEGA PRIME                     ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
console.log(`[CONFIG] Project: ${PROJECT_ROOT}`);
console.log(`[CONFIG] WebSocket: ${WS_PORT} | HTTP: ${HTTP_PORT}`);
console.log(`[AUTH] Token: ${AUTH_TOKEN}\n`);

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getFileTree(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return [];
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        return items
            .filter(item => !SKIP_DIRS.includes(item.name) && !item.name.startsWith('.'))
            .map(item => {
                const fullPath = path.join(dir, item.name);
                const relPath = path.relative(PROJECT_ROOT, fullPath);
                return {
                    name: item.name,
                    path: relPath.replace(/\\/g, '/'),
                    type: item.isDirectory() ? 'folder' : 'file',
                    icon: item.isDirectory() ? 'folder' : 'description',
                    children: item.isDirectory() ? getFileTree(fullPath, depth + 1, maxDepth) : null
                };
            });
    } catch (err) {
        return [];
    }
}

function isAllowedFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ALLOWED_EXT.includes(ext);
}

function sanitizePath(requestedPath) {
    const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(PROJECT_ROOT, normalized);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
        return null; // Path traversal attempt
    }
    return fullPath;
}

function isCommandAllowed(cmd) {
    return ALLOWED_COMMANDS.some(allowed => cmd.trim().startsWith(allowed));
}


// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVER (Trinity UI - Local Control)
// ═══════════════════════════════════════════════════════════════════════════════

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`[WS] Trinity UI connected from ${clientIP}`);

    ws.send(JSON.stringify({ 
        type: 'CONNECTED', 
        message: 'BRIDGE LINK ESTABLISHED',
        project: PROJECT_ROOT,
        authToken: AUTH_TOKEN
    }));

    ws.on('message', async (message) => {
        let request;
        try {
            request = JSON.parse(message);
        } catch (e) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON' }));
            return;
        }

        const { action, fileName, content, command, token } = request;
        console.log(`[WS] Action: ${action}`);

        try {
            switch (action) {
                case 'LIST_FILES':
                    const files = getFileTree(PROJECT_ROOT);
                    ws.send(JSON.stringify({ type: 'FILE_TREE', data: files }));
                    break;

                case 'READ_FILE':
                    const safePath = sanitizePath(fileName);
                    if (!safePath) {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid path' }));
                        return;
                    }
                    if (!fs.existsSync(safePath)) {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'File not found' }));
                        return;
                    }
                    const data = fs.readFileSync(safePath, 'utf8');
                    ws.send(JSON.stringify({ type: 'FILE_CONTENT', fileName, data }));
                    break;

                case 'WRITE_FILE':
                    if (token !== AUTH_TOKEN) {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized' }));
                        return;
                    }
                    const writePath = sanitizePath(fileName);
                    if (!writePath) {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid path' }));
                        return;
                    }
                    fs.writeFileSync(writePath, content);
                    console.log(`[WRITE] ${fileName}`);
                    ws.send(JSON.stringify({ type: 'STATUS', message: `${fileName} written` }));
                    break;

                case 'EXECUTE':
                    if (token !== AUTH_TOKEN) {
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized' }));
                        return;
                    }
                    if (!isCommandAllowed(command)) {
                        ws.send(JSON.stringify({ 
                            type: 'ERROR', 
                            message: `Command not whitelisted. Allowed: ${ALLOWED_COMMANDS.join(', ')}` 
                        }));
                        return;
                    }
                    exec(command, { cwd: PROJECT_ROOT, timeout: 60000 }, (error, stdout, stderr) => {
                        ws.send(JSON.stringify({ type: 'EXEC_RESULT', command, stdout, stderr }));
                    });
                    break;

                case 'GET_STATUS':
                    ws.send(JSON.stringify({
                        type: 'STATUS',
                        project: PROJECT_ROOT,
                        wsPort: WS_PORT,
                        httpPort: HTTP_PORT,
                        allowedCommands: ALLOWED_COMMANDS
                    }));
                    break;

                default:
                    ws.send(JSON.stringify({ type: 'ERROR', message: `Unknown action: ${action}` }));
            }
        } catch (err) {
            console.error(`[ERROR] ${err.message}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
        }
    });

    ws.on('close', () => console.log('[WS] Trinity UI disconnected'));
});

console.log(`[WS] WebSocket server listening on port ${WS_PORT}`);


// ═══════════════════════════════════════════════════════════════════════════════
// HTTP SERVER (External AI Access - Read Only)
// ═══════════════════════════════════════════════════════════════════════════════

const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
    const pathname = decodeURIComponent(url.pathname);
    
    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`[HTTP] ${req.method} ${pathname}`);

    // API endpoints
    if (pathname === '/api/tree') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ files: getFileTree(PROJECT_ROOT) }));
        return;
    }

    if (pathname === '/api/status') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            status: 'online',
            project: 'RightAtHomeBnB',
            files: fs.readdirSync(PROJECT_ROOT).length,
            mode: 'read-only'
        }));
        return;
    }

    if (pathname.startsWith('/api/file/')) {
        const filePath = pathname.replace('/api/file/', '');
        const safePath = sanitizePath(filePath);
        
        if (!safePath || !fs.existsSync(safePath)) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }

        if (!isAllowedFile(safePath)) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'File type not allowed' }));
            return;
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(fs.readFileSync(safePath, 'utf8'));
        return;
    }

    // Serve static files (for browsing)
    if (pathname === '/' || pathname === '/index.html') {
        res.setHeader('Content-Type', 'text/html');
        res.end(generateIndexHTML());
        return;
    }

    // Serve raw files
    const safePath = sanitizePath(pathname);
    if (safePath && fs.existsSync(safePath)) {
        const stat = fs.statSync(safePath);
        if (stat.isDirectory()) {
            res.setHeader('Content-Type', 'application/json');
            const items = fs.readdirSync(safePath).filter(i => !SKIP_DIRS.includes(i));
            res.end(JSON.stringify({ path: pathname, items }));
        } else if (isAllowedFile(safePath)) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(fs.readFileSync(safePath, 'utf8'));
        } else {
            res.writeHead(403);
            res.end('File type not allowed');
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

function generateIndexHTML() {
    return `<!DOCTYPE html>
<html><head>
    <title>RightAtHomeBnB - Gemini Bridge</title>
    <style>
        body { font-family: system-ui; background: #1a1a2e; color: #eee; padding: 20px; }
        h1 { color: #500000; }
        a { color: #4fc3f7; }
        .file { padding: 5px; }
        pre { background: #0d0d1a; padding: 15px; border-radius: 8px; overflow-x: auto; }
    </style>
</head><body>
    <h1>🏠 RightAtHomeBnB - Gemini Bridge</h1>
    <p>Project files available for AI review (read-only)</p>
    <h3>API Endpoints:</h3>
    <ul>
        <li><a href="/api/status">/api/status</a> - Bridge status</li>
        <li><a href="/api/tree">/api/tree</a> - File tree JSON</li>
        <li>/api/file/{path} - Read specific file</li>
    </ul>
    <h3>Quick Links:</h3>
    <ul>
        <li><a href="/README.md">/README.md</a></li>
        <li><a href="/BUILD_PLAN.md">/BUILD_PLAN.md</a></li>
        <li><a href="/package.json">/package.json</a></li>
        <li><a href="/backend/main.py">/backend/main.py</a></li>
        <li><a href="/apps/web/app/page.tsx">/apps/web/app/page.tsx</a></li>
    </ul>
</body></html>`;
}

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[HTTP] File server listening on port ${HTTP_PORT}`);
    console.log(`[HTTP] Local: http://localhost:${HTTP_PORT}`);
    console.log('\n[READY] Bridge is active. Start Cloudflare Tunnel for external access:');
    console.log(`        cloudflared tunnel --url http://localhost:${HTTP_PORT}\n`);
});
