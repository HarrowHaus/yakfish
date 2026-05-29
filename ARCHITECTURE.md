# ARCHITECTURE.md — yak.fish backend & data

This document is the source of truth for how data enters yak.fish, how it is
shaped, and how it is served. It supersedes the current code where they disagree.
Read `CLAUDE.md` first; the NEVER/ALWAYS rules there are assumed throughout.

## 0. The shape, restated

Two parts, kept strictly separate:

- **Build-time (shared wire):** scheduled job → pull → cluster → strip → write
  static JSON → CDN. Serves all visitors at ~$0. No server in the hot path.
- **Runtime (per-user proxy, paid tier):** one edge function that fetches a
  user-supplied RSS URL, gated by license key. The only per-request cost.

The browser merges the static shared wire with the user's own feeds locally.
Everything personal (seen/unseen, saved, comfort, entitlement) is `localStorage`.

---

## 1. Data sources

### 1a. GDELT (the shared wire backbone)

Use the **GDELT DOC 2.0 API** (`https://api.gdeltproject.org/api/v2/doc/doc`).
Free, no key, redistribution-clean for *metadata* (headline, URL, domain,
seendate, language). Modes we use:

- **`mode=ArtList`** — the article list. This produces the link tuples: title,
  url, domain (source), seendate (UTC), language. **This is the source of the
  stories in the river.** Keep `maxrecords` modest and paginate by time window.
- **`mode=TimelineVol`** — proportion of global coverage matching a query over
  time. Returns a `norm` field = total articles GDELT monitored in the interval
  (the honest denominator). **Use only as an optional clustering hint (§1c, §3) —
  never as a front-surface "what's big" signal.**
- **`mode=TimelineVolInfo`** — same, plus the top articles driving each interval,
  so a volume spike can be tied to the stories causing it.
- **GKG themes** (`theme:` query operator) — GDELT's own auto-extracted topic
  groupings (hundreds of phrases under one heading). Use these only as a clustering
  hint (§3) to help group stories *without yak.fish inventing any taxonomy or ranking.*

**Do NOT use `tone` / sentiment for ordering or display.** Tone is an editorial
signal and violates the non-editorial rule. It may be ignored entirely.

Keep only redistribution-clean fields. **Discard** GDELT's `socialimage` and any
field beyond headline/url/domain/seendate (see Field discipline, §5).

### 1b. RSS (curated + user feeds)

- `lib/parse-rss.js` parses RSS 2.0, Atom, and RDF. It must tolerate all three and
  malformed feeds without crashing the build.
- The curated source list lives in `feeds.json` (schema in §4). ~39 sources today,
  ~22 live / ~17 down at last build. A down feed is simply **absent from the river** —
  nothing about source health reaches the reader. The build still computes up/down (§4)
  and keeps it **internally**, for your keep/repair/nix maintenance only.
- **Aggregator feeds need special handling.** Several current sources are *Google
  News RSS* (`trustTier: "aggregator"`), which has three problems the build must
  address: (1) the item `url` is an opaque `news.google.com/rss/articles/…` redirect,
  not the publisher's URL — so URL-dedup can't work and the "host you leave to" is
  google.com, not the real outlet; (2) the real publisher is embedded in the title
  suffix (" - Reuters"), not a clean field; (3) it surfaces *Google's* selection, a
  second layer of editorializing on top of the press. The build must either resolve
  each Google link to its real publisher URL + extract the real source, or move to
  direct publisher feeds (see the source-hardening recommendation). This is the single
  biggest source-quality issue — bigger than the count of broken feeds.
- User-added feeds (paid tier) are fetched at runtime through the proxy (§7), parsed
  by the same code, and merged client-side. They are never sent to a server for storage.

### 1c. There is no separate "top layer" to build

