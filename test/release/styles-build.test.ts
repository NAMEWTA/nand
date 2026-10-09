import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';

const script = path.resolve('scripts/build-styles.mjs');
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it('checks and writes the same stylesheet with CRLF sources and an LF package stylesheet', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'nand-styles-'));
	dirs.push(root);
	mkdirSync(path.join(root, 'src'));
	mkdirSync(path.join(root, 'node_modules/vendor'), { recursive: true });
	writeFileSync(path.join(root, 'src/styles.json'), JSON.stringify({ sources: ['src/theme.css', 'node_modules/vendor/style.css'] }));
	writeFileSync(path.join(root, 'src/theme.css'), '/* 主题 */\r\n.page { color: red; }\r\n');
	writeFileSync(path.join(root, 'node_modules/vendor/style.css'), '.terminal { color: blue; }\n');
	const expected = '/* 主题 */\n.page { color: red; }\n.terminal { color: blue; }\n';
	const checkedOut = expected.replace(/\n/g, '\r\n');
	const output = path.join(root, 'styles.css');
	writeFileSync(output, checkedOut);
	const run = (mode: string) => spawnSync(process.execPath, [script, mode], { cwd: root, encoding: 'utf8' });
	const checked = run('--check');
	expect(checked.status, checked.stderr).toBe(0);
	expect(readFileSync(output, 'utf8')).toBe(checkedOut);
	expect(run('--write').status).toBe(0);
	expect(readFileSync(output, 'utf8')).toBe(expected);
	expect(run('--check').status).toBe(0);
	writeFileSync(output, expected.replace('red', 'green'));
	expect(run('--check').status).toBe(1);
	expect(readFileSync(output, 'utf8')).toContain('green');
});
