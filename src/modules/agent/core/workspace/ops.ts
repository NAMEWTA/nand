import { sessionsOf, type LayoutNode } from '../terminal/layout';
import { AGENT_CATALOG } from '../launch/catalog';
import type { AgentId } from '../launch/types';
import {
	emptyWorkspace,
	MAX_GROUPS,
	type GroupLayoutNode,
	type ResumeInfo,
	type TabColor,
	type TabGroup,
	type WorkspaceState,
	type WorkspaceTab,
} from './model';

export function groupOf(state: WorkspaceState, tabId: string): TabGroup | undefined {
	return state.groups.find((group) => group.tabIds.includes(tabId));
}
export function activeTab(state: WorkspaceState): WorkspaceTab | undefined {
	const id = state.groups.find((group) => group.id === state.activeGroupId)?.activeTabId;
	return id ? state.tabs[id] : undefined;
}
export function activateTab(state: WorkspaceState, tabId: string): WorkspaceState {
	const group = groupOf(state, tabId),
		tab = state.tabs[tabId];
	if (!group || !tab) return state;
	return {
		...state,
		activeGroupId: group.id,
		groups: state.groups.map((g) =>
			g === group
				? { ...g, activeTabId: tabId, recentTabIds: [tabId, ...g.recentTabIds.filter((id) => id !== tabId)] }
				: g,
		),
		tabs:
			tab.kind === 'terminal' && tab.unread ? { ...state.tabs, [tabId]: { ...tab, unread: false } } : state.tabs,
	};
}
export function openTab(state: WorkspaceState, groupId: string | undefined, tab: WorkspaceTab): WorkspaceState {
	if (state.tabs[tab.id]) return activateTab(state, tab.id);
	let group =
		state.groups.find((g) => g.id === groupId) ??
		state.groups.find((g) => g.id === state.activeGroupId) ??
		state.groups[0];
	if (!group) {
		group = { id: groupId || `group-${tab.id}`, tabIds: [], recentTabIds: [] };
		state = { ...state, groups: [group], layout: { kind: 'group', groupId: group.id } };
	}
	return activateTab(
		{
			...state,
			tabs: { ...state.tabs, [tab.id]: tab },
			groups: state.groups.map((g) => (g === group ? { ...g, tabIds: [...g.tabIds, tab.id] } : g)),
		},
		tab.id,
	);
}
function prune(node: GroupLayoutNode | undefined, ids: Set<string>): GroupLayoutNode | undefined {
	if (!node) return undefined;
	if (node.kind === 'group') return ids.has(node.groupId) ? node : undefined;
	const children = node.children
		.map((child) => prune(child, ids))
		.filter((child): child is GroupLayoutNode => !!child);
	if (children.length === 1) return children[0];
	if (!children.length) return undefined;
	return {
		...node,
		children,
		sizes: children.length === node.children.length ? node.sizes : children.map(() => 100 / children.length),
	};
}
export function removeEmptyGroups(state: WorkspaceState): WorkspaceState {
	const oldIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
	const groups = state.groups.filter((g) => g.tabIds.length);
	return {
		...state,
		groups,
		activeGroupId: groups.some((g) => g.id === state.activeGroupId)
			? state.activeGroupId
			: (groups[oldIndex] ?? groups[oldIndex - 1] ?? groups[0])?.id,
		layout: prune(state.layout, new Set(groups.map((g) => g.id))),
	};
}
function detach(state: WorkspaceState, tabId: string): WorkspaceState {
	return {
		...state,
		groups: state.groups.map((g) => {
			const index = g.tabIds.indexOf(tabId);
			if (index < 0) return g;
			const tabIds = g.tabIds.filter((id) => id !== tabId),
				recentTabIds = g.recentTabIds.filter((id) => id !== tabId);
			return {
				...g,
				tabIds,
				recentTabIds,
				activeTabId:
					g.activeTabId === tabId ? (recentTabIds[0] ?? tabIds[index] ?? tabIds[index - 1]) : g.activeTabId,
			};
		}),
	};
}
export function closeTab(state: WorkspaceState, tabId: string): WorkspaceState {
	const tab = state.tabs[tabId];
	if (!tab) return state;
	const tabs = { ...state.tabs };
	delete tabs[tabId];
	return removeEmptyGroups({
		...detach(state, tabId),
		tabs,
		closedTabs: [tab, ...state.closedTabs.filter((t) => t.id !== tabId)].slice(0, 20),
	});
}
export function moveTab(state: WorkspaceState, tabId: string, groupId: string, index: number): WorkspaceState {
	if (!state.tabs[tabId] || !state.groups.some((g) => g.id === groupId)) return state;
	const next = detach(state, tabId);
	return activateTab(
		removeEmptyGroups({
			...next,
			groups: next.groups.map((g) => {
				if (g.id !== groupId) return g;
				const tabIds = [...g.tabIds];
				tabIds.splice(Math.max(0, Math.min(index, tabIds.length)), 0, tabId);
				return { ...g, tabIds };
			}),
		}),
		tabId,
	);
}
export function splitGroupWithTab(
	state: WorkspaceState,
	tabId: string,
	ofGroupId: string,
	edge: 'right' | 'down' | 'left' | 'up',
	newGroupId = `group-${tabId}-${state.groups.length}`,
): WorkspaceState {
	const source = groupOf(state, tabId),
		target = state.groups.find((g) => g.id === ofGroupId);
	if (
		!source ||
		!target ||
		state.groups.length >= MAX_GROUPS ||
		state.groups.some((g) => g.id === newGroupId) ||
		(source === target && source.tabIds.length === 1)
	)
		return state;
	const group: TabGroup = { id: newGroupId, tabIds: [tabId], activeTabId: tabId, recentTabIds: [tabId] };
	const before = edge === 'left' || edge === 'up';
	const replace = (node: GroupLayoutNode): GroupLayoutNode =>
		node.kind === 'group'
			? node.groupId === ofGroupId
				? {
						kind: 'split',
						direction: edge === 'right' || edge === 'left' ? 'row' : 'column',
						sizes: [50, 50],
						children: before
							? [{ kind: 'group', groupId: newGroupId }, node]
							: [node, { kind: 'group', groupId: newGroupId }],
					}
				: node
			: { ...node, children: node.children.map(replace) };
	const next = detach(state, tabId),
		groups = [...next.groups];
	groups.splice(groups.findIndex((g) => g.id === ofGroupId) + (before ? 0 : 1), 0, group);
	return activateTab(removeEmptyGroups({ ...next, groups, layout: state.layout && replace(state.layout) }), tabId);
}
export function renameTab(state: WorkspaceState, tabId: string, title: string): WorkspaceState {
	const tab = state.tabs[tabId];
	return tab
		? {
				...state,
				tabs: { ...state.tabs, [tabId]: { ...tab, customTitle: title.trim().slice(0, 200) || undefined } },
			}
		: state;
}
export function nextTab(state: WorkspaceState, offset = 1): string | undefined {
	const group = state.groups.find((g) => g.id === state.activeGroupId);
	return group?.tabIds[
		(((group.tabIds.indexOf(group.activeTabId ?? '') + offset) % group.tabIds.length) + group.tabIds.length) %
			group.tabIds.length
	];
}
export function recentTab(state: WorkspaceState): string | undefined {
	const group = state.groups.find((g) => g.id === state.activeGroupId);
	return group?.recentTabIds.find((id) => id !== group.activeTabId && group.tabIds.includes(id));
}
export function resizeGroups(state: WorkspaceState, path: readonly number[], sizes: number[]): WorkspaceState {
	const update = (node: GroupLayoutNode, rest: readonly number[]): GroupLayoutNode => {
		if (node.kind !== 'split') return node;
		if (!rest.length)
			return sizes.length === node.children.length && sizes.every((n) => Number.isFinite(n) && n > 0)
				? { ...node, sizes }
				: node;
		return {
			...node,
			children: node.children.map((child, i) => (i === rest[0] ? update(child, rest.slice(1)) : child)),
		};
	};
	return state.layout ? { ...state, layout: update(state.layout, path) } : state;
}
const record = (v: unknown): Record<string, unknown> =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 8192) : '');
const ids = (v: unknown): string[] =>
	Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === 'string' && !!id))] : [];
