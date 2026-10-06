import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const stacked = readFileSync('src/view/styles/021-stacked-layout-desktop-tablet-only.css', 'utf8');
const workbench = readFileSync('src/view/styles/117-nand-unified-workbench-neutral-shell-isolated-fr.css', 'utf8');
const nativeTerminal = readFileSync('src/view/styles/115-agent-workbench-the-xterm-island-stays-mounted-w.css', 'utf8');

test('stacked layout still hides the sidebar calendar and recent notes', () => {
	assert.match(stacked, /\[data-layout="stacked"\] \.dashboard-sidebar-week-calendar,\s*\[data-layout="stacked"\] \.dashboard-recent \{\s*display: none;/);
});

test('the workbench home overview keeps those same classes visible', () => {
	assert.match(workbench, /\.nand-workbench-home-overview \.nand-workbench-home-calendar \.dashboard-sidebar-week-calendar \{ display: flex; \}/);
	assert.match(workbench, /\.nand-workbench-home-overview \.nand-workbench-home-recent \.dashboard-recent \{ display: block; \}/);
});

test('an embedded workbench terminal fills the only grid column', () => {
	assert.match(workbench, /\.terminal-workbench-shell\.is-workbench-embedded > \.nand-agent-center \{ grid-column: 1; \}/);
	assert.match(nativeTerminal, /\.nand-agent-center \{ grid-column: 3; /);
	assert.match(nativeTerminal, /@container nand-terminal \(max-width: 799px\)/);
	assert.match(nativeTerminal, /\.nand-agent-center \{ grid-column: 1; \}/);
});
