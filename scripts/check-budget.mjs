// scripts/check-budget.mjs
// A LEANNESS TRIPWIRE — not a sacred number. The law is: lean, vanilla, cheap,
// permanent, no bloat. CEILING_BYTES is a self-chosen alarm against creeping bloat in
// the SHELL (HTML + CSS + JS + fonts); it is ours to move if leanness is genuinely
// served. (It is NOT the external "512 KB club" — that was only ever a proxy for the
// value.) The news payload (public/cache, public/archive) is capped separately/excluded.
// Dependency-free on purpose — do not add packages for this.
//
// Measures *uncompressed* bytes (stricter than transfer size), which is fine.

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "public";
const CEILING_BYTES = 512 * 1024; // chosen leanness tripwire — adjustable in service of the value
const BUDGET_BYTES = CEILING_BYTES;
const EXCLUDE_DIRS = new Set(["cache", "archive"]); // the data payload, not the shell

async function walk(dir) {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    console.error(`✗ Could not read ${dir} — run from the repo root.`);
    process.exit(2);
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      total += await walk(p);
    } else {
      total += (await stat(p)).size;
    }
  }
  return total;
}

const bytes = await walk(ROOT);
const kb = (bytes / 1024).toFixed(1);
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);

if (bytes > BUDGET_BYTES) {
  const over = ((bytes - BUDGET_BYTES) / 1024).toFixed(1);
  console.error(`✗ Shell is ${kb} KB — OVER the ${budgetKb} KB budget by ${over} KB.`);
  console.error(`  Trim CSS/JS, subset fonts further (drop unused weights/italics), or remove an asset.`);
  process.exit(1);
}
console.log(`✓ Shell is ${kb} KB — under the ${budgetKb} KB budget.`);
