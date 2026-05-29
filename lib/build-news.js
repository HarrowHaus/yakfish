import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXmlFeed } from './parse-rss.js';
import { stableHash } from './hash.js';
import { canonicalizeUrl, hostFromUrl } from './url.js';
import { cleanText, normalizeTitle } from './text.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FEEDS_PATH = path.join(ROOT, 'public', 'feeds.json');
const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_CACHE_SECONDS = 60;

let memoryCache = null;

export async function readSources(feedsPath = DEFAULT_FEEDS_PATH) {
  const raw = await fs.readFile(feedsPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.sources)) {
    throw new Error('feeds.json must contain { "sources": [...] }.');
  }
  return parsed.sources;
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function minutesBetween(laterIso, earlierIso) {
  const later = new Date(laterIso).getTime();
  const earlier = new Date(earlierIso).getTime();
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.max(0, Math.round((later - earlier) / 60000));
}

function withTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

function normalizeArticle(raw, source, fetchedAt) {
  const title = cleanText(raw.title);
  const url = canonicalizeUrl(raw.url);
  const fallbackPublished = fetchedAt;
  const publishedAt = raw.publishedAt || fallbackPublished;
  const publisher = source.type === 'rss' && raw.rawSource ? cleanText(raw.rawSource) : source.type === 'gdelt' && raw.rawSource ? cleanText(raw.rawSource) : source.label;
  const publisherUrl = raw.rawSourceUrl || source.homepage || source.url || '';
  const pipeType = source.type === 'gdelt' ? 'GDELT DOC' : source.trustTier === 'aggregator' ? 'RSS AGG' : 'RSS DIRECT';
  const normalized = {
    id: stableHash(`${url}|${title}|${source.id}`),
    title,
    url,
    canonicalUrl: url,
    host: hostFromUrl(url),
    source: publisher || source.label,
    publisher: publisher || source.label,
    sourceId: source.id,
    sourceLabel: source.label,
    pipe: source.label,
    pipeId: source.id,
    pipeType,
    sourceHomepage: publisherUrl,
    section: source.section || 'UNFILED',
    jurisdiction: source.jurisdiction || 'GLOBAL',
    language: source.language || 'en',
    trustTier: source.trustTier || 'source',
    recordId: stableHash(`${url}|${title}|${source.id}`).toUpperCase(),
    publishedAt,
    fetchedAt,
    ageMinutes: minutesBetween(fetchedAt, publishedAt),
    tags: source.tags || [],
    description: raw.description || '',
    dupeKey: `${source.section || 'UNFILED'}:${normalizeTitle(title)}`
  };
  return normalized;
}

async function fetchText(url, timeoutMs) {
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'user-agent': 'PublicWireIndex/1.0 (+source-linked RSS directory)',
        'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    cancel();
  }
}

async function fetchJson(url, timeoutMs) {
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'user-agent': 'PublicWireIndex/1.0 (+source-linked news directory)',
        'accept': 'application/json, */*'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    cancel();
  }
}

function gdeltUrl(source) {
  const query = source.query || '';
  const maxrecords = Math.min(Number(source.maxItems || 50), 250);
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: String(maxrecords),
    sort: source.sort || 'datedesc'
  });
  if (source.timespan) params.set('timespan', source.timespan);
  return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
}

