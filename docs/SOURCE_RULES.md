# Source Rules

## Add RSS source

```json
{
  "id": "unique-id",
  "label": "Publisher — Feed Name",
  "section": "WORLD",
  "type": "rss",
  "url": "https://example.com/feed.xml",
  "homepage": "https://example.com/",
  "jurisdiction": "GLOBAL",
  "language": "en",
  "enabled": true,
  "maxItems": 40,
  "trustTier": "publisher"
}
```

## Add Google News RSS query

```json
{
  "id": "google-query-name",
  "label": "Google News — Query Name",
  "section": "COURTS",
  "type": "rss",
  "url": "https://news.google.com/rss/search?q=indictment%20OR%20sentenced&hl=en-US&gl=US&ceid=US:en",
  "jurisdiction": "US",
  "language": "en",
  "enabled": true,
  "maxItems": 50,
  "trustTier": "aggregator"
}
```

## Add GDELT query

```json
{
  "id": "gdelt-topic-name",
  "label": "GDELT — Topic Name",
  "section": "MONEY",
  "type": "gdelt",
  "query": "\"government fraud\" OR \"contractor fraud\"",
  "jurisdiction": "GLOBAL",
  "language": "en",
  "enabled": true,
  "maxItems": 75,
  "trustTier": "open-data",
  "timespan": "3d"
}
```

## Section names

Section names are just strings. Recommended set:

```txt
TOP
WORLD
US
POLITICS
MONEY
COURTS
WAR
LOCAL
TECH
HEALTH
SCIENCE
CULTURE
SPORTS
ODD
OBITS
```

## Validation

```bash
npm run validate:feeds
npm run validate:news
```
