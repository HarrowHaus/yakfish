# Agent Work Orders

This is the AI-build decomposition. It is not a human Gantt chart.

## Work Order 1 — Source Registry Expansion

Input: `public/feeds.json`

Output: a larger source registry with direct publisher RSS feeds, official institutional feeds, and carefully marked aggregator feeds.

Acceptance:

- every source has unique `id`
- every RSS source has `url`
- every GDELT source has `query`
- every source has `section`
- validation passes

## Work Order 2 — Parser Hardening

Input: `lib/parse-rss.js`

Output: improved parsing for malformed RSS/Atom feeds without adding heavy dependencies unless justified.

Acceptance:

- RSS item parsing works
- Atom entry parsing works
- CDATA works
- entity decode works
- broken feeds fail safely

## Work Order 3 — Deduplication Upgrade

Input: `lib/build-news.js`

Output: better duplicate collapse while preserving different-source coverage when useful.

Acceptance:

- exact URL duplicates collapse
- tracking-parameter variants collapse
- obvious title clones collapse
- unrelated same-topic stories do not over-collapse

## Work Order 4 — Database Adapter

Input: `DATABASE_BOUNDARY.md`

Output: optional database adapter that does not break no-database mode.

Acceptance:

- live mode still works without env vars
- DB mode stores articles and fetch runs
- source ledger can show historical uptime

## Work Order 5 — Host Adapter

Input: repo root

Output: deployment target package for one chosen host.

Acceptance:

- local run works
- deployed site opens
- `/api/news` or cache endpoint returns JSON
- public UI renders live or cached headlines
