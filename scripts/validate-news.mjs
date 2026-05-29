import { buildNews } from '../lib/build-news.js';

const data = await buildNews({ force: true, cacheSeconds: 0 });
console.log(`UPDATED: ${data.updatedAt}`);
console.log(`SOURCES: ${data.okSourceCount} ok / ${data.brokenSourceCount} broken / ${data.sourceCount} total`);
console.log(`ARTICLES: ${data.articleCount} kept / ${data.rawArticleCount} raw`);

const broken = data.sources.filter((source) => source.status === 'error');
if (broken.length) {
  console.log('\nBROKEN SOURCES:');
  for (const source of broken) console.log(`- ${source.id}: ${source.error}`);
}

const firstTen = data.articles.slice(0, 10);
console.log('\nTOP 10 HEADLINES:');
for (const article of firstTen) {
  console.log(`${article.publishedAt} | ${article.section} | ${article.source} | ${article.title}`);
}

if (!data.articleCount) {
  console.error('NO ARTICLES RETURNED. The app refuses to pass validation without live/cached headlines.');
  process.exit(1);
}
