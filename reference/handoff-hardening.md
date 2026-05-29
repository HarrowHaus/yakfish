# Hardening the Handoff for "Wire": Rename, Cost, Monetization, Sync, Legal & Resilience

## TL;DR
- **Rename now, and pick from the "transmission" or "completion" families.** "Wire" is unwinnable on search and collides with WIRED (Condé Nast), The Wire (India), Wire (wire.com messaging) and more; the strongest ownable directions are coined/abstract single words or completion-metaphor names (e.g., *Tideline*, *Relay*, *Ledger*-adjacent coinages) that no incumbent owns and that can rank for themselves.
- **The architecture is essentially free at the front door and only costs money on the paid RSS tier.** A static shell + one shared news JSON on Cloudflare Pages is ~$0 at 100, 10,000, and 1,000,000 users (unlimited bandwidth, static requests free). The only per-user cost cliff is the serverless CORS proxy that fetches each power user's arbitrary feeds — realistically $0 (free tier) at 100 users, ~$5/mo at 10k, and low-tens-to-low-hundreds/mo at 1M, fully confinable to paying users with shared caching and conditional GET.
- **Accountless paid unlock is a solved problem; PWYW will convert in the low single-digit percent, so price the unlock and the cost model accordingly.** Use a license-key model (Gumroad/Lemon Squeezy/Stripe) verified by a tiny function, store the entitlement in localStorage, and lean on OPML+JSON export for sync. The headline-and-link-out model is low legal risk in the US if you never copy the lede or images; PWA adds little for a finishable reader; build a GDELT fallback to the RSS registry.

---

## Key Findings

1. **"Wire" is a naming dead end** primarily because of search un-ownability, not just trademark collisions. The product needs a distinctive, ideally coined or oblique-metaphor name. The aggregator category is saturated with "feed/brief/digest/daily/ground/particle/artifact/smart" clichés, leaving white space in the completion/quiet and abstract-coinage families.
2. **Cost is dominated by one variable: the RSS proxy.** Everything else (static hosting, the GDELT pull, the shared JSON) is fixed and near-zero. The cheapest viable architecture serves one shared cached JSON to all free users and confines all per-user serverless cost to the paid tier.
3. **Every cautionary-tale death (Nuzzel, Artifact, Brief) was a market-size/cost-of-team problem, not a hosting-cost problem.** Artifact was self-funded by Kevin Systrom and Mike Krieger with a team of 8 and shut for market size — Systrom's Jan 12, 2024 post said they "concluded that the market opportunity isn't big enough to warrant continued investment in this way" (it had 444,000 total downloads since Feb 2023, 44% US and no other country above 4%, per Appfigures via TechCrunch). Tellingly, Systrom later told TechCrunch (March 26, 2024) "it takes a lot less to run it than we had imagined," [TechCrunch](https://techcrunch.com/2024/03/26/instagram-co-founders-ai-powered-news-app-artifact-may-not-be-shutting-down-after-all/) noting "it's just himself and Krieger running Artifact right now." Nuzzel died because its owner (Twitter, via Scroll) chose not to maintain it after acquisition. [ZoomInfo](https://www.zoominfo.com/c/nuzzel-inc/358902049) The survivors (NetNewsWire, Fraidycat) are cheap labor-of-love projects. Wire's thesis — near-zero fixed cost, one operator — is the correct structural lesson.
4. **Accountless entitlement is mature and the abuse risk is acceptable for a cheap honest tool.** Gumroad/Lemon Squeezy issue license keys verifiable by API; the device stores the unlock locally.
5. **The headline-aggregate-and-link-out model sits on solid US footing** — hot-news misappropriation is largely preempted (Barclays v. Theflyonthewall, 2011), headlines are generally uncopyrightable short phrases, and linking is legal. The real risk line is copying the **lede/"heart" of the article** (the AP v. Meltwater 2013 trap), images, or operating as a paywall-substitute. The EU press-publishers' right (DSM Art. 15) explicitly exempts hyperlinks and "very short extracts."
6. **A PWA helps only marginally** for a finishable reader, but the home-screen-install path is the one thing that protects localStorage from Safari's 7-day deletion — so it's worth shipping a minimal PWA manifest. GDELT has no SLA and is a solo-creator project; a fallback to the RSS registry is mandatory.

