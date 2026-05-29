import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const out = path.resolve(root, '..', 'public-wire-index.zip');
const result = spawnSync('zip', ['-r', out, '.', '-x', 'node_modules/*', '.git/*'], {
  cwd: root,
  stdio: 'inherit'
});
if (result.status !== 0) process.exit(result.status || 1);
console.log(out);