const agentId = (v: unknown): AgentId | undefined => AGENT_CATALOG.find((a) => a.id === v)?.id;
function resumeInfo(value: unknown): ResumeInfo {
	const v = record(value);
	return {
		cwd: text(v.cwd),
		customTitle: text(v.customTitle).slice(0, 200) || undefined,
		nativeSessionId: text(v.nativeSessionId) || undefined,
		transcriptPath: text(v.transcriptPath) || undefined,
		accountId: text(v.accountId) || undefined,
		agentId: agentId(v.agentId),
		shell: ['default', 'bash', 'zsh', 'fish', 'pwsh', 'powershell', 'cmd', 'gitbash', 'wsl', 'custom'].includes(
			text(v.shell),
		)
			? (v.shell as ResumeInfo['shell'])
			: undefined,
	};
}
/** Read untrusted disk data without retaining unknown fields, duplicate references or unbounded trees. */
export function normalizeWorkspace(raw: unknown): WorkspaceState {
	const v = record(raw),
		state = emptyWorkspace();
	if (v.version !== 1) return state;
	for (const [id, value] of Object.entries(record(v.tabs)).slice(0, 200)) {
		const tab = record(value);
		if (tab.id !== id || !id || !['terminal', 'browser'].includes(text(tab.kind))) continue;
		const base = {
			id,
			title: text(tab.title).slice(0, 200),
			customTitle: text(tab.customTitle).slice(0, 200) || undefined,
			pinned: tab.pinned === true,
			color: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'].includes(text(tab.color))
				? (tab.color as TabColor)
				: undefined,
			createdAt: Number.isFinite(tab.createdAt) ? (tab.createdAt as number) : 0,
		};
		if (tab.kind === 'browser') {
			state.tabs[id] = {
				...base,
				kind: 'browser',
				pageId: text(tab.pageId),
				url: text(tab.url),
				profileId: text(tab.profileId) || 'default',
				zoom:
					typeof tab.zoom === 'number' && Number.isFinite(tab.zoom)
						? Math.min(3, Math.max(0.25, tab.zoom))
						: 1,
			};
			continue;
		}
		const sessionIds = ids(tab.sessionIds).slice(0, 4);
		if (!sessionIds.length) sessionIds.push(`restored-${id}`);
		const seen = new Set<string>();
		const pane = (value: unknown, depth = 0): LayoutNode | undefined => {
			const n = record(value);
			if (depth > 4) return undefined;
			if (n.kind === 'pane' && sessionIds.includes(text(n.session)) && !seen.has(text(n.session))) {
				seen.add(text(n.session));
				return { kind: 'pane', session: text(n.session) };
			}
			if (n.kind !== 'split') return undefined;
			const first = pane(n.first, depth + 1),
				second = pane(n.second, depth + 1);
			return first && second
				? {
						kind: 'split',
						direction: n.direction === 'column' ? 'column' : 'row',
						ratio:
							typeof n.ratio === 'number' && Number.isFinite(n.ratio)
								? Math.max(0.15, Math.min(0.85, n.ratio))
								: 0.5,
						first,
						second,
					}
				: (first ?? second);
		};
		let paneLayout = pane(tab.paneLayout);
		for (const session of sessionIds.filter((s) => !seen.has(s)))
			paneLayout = paneLayout
				? { kind: 'split', direction: 'row', ratio: 0.5, first: paneLayout, second: { kind: 'pane', session } }
				: { kind: 'pane', session };
		const focusedSessionId = sessionIds.includes(text(tab.focusedSessionId))
			? text(tab.focusedSessionId)
			: sessionIds[0]!;
		const panes = Object.fromEntries(sessionIds.map((s) => [s, resumeInfo(record(tab.panes)[s] ?? tab.resume)]));
		state.tabs[id] = {
			...base,
			kind: 'terminal',
			agentId: agentId(tab.agentId),
			sessionIds: sessionsOf(paneLayout!),
			paneLayout: paneLayout!,
			focusedSessionId,
			panes,
			resume: { ...panes[focusedSessionId]!, agentId: agentId(tab.agentId) },
			state: 'idle',
			unread: false,
			updatedAt: base.createdAt,
		};
	}
	const usedTabs = new Set<string>(),
		usedGroups = new Set<string>();
	for (const value of (Array.isArray(v.groups) ? v.groups : []).slice(0, MAX_GROUPS)) {
		const g = record(value),
			id = text(g.id);
		if (!id || usedGroups.has(id)) continue;
		const tabIds = ids(g.tabIds).filter((t) => state.tabs[t] && !usedTabs.has(t));
		if (!tabIds.length) continue;
		tabIds.forEach((t) => usedTabs.add(t));
		usedGroups.add(id);
		const activeTabId = tabIds.includes(text(g.activeTabId)) ? text(g.activeTabId) : tabIds[0];
		state.groups.push({
			id,
			tabIds,
			activeTabId,
			recentTabIds: [...new Set([activeTabId!, ...ids(g.recentTabIds).filter((t) => tabIds.includes(t))])],
		});
	}
	// Unreferenced tabs cannot be displayed and must not accumulate indefinitely.
	state.tabs = Object.fromEntries(Object.entries(state.tabs).filter(([id]) => usedTabs.has(id)));
	const usedLayout = new Set<string>();
	const layout = (value: unknown, depth = 0): GroupLayoutNode | undefined => {
		const n = record(value);
		if (depth > 8) return undefined;
		if (n.kind === 'group' && usedGroups.has(text(n.groupId)) && !usedLayout.has(text(n.groupId))) {
			usedLayout.add(text(n.groupId));
			return { kind: 'group', groupId: text(n.groupId) };
		}
		if (n.kind !== 'split' || !Array.isArray(n.children)) return undefined;
		const children = n.children
			.slice(0, 4)
			.map((c) => layout(c, depth + 1))
			.filter((c): c is GroupLayoutNode => !!c);
		if (children.length < 2) return children[0];
		const sizes =
			Array.isArray(n.sizes) &&
			n.sizes.length === children.length &&
			n.sizes.every((s) => typeof s === 'number' && Number.isFinite(s) && s > 0)
				? (n.sizes as number[])
				: children.map(() => 1);
		const sum = sizes.reduce((a, b) => a + b, 0);
		return {
			kind: 'split',
			direction: n.direction === 'column' ? 'column' : 'row',
			children,
			sizes: sizes.map((s) => (s / sum) * 100),
		};
	};
	state.layout = layout(v.layout);
	for (const g of state.groups.filter((g) => !usedLayout.has(g.id)))
		state.layout = state.layout
			? {
					kind: 'split',
					direction: 'row',
					sizes: [50, 50],
					children: [state.layout, { kind: 'group', groupId: g.id }],
				}
			: { kind: 'group', groupId: g.id };
	state.activeGroupId = usedGroups.has(text(v.activeGroupId)) ? text(v.activeGroupId) : state.groups[0]?.id;
	return state;
}