---

## Details

### AREA 1 — Renaming and the naming landscape

**Why "Wire" fails.** Beyond the trademark thicket (WIRED/Condé Nast; The Wire India news nonprofit; The Wire UK music magazine; Wire the encrypted messenger at wire.com; the HBO show), "wire news" is a generic phrase tied to wire services (AP/Reuters), so the term can never rank for itself. SEO un-ownability is fatal for a product whose entire growth model is word-of-mouth + organic search. A name must be able to "rank for itself."

**The category's naming clichés (avoid).** The live field is dense with: *Feedly, Inoreader, NewsBlur, Feedbin, Feeder, Feeeed, Flipboard, Ground News, Particle, News Minimalist, Newsdrop, SmartNews, Digg, Tangle, Bulletin, Tapestry, Artifact, Brief, theSkimm.* Overused morphemes: **feed, brief, digest, daily, ground, particle, smart, news, drop, wave, skimm**. The "-ly" suffix and "smart/AI" prefixes are dated. Bias/aggregation names cluster on "ground/particle/spectrum."

**White space.** Two families are comparatively uncrowded and fit Wire's ethos:
- **The "finishable/caught-up/quiet/low-tide" completion family** — almost nobody in news owns this conceptual territory, and it directly encodes the anti-doomscroll promise.
- **Coined/abstract ownable single words** — maximally SEO-ownable and trademark-clean.

**Naming directions evaluated:**

| Direction | Concept | Distinctiveness / collision | Searchability | Domain plausibility | Durability | Boxes product in? |
|---|---|---|---|---|---|---|
| **Transmission lineage** (Dispatch, Cable, Telegraph, Relay, Current, Signal, Telex) | honest transmission | *Signal* taken (messaging); *Current/Cable* generic; *Telegraph* = UK newspaper; *Dispatch* heavily used in news | Poor for common words; better for archaic ones (Telex, Relay) | .com mostly gone; alt-TLD needed | Timeless metaphor; archaic ones risk twee | Slightly — implies push/breaking |
| **Record/ledger/registry/index** | the public record | *Ledger* = crypto wallet brand; *Index* generic; *Registry* clean-ish | Weak (common words) | Hard on .com | Very durable, serious tone | No — fits chronological/archive ethos |
| **Completion/quiet/low-tide** (Tideline, Ebb, Caughtup, Done, Enough, Still, Lowtide, Settled) | anti-doomscroll finish | Largely open in news; *Tide* apps exist but not news | Good — uncommon in category | *Tideline/Ebb* alt-TLDs plausible | Strong, evocative, timeless | No — encodes the core promise |
| **Plain/clear/legible** (Plainly, Clearly, Legible, Plaintext) | honesty/clarity | "-ly" dated; Plaintext techy | Medium | Medium | Medium | Slightly techy |
| **Coined/abstract** (invented words) | ownable mark | By design zero collision | Excellent (ranks for itself) | .com far more likely | Depends on phonetics | No |

**Shortlist (strongest candidates, with reasoning):**
1. **Tideline** — encodes "the news comes in, then goes out; you can be caught up." Evocative, pronounceable, durable, not a category cliché. Collision risk moderate (some unrelated uses); needs a knockout search. Likely needs a non-.com TLD or compound domain.
2. **A coined/abstract single word** (e.g., a short invented 2-syllable mark) — best SEO ownability and .com availability, zero trademark collision, doesn't box in the product. Trade-off: needs brand-building because it carries no inherent meaning.
3. **Ledger-family coinage / "the record" angle** — fits the "public record, chronological, honest" ethos and the anti-domination stance; serious and durable. Avoid bare "Ledger" (crypto-tainted) — coin a variant.
4. **Dispatch-adjacent** (*Relay*, *Telex*) — keeps the honest-transmission lineage Wire was reaching for, with better ownability than "Wire." *Relay* is clean-ish and modern; *Telex* is distinctive but risks feeling retro.

