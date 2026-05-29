const STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_name', 'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid',
  'cmpid', 'ocid', 'smid', 'ref', 'ref_src'
]);

export function safeUrl(value = '') {
  try {
    return new URL(String(value).trim());
  } catch {
    return null;
  }
}

export function canonicalizeUrl(value = '') {
  const parsed = safeUrl(value);
  if (!parsed) return String(value || '').trim();
  for (const key of [...parsed.searchParams.keys()]) {
    if (STRIP_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key);
  }
  parsed.hash = '';
  parsed.hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
  let out = parsed.toString();
  if (out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

export function hostFromUrl(value = '') {
  const parsed = safeUrl(value);
  return parsed ? parsed.hostname.replace(/^www\./, '').toLowerCase() : '';
}
