#!/usr/bin/env node
/**
 * codespace-ping notifier server
 *
 * Runs inside your Codespace. Exposes:
 *   GET  /              -> the listener page (open this in a browser tab)
 *   GET  /events        -> Server-Sent Events stream
 *   POST /notify        -> trigger a notification (called by the ping-done CLI)
 *   GET  /api/sounds    -> list available audio files in ./sounds
 *   GET  /sounds/<file> -> serve audio files
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PING_DONE_PORT || 3737);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SOUNDS_DIR = path.join(ROOT, 'sounds');

const clients = new Set();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.m4a':  'audio/mp4',
  '.flac': 'audio/flac',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}
function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}
function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch (_) {}
  }
}
function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
function listSounds() {
  if (!fs.existsSync(SOUNDS_DIR)) return [];
  return fs.readdirSync(SOUNDS_DIR)
    .filter(f => /\.(mp3|wav|ogg|m4a|flac)$/i.test(f))
    .sort();
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { resolve({ message: raw }); }
    });
    req.on('error', () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`: connected\n\n`);
    clients.add(res);
    const heartbeat = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch (_) {}
    }, 25000);
    req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
    return;
  }

  if (url.pathname === '/notify' && req.method === 'POST') {
    const body = await readBody(req);
    const event = {
      message: body.message || 'Done',
      status:  body.status  || 'success',
      sound:   body.sound   || null,
      time:    Date.now(),
    };
    broadcast(event);
    return sendJSON(res, 200, { ok: true, listeners: clients.size, event });
  }

  if (url.pathname === '/api/sounds') {
    return sendJSON(res, 200, { sounds: listSounds() });
  }

  if (url.pathname === '/api/status') {
    return sendJSON(res, 200, { listeners: clients.size, sounds: listSounds().length, port: PORT });
  }

  if (url.pathname.startsWith('/sounds/')) {
    const name = path.basename(url.pathname);
    const file = path.join(SOUNDS_DIR, name);
    const ext = path.extname(file).toLowerCase();
    if (!MIME[ext]) return send(res, 415, 'Unsupported audio type');
    return serveStatic(res, file, MIME[ext]);
  }

  const reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(PUBLIC_DIR, reqPath);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  const ext = path.extname(filePath).toLowerCase();
  return serveStatic(res, filePath, MIME[ext] || 'application/octet-stream');
});

server.listen(PORT, () => {
  console.log(`\n  codespace-ping listening on http://localhost:${PORT}`);
  console.log(`  Open the forwarded URL in a browser tab to receive notifications.\n`);
});
