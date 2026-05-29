# yak.fish

A chronological, finishable, accountless reader for public news **links**. It
deduplicates the public press into one line per story, in plain time order, so you
can see what exists, decide what to read, and leave to read it at the source. It owns
no content; success is a fast, well-chosen departure, not time on site.

Vanilla HTML/CSS/JS. No accounts, no algorithm, no ads, no tracking. Built to run
cheaply enough to last.

## Read these first (in order)

0. **`ROADMAP.md`** — the master blueprint: current state, what changes, all phases & tasks. Start here.

1. **`CLAUDE.md`** — the working agreement / hard constraints. Non-negotiable.
2. **`PRODUCT.md`** — what it does: the river, the dive, and the interaction grammar.
3. **`ARCHITECTURE.md`** — data sources, pipeline, clustering, data model, deploy, proxy.
3b. **`SOURCES.md`** — which sources, why GDELT is the backbone, how to triage the broken ones.
4. **`DESIGN.md`** — the calm visual form.
5. **`DECISIONS.md`** — why all of the above, and the paths rejected.
6. **`OPEN_QUESTIONS.md`** — what's genuinely still undecided.
7. **`BUILD_PLAN.md`** — the relay handoffs (one paste-in prompt per phase), model routing, and exactly which docs each prompt points Claude Code at. **This is where the prompts you paste live.**
8. **`CONTRIBUTING.md`** — build order, commit style, and the cost routing for Claude Code.

## Repo map

```
public/
├── index.html          vanilla HTML
├── styles.css          Recursive @font-face, clamp() scales, all design language
├── app.js              all interaction logic
├── fonts/              Recursive-Variable.woff2 + Atkinson Hyperlegible (subset)
├── cache/latest.json   small capped window — first paint        (built artifact)
└── archive/*.jsonl     append-only story archive, lazy-loaded   (built artifact)
lib/
├── build-news.js       build-time aggregator: pull → cluster → strip → emit
└── parse-rss.js        RSS 2.0 / Atom / RDF parser
functions/              Cloudflare Pages Functions
├── rss-proxy           per-user RSS CORS proxy (paid tier; SSRF-safe, rate-limited)
└── verify              license-key entitlement check
feeds.json              curated source list (id, name, type, url, section, status)
server.mjs              local dev server only
```

(The previous `api/news.js` (Vercel) and `netlify/functions/news.mjs` are retired —
see `ARCHITECTURE.md` §9.)

## Run locally

```bash
npm install
node lib/build-news.js     # build the static JSON artifacts into public/cache + archive
npm run dev                # serve public/ via server.mjs
```

## Deploy

- Static front door → **Cloudflare Pages** (publish `public/`).
- `functions/` → Pages Functions (the RSS proxy + license verify).
- Scheduled build/cron (GitHub Action or Cloudflare cron) runs `lib/build-news.js`
  every 15–30 min and publishes the refreshed JSON.
- Ship the PWA manifest + service worker (so Safari doesn't wipe `localStorage`
  after ~7 days — see `ARCHITECTURE.md` §9).

## Budgets (enforced in CI)

- **Shell leanness tripwire** (HTML + CSS + JS + fonts; excludes the news payload) — a
  self-chosen ceiling (~512 KB), movable in service of leanness, not a sacred number.
- **News payload** capped separately and served brotli/gzip-compressed.
