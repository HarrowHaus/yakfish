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

// The client reads cache/latest.json FIRST, so this build MUST write it too — otherwise
// Pages serves a stale latest.json while only news.json refreshes (the bug). Keep it
// field-disciplined (CLAUDE.md): the story river + slim source-status only — never the
// fat per-source provenance or articles[]. Degraded guard: if the build produced no
// stories, do NOT overwrite — keep the last-good latest.json (stale-but-honest).
if (Array.isArray(payload.stories) && payload.stories.length) {
  const latest = {
    product: payload.product,
    updatedAt: payload.updatedAt,
    storyCount: payload.storyCount,
    multiSourceCount: payload.multiSourceCount,
    sections: payload.sections,
    stories: payload.stories,
    sources: (payload.sources || []).map((s) => ({ id: s.id, label: s.label, section: s.section, status: s.status }))
  };
  await fs.writeFile(path.join(cacheDir, 'latest.json'), JSON.stringify(latest));
  console.log(`STATIC CACHE BUILT: ${payload.storyCount} stories, ${payload.articleCount} articles, ${payload.sourceCount} sources (latest.json updated, updatedAt ${payload.updatedAt})`);
} else {
  console.warn(`STATIC CACHE BUILT (DEGRADED): no stories — kept last-good latest.json; news.json + sources.json updated`);
}
