import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { TerminalWorkbench } from '../src/view/terminal/TerminalWorkbench';
import { InboxPanel } from '../src/view/notifications/InboxPanel';
import type { NotificationRecord } from '../src/core/notifications/service';

const { document } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document });
const left = document.createElement('div');
const right = document.createElement('div');
document.body.append(left, right);
let searches = 0,
	previous = 0,
	next = 0,
	closed = 0;
let terminal: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
const refs = {
	terminalRef: (node: HTMLDivElement | null) => {
		terminal = node;
	},
	inputRef: (node: HTMLInputElement | null) => {
		input = node;
	},
	searchRef: () => {},
};
const actions = {
	search: () => {
		searches++;
	},
	previous: () => {
		previous++;
	},
	next: () => {
		next++;
	},
	closeSearch: () => {
		closed++;
	},
};
const row: NotificationRecord = {
	id: 'one',
	title: 'One',
	body: 'Content',
	createdAt: 0,
	read: false,
	channels: [],
	deliveries: {},
};
const read: string[] = [];
function inbox(id: string) {
	return h(InboxPanel, {
		records: [row],
		unread: 1,
		markRead: () => {
			read.push(id);
		},
		clearRead: () => {},
		open: () => {},
	});
}
render(h(TerminalWorkbench, { ...refs, ...actions, sessions: inbox('left') }), left);
render(inbox('right'), right);
const xtermHost = left.querySelector('.terminal-container')!;
assert.equal(terminal, xtermHost);
const xtermOwnedChild = document.createElement('canvas');
xtermHost.appendChild(xtermOwnedChild);
const search = left.querySelector<HTMLInputElement>('input')!;
assert.equal(input, search);
search.value = 'needle';
search.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
assert.equal(searches, 1);
for (const button of Array.from(left.querySelectorAll<HTMLButtonElement>('.terminal-search-btn'))) button.click();
assert.deepEqual([previous, next, closed], [1, 1, 1]);
render(
	h(TerminalWorkbench, { ...refs, ...actions, sessions: inbox('updated'), usage: h('span', {}, 'Updated quota') }),
	left,
);
assert.equal(left.querySelector('.terminal-container'), xtermHost, 'workbench refresh preserves the xterm island');
assert.equal(xtermHost.firstChild, xtermOwnedChild, 'Preact does not replace xterm-owned content');
assert.equal(left.querySelector('input'), search, 'search focus target survives data refresh');
assert.equal(search.value, 'needle');
left.querySelector<HTMLButtonElement>('.nand-agent-sidebar button')!.click();
right.querySelector<HTMLButtonElement>('button')!.click();
assert.deepEqual(read, ['updated', 'right'], 'composed instances dispatch to their own hosts');
render(null, left);
assert.equal(terminal, null, 'unmount releases native island refs');
assert.equal(left.childNodes.length, 0);
assert.ok(right.textContent?.includes('One'), 'unmounting a workbench leaves separately composed panels alive');
render(null, right);
console.log('Panel composition: independent actions, persistent xterm island/search, clean unmount passed.');
