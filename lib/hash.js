import crypto from 'node:crypto';

export function stableHash(value = '') {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16);
}
