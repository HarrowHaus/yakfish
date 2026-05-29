import { readSources } from '../lib/build-news.js';

const sources = await readSources();
const ids = new Set();
const errors = [];

for (const source of sources) {
  if (!source.id) errors.push('Source missing id.');
  if (ids.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
  ids.add(source.id);
  if (!source.label) errors.push(`${source.id}: missing label`);
  if (!source.section) errors.push(`${source.id}: missing section`);
  if (!source.type) errors.push(`${source.id}: missing type`);
  if (source.type === 'rss' && !source.url) errors.push(`${source.id}: rss source missing url`);
  if (source.type === 'gdelt' && !source.query) errors.push(`${source.id}: gdelt source missing query`);
  if (source.type && !['rss', 'gdelt'].includes(source.type)) errors.push(`${source.id}: unsupported type ${source.type}`);
}

if (errors.length) {
  console.error('FEED REGISTRY FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`FEED REGISTRY OK: ${sources.length} sources`);
console.log([...new Set(sources.map((s) => s.section))].sort().join(', '));
