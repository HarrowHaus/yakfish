# LIVE NEWS DATABASE — Finished Product Basis

LIVE NEWS DATABASE is a severe live headline database.

It is not a news feed, CMS, social product, newsletter, AI summarizer, or publication. It is a source-linked public record table of current headline metadata.

## Product law

Every row must answer:

```txt
What is the headline?
Who published it?
Which pipe found it?
When did it appear?
What section is it filed under?
What host does it leave to?
Did the source system break?
```

## Interface law

- Ugly on purpose.
- Tables first.
- No cards.
- No infinite scroll.
- No images.
- No decorative widgets.
- No recommender language.
- Provenance is the interface.

## Core tables

1. HEADLINES
2. SOURCES
3. BROKEN SOURCES
4. INTAKE
5. RAW OUTPUT

## Data law

- Headline/title/link/date/source metadata only.
- No full article scraping.
- No headline rewriting.
- No summaries.
- Broken pipes remain visible.
- Aggregator pipes remain labeled.
- GDELT pipes remain labeled.

## Release object

The repository is portable across:

- Local phone/PC Node server
- Vercel serverless endpoint
- Netlify serverless endpoint
- GitHub Pages static cache
- Git-backed JSONL archive