**Non-lawyer screening checklist (apply before paying for clearance):**
1. **USPTO knockout search** — the free USPTO Trademark Search (formerly TESS); search exact mark + phonetic equivalents + each word independently, in the relevant class (likely Class 9 software / Class 42 SaaS / Class 41 providing online publications). A knockout search "is a preliminary clearance search intended to eliminate proposed brand candidates that are likely to be refused registration" (USPTO) and is cheap insurance against losing a $350/class filing fee plus rebrand cost.
2. **Live vs. dead** — a confusingly similar *live* mark in a related class is a likely blocker.
3. **Google/SERP test** — can the name plausibly reach page one for itself within a year? If a major incumbent owns the term (the "Wire" problem), kill it.
4. **Domain test** — is a clean .com or a credible alt-TLD (.app, .news, .co) available? Avoid hyphens/numbers.
5. **Common-law sweep** — plain web + social handle + app-store search for existing products (knockouts miss common-law users).
6. **Pronounce/spell test** — say it on a phone; can a stranger spell it back?
7. **International gut check** — no unfortunate meanings in major languages.
8. **Then** pay an attorney for a comprehensive clearance only on the 1–2 finalists (knockout searches "do not detect similar-sounding or visually similar marks" and ignore common-law/state/international marks).

### AREA 2 — The cost teardown (the central issue)

**Fixed components (near-zero at all scales):**
- **Static hosting/CDN (app shell + shared news JSON).** Cloudflare Pages has **unlimited bandwidth and unlimited requests to static assets, free**, with a 20,000-file and 500-builds/month cap on the free plan. Requests to static assets "are free and unlimited" on both free and paid plans. This is the decisive platform choice: Vercel's free tier has a 100 GB soft bandwidth cap and Netlify meters bandwidth, but **Cloudflare Pages does not cap bandwidth**, so serving the shell and a shared JSON to a million users costs **$0**.
- **The GDELT pull.** GDELT is free and explicitly redistributable: "any academic, commercial, or governmental use of any kind without fee. You may redistribute, rehost, republish, and mirror any of the GDELT datasets," requiring only attribution and a link. Pull on a cron (a scheduled Worker) and write **one shared static JSON** that every user reads from the CDN. Marginal cost per user ≈ $0. **Never** query GDELT per-user.

**The cost cliff: the CORS proxy for arbitrary power-user RSS feeds.** This is the only cost that scales per user, because arbitrary feeds usually cannot be fetched client-side (see below), so a serverless function must fetch them.

