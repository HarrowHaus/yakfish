import fs from 'node:fs/promises';
import path from 'node:path';
import { buildNews } from '../lib/build-news.js';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const cacheDir = path.join(root, 'public', 'cache');
const archivePath = path.join(dataDir, 'headlines.jsonl');
const cachePath = path.join(cacheDir, 'news.json');
const manifestPath = path.join(cacheDir, 'archive-manifest.json');

async function readExistingIds() {
  try {
    const raw = await fs.readFile(archivePath, 'utf8');
    return new Set(raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line).id; } catch { return null; }
    }).filter(Boolean));
  } catch { return new Set(); }
}

await fs.mkdir(dataDir, { recursive: true });
await fs.mkdir(cacheDir, { recursive: true });

const payload = await buildNews({ force: true, cacheSeconds: 0 });
const existing = await readExistingIds();
const newRecords = payload.articles.filter((article) => !existing.has(article.id));

if (newRecords.length) {
  const lines = newRecords.map((article) => JSON.stringify({
    ...article,
    firstArchivedAt: payload.updatedAt,
    archiveProduct: 'PUBLIC WIRE DATABASE'
  })).join('\n') + '\n';
  await fs.appendFile(archivePath, lines, 'utf8');
}

await fs.writeFile(cachePath, JSON.stringify(payload, null, 2));
await fs.writeFile(manifestPath, JSON.stringify({
  product: 'PUBLIC WIRE DATABASE',
  updatedAt: payload.updatedAt,
  sourceCount: payload.sourceCount,
  okSourceCount: payload.okSourceCount,
  brokenSourceCount: payload.brokenSourceCount,
  currentArticleCount: payload.articleCount,
  appendedArticleCount: newRecords.length,
  archivePath: 'data/headlines.jsonl',
  cachePath: 'public/cache/news.json'
}, null, 2));

console.log(`ARCHIVE RUN: ${payload.articleCount} current records, ${newRecords.length} appended.`);
console.log(`BROKEN PIPES: ${payload.brokenSourceCount}`);
