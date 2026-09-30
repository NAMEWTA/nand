import { pathToFileURL } from 'node:url';
const repo = process.env.NAND_REPO || process.cwd();
import assert from 'node:assert/strict';
const { AutomationEditor } = await import(new URL('./src/view/automations/editor.ts', pathToFileURL(repo + '/')).href);
const { Setting, Notice } = await import(new URL('./scripts/obsidian-stub.ts', pathToFileURL(repo + '/')).href);
const { setLanguage, t } = await import(new URL('./src/shared/i18n/index.ts', pathToFileURL(repo + '/')).href);
setLanguage('en');
const saved = [];
const api = {
	deviceId: 'fixture-device',
	agent: () => undefined,
	save: async (d) => {
		saved.push(structuredClone(d));
	},
	tick: async () => {},
};
const targets = [
	{ path: 'First.md', cardId: 'card-one', title: 'First board/card' },
	{ path: 'Second.md', cardId: 'card-two', title: 'Second board/card' },
];
const def = {
	id: 'create',
	name: 'Fixture task creator',
	enabled: true,
	deviceId: 'fixture-device',
	revision: 1,
	schedule: { kind: 'manual' },
	action: { kind: 'create-task', path: 'First.md', cardId: 'card-one', text: 'Test task' },
	channels: ['in-app'],
	notifyOn: 'always',
	graceMinutes: 720,
	createdAt: 0,
	updatedAt: 0,
};
const editor = new AutomationEditor({}, api, async () => targets, '/fixture', undefined, '', def);
editor.onOpen();
await new Promise((r) => setTimeout(r, 0));
const target = Setting.created.find((x) => x.name === t('automation.target')).dropdowns[0];
assert.equal(target.value, '0');
target.value = '';
target.fire(''); // Actual UI onChange registered by AutomationEditor
await editor.save();
assert.equal(saved.length, 0);
assert.ok(Notice.messages.includes(t('automation.targetRequired')));
assert.equal(editor.draft.action.path, '');
assert.equal(editor.draft.action.cardId, '');
target.fire('1');
await editor.save();
assert.equal(saved.length, 1);
assert.equal(saved[0].action.path, 'Second.md');
console.log('Automation target: empty selection rejected, re-selection saved');
