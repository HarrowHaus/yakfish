# SOURCES.md — source strategy & hardening

Companion to `ARCHITECTURE.md` (§1 sources, §3 clustering). This is how the source
list is chosen, maintained, and repaired. It exists because the current `feeds.json`
(~39 sources, ~22 live / ~17 down) leans on Google News RSS, which is the single
biggest quality problem — bigger than the broken count.

## The principle

**GDELT is the backbone; direct publisher RSS is a curated supplement; Google News
RSS is retired or resolved.**

- **GDELT** (DOC 2.0 `ArtList`) already indexes the wires (AP, Reuters, AFP) and the
  global press, returning clean metadata (title, real publisher URL, domain, UTC
  time). This is the right backbone *because* the wire services no longer offer usable
  public RSS — **Reuters removed direct RSS in 2020 and AP has no simple public feed.**
  Do not try to add Reuters/AP via RSS; get that coverage through GDELT.
- **Direct publisher RSS** supplements GDELT for outlets that reliably publish stable,
  real-URL feeds (list below). These give a clean "host you leave to" and need no
  redirect resolution.
- **Google News RSS** is the problem to remove (see next section).

## The Google News RSS problem (why it must go or be resolved)

Several current sources are Google News RSS (`trustTier: "aggregator"`). Three faults:

1. The item `url` is an opaque `news.google.com/rss/articles/…` redirect, **not** the
   publisher's URL — so URL-dedup can't work, clustering can't see the real host, and
   the "host you leave to" is google.com, not the outlet.
2. The real publisher is buried in the title suffix (`" - Reuters"`), not a clean field.
3. It surfaces **Google's** selection — a second editorial layer on top of the press,
   which violates the non-editorial rule.

**Fix (pick one):**
- **Preferred:** drop Google News RSS entirely. Cover the same ground with GDELT
  (backbone) + the direct feeds below. Cleaner, no resolution step, no second agenda.
- **If a Google feed must stay** (a niche query nothing else covers): the build must
  resolve each redirect to the real publisher URL and extract the real source from the
  title suffix, and mark `trustTier: "aggregator"` so it can be deprioritized. Never
  store the `news.google.com` URL as the link-out.

## The decision rule for any source: KEEP / REPAIR / REPLACE / NIX

Apply per source whenever the down-list is reviewed (the build already flips a feed to
`status:"down"` after repeated failures — `ARCHITECTURE.md` §4):

- **KEEP** — live, real-URL, direct publisher or clean GDELT query. No action.
- **REPAIR** — temporarily down or moved (e.g. feed path changed). Update the URL; many
  "broken" feeds are just a stale path. Re-test before nixing.
- **REPLACE** — a Google News aggregator feed, or a publisher that killed its RSS
  (Reuters): swap for the GDELT-backbone equivalent or a direct feed below.
- **NIX** — permanently dead (domain gone, RSS retired with no equivalent) **and** the
  coverage is already provided by GDELT or another live source. Remove only when it's
  redundant; a unique-but-flaky source may be worth repairing instead.

**Bias:** prefer REPAIR/REPLACE over NIX for anything that adds coverage GDELT lacks
(local outlets, specialist desks). A down feed simply drops out of the river; its
status is tracked **internally for this maintenance review only**, never shown to the
reader (`CLAUDE.md`).

## The actual feeds.json triage (from the real 39-source registry)

The live registry has **39 sources**: 12 Google News (aggregator), ~17 direct
publishers, 10 GDELT queries. Applying the rule:

**NIX or REPLACE — the 12 Google News feeds** (all `trustTier:"aggregator"`; the
opaque-URL + Google-selection problem above). IDs:
`google-top-us, google-world, google-us, google-business, google-tech,
google-science, google-health, google-politics, google-courts, google-war-conflict,
google-public-money, google-chicago-local`. Replace each with the direct-publisher
feed(s) for its section from the set below, and lean on the existing GDELT queries for
the investigative sections (war, courts, money/fraud, local) they were padding.

**REPLACE — CNN.** `cnn-top` (`rss.cnn.com/rss/edition.rss`) and `cnn-world`
(`rss.cnn.com/rss/edition_world.rss`): the `rss.cnn.com` endpoints have been
unreliable/dead for years. Drop or swap for the World/US feeds below.

