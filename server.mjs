import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNews } from './lib/build-news.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.ico', 'image/x-icon']
]);

function writeJson(res, payload, statusCode = 200) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, stale-while-revalidate=300'
  });
  res.end(JSON.stringify(payload));
}

async function serveFile(res, requestPath) {
  const cleanPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': TYPES.get(ext) || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/news') {
    try {
      const payload = await buildNews({ force: url.searchParams.get('force') === '1' });
      writeJson(res, payload);
    } catch (error) {
      writeJson(res, { error: true, message: error?.message || String(error), articles: [], sources: [] }, 500);
    }
    return;
  }
  await serveFile(res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`PUBLIC WIRE INDEX local server`);
  console.log(`http://${HOST}:${PORT}`);
  if (HOST === '127.0.0.1') console.log(`Termux LAN mode: HOST=0.0.0.0 npm run dev`);
});
