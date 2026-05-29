# LIVE AUTO-PULL

The browser now updates the visible database without a page reload.

## Mechanism

This is intentionally not WebSockets. Serverless hosts are better served by controlled polling.

- The page opens `/api/news`.
- It remembers the first working endpoint: Vercel, Netlify, or static cache.
- It pulls again on a selected cadence.
- Default cadence is 60 seconds.
- Manual `PULL NOW` uses `force=1` on live endpoints to bypass the in-process cache.
- Normal auto-pulls respect the server cache so public RSS/GDELT pipes are not hammered.
- New records get a `NEW` marker and a hard left rail.
- Filters, search, section, table mode, and scroll position are not reset by the browser.

## Cadence guidance

Use 60 seconds while developing. Use 5 minutes for a public free-hosted deployment if traffic grows.

The page has no fake push layer. It performs real network pulls and swaps the database table in place.
