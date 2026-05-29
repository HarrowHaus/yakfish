export function stripCdata(value = '') {
  return String(value)
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .trim();
}

export function decodeEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function stripTags(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ');
}

export function cleanText(value = '') {
  return decodeEntities(stripTags(stripCdata(value)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitle(value = '') {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|live|update|updates|breaking)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleLooksBad(title = '') {
  const t = cleanText(title);
  if (!t || t.length < 8) return true;
  if (/^http/i.test(t)) return true;
  return false;
}