An earlier draft proposed a GDELT coverage-volume *landscape* as a homepage you
arrive at. **That was wrong — yak.fish has no homepage.** What you arrive at and
traverse is the river itself (`PRODUCT.md`): the deduped, chronological wire, anchored
at the new/old line, traversed by gesturing down toward that line. GDELT's
volume/theme signals are **not** a front surface; at most they are an *optional input
to clustering* (§3) — a hint that many outlets converged on something, used to help
group stories, never rendered as a "what's big" dashboard. Do not emit or build a
coverage/landscape artifact.

---

## 2. The pipeline (build-time)

```
cron (e.g. every 15–30 min)
  → fetch GDELT ArtList (windowed) + all live RSS feeds in feeds.json
  → normalize each item to a tuple {headline, host, url, seendate(UTC)}
  → CLUSTER into stories (§3)   ← this is the part the current build is missing
  → for each story: compute stable id (§3), assemble sources[] + host count
  → STRIP to allowed fields only (§5)
  → emit two artifacts (§6): latest.json (small) + append to archive JSONL
  → publish to CDN (Cloudflare Pages)
```

`lib/build-news.js` is the right home for this, but it must be extended from
"URL-only dedup" to "cluster, then dedup within cluster" (§3).

On failure (GDELT down, network error): **do not publish an empty file.** Keep the
last-good `latest.json` live and record the failure so the page can show a quiet
"couldn't refresh" state. Stale-but-honest beats empty.

---

## 3. Dedup vs clustering — wire up what already exists

**The real state of the code (corrected):** `build-news.js` dedups by URL only **on
purpose** — the comment is explicit: a database keeps records, and different publishers
covering the same story stay as separate records because that syndication signal *is*
the data. That is the PRODUCT_BASIS law and it stays. The mistake would be to destroy
those records.

**The grouping substrate is already there.** `build-news.js` already computes
`dupeKey = "<section>:<normalizeTitle(title)>"` on every article, and `app.js` already
has `clusterKey(title)`. Neither is currently used to group. So clustering is not a new
system to build — it is a **read-model grouping over the records that already exist**,
keyed by the `dupeKey` already computed.

**The reconciliation (records vs stories):**
- **Data layer (unchanged):** keep every publisher's record; URL-dedup only; provenance intact.
- **Read model (the river):** group records by `dupeKey` into one **story** for display.
- **The dive:** expands a story back into its member records — the hosts. A story with one
  record → no hosts pause → straight to source.

**Where to do the grouping:** prefer the **build** (emit stories with `sources[]`, §6) so the
client stays thin and the contract is explicit; the client `clusterKey` can remain as a
fallback/secondary. Either way, group by the normalized-title key already computed; only
tighten it (add a time window, or require a shared entity) if you see unrelated same-word
stories merging. Bias to *under*-merge: a missed merge is a minor annoyance, a wrong merge
is misinformation.

**Stable IDs.** Stories need a deterministic `id` stable across builds, or `localStorage`
seen/saved state breaks each refresh. The existing `stableHash` is the right tool — derive
the story id from cluster-invariant content (e.g. `stableHash(dupeKey + earliest-day)`),
**not** from array index or build timestamp. Per-record ids (already `stableHash(url|title|
sourceId)`) stay as the host-level keys inside `sources[]`.

---

## 4. `feeds.json` schema (matches the existing registry)

The existing `feeds.json` is an object — `{ name, updated, rules[], sources[] }` —
where each source is:

```json
{
  "id": "google-top-us",
  "label": "Google News — U.S. Top",
  "section": "TOP",                 // free label, NOT a ranking
  "type": "rss",                    // "rss" | "gdelt"
  "url": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
  "jurisdiction": "US",
  "language": "en",
  "enabled": true,
  "maxItems": 50,
  "trustTier": "publisher",         // "publisher" | "aggregator"
  "notes": "…"
}
```

Up/down state is **computed by the build**, not stored per-source (the build already
emits `okSourceCount` / `brokenSourceCount`). Recommended hardening: have the build
write a `status` (`"live"`/`"down"`) and a `lastOkAt` back per source for **maintenance
use only** (it is never surfaced to the reader). A down source just doesn't appear in the
river; a *permanently* dead feed is removed by human review
(`OPEN_QUESTIONS.md`). `trustTier: "aggregator"` marks feeds that are themselves
aggregators (e.g. Google News RSS) rather than a primary publisher — see §1b.

