// scripts/archive-news.mjs — the canonical yak.fish build entry (ARCHITECTURE §2, §6, §10).
//
// Pipeline:  fetch records → degrade gracefully if empty → window + flood-cap →
//            cluster into stories → emit latest.json (capped) + archive/*.jsonl.
//
// Never publishes an empty file. If the live fetch yields nothing, it degrades along
// the chain GDELT → RSS (both already attempted in buildRecords) → last-good
// latest.json → legacy cache/news.json → JSONL archive, and refuses to overwrite a
// good file with emptiness (§10: stale-but-honest beats empty).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRecords,
  clusterIntoStories,
  applyFloodCap,
  LATEST_WINDOW_HOURS,
  LATEST_MAX_STORIES,
  FLOOD_CAP_PER_SOURCE
} from '../lib/build-news.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'public', 'cache');
const ARCHIVE_DIR = path.join(ROOT, 'public', 'archive');
const LATEST_PATH = path.join(CACHE_DIR, 'latest.json');
const LEGACY_PATH = path.join(CACHE_DIR, 'news.json');
const MANIFEST_PATH = path.join(CACHE_DIR, 'archive-manifest.json');

function timeMs(value) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

async function fileExists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

// Reconstruct minimal records from emitted stories (latest.json no longer carries
// articles[]). Each source becomes a record; clusterIntoStories re-derives the
// grouping from section + title, so the fallback round-trips cleanly.
function recordsFromStories(stories) {
  const out = [];
  for (const s of stories || []) {
    for (const src of s.sources || []) {
      out.push({
        title: s.headline,
        url: src.url,
        host: src.host,
        source: src.name,
        publisher: src.name,
        sourceId: src.host,
        section: s.section || 'UNFILED',
        publishedAt: src.time || s.time,
        fetchedAt: src.time || s.time
      });
    }
  }
  return out;
}

await fs.mkdir(CACHE_DIR, { recursive: true });
await fs.mkdir(ARCHIVE_DIR, { recursive: true });

// ---- 1. Intake, with graceful degradation (never empty) -------------------------
const live = await buildRecords({ now: new Date() });
let records = live.records;                 // FAT records (dupeKey/sourceId intact)
let sources = live.sourceStatuses;
let sections = live.sections;
let updatedAt = live.fetchedAt;
let degraded = false;

if (!records.length) {
  // GDELT + RSS both produced nothing this run.
  if (await fileExists(LATEST_PATH)) {
    console.warn('DEGRADED: live fetch empty — keeping last-good latest.json untouched.');
    process.exit(0);
  }
  // Bootstrap / deep fallback: reuse the legacy cache snapshot as last-good.
  const legacy = await readJson(LEGACY_PATH);
  if (legacy && (Array.isArray(legacy.stories) || Array.isArray(legacy.articles))) {
    records = Array.isArray(legacy.articles) && legacy.articles.length
      ? legacy.articles
      : recordsFromStories(legacy.stories);
    sources = Array.isArray(legacy.sources) ? legacy.sources : [];
    sections = Array.isArray(legacy.sections) ? legacy.sections : sections;
    updatedAt = legacy.updatedAt || updatedAt;
    degraded = 'legacy-cache';
    console.warn(`DEGRADED: live fetch empty — bootstrapping from legacy cache (${records.length} records).`);
  }
}

if (!records.length) {
  console.error('NO DATA from any source and no last-good file — refusing to publish empty.');
  process.exit(0);
}

// ---- 2. The capped default window: window → flood-cap → cluster ------------------
const cutoff = Date.now() - LATEST_WINDOW_HOURS * 3600_000;
let windowed = records.filter((r) => timeMs(r.publishedAt || r.fetchedAt) >= cutoff);
if (!windowed.length) windowed = records;   // clock-safety: never empty the river

const { kept, overflow } = applyFloodCap(windowed, FLOOD_CAP_PER_SOURCE);
const latestStories = clusterIntoStories(kept).slice(0, LATEST_MAX_STORIES);
const multiSourceCount = latestStories.filter((s) => s.sources.length > 1).length;

// The full set clustered — the archive superset (lazy-loaded past latest).
const allStories = clusterIntoStories(records);

// Slim the per-source status to the minimum the maintenance count needs. The full
// status (pipeType/trustTier/jurisdiction/query/error…) stays INTERNAL — never on
// the wire (ARCHITECTURE §4; the provenance/pipe-type surface is retired in Phase 3).
const slimSources = (sources || []).map((s) => ({
  id: s.id,
  label: s.label,
  section: s.section,
  status: s.status
}));

// ---- 3. Emit latest.json (the capped river) + slim legacy news.json --------------
const latest = {
  product: 'yak.fish',
  updatedAt,
  degraded,
  windowHours: LATEST_WINDOW_HOURS,
  floodCapPerSource: FLOOD_CAP_PER_SOURCE,
  storyCount: latestStories.length,
  multiSourceCount,
  recordCount: kept.length,
  cappedFromRecords: windowed.length,
  floodOverflow: overflow.length,
  sections,
  stories: latestStories,     // the river: the renderer consumes stories[]/sources[]
  sources: slimSources        // id/label/section/status only — for the ok/total count
};

await fs.writeFile(LATEST_PATH, JSON.stringify(latest));
// Keep cache/news.json alive as a slim fallback endpoint (now field-disciplined too).
await fs.writeFile(LEGACY_PATH, JSON.stringify(latest));

// ---- 4. Append new stories to the per-day JSONL archive (one story per line) -----
const byDay = new Map();
for (const story of allStories) {
  const day = String(story.time || updatedAt).slice(0, 10) || 'undated';
  if (!byDay.has(day)) byDay.set(day, []);
  byDay.get(day).push(story);
}

let appended = 0;
for (const [day, dayStories] of byDay) {
  const dayPath = path.join(ARCHIVE_DIR, `${day}.jsonl`);
  const existingRaw = await fs.readFile(dayPath, 'utf8').catch(() => '');
  const existingIds = new Set(
    existingRaw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line).id; } catch { return null; }
    }).filter(Boolean)
  );
  const fresh = dayStories.filter((s) => !existingIds.has(s.id));
  if (fresh.length) {
    await fs.appendFile(dayPath, fresh.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8');
    appended += fresh.length;
  }
}

// ---- 5. Maintenance manifest (internal, never reader-facing) ---------------------
await fs.writeFile(MANIFEST_PATH, JSON.stringify({
  product: 'yak.fish',
  updatedAt,
  degraded,
  sourceCount: sources.length,
  okSourceCount: sources.filter((s) => s.status === 'ok').length,
  brokenSourceCount: sources.filter((s) => s.status === 'error').length,
  latestStoryCount: latestStories.length,
  latestMultiSourceCount: multiSourceCount,
  archiveStoryCount: allStories.length,
  appendedStoryCount: appended,
  latestPath: 'public/cache/latest.json',
  archiveDir: 'public/archive'
}, null, 2));

console.log(`BUILD: ${latestStories.length} stories in latest.json, ${multiSourceCount} multi-source clusters${degraded ? ` [degraded: ${degraded}]` : ''}.`);
console.log(`ARCHIVE: ${allStories.length} total stories, ${appended} newly appended across ${byDay.size} day file(s).`);
