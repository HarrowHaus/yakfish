import { buildNews } from '../../lib/build-news.js';

export async function handler(event) {
  try {
    const force = event?.queryStringParameters?.force === '1';
    const payload = await buildNews({ force });
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, stale-while-revalidate=300'
      },
      body: JSON.stringify(payload)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        product: 'PUBLIC WIRE INDEX',
        updatedAt: new Date().toISOString(),
        error: true,
        message: error?.message || String(error),
        articles: [],
        sources: []
      })
    };
  }
}
