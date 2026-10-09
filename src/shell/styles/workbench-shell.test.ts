import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const stacked = readFileSync('src/modules/home/styles/021-stacked-layout-desktop-tablet-only.css', 'utf8');
const workbench = readFileSync('src/shell/styles/workbench-pages.css', 'utf8');
const agent = readFileSync('src/modules/agent/styles/agent.css', 'utf8');

test('stacked layout still hides the sidebar calendar and recent notes', () => {
	assert.match(stacked, /\[data-layout="stacked"\] \.dashboard-sidebar-week-calendar,\s*\[data-layout="stacked"\] \.dashboard-recent \{\s*display: none;/);
});

test('the workbench home overview keeps those same classes visible', () => {
	assert.match(workbench, /\.nand-workbench-home-overview \.nand-workbench-home-calendar \.dashboard-sidebar-week-calendar \{ display: flex; \}/);
	assert.match(workbench, /\.nand-workbench-home-overview \.nand-workbench-home-recent \.dashboard-recent \{ display: block; \}/);
});

test('the agent page gives the terminal panes all remaining height', () => {
	assert.match(agent, /\.nand-agent-panes \{\s*display: flex;\s*flex: 1;\s*min-height: 0;/);
	assert.match(agent, /\.nand-terminal-view \{\s*position: absolute;\s*inset: 0;/);
});
