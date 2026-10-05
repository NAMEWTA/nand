// Temporary implementation helpers; removed before final review.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
export const read = (path) => readFileSync(path, 'utf8');
export const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text.trimStart(), 'utf8'); };
export const replace = (path, before, after) => {
 const text = read(path);
 if (!text.includes(before)) throw new Error('Missing reviewed anchor: ' + path + ' ' + before.slice(0, 100));
 put(path, text.replace(before, after));
};
export const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
