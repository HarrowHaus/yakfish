# Worker and database explanation

## Does a worker run Python?

No.

This repo uses JavaScript everywhere:

- Local phone/PC: `node server.mjs`
- Vercel: `api/news.js`
- Netlify: `netlify/functions/news.mjs`
- GitHub Pages: no live worker; it serves `public/cache/news.json`

A worker/function is just the tiny server-side fetcher that bypasses browser CORS and normalizes public feeds into one JSON database response.

## What the worker does

1. Read `public/feeds.json`.
2. Fetch enabled RSS/GDELT pipes.
3. Parse XML or JSON.
4. Normalize each item into a headline record.
5. Deduplicate by URL/title.
6. Sort newest first.
7. Return `{ articles, sources, stats }`.

## What the worker does not do

- No full article scraping.
- No login.
- No Python runtime.
- No paid news API.
- No recommendation model.
- No text rewriting.

## Database modes

### Live database surface

`/api/news` is the live database surface. Every request returns current normalized records.

### Git-backed archive database

`npm run archive:news` appends unseen headline records to:

```txt
data/headlines.jsonl
```

That makes Git itself the free append-only database. The included GitHub Action can run every 30 minutes and commit new records.

### External DB boundary

Add D1/Turso/Supabase only when you need multi-user historical search, complex queries, or high-volume persistence. The current schema is already record-shaped enough to migrate cleanly.
