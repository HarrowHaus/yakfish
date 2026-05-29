# wire

A database of headline links from public RSS and GDELT pipes.

Not a feed. Not a publication. Not a news app. Just headlines as links, with a small line under each showing the time and which host serves it. When the same story appears at several outlets, the hosts collapse into one line under one headline.

No scores. No ranking. No metrics. No accounts. No comments. No recommendation engine.

## Run it

See `docs/RUN_AND_DEPLOY.md`. The short version:

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`. If you've been running an older version, **hard-reload the browser** — the page title should say "wire" (lowercase). If it still says "PUBLIC WIRE DATABASE" you're seeing cache.

## Edit sources

Edit `public/feeds.json`. Add RSS pipes with `type: "rss"`. Add GDELT pipes with `type: "gdelt"` and a `query`. Then:

```bash
npm run validate:feeds
npm run validate:news
```

## Files that matter

- `public/index.html` — the page (about 20 lines)
- `public/styles.css` — the look (paper background, near-black serif, mono meta)
- `public/app.js` — fetch, cluster by title, render
- `lib/build-news.js` — backend fetcher and dedup
- `public/feeds.json` — the source registry
