import { buildNews, sendJson } from '../lib/build-news.js';

export default async function handler(req, res) {
  try {
    const force = req?.query?.force === '1' || req?.url?.includes('force=1');
    const payload = await buildNews({ force });
    sendJson(res, payload, 200, 60);
  } catch (error) {
    sendJson(res, {
      product: 'PUBLIC WIRE INDEX',
      updatedAt: new Date().toISOString(),
      error: true,
      message: error?.message || String(error),
      articles: [],
      sources: []
    }, 500, 60);
  }
}
