# GDELT query bank

GDELT is included through sources with:

```json
{
  "type": "gdelt",
  "query": "...",
  "timespan": "24h",
  "maxItems": 75
}
```

The serverless function converts those records to a GDELT DOC 2.0 ArticleList JSON request.

Included GDELT pipes:

- Public Money
- Conflict
- Public Corruption
- Contractor Fraud
- Healthcare Fraud
- Local Government
- Courts / Indictments
- War / Frontline
- Disasters
- Police Settlements

The UI separates:

- **PUBLISHER** — who published the linked story.
- **PIPE** — which intake feed/query found it.
- **HOST** — the outbound article domain.

That is why GDELT may not always appear in the visible publisher column. It appears in the PIPE column, Source Ledger, Query Bank, and raw JSON.
