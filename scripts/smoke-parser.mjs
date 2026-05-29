import { parseXmlFeed } from '../lib/parse-rss.js';

const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Test Headline &amp; One]]></title><link>https://example.com/a?utm_source=x</link><pubDate>Tue, 26 May 2026 12:00:00 GMT</pubDate><source url="https://example.com">Example</source></item></channel></rss>`;
const items = parseXmlFeed(xml, { id: 'smoke' });
if (items.length !== 1 || items[0].title !== 'Test Headline & One') {
  console.error(items);
  throw new Error('Parser smoke test failed');
}
console.log('PARSER SMOKE OK');
