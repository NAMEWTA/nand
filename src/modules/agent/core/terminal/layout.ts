/** Terminal tabs: each tab is a small split tree of up to four session panes. Immutable updates. */

export const MAX_PANES = 4;

export type SplitDirection = 'row' | 'column';
export type LayoutNode =
	| { kind: 'pane'; session: string }
	| { kind: 'split'; direction: SplitDirection; ratio: number; first: LayoutNode; second: LayoutNode };

export interface TerminalTab {
	id: string;
	root: LayoutNode;
	/** The pane that receives keyboard focus and "send to terminal" commands. */
	focused: string;
}

export interface TabsState {
	tabs: readonly TerminalTab[];
	active?: string;
}

export const EMPTY_TABS: TabsState = { tabs: [] };

export function sessionsOf(node: LayoutNode): string[] {
	return node.kind === 'pane' ? [node.session] : [...sessionsOf(node.first), ...sessionsOf(node.second)];
}

export function tabOf(state: TabsState, session: string): TerminalTab | undefined {
	return state.tabs.find((tab) => sessionsOf(tab.root).includes(session));
}

export function activeTab(state: TabsState): TerminalTab | undefined {
	return state.tabs.find((tab) => tab.id === state.active) ?? state.tabs[0];
}

export function openTab(state: TabsState, id: string, session: string): TabsState {
	return { tabs: [...state.tabs, { id, root: { kind: 'pane', session }, focused: session }], active: id };
}

export function activate(state: TabsState, session: string): TabsState {
	const tab = tabOf(state, session);
	if (!tab) return state;
	return { tabs: state.tabs.map((item) => (item === tab ? { ...item, focused: session } : item)), active: tab.id };
}

export function canSplit(state: TabsState, session: string): boolean {
	const tab = tabOf(state, session);
	return !!tab && sessionsOf(tab.root).length < MAX_PANES;
}

function replace(node: LayoutNode, session: string, make: (pane: LayoutNode) => LayoutNode): LayoutNode {
	if (node.kind === 'pane') return node.session === session ? make(node) : node;
	return { ...node, first: replace(node.first, session, make), second: replace(node.second, session, make) };
}

/** Put `added` next to `session` (right of it for `row`, below it for `column`). */
export function split(state: TabsState, session: string, direction: SplitDirection, added: string): TabsState {
	const tab = tabOf(state, session);
	if (!tab || !canSplit(state, session)) return state;
	const root = replace(tab.root, session, (pane) => ({ kind: 'split', direction, ratio: 0.5, first: pane, second: { kind: 'pane', session: added } }));
	return { tabs: state.tabs.map((item) => (item === tab ? { ...item, root, focused: added } : item)), active: tab.id };
}

function without(node: LayoutNode, session: string): LayoutNode | undefined {
	if (node.kind === 'pane') return node.session === session ? undefined : node;
	const first = without(node.first, session);
	const second = without(node.second, session);
	if (!first) return second;
	if (!second) return first;
	return { ...node, first, second };
}

/** Drop a session's pane; an emptied tab closes and its neighbour becomes active. */
export function removeSession(state: TabsState, session: string): TabsState {
	const tab = tabOf(state, session);
	if (!tab) return state;
	const root = without(tab.root, session);
	if (root) {
		const sessions = sessionsOf(root);
		const focused = tab.focused === session ? sessions[0]! : tab.focused;
		return { ...state, tabs: state.tabs.map((item) => (item === tab ? { ...item, root, focused } : item)) };
	}
	const index = state.tabs.indexOf(tab);
	const tabs = state.tabs.filter((item) => item !== tab);
	const active = state.active === tab.id ? (tabs[index] ?? tabs[index - 1])?.id : state.active;
	return active === undefined ? { tabs } : { tabs, active };
}

export function setRatio(state: TabsState, tabId: string, path: readonly ('first' | 'second')[], ratio: number): TabsState {
	const clamp = Math.min(0.85, Math.max(0.15, ratio));
	const update = (node: LayoutNode, rest: readonly ('first' | 'second')[]): LayoutNode => {
		if (node.kind === 'pane') return node;
		if (!rest.length) return { ...node, ratio: clamp };
		const [head, ...tail] = rest;
		return head === 'first' ? { ...node, first: update(node.first, tail) } : { ...node, second: update(node.second, tail) };
	};
	return { ...state, tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, root: update(tab.root, path) } : tab)) };
}

export function moveTab(state: TabsState, from: number, to: number): TabsState {
	if (from === to || from < 0 || to < 0 || from >= state.tabs.length || to >= state.tabs.length) return state;
	const tabs = [...state.tabs];
	const [moved] = tabs.splice(from, 1);
	tabs.splice(to, 0, moved!);
	return { ...state, tabs };
}
