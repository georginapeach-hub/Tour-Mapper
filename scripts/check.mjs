import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const src = new URL('../src/', import.meta.url);
for (const file of await readdir(src)) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', new URL(file, src).pathname], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const html = await readFile(new URL('index.html', src), 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^https?:/.test(ref)) continue;
  await access(new URL(ref.split('?')[0], src));
}
console.log('JavaScript syntax and local asset references passed.');
