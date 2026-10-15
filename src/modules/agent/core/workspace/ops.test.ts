import { describe, expect, it } from 'vitest';
import { emptyWorkspace, type TerminalTabData } from './model';
import {
	activateTab,
	activeTab,
	closeTab,
	groupOf,
	moveTab,
	nextTab,
	normalizeWorkspace,
	openTab,
	recentTab,
	removeEmptyGroups,
	renameTab,
	resizeGroups,
	splitGroupWithTab,
} from './ops';
export const terminalTab = (id: string): TerminalTabData => ({
	kind: 'terminal',
	id,
	title: id,
	sessionIds: [id],
	paneLayout: { kind: 'pane', session: id },
	focusedSessionId: id,
	panes: { [id]: { cwd: '/vault' } },
	state: 'unknown',
	unread: false,
	createdAt: 1,
	updatedAt: 1,
});
const three = () => ['a', 'b', 'c'].reduce((s, id) => openTab(s, 'g', terminalTab(id)), emptyWorkspace());
describe('workspace operations', () => {
	it('opens in an empty workspace and activates, without mutating the baseline', () => {
		const original = emptyWorkspace(),
			state = openTab(original, undefined, terminalTab('a'));
		expect(original.groups).toEqual([]);
		expect(state.groups).toHaveLength(1);
		expect(activeTab(state)?.id).toBe('a');
		expect(openTab(state, undefined, terminalTab('a')).groups[0]!.tabIds).toEqual(['a']);
	});
	it('closing the last tab removes its group and focuses the adjacent group', () => {
		const split = splitGroupWithTab(three(), 'c', 'g', 'right', 'g2');
		const closed = closeTab(split, 'c');
		expect(closed.groups.map((g) => g.id)).toEqual(['g']);
		expect(closed.activeGroupId).toBe('g');
		expect(closed.layout).toEqual({ kind: 'group', groupId: 'g' });
		expect(closed.closedTabs[0]?.id).toBe('c');
		expect(closeTab(closed, 'missing')).toBe(closed);
	});
	it('moves into the second position of another group and repairs both selections', () => {
		let state = splitGroupWithTab(three(), 'c', 'g', 'right', 'g2');
		state = openTab(state, 'g2', terminalTab('d'));
		state = moveTab(state, 'b', 'g2', 1);
		expect(state.groups[0]?.tabIds).toEqual(['a']);
		expect(state.groups[0]?.activeTabId).toBe('a');
		expect(state.groups[1]?.tabIds).toEqual(['c', 'b', 'd']);
		expect(state.groups[1]?.activeTabId).toBe('b');
	});
	it('sorts within a group, rejects invalid moves and clamps insertion', () => {
		let state = moveTab(three(), 'a', 'g', 2);
		expect(state.groups[0]?.tabIds).toEqual(['b', 'c', 'a']);
		state = moveTab(state, 'a', 'g', -3);
		expect(state.groups[0]?.tabIds).toEqual(['a', 'b', 'c']);
		expect(moveTab(state, 'a', 'missing', 0)).toBe(state);
	});
	it('splits at all four edges with equal sizes and refuses a fifth group', () => {
		let state = three();
		state = splitGroupWithTab(state, 'c', 'g', 'right', 'g2');
		expect(state.layout).toMatchObject({
			kind: 'split',
			direction: 'row',
			sizes: [50, 50],
			children: [{ groupId: 'g' }, { groupId: 'g2' }],
		});
		state = splitGroupWithTab(state, 'b', 'g', 'down', 'g3');
		expect(state.groups.map((g) => g.id)).toEqual(['g', 'g3', 'g2']);
		state = openTab(state, 'g', terminalTab('d'));
		state = splitGroupWithTab(state, 'd', 'g', 'left', 'g4');
		expect(state.groups[0]?.id).toBe('g4');
		expect(splitGroupWithTab(state, 'c', 'g', 'up')).toBe(state);
		const up = splitGroupWithTab(three(), 'c', 'g', 'up', 'u');
		expect(up.layout).toMatchObject({ direction: 'column', children: [{ groupId: 'u' }, { groupId: 'g' }] });
	});
	it('does not create an empty split from a single-tab group', () => {
		const state = openTab(emptyWorkspace(), 'g', terminalTab('a'));
		expect(splitGroupWithTab(state, 'a', 'g', 'right')).toBe(state);
	});
	it('activating clears unread and returns the previous active tab for Ctrl Tab', () => {
		let state = three();
		state.tabs.a = { ...terminalTab('a'), unread: true };
		state = activateTab(state, 'a');
		expect(recentTab(state)).toBe('c');
		expect(state.tabs.a).toMatchObject({ unread: false });
		expect(activateTab(state, 'missing')).toBe(state);
	});
	it('next/previous wrap, rename is bounded, and closing prefers MRU', () => {
		let state = three();
		expect(nextTab(state)).toBe('a');
		expect(nextTab(state, -1)).toBe('b');
		state = renameTab(state, 'a', '  new name  ');
		expect(state.tabs.a?.customTitle).toBe('new name');
		state = activateTab(activateTab(state, 'a'), 'c');
		expect(closeTab(state, 'c').groups[0]?.activeTabId).toBe('a');
		expect(nextTab(emptyWorkspace())).toBeUndefined();
		expect(recentTab(emptyWorkspace())).toBeUndefined();
	});
	it('removes empty groups and updates nested split sizes', () => {
		let state = splitGroupWithTab(three(), 'c', 'g', 'right', 'g2');
		state = resizeGroups(state, [], [30, 70]);
		expect(state.layout).toMatchObject({ sizes: [30, 70] });
		expect(resizeGroups(state, [], [NaN, 1]).layout).toEqual(state.layout);
		expect(removeEmptyGroups(emptyWorkspace()).layout).toBeUndefined();
	});
	it('normalizes dangling ids, duplicate refs, empty groups, malformed splits and bounds panes', () => {
		const raw = {
			...three(),
			groups: [
				{ id: 'g', tabIds: ['a', 'missing', 'a'], activeTabId: 'missing', recentTabIds: ['missing'] },
				{ id: 'empty', tabIds: ['missing'] },
			],
			layout: {
				kind: 'split',
				children: [
					{ kind: 'group', groupId: 'empty' },
					{ kind: 'group', groupId: 'g' },
				],
			},
		};
		const state = normalizeWorkspace(raw);
		expect(state.groups).toEqual([{ id: 'g', tabIds: ['a'], activeTabId: 'a', recentTabIds: ['a'] }]);
		expect(Object.keys(state.tabs)).toEqual(['a']);
		expect(state.layout).toEqual({ kind: 'group', groupId: 'g' });
		expect(state.tabs.a).toMatchObject({ resume: { cwd: '/vault' } });
		expect(normalizeWorkspace(null)).toEqual(emptyWorkspace());
		expect(normalizeWorkspace({ version: 0, tabs: raw.tabs })).toEqual(emptyWorkspace());
		expect(groupOf(state, 'a')?.id).toBe('g');
	});
	it('restores per-pane metadata without serialized credentials or executing sessions', () => {
		const state = three();
		state.tabs.a = {
			...terminalTab('a'),
			agentId: 'claude-code',
			panes: {
				a: {
					cwd: '/vault',
					accountId: 'work',
					nativeSessionId: 'native',
					transcriptPath: '/vault/.nand/log.json',
				},
			},
		};
		const restored = normalizeWorkspace(JSON.parse(JSON.stringify(state)));
		expect(restored.tabs.a).toMatchObject({
			resume: { cwd: '/vault', accountId: 'work', nativeSessionId: 'native' },
			state: 'idle',
			unread: false,
		});
	});
});