function parseGdeltDate(value) {
  if (!value) return null;
  const normalized = String(value).replace(/(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeGdeltArticle(article, source) {
  return {
    title: article.title || article.seendate || article.url,
    url: article.url,
    publishedAt: parseGdeltDate(article.seendate),
    rawSource: article.domain || article.sourceCommonName || source.label,
    rawSourceUrl: article.url || '',
    description: article.socialimage || '',
    sourceId: source.id
  };
}

async function fetchSource(source, fetchedAt) {
  const started = Date.now();
  const timeoutMs = Number(source.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    let rawItems = [];
    if (source.type === 'gdelt') {
      const json = await fetchJson(gdeltUrl(source), timeoutMs);
      rawItems = Array.isArray(json.articles) ? json.articles.map((a) => normalizeGdeltArticle(a, source)) : [];
    } else {
      const xml = await fetchText(source.url, timeoutMs);
      rawItems = parseXmlFeed(xml, source);
    }

    const maxItems = Number(source.maxItems || 50);
    const articles = rawItems
      .slice(0, maxItems)
      .map((item) => normalizeArticle(item, source, fetchedAt))
      .filter((item) => item.title && item.url);

    return {
      status: 'ok',
      source: sourceStatus(source, 'ok', articles.length, Date.now() - started),
      articles
    };
  } catch (error) {
    return {
      status: 'error',
      source: sourceStatus(source, 'error', 0, Date.now() - started, error),
      articles: []
    };
  }
}

function sourceStatus(source, status, itemCount, latencyMs, error = null) {
  return {
    id: source.id,
    label: source.label,
    section: source.section || 'UNFILED',
    type: source.type || 'rss',
    pipeType: source.type === 'gdelt' ? 'GDELT DOC' : source.trustTier === 'aggregator' ? 'RSS AGG' : 'RSS DIRECT',
    jurisdiction: source.jurisdiction || 'GLOBAL',
    trustTier: source.trustTier || 'source',
    url: source.url || null,
    query: source.query || null,
    enabled: source.enabled !== false,
    status,
    itemCount,
    latencyMs,
    checkedAt: new Date().toISOString(),
    error: error ? String(error.message || error) : null,
    notes: source.notes || ''
  };
}

function dedupeArticles(articles) {
  // A database keeps records. We drop only true duplicates (same canonical URL
  // republished by the same intake). Different publishers covering the same
  // story stay as separate records — that wire-syndication signal IS the data.
  const byUrl = new Map();
  const kept = [];

  for (const article of articles) {
    const urlKey = article.canonicalUrl || article.url;
    if (urlKey && byUrl.has(urlKey)) continue;
    if (urlKey) byUrl.set(urlKey, article.id);
    kept.push(article);
  }
  return kept;
}

export async function buildNews(options = {}) {
  const feedsPath = options.feedsPath || DEFAULT_FEEDS_PATH;
  const cacheSeconds = Number(options.cacheSeconds ?? DEFAULT_CACHE_SECONDS);
  const fetchedAt = nowIso(options.now || new Date());
  const force = Boolean(options.force);

  if (!force && memoryCache && Date.now() - memoryCache.createdAt < cacheSeconds * 1000) {
    return { ...memoryCache.payload, cache: { status: 'hit', seconds: cacheSeconds } };
  }

  const allSources = await readSources(feedsPath);
  const enabledSources = allSources.filter((source) => source.enabled !== false);
  const disabledSources = allSources.filter((source) => source.enabled === false).map((source) => sourceStatus(source, 'disabled', 0, 0));

  const results = await Promise.all(enabledSources.map((source) => fetchSource(source, fetchedAt)));
  const sourceStatuses = [...results.map((result) => result.source), ...disabledSources]
    .sort((a, b) => a.section.localeCompare(b.section) || a.label.localeCompare(b.label));
  const rawArticles = results.flatMap((result) => result.articles);
  const articles = dedupeArticles(rawArticles)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const sections = [...new Set(sourceStatuses.map((source) => source.section).filter(Boolean))].sort();
  const okSources = sourceStatuses.filter((source) => source.status === 'ok').length;
  const brokenSources = sourceStatuses.filter((source) => source.status === 'error').length;

  const payload = {
    product: 'PUBLIC WIRE DATABASE',
    updatedAt: fetchedAt,
    sourceCount: sourceStatuses.length,
    enabledSourceCount: enabledSources.length,
    okSourceCount: okSources,
    brokenSourceCount: brokenSources,
    articleCount: articles.length,
    rawArticleCount: rawArticles.length,
    sections,
    articles,
    sources: sourceStatuses,
    cache: { status: 'miss', seconds: cacheSeconds }
  };

  memoryCache = { createdAt: Date.now(), payload };
  return payload;
}

export function sendJson(res, payload, statusCode = 200, cacheSeconds = DEFAULT_CACHE_SECONDS) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=900`);
  res.end(body);
}
