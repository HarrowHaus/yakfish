// test/cluster.test.mjs — Phase 2 backend verification (ARCHITECTURE §11).
// Run: node test/cluster.test.mjs
//
// Proves the read-model contract without leaning on noisy live data:
//   1. a known multi-host event collapses to ONE story with correct sources[]
//   2. unrelated same-word stories do NOT merge (bias to under-merge)
//   3. story ids are stable across builds and independent of array order
//   4. field discipline: slim records + emitted latest.json carry only allowed fields
//   5. the per-source flood cap is content-blind and preserves overflow

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clusterIntoStories,
  applyFloodCap,
  toSlimArticle,
  FLOOD_CAP_PER_SOURCE
} from '../lib/build-news.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function ok(name) { console.log(`  ✓ ${name}`); passed++; }

// A fabricated record, shaped like normalizeArticle's output.
function rec({ title, host, url, t, section = 'WORLD', source }) {
  return {
    id: `${host}|${url}`,
    title,
    url,
    host,
    source: source || host,
    publisher: source || host,
    sourceId: host,
    section,
    publishedAt: t,
    fetchedAt: t,
    dupeKey: `${section}:${title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
  };
}

// ---- 1. multi-host collapse ------------------------------------------------------
{
  const ceasefire = [
    rec({ title: 'Ceasefire holds along border', host: 'reuters.com', url: 'https://reuters.com/a', t: '2026-05-29T10:00:00Z', source: 'Reuters' }),
    rec({ title: 'Ceasefire holds along border', host: 'apnews.com',  url: 'https://apnews.com/b',  t: '2026-05-29T09:30:00Z', source: 'AP' }),
    rec({ title: 'Ceasefire holds along border', host: 'bbc.com',     url: 'https://bbc.com/c',     t: '2026-05-29T11:15:00Z', source: 'BBC' })
  ];
  const stories = clusterIntoStories(ceasefire);
  assert.equal(stories.length, 1, 'three same-title records → one story');
  const s = stories[0];
  assert.equal(s.sources.length, 3, 'host count === sources.length === 3');
  assert.deepEqual(s.sources.map((x) => x.host).sort(), ['apnews.com', 'bbc.com', 'reuters.com']);
  assert.equal(s.time, '2026-05-29T09:30:00Z', 'story time === earliest seendate in cluster');
  assert.equal(s.headline, 'Ceasefire holds along border', 'headline is verbatim');
  ok('multi-host event collapses to one story with correct sources[]');
}

// ---- 1b. same host twice is ONE source, not a multi-host pause --------------------
{
  const npr = [
    rec({ title: 'LA mayoral race heats up', host: 'npr.org', url: 'https://npr.org/a', t: '2026-05-29T08:00:00Z', source: 'NPR' }),
    rec({ title: 'LA mayoral race heats up', host: 'npr.org', url: 'https://npr.org/b', t: '2026-05-29T10:00:00Z', source: 'NPR' })
  ];
  const s = clusterIntoStories(npr)[0];
  assert.equal(s.sources.length, 1, 'two URLs from one outlet collapse to one host');
  assert.equal(s.sources[0].url, 'https://npr.org/a', 'kept the earliest URL for the host');
  ok('two URLs from the same host collapse to a single source (no false multi-host)');
}

// ---- 2. unrelated same-word stories do NOT merge ---------------------------------
{
  const records = [
    rec({ title: 'Bank of England holds rates', host: 'ft.com', url: 'https://ft.com/1', t: '2026-05-29T08:00:00Z' }),
    rec({ title: 'River bank collapses after floods', host: 'bbc.com', url: 'https://bbc.com/2', t: '2026-05-29T08:30:00Z' })
  ];
  const stories = clusterIntoStories(records);
  assert.equal(stories.length, 2, 'shared word "bank" must NOT merge unrelated stories');
  ok('unrelated same-word stories stay separate (under-merge bias)');
}

// ---- 3. id stability across builds & order-independence --------------------------
{
  const a = [
    rec({ title: 'Election results certified', host: 'reuters.com', url: 'https://reuters.com/x', t: '2026-05-29T10:00:00Z' }),
    rec({ title: 'Election results certified', host: 'apnews.com',  url: 'https://apnews.com/y',  t: '2026-05-29T09:00:00Z' })
  ];
  const b = [a[1], a[0]]; // reversed input order
  const id1 = clusterIntoStories(a)[0].id;
  const id2 = clusterIntoStories(b)[0].id;
  assert.equal(id1, id2, 'same cluster → same id regardless of input order');
  assert.match(id1, /^[0-9a-f]{16}$/, 'id is a stable content hash, not an index');
  ok('story ids are stable across builds and input order');
}

// ---- 4. field discipline ---------------------------------------------------------
const ALLOWED_ARTICLE = new Set(['id', 'title', 'url', 'host', 'source', 'publisher', 'section', 'publishedAt', 'fetchedAt']);
const ALLOWED_SOURCE = new Set(['name', 'host', 'url', 'time']);
const FORBIDDEN = ['description', 'socialimage', 'image', 'thumbnail', 'summary', 'content', 'snippet', 'lede', 'body'];

{
  const fat = {
    ...rec({ title: 'X', host: 'bbc.com', url: 'https://bbc.com/z', t: '2026-05-29T10:00:00Z' }),
    description: '<ol>...</ol>', socialimage: 'http://img', thumbnail: 'http://t'
  };
  const slim = toSlimArticle(fat);
  for (const k of Object.keys(slim)) assert.ok(ALLOWED_ARTICLE.has(k), `slim article leaked field: ${k}`);
  for (const f of FORBIDDEN) assert.ok(!(f in slim), `slim article must not carry ${f}`);
  ok('toSlimArticle keeps only allowed fields');
}

// Scan the real emitted latest.json (if present) for any forbidden field, anywhere.
{
  const latestPath = path.join(ROOT, 'public', 'cache', 'latest.json');
  if (fs.existsSync(latestPath)) {
    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    for (const a of latest.articles || []) {
      for (const k of Object.keys(a)) assert.ok(ALLOWED_ARTICLE.has(k), `latest.json article leaked field: ${k}`);
    }
    for (const s of latest.stories || []) {
      assert.deepEqual(Object.keys(s).sort(), ['headline', 'id', 'section', 'sources', 'time']);
      for (const src of s.sources) {
        for (const k of Object.keys(src)) assert.ok(ALLOWED_SOURCE.has(k), `story source leaked field: ${k}`);
      }
    }
    // Per-source status is internal/maintenance only: no provenance/pipe-type surface.
    const ALLOWED_STATUS = new Set(['id', 'label', 'section', 'status']);
    for (const src of latest.sources || []) {
      for (const k of Object.keys(src)) assert.ok(ALLOWED_STATUS.has(k), `latest.json source status leaked field: ${k}`);
    }
    // Brute-force: forbidden substrings must not appear as keys ANYWHERE in the file.
    const blob = JSON.stringify(latest);
    for (const f of FORBIDDEN) assert.ok(!blob.includes(`"${f}"`), `latest.json contains forbidden field "${f}"`);
    ok(`emitted latest.json is field-disciplined (${(latest.stories || []).length} stories scanned)`);
  } else {
    console.log('  · latest.json not built yet — skipping live scan');
  }
}

// ---- 5. flood cap is content-blind and preserves overflow ------------------------
{
  const flood = [];
  for (let i = 0; i < 30; i++) flood.push(rec({ title: `Story ${i}`, host: 'spammy.com', url: `https://spammy.com/${i}`, t: '2026-05-29T10:00:00Z' }));
  flood.push(rec({ title: 'Lone other', host: 'other.com', url: 'https://other.com/1', t: '2026-05-29T10:00:00Z' }));
  const { kept, overflow } = applyFloodCap(flood, FLOOD_CAP_PER_SOURCE);
  assert.equal(kept.filter((r) => r.sourceId === 'spammy.com').length, FLOOD_CAP_PER_SOURCE, 'no source exceeds the cap in the kept set');
  assert.equal(kept.filter((r) => r.sourceId === 'other.com').length, 1, 'other sources are untouched');
  assert.equal(overflow.length, 30 - FLOOD_CAP_PER_SOURCE, 'overflow is preserved, not deleted');
  ok('per-source flood cap is content-blind and keeps overflow');
}

console.log(`\nPhase 2 backend: ${passed} checks passed.`);