**KEEP — the working direct publishers** already in the registry: BBC
(`bbc-world`/`bbc-uk`/`bbc-business`), PBS NewsHour
(`pbs-headlines`/`pbs-politics`/`pbs-world`/`pbs-health`/`pbs-science`), NPR
(`npr-news`/`npr-world`/`npr-politics`), ProPublica (`propublica-main`), Guardian
(`guardian-world`/`guardian-us`), Al Jazeera (`aljazeera-all`). These are real-URL
publisher feeds — keep, just confirm each still 200s at build.

**KEEP — the 10 GDELT queries** (`gdelt-*`): these are the backbone for the
investigative/topic sections and don't have the aggregator problem.

> The build computes live status each run, so the *exact* currently-down set surfaces
> in the next `latest.json`. The triage above is by structure (aggregator vs dead-host
> vs working publisher); confirm against a live build and flip `status` accordingly.

## Curated direct-publisher replacement set (verified 2026)

Real-URL feeds to seed `feeds.json` with, by section. **Validate each at build** — the
pipeline already self-reports `status`, so a wrong path simply flips to "down" rather
than corrupting data. Paths drift; treat this as a starting set, not gospel.

**World / general**
- BBC World — `https://feeds.bbci.co.uk/news/world/rss.xml`
- BBC top — `https://feeds.bbci.co.uk/news/rss.xml`
- Al Jazeera (all) — `https://www.aljazeera.com/xml/rss/all.xml`
- The Guardian World — `https://www.theguardian.com/world/rss`
- France 24 — `https://www.france24.com/en/rss`
- NYT World — `https://rss.nytimes.com/services/xml/rss/nyt/World.xml`

**US / national**
- NPR top stories — `https://feeds.npr.org/1001/rss.xml`
- CNN US — `http://rss.cnn.com/rss/edition_us.rss`
- NBC News top — `https://feeds.nbcnews.com/feeds/topstories`
- USA Today — `https://rssfeeds.usatoday.com/usatoday-newstopstories`
- Washington Post National — `https://feeds.washingtonpost.com/rss/national`

**Politics**
- Politico — `https://www.politico.com/rss/politicopicks.xml`
- NYT Politics — `https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml`
- The Guardian US politics — `https://www.theguardian.com/us-news/us-politics/rss`

**Money / business**
- CNBC business — `https://www.cnbc.com/id/100727362/device/rss/rss.html`
- BBC Business — `https://feeds.bbci.co.uk/news/business/rss.xml`
- NYT Business — `https://rss.nytimes.com/services/xml/rss/nyt/Business.xml`

**Tech**
- BBC Technology — `https://feeds.bbci.co.uk/news/technology/rss.xml`
- The Guardian Technology — `https://www.theguardian.com/uk/technology/rss`
- NYT Technology — `https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml`

**Science / health**
- NPR Science — `https://feeds.npr.org/1007/rss.xml`
- BBC Science — `https://feeds.bbci.co.uk/news/science_and_environment/rss.xml`
- NYT Science — `https://rss.nytimes.com/services/xml/rss/nyt/Science.xml`
- NYT Health — `https://rss.nytimes.com/services/xml/rss/nyt/Health.xml`

**Wire-grade (no direct RSS — use GDELT, not a feed)**
- AP, Reuters, AFP: cover via GDELT `ArtList`; do **not** add as RSS.

`feeds.json` shape for each (per `ARCHITECTURE.md` §4):
```json
{ "id":"bbc-world", "name":"BBC — World", "type":"rss",
  "url":"https://feeds.bbci.co.uk/news/world/rss.xml",
  "section":"world", "status":"live" }
```

## Cadence & maintenance

- The build re-tests every feed each run and flips `status`.
- A human reviews the down-list periodically and applies KEEP/REPAIR/REPLACE/NIX. This
  is curation of the *source list*, which is allowed; it is not algorithmic filtering
  of content.
- Diversity check (manual, occasional): the set should span outlets and regions so the
  wire isn't one house style. This is editorial *of the source list only* — never of
  which stories surface.
