#!/usr/bin/env node
// Production CLI entry: loads the compiled `dist/` output.
// (The TypeScript source lives in `src/bin/weasyprint.ts`.)
try {
  await import('../dist/bin/weasyprint.js');
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
