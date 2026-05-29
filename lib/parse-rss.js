import { cleanText, titleLooksBad } from './text.js';

function firstMatch(block, regex) {
  const match = block.match(regex);
  return match ? match[1] : '';
}

function getTag(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return firstMatch(block, new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
}

function getAttr(block, tag, attr) {
  const tagMatch = block.match(new RegExp(`<${tag}\\s+([^>]*)>`, 'i')) || block.match(new RegExp(`<${tag}\\s+([^>]*)\\/>`, 'i'));
  if (!tagMatch) return '';
  const attrs = tagMatch[1];
  const attrMatch = attrs.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
  return attrMatch ? attrMatch[1] : '';
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(cleanText(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseRssItems(xml, source) {
  const itemBlocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return itemBlocks.map((block) => {
    const title = cleanText(getTag(block, 'title'));
    let url = cleanText(getTag(block, 'link')) || cleanText(getTag(block, 'guid'));
    const enclosureUrl = getAttr(block, 'enclosure', 'url');
    if (!url && enclosureUrl) url = enclosureUrl;
    const pubDate = getTag(block, 'pubDate') || getTag(block, 'dc:date') || getTag(block, 'date');
    const itemSource = cleanText(getTag(block, 'source'));
    const itemSourceUrl = getAttr(block, 'source', 'url');
    return {
      title,
      url,
      publishedAt: parseDate(pubDate),
      rawSource: itemSource,
      rawSourceUrl: itemSourceUrl,
      description: cleanText(getTag(block, 'description')),
      sourceId: source.id
    };
  }).filter((item) => !titleLooksBad(item.title) && item.url);
}

function parseAtomEntries(xml, source) {
  const entryBlocks = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return entryBlocks.map((block) => {
    const title = cleanText(getTag(block, 'title'));
    let url = getAttr(block, 'link', 'href');
    if (!url) url = cleanText(getTag(block, 'link'));
    const date = getTag(block, 'updated') || getTag(block, 'published') || getTag(block, 'modified');
    const authorBlock = getTag(block, 'author');
    const rawSource = cleanText(getTag(authorBlock, 'name'));
    return {
      title,
      url,
      publishedAt: parseDate(date),
      rawSource,
      rawSourceUrl: '',
      description: cleanText(getTag(block, 'summary') || getTag(block, 'content')),
      sourceId: source.id
    };
  }).filter((item) => !titleLooksBad(item.title) && item.url);
}

export function parseXmlFeed(xml = '', source = {}) {
  const feedText = String(xml || '');
  if (!feedText.trim()) return [];
  const rss = parseRssItems(feedText, source);
  const atom = parseAtomEntries(feedText, source);
  return [...rss, ...atom];
}
