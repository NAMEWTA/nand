// Run only against an isolated Obsidian vault: changes settings and closes test terminals.
import fs from 'node:fs/promises';
import { dir } from './common.mjs';
await fs.mkdir(dir, { recursive: true });
for (const name of ['terminal', 'filters', 'filter-options', 'colors', 'lifecycle', 'dashboard-conflict']) {
	await import(`./${name}.mjs`);
}
