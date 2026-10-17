import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const workbench = readFileSync('src/shell/styles/host.css', 'utf8');
const agent = readFileSync('src/modules/agent/styles/agent.css', 'utf8');

test('native workbench pages stay hidden until the host activates them', () => {
	assert.match(workbench, /\.nand-workbench-page\[hidden\] \{ display: none; \}/);
});

test('the terminal renderer occupies its React host', () => {
	assert.match(agent, /\.nand-terminal-view \{\s*position: absolute;\s*inset: 0;/);
});
