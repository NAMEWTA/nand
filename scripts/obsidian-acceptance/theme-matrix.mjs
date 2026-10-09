// Screenshot matrix of the global theme presets on a Markdown sample in Reading, Live Preview and Source.
// Usage: NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian xvfb-run -a node scripts/obsidian-acceptance/theme-matrix.mjs /tmp/<new-dir>
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const root = process.argv[2];
assert.ok(root, 'Pass a new directory for the disposable vault');
const sample = `# Heading one
Body text with **bold words**, *italic words*, \`inline code\` and a [[Link target]].

## Heading two
> A quote that should stand apart from body text.

### Heading three
- First item with **emphasis**
- Second item

#### Heading four
##### Heading five
###### Heading six
`;
const { connection, stop, shot, evidence } = await launchFreshVault({
	root,
	files: { 'Sample.md': sample },
	settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { home: false, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false } } } },
});
const run = (expression) => connection.evaluate(expression);
const results = [];
try {
	await connection.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false });
	await run(`(async()=>{const leaf=app.workspace.getLeaf(false);await leaf.openFile(app.vault.getAbstractFileByPath('Sample.md'));app.workspace.rightSplit?.collapse?.();app.workspace.leftSplit?.collapse?.();})()`);
	for (const preset of ['system', 'claude-code', 'eye-care']) {
		await run(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}},{persist:'immediate'})`);
		for (const mode of ['light', 'dark']) {
			await run(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
			for (const view of ['preview', 'live', 'source']) {
				await run(`(async()=>{const leaf=app.workspace.getMostRecentLeaf();const state=leaf.getViewState();state.state.mode=${JSON.stringify(view === 'preview' ? 'preview' : 'source')};state.state.source=${view === 'source'};await leaf.setViewState(state);})()`);
				await delay(400);
				const probe = await run(`(()=>{const body=document.body;const h1=document.querySelector('.markdown-reading-view h1, .HyperMD-header-1');const strong=document.querySelector('.markdown-reading-view strong, .cm-strong');const cs=(el,p)=>el?getComputedStyle(el).getPropertyValue(p):null;return {classes:[...body.classList].filter(c=>c.startsWith('nand-')),bg:getComputedStyle(body).getPropertyValue('--background-primary').trim(),h1Border:cs(h1,'border-bottom-style'),boldColor:cs(strong,'color')};})()`);
				results.push({ preset, mode, view, ...probe });
				await shot(`theme-${preset}-${mode}-${view}`);
			}
		}
	}
	const system = results.filter((row) => row.preset === 'system');
	assert.ok(system.every((row) => row.classes.length === 0), 'Follow system adds no NAND body classes');
	assert.ok(results.filter((row) => row.preset === 'claude-code' && row.mode === 'light').every((row) => row.bg === '#faf9f5'), 'Claude Code light background');
	assert.ok(results.filter((row) => row.preset !== 'system' && row.view !== 'source').every((row) => row.h1Border === 'solid'), 'Accented H1 rule in Reading and Live Preview');
	console.log(JSON.stringify({ passed: true, evidence, results }, null, 1));
} finally {
	await stop();
}