---

## 5. Field discipline (legal + ethos) — enforced at build

Only these fields may ever be stored or rendered per item:

- `headline` (verbatim, never rewritten or summarized)
- `source` / `host` (the outlet + its domain)
- `time` (UTC ISO 8601)
- `url` (the link out)

**Strip everything else at build time** — GDELT `socialimage`, any RSS
`description`/`content:encoded`/`summary`, any image enclosure, any author bio.
This is enforced in `build-news.js`, not merely trusted in the renderer, so that no
disallowed field is ever even present in `news.json`. (Rationale: headline + source +
link is low-risk; ledes/snippets/images are where copyright exposure starts. See
`DECISIONS.md`.)

---

## 6. The news payload — schema and split

The current single `cache/news.json` is ~1.55 MB / ~721 articles shipped whole.
Split it:

- **`latest.json`** — a small, capped window (e.g. last 24 h or last N stories),
  brotli/gzip-compressed at the CDN. This is what loads on first paint. Target it
  well under a few hundred KB transferred.
- **`archive/YYYY-MM-DD.jsonl`** — append-only JSON Lines, one story per line, lazy-
  loaded only if the user scrolls/dives past `latest`. Cheap to generate and serve.

Story object (the contract the client renders against):

```json
{
  "id": "a1b2c3…",                 // stable, deterministic (§3)
  "headline": "…",                  // verbatim
  "time": "2026-05-29T14:03:00Z",   // UTC; earliest seendate in the cluster
  "section": "world",
  "sources": [                      // the cluster; ≥1; >1 makes the dive pause at the hosts
    { "name": "Reuters", "host": "reuters.com", "url": "https://…", "time": "…Z" },
    { "name": "AP",      "host": "apnews.com",  "url": "https://…", "time": "…Z" }
  ]
}
```

- `sources.length === 1` → single-source story → no hosts pause; the dive falls straight to
  the source.
- `sources.length > 1` → the dive pauses at the hosts (the cluster) before the source.

So **host count = `sources.length`**, computed by clustering, carried in the data.
Dive depth is felt; it is never rendered as a badge or used to reorder.

There is no `coverage.json` / landscape artifact — yak.fish has no homepage (§1c).

The shell budget (≤ 512 KB) **excludes** these payload files; the payload has its
own cap and must be compressed in transit.

---

## 7. Runtime: the per-user RSS proxy (paid tier)

A single edge function (Cloudflare Pages Function) that fetches a user-supplied feed
URL and returns parsed items (headline/source/time/link only). Hard requirements:

- **License gate.** Require a valid license key (§8). No key → no proxy.
- **SSRF safety (non-negotiable):** allow `http`/`https` only; reject any URL that
  resolves to private/internal/loopback/link-local ranges; enforce a request
  timeout and a response size cap; do not follow redirects to disallowed hosts.
- **Rate limit per key** and **edge-cache** feed responses (short TTL) so the cost
  stays near-zero at scale (the only cost cliff in the system).
- Returns only the four allowed fields; strips everything else (§5) before responding.

This function is the **only** server code in the request path. The free tier never
calls it.

**Cost control (this is the system's one cost cliff — `reference/handoff-hardening.md`
Area 2):** most feeds can't be fetched in the browser (CORS), but a minority send
permissive CORS. So **try a direct client-side fetch first; fall back to this proxy only
when it fails** — that pushes the CORS-friendly feeds to $0. In the proxy, collapse cost
with: (1) a **shared cache** keyed by feed URL in Workers KV (N users on the same feed =
1 upstream fetch); (2) **conditional GET** (`If-None-Match`/`If-Modified-Since` → cheap
304s); (3) **poll throttling** (a sane minimum interval; fetch on app-open, not a
background timer). With these, the paid tier is ~$0 at 100 users, ~$5/mo at 10k, low
tens–hundreds/mo at 1M — fully funded by the paying cohort.

