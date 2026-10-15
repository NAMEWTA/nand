// Run both builders and serialize CSS writes so edits never race the concatenator.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('@tailwindcss/cli/package.json')), 'dist', 'index.mjs');
execFileSync(process.execPath, ['scripts/build-tailwind.mjs', '--write-styles'], { stdio: 'inherit' });
const children = [
 spawn(process.execPath, ['esbuild.config.mjs'], { stdio: 'inherit' }),
 spawn(process.execPath, [cli, '-i', 'src/ui/tailwind/index.css', '-o', 'build/tailwind.raw.css', '--optimize', '--watch'], { stdio: 'inherit' }),
];
let timer;
function scheduleStyles() {
 clearTimeout(timer);
 timer = setTimeout(() => {
  try { execFileSync(process.execPath, ['scripts/build-tailwind.mjs', '--skip-compile', '--write-styles'], { stdio: 'inherit' }); }
  catch (error) { console.error('CSS rebuild failed', error.message); }
 }, 150);
}
const watcher = fs.watch('build', (_, file) => { if (file === 'tailwind.raw.css') scheduleStyles(); });
const authors = fs.watch('src', { recursive: true }, (_, file) => {
 if (!file || file.endsWith('fonts.generated.css') || file.startsWith('ui' + path.sep + 'tailwind')) return;
 if (/\.(css|woff2)$/.test(file) || file === 'styles.json') scheduleStyles();
});
let stopping = false;
function stop(code = 0) {
 if (stopping) return;
 stopping = true;
 clearTimeout(timer);
 watcher.close();
 authors.close();
 for (const child of children) child.kill();
 process.exitCode = code;
}
for (const child of children) {
 child.on('error', (error) => { console.error(error); stop(1); });
 child.on('exit', (code) => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
