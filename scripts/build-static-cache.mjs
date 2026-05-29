import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNews } from '../lib/build-news.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const cacheDir = path.join(root, 'public', 'cache');
await fs.mkdir(cacheDir, { recursive: true });

const payload = await buildNews({ force: true, cacheSeconds: 0 });
payload.endpoint = '/cache/news.json';
payload.staticCacheBuiltAt = new Date().toISOString();
await fs.writeFile(path.join(cacheDir, 'news.json'), JSON.stringify(payload, null, 2));
await fs.writeFile(path.join(cacheDir, 'sources.json'), JSON.stringify(payload.sources, null, 2));
console.log(`STATIC CACHE BUILT: ${payload.articleCount} articles, ${payload.sourceCount} sources`);