---

## 8. Accountless paid unlock & portability

- Sell license keys via a provider (Gumroad / Lemon Squeezy / Paddle / Stripe). Prefer a
  **merchant-of-record** (Lemon Squeezy / Paddle) so global VAT/sales tax is handled for
  a solo operator. Price the unlock as **PWYW with a suggested $5–$15, middle-anchored**,
  framed as "free with optional support" (`reference/handoff-hardening.md` Area 3).
- A tiny verify function checks a key against the provider and returns entitlement.
- The client caches entitlement in `localStorage`. No user record, no account, no DB.
- Power features (pin/add RSS via the proxy, larger archive, optional sync) are gated on
  entitlement; the intuitive core wire stays free and accountless.

**Portability / sync (no accounts, no server):**
- **OPML import/export** for feeds — the de-facto standard every serious reader speaks
  (NetNewsWire, Reeder, Feedly, Inoreader, FreshRSS). A real RSS replacement **must**
  read and write OPML (nested `<outline>` with `xmlUrl`/`title`, folders as nesting).
- **JSON export/import** for the rest (saved, pins, settings, read-state). Bundle OPML +
  JSON as the canonical portable state file. This is the free portability backbone.
- **Optional paid sync** via the *user's own* store (Dropbox / Drive / WebDAV, ideally
  E2EE) — yak.fish stores nothing. Treat client storage as a cache, not source of truth;
  nudge "add to home screen" (iOS) and periodic export to survive Safari's 7-day wipe.

---

## 9. Deploy

- **Host: Cloudflare Pages (primary).** Unlimited static bandwidth, ~$0 for the static
  front door; Pages Functions cover the proxy + verify. Make Cloudflare the primary
  target via the static-cache path (already the renderer's fallback endpoint). The
  Vercel `api/news.js` and `netlify/functions/news.mjs` configs **may stay as optional
  alternates** — the repo is portable by design (PRODUCT_BASIS "Release object") — but
  they are not the front door and must not be the per-request path for the free wire.
  Keep `server.mjs` for local dev.
- Build/cron via GitHub Actions (or Cloudflare cron) writing the static artifacts.
- PWA: ship a manifest + service worker. **Reason:** Safari deletes script-writable
  storage (incl. `localStorage`) after ~7 days of non-use unless the site is added to
  the home screen — which would wipe seen/saved/entitlement. Service-worker strategy:
  cache the shell (cache-first), fetch `latest.json` network-first with cache fallback.

---

## 10. Failure modes (spec them, don't discover them)

- **GDELT down / build fails** → GDELT has no SLA (a solo-run project), so degrade
  gracefully along a chain: **GDELT → the RSS sources already in `feeds.json` →
  last-good `latest.json` → the JSONL archive.** Never publish empty; surface a quiet
  "showing last update" state. (The same feeds power both modes, so the fallback is free.)
- **A feed 404s** → mark `status:"down"` internally (maintenance only); it simply
  drops out of the river. No reader-facing indicator, no provenance display.
- **Clustering uncertain** → prefer *under*-clustering (show two lines) over
  *over*-clustering (merging unrelated stories). A missed merge is a small annoyance;
  a wrong merge is misinformation.
- **Proxy abuse** → rate-limit + SSRF guard above; fail closed.

---

## 11. Testing checklist for the backend

- Clustering: known multi-host event collapses to one story with correct `sources[]`;
  unrelated same-word stories do **not** merge.
- ID stability: same story across two consecutive builds yields the same `id`.
- Field discipline: no `socialimage`, description, or image field appears anywhere in
  the emitted JSON.
- Payload: `latest.json` transferred size under target; archive lazy-loads correctly.
- RSS parser: valid against RSS 2.0, Atom, and RDF, and against a deliberately
  malformed feed.
- Proxy: rejects internal-IP URLs, non-http(s) schemes, oversize responses; enforces
  the license gate and rate limit.
- Time: all stored times are UTC; rendering converts to local.
