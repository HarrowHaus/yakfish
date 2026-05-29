# Database Boundary

PUBLIC WIRE INDEX ships without a database because the core function is a live directory, not an archive.

## Add a database only for memory

A database is justified when the product needs memory:

- first seen timestamp
- last seen timestamp
- source uptime history
- trend counts
- duplicate clusters over time
- daily records
- saved query pages
- alert thresholds

## Minimal schema

```sql
create table sources (
  id text primary key,
  label text not null,
  type text not null,
  url text,
  query text,
  section text not null,
  jurisdiction text,
  language text,
  enabled integer not null default 1,
  trust_tier text,
  created_at text not null,
  updated_at text not null
);

create table articles (
  id text primary key,
  title text not null,
  url text not null,
  canonical_url text not null,
  host text,
  source_id text not null,
  source_label text,
  section text not null,
  jurisdiction text,
  published_at text,
  first_seen_at text not null,
  last_seen_at text not null,
  dupe_key text,
  raw_hash text
);

create table fetch_runs (
  id text primary key,
  source_id text not null,
  started_at text not null,
  finished_at text,
  status text not null,
  item_count integer not null default 0,
  latency_ms integer,
  error_message text
);

create table article_tags (
  article_id text not null,
  tag text not null,
  primary key (article_id, tag)
);

create table saved_queries (
  id text primary key,
  label text not null,
  section text,
  query text not null,
  enabled integer not null default 1,
  created_at text not null
);
```

## Suggested database choices

- Cloudflare D1 for Cloudflare Workers / Pages.
- Turso for portable SQLite.
- Supabase if a Postgres dashboard/admin UI becomes useful.

## Rule

Do not add database complexity for the live directory. Add it only when memory is the feature.
