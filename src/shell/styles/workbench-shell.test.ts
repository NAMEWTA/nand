import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const stacked = readFileSync('src/modules/home/ui/sidebar/Sidebar.tsx', 'utf8');
const workbench = readFileSync('src/app/workbench/legacy-pages.css', 'utf8');
const agent = readFileSync('src/modules/agent/styles/agent.css', 'utf8');

test('stacked layout still hides the sidebar calendar and recent notes', () => {
	assert.ok(stacked.includes('{!stacked && <WeekStrip />}'));
	assert.ok(stacked.includes('{!stacked && <RecentDocs store={store} />}'));
});

test('the workbench home overview keeps those same classes visible', () => {
	assert.match(workbench, /\.nand-workbench-home-overview \.nand-workbench-home-calendar \.dashboard-sidebar-week-calendar \{ display: flex; \}/);
	assert.match(workbench, /\.nand-workbench-home-overview \.nand-workbench-home-recent \.dashboard-recent \{ display: block; \}/);
});

test('the terminal renderer occupies its React host', () => {
	assert.match(agent, /\.nand-terminal-view \{\s*position: absolute;\s*inset: 0;/);
});