*Free-tier limits (2025–2026):*
- **Cloudflare Workers:** free plan = **100,000 requests/day**; static-asset requests don't count. Paid plan has a **$5 minimum monthly charge** bundling **10 million requests** and **30 million CPU-milliseconds**, with overages of **$0.30 per million additional requests** and $0.02 per million additional CPU-ms (Cloudflare Workers pricing docs). Subrequests (the actual outbound feed fetches) are limited (50/request on free, 1,000 on paid) but not separately billed as "requests."
- **Deno Deploy:** free = **100,000 requests/day, 100 GiB outbound/month**, 1 GB KV. Spending caps configurable.
- **Netlify Functions / Vercel Functions:** free tiers exist but bandwidth-metered; less attractive than Cloudflare for this workload.
- **Val Town:** good for prototyping; per-day run limits; plans to raise pricing. [Val](https://blog.val.town/blog/val-town-newsletter-23/)

*Request-volume math and the three scales:*
- **~100 users:** Even if every user is a power user with 20 feeds polled every 30 min, that's ~100 × 20 × 48 = 96,000 fetches/day — *at* the Workers free limit, and far under it with caching. **Cost: $0.**
- **~10,000 users:** Assume 3–5% convert to the paid RSS tier (consistent with PWYW conversion below) = 300–500 power users × ~20 feeds. With a **shared cache for popular feeds** (many users follow the same big sites), **conditional GET (ETag/If-Modified-Since)** to collapse unchanged feeds to 304s, and **poll throttling** (fetch on app-open + a sane minimum interval), real outbound volume lands in the low hundreds of thousands of requests/day. **Cost: ~$5/mo** (one Workers Paid plan) — comfortably inside the 10M/month allotment.
- **~1,000,000 users:** Free front door still **$0** (static). Paid power users at 3–5% = 30,000–50,000 × ~20 feeds. Even after shared-cache dedupe (the long tail of unique feeds is the real driver) this is millions of outbound fetches/day; you exceed the 10M/month included requests and pay overage at ~$0.30/million plus KV/cache operations. **Realistic cost: low tens to low hundreds of dollars/month** — and it is *entirely funded by and proportional to* the paying cohort.

*Caching strategies that collapse cost:*
1. **Shared cache for popular feeds** — store each unique feed's parsed result in Workers KV/cache keyed by URL; N users following the same feed = 1 upstream fetch.
2. **Conditional GET** — send `If-None-Match`/`If-Modified-Since`; a 304 is cheap and means no re-parse.
3. **Poll throttling** — minimum refresh interval per feed (e.g., 15–30 min), fetch on app-open not on a background timer.
4. **Coalesce** — a single scheduled job refreshes all subscribed feeds rather than per-user on-demand storms.

*Can arbitrary RSS be fetched client-side (cost → $0)?* **Mostly no.** CORS blocks browser fetches of cross-origin feeds unless the feed server sends `Access-Control-Allow-Origin`, which **most feeds do not** (WordPress — "the biggest RSS producer on the web" — still does not send permissive CORS by default; the open WordPress Trac ticket #50441 to add CORS for RSS feeds remains unresolved). So: **try a direct client-side fetch first** (works for the minority of feeds with permissive CORS, pushing their cost to zero), and **fall back to the serverless proxy** only for feeds that fail. This hybrid minimizes the billable cliff.

**Cheapest viable architecture (recommendation):** Cloudflare Pages static shell ($0) + a scheduled Worker that pulls GDELT and writes one shared JSON to the CDN ($0 marginal) + a Worker CORS-proxy *gated behind the paid unlock* with KV shared-cache + conditional GET + throttling. Free users touch only static assets; variable cost exists only for paying users.

### AREA 3 — Accountless paid unlock and PWYW mechanics

**License-key / unlock-token patterns.** The standard indie pattern: sell via **Gumroad, Lemon Squeezy, Paddle, or a Stripe Payment Link**; the processor issues a **license key**; a tiny verification function checks it (Gumroad exposes `POST https://api.gumroad.com/v2/licenses/verify` with `product_id` + `license_key`, returning success and a `uses` count). On success, the site writes a **device-local entitlement to localStorage** ("lifetime unlock"). No accounts, no user database. Lemon Squeezy and Paddle act as **merchant of record**, handling global VAT/sales tax [Airwallex](https://www.airwallex.com/uk/blog/lemon-squeezy-vs-stripe-comparison) — valuable for a solo operator.

**Security/abuse tradeoffs.** Client-side or near-client-side entitlements can be shared or cracked. For a low-priced honest tool this rarely matters: the verification API's `uses` counter lets you cap activations loosely, and the economics of piracy on a cheap utility are trivial. The honest-box experience (and "pay once" tools like Tarsnap, or Synergy's $10 lifetime) shows that **friction, not theft, is the real revenue killer** — as one Hacker News commenter put it about Synergy/Humble Bundle, "The problem with donations is not really that people are so cheap. It's that they're so lazy."

**PWYW conversion data and best practices.** The canonical field experiment is Gneezy, Gneezy & Brown, "Shared Social Responsibility" (*Science*, July 16, 2010, Vol. 329, no. 5989, pp. 325–327), [Berkeley Haas](https://newsroom.haas.berkeley.edu/name-your-price-pricing-strategy-aimed-achieving-corporate-social-responsibility-and/) run on 113,047 roller-coaster riders: under pay-what-you-want, **8.39% bought a photo but paid only $0.92 on average** (vs. 0.5% buying at the flat $12.95 price) — more buyers, but negligible income gain. **Pairing PWYW with a charitable cause raised it to ~4.5% buying at an average of $5.33** per photo, materially better for the firm. A 2012 follow-up found PWYW can *deter* purchase because "individuals feel bad when they pay less than the 'appropriate' price." Practical implications:
- **Anchor with a suggested price** and a middle default (people gravitate to the middle option).
- **Frame as "free with optional support"** rather than a guilt ask.
- Expect **low single-digit-percent conversion** to paying among free users (PWYW/donation for software typically converts in roughly the 1–5% range; treat 2–5% as planning numbers, validated against your own funnel).
- Beware **donation fatigue** and recurring-charge confusion (Gumroad's "name a fair price" can silently create a subscription).

**Processor fees, minimums, and break-even.**
- **Stripe (you = merchant of record):** ~2.9% + $0.30 per transaction; [Sabo](https://getsabo.com/blog/stripe-vs-lemon-squeezy) you handle tax.
- **Lemon Squeezy / Paddle (merchant of record):** ~5% + $0.50 per transaction; tax handled for you. Lemon Squeezy adds +1.5% for non-US transactions; [Lemonsqueezy](https://docs.lemonsqueezy.com/help/getting-started/fees) post-Stripe-acquisition it cut payout fees (US payouts free; 1% international). [Indie Hackers](https://www.indiehackers.com/post/tech/lemons-squeezy-is-slashing-its-payout-fees-so-long-as-you-use-stripe-s5aeYKsIj9dWWq7TlaBb)
- **The $0.30–$0.50 fixed fee makes micro-donations uneconomic:** a $1 "tip" loses 30–50% to fees. Set a **suggested unlock around $5–$15** so fees are a small percentage and a single unlock covers many months of the Area-2 RSS cost.
- **Break-even:** Since the *free* front door is ~$0 and only paid users incur RSS cost, the model is structurally self-funding. At 10k users, **one $5 unlock per month covers the entire ~$5 Workers bill.** At 1M users with a low-hundreds bill, a few hundred unlocks/year (a fraction of a percent of users) covers infrastructure — so PWYW economics work as long as conversion clears roughly the cost-per-paid-user, which here is cents.

**Indie precedents that sustained:** NetNewsWire (free, open-source, labor-of-love — survives), Fraidycat (free, open-source), Tarsnap ("pay once"-style), Synergy ($10 lifetime). The pattern: low fixed cost + frictionless one-time payment + no investor return expectations = durable.

### AREA 4 — Accountless sync and portability

**Lightest option that needs no server and no account:** an **export/import state file**. Specifically:
- **OPML for feeds** — the de facto standard. NetNewsWire, Reeder, and essentially every serious reader import/export OPML; it is "a widely supported open format that's effectively the standard for sharing feed subscription lists" [NetNewsWire](https://netnewswire.com/help/ios/6.0/en/export-opml.html) (NetNewsWire docs). A serious RSS replacement **must** read and write OPML (nested `<outline>` elements with `xmlUrl`/`title`/`text` attributes, folders as nested outlines) for interoperability with NetNewsWire, Feedly, Inoreader, FreshRSS, etc.
- **JSON for everything else** — saved items, pins, settings, read-state. Bundle OPML + JSON in a single downloadable file (or a zip) as the canonical portable state.

**Heavier optional layers (offer, don't require):**
- **URL-encoded / shareable-link state** for small state (a filter view, a feed set) — encode in the URL fragment; instant, serverless, great for sharing a configuration.
- **QR handoff** — encode the export (or a link to it) as a QR for phone↔desktop transfer.
- **Optional E2EE sync via user-supplied store** — Dropbox/Drive/WebDAV/remoteStorage, where the *user* owns the backend and you store nothing. This is how to offer "sync" as a paid power feature without running accounts or servers.

**Storage durability (critical caveat).** Browser localStorage/IndexedDB is **not durable** by default:
- **Safari/WebKit ITP deletes all script-writable storage (localStorage, IndexedDB, SessionStorage, service-worker registrations) after 7 days of Safari use without user interaction with the site** (WebKit blog, John Wilander, "Full Third-Party Cookie Blocking and More," March 24, 2020: "deleting all of a website's script-writable storage after seven days of Safari use without user interaction on the site"). The counter resets on each interaction (click/tap/keyboard — scrolling does not count). **Home-screen-installed web apps are exempt** ("Web applications added to the home screen are not part of Safari and thus have their own counter of days of use… We do not expect the first-party in such a web application to have its website data deleted").
- **Chrome/Firefox** evict best-effort storage only under disk pressure (LRU); regularly-visited sites are "very rarely" evicted (MDN). Call **`navigator.storage.persist()`** to request persistent storage (protects against pressure eviction, but **not** against Safari's 7-day timeout, which is privacy-driven, not pressure-driven).

**Design implication:** treat client storage as a cache, not a source of truth. **Prompt users to export** (and nudge "add to home screen" on iOS to protect their state), and re-derive the feed from GDELT + the registry on load. This is exactly how local-first readers hedge: NetNewsWire offers iCloud/Feedbin/Feedly/Inoreader/FreshRSS sync [App Store](https://apps.apple.com/us/app/netnewswire-rss-reader/id1480640210) *plus* OPML export as the universal escape hatch; Fraidycat relies on export.

### AREA 5 — Legal risk assessment (headline aggregate + link out)

**What's clearly fine:**
- **Linking out.** Deep linking to freely available content is not infringement; the EU's CJEU (Svensson, 2014) confirmed linking to freely-available content is not a restricted act, and US law treats links as references, not copies.
- **Displaying a bare headline + source + timestamp.** Headlines are generally **uncopyrightable short phrases/titles** under 37 C.F.R. § 202.1(a) ("Words and short phrases such as names, titles, and slogans… [are] not subject to copyright") and the *Feist Publications v. Rural Telephone* (1991) originality floor ("copyright rewards originality, not effort"; facts are never copyrightable). The U.S. Copyright Office's Circular 34 confirms a name/title/short phrase "cannot be protected by copyright" even if novel or distinctive. Source names, timestamps, and URLs are uncopyrightable facts.
- **Hot-news misappropriation is largely a dead letter against attributed aggregation.** In **Barclays Capital v. Theflyonthewall.com (2d Cir. 2011)**, the court held the hot-news claim **preempted by federal copyright law**, finding that gathering and disseminating factual information **with attribution** is "not free-riding." The doctrine survives only in a narrow band (the NBA v. Motorola five-factor test) that attributed headline-linking does not meet.

**What's gray / what to avoid:**
- **Copying the lede or the "heart" of the article** — the **AP v. Meltwater, 931 F. Supp. 2d 537 (S.D.N.Y. 2013)** trap. Meltwater, a *paid* monitoring service, copied each article's **headline + lede + a "hit sentence" + link**, and **lost on fair use**: the court found it copied "a qualitatively significant part… (the 'heart of the story')" and functioned as "an 'expensive subscription service'" substitute, not a referral tool (click-through under 1% vs. 60%+ for Google News). **Lesson: never reproduce the opening sentence/lede or a substantial excerpt.** Headline-only + link, driving traffic *to* the source, is the safe side of the line. (Meltwater is a district-court opinion that settled before appeal — persuasive, not binding, and widely criticized — but it defines the risk boundary.)
- **No images / no hotlinking** — images carry their own copyright; the plan to show no images is correct and removes a whole risk category.
- **No summaries / no full-text scraping** — also correctly excluded; summarization risks creating a derivative and substituting for the original.
- **EU/UK divergence.** The **DSM Copyright Directive Article 15** ("press publishers' right," the "link tax") gives EU publishers a right over online reuse of press publications, **but expressly exempts (i) acts of hyperlinking and (ii) "individual words or very short extracts."** Headline-plus-link is designed to fall inside these carve-outs. Spain's earlier law caused Google News to **shut down in Spain**; France forced Google to negotiate payments (and fined it €500M for failing to negotiate in good faith). Implementation is uneven across member states and the meaning of "very short extract" is unsettled — so a solo free operator showing only headlines + links is low-risk but should **avoid snippet text** entirely to stay inside the carve-out.
- **Feed terms of use / Google News RSS.** RSS is meant to be consumed by software, but individual feeds' terms can restrict commercial republication. **Google News RSS** is widely used by aggregators, but Google's terms are not a clear grant for commercial redistribution of feed content — treat Google News RSS as **gray**: fine for personal/non-commercial display and linking, riskier as a core commercial dependency. Prefer pulling from publishers' own feeds and GDELT (which has an explicit redistribution grant) where possible.
- **GDELT licensing** — explicitly permissive: redistribution allowed "in any form" with attribution + link to gdeltproject.org. This is the cleanest source you have; cite it.

**Bottom line for a solo non-lawyer:** headline + source + timestamp + outbound link, no images, no lede, no summaries, attributed, free, driving traffic to publishers = **low risk** in the US and inside the EU Art. 15 carve-outs. The avoidable mistakes are reproducing ledes/snippets (Meltwater), hotlinking images, and over-relying on Google News RSS as a commercial input.

### AREA 6 — PWA-as-website and resilience

**(a) PWA in 2025–2026.** Apple added **Web Push for installed PWAs in iOS 16.4** (March 2023) and a Badging API, but PWAs on iOS still require **manual "Add to Home Screen"** (no install prompt), have **no Background Sync**, a **small (~50 MB) cache quota**, and **aggressive storage eviction**. In Feb 2024 Apple briefly removed home-screen web apps in the EU under the DMA, then reversed. **For a finishable news reader, a full PWA adds complexity for little gain** — you don't need push (it's anti-ethos), offline catalog browsing is marginal for a link-out reader, and background sync is unavailable. **However**, shipping a **minimal PWA manifest + a thin service worker** is worth it for one specific reason: **home-screen install is the only way to exempt the user's localStorage from Safari's 7-day deletion** (Area 4). Recommendation: **ship a lightweight installable PWA (manifest + app-shell caching), skip push and heavy offline.**

**(b) Resilience for a one-person static site.**
- **Edge-cache the shared news JSON** on Cloudflare's CDN; static assets are unlimited/free and survive traffic spikes without operator intervention.
- **GDELT-outage fallback.** GDELT has **no SLA, no public status page, and is a solo-creator (Kalev Leetaru) project** hosted on Google Cloud and supported by Google Jigsaw; it showed continuous operation through 2025–2026 (unbroken monthly file archives, near-daily blog activity) with no documented major data-feed outage — though occasional missing 15-minute files occur, and data quality is imperfect (a 2025 study in *Data*, Hong et al., found event-field accuracy ~55% with ~20% redundancy — relevant to dedup, not uptime). **Treat GDELT as reliable-but-not-guaranteed.** Build graceful degradation: (1) **serve last-good cached JSON** if a GDELT pull fails; (2) **fall back to the RSS sources already in the registry** (the same feeds power both modes); (3) keep the **JSONL archive** as a deeper backstop. The system should never hard-fail because GDELT blinked.
- **URL-based dedup** already gives you resilience against GDELT's redundancy problem.
- **Graceful degradation generally:** static shell renders even if all dynamic data fails; show a clear "couldn't refresh, showing last update" state.

**(c) Privacy-preserving analytics.** Use **cookieless, aggregate-only analytics** that need no consent banner: **Plausible** (no cookies, aggregate-only, ~1 KB script, EU-hosted, no consent banner required — "We do not track visitors across devices, websites or time. All data is in aggregate only") or **GoatCounter** (open-source, cookieless, free for personal/non-commercial use with unlimited pageviews, ~3.5 KB, self-hostable, commercial use from $5/mo). Both let the operator know whether anyone visits without betraying the no-tracking ethos. **Recommendation: GoatCounter (free tier or self-hosted) or Plausible**, aggregate metrics only.

---

## Recommendations

**Stage 0 — Rename before any launch/marketing.**
1. Brainstorm within the **completion/quiet** and **coined-abstract** families; carry 5–8 candidates (e.g., Tideline, Relay, a coined word, a Ledger-variant).
2. Run the **non-lawyer screening checklist** (USPTO knockout, SERP test, domain test, common-law sweep) on all of them.
3. Pay an attorney for a **comprehensive clearance** only on the 1–2 finalists, in software/SaaS/online-publication classes.
- *Threshold to change course:* if a finalist has a live, confusingly-similar mark in a related class or a major incumbent owns the SERP, drop it.

**Stage 1 — Ship the free front door at $0.**
1. Cloudflare Pages static shell + scheduled Worker pulling GDELT → one shared JSON on the CDN.
2. Minimal PWA manifest + app-shell service worker (for home-screen install / storage protection), no push.
3. GoatCounter/Plausible aggregate analytics.
4. OPML + JSON export/import as the portability backbone.
- *Threshold:* if you approach Cloudflare Pages' 500 builds/month or 20k-file limits, restructure the build; bandwidth will not be a constraint.

**Stage 2 — Add the paid power tier only when there's demand.**
1. Gate the **RSS CORS proxy** behind a license-key unlock (Lemon Squeezy or Paddle for merchant-of-record tax handling; Stripe Payment Link if you'll handle tax).
2. Implement **client-side fetch first, proxy fallback**, with **KV shared-cache + conditional GET + poll throttling** in the proxy.
3. Price the unlock at a **suggested $5–$15 PWYW** with a middle-anchored default; frame as "free with optional support."
4. Offer **optional E2EE sync via the user's own Dropbox/Drive/WebDAV** as a paid feature — you store nothing.
- *Thresholds that change the plan:* if paid-tier RSS volume pushes Workers past the 10M-requests/month included allotment, the overage (~$0.30/M) is covered by unlock revenue at any realistic conversion ≥ ~1%. If conversion sits below ~1%, raise the suggested price or add the charitable/transparency framing the Gneezy research shows lifts PWYW payments (from $0.92 to $5.33 per buyer when paired with a cause).

**Stage 3 — Resilience hardening.**
1. Ship the **GDELT→RSS-registry→JSONL** fallback chain and the "showing last update" degraded state.
2. Nudge iOS users to **add to home screen** to protect their saved state from Safari's 7-day storage deletion, and prompt periodic **export**.

---

## Caveats
- **PWYW conversion is the biggest uncertainty.** The 2–5% planning range is an industry heuristic, not a measured figure for this product; the Gneezy 2010 research shows averages can collapse toward ~$0.92/buyer without anchoring/cause framing. Validate against your own funnel before relying on it.
- **The 1M-user RSS cost is an estimate**, sensitive to how many *unique* (long-tail) feeds paid users follow — the shared cache only helps popular feeds. Real cost could swing from low-tens to several-hundred dollars/month; instrument it early.
- **AP v. Meltwater is a non-binding district-court opinion that settled before appeal** and was widely criticized; it defines a *risk boundary*, not settled nationwide law. The headline-only/no-lede design stays well clear of it, but this is general information, not legal advice — get a lawyer before launch if monetizing.
- **EU Art. 15 "very short extract" is legally unsettled** and implemented unevenly across member states; the safest posture is headlines + links with **no snippet text at all**.
- **Google News RSS terms are gray** for commercial redistribution; do not make it a load-bearing commercial dependency.
- **GDELT reliability rests partly on absence-of-evidence** (no public status page exists; the "no 2025 outage" finding is inferred from continuous blog/file activity) and it is a single-creator project — hence the mandatory fallback.
- **Some pricing figures (Workers overage, Lemon Squeezy/Stripe fees) change frequently**; confirm current rates at implementation time.
- Lower-quality sources (Medium tutorials, vendor blogs, SEO listicles) were used only for corroboration of technical patterns, not for load-bearing claims; primary docs (Cloudflare, WebKit, USPTO, GDELT, court opinions, *Science*/Gneezy et al.) anchor the key facts.