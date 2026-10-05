import { emptyQuery } from '../../core/contacts/index-store';
import type { ContactsLayoutMode, ContactsPanelState } from './panel-contract';

const modes = ['list', 'card'] as const;

function mode(value: unknown, fallback: ContactsLayoutMode): ContactsLayoutMode {
	return value === 'list' || value === 'card' ? value : fallback;
}
function anchors(raw: unknown): ContactsPanelState['anchors'] {
	const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const blank = (): Record<ContactsLayoutMode, string> => ({ list: '', card: '' });
	const read = (kind: 'person' | 'company'): Record<ContactsLayoutMode, string> => {
		const value = source[kind];
		const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
		const next = blank();
		for (const item of modes) if (typeof record[item] === 'string') next[item] = record[item];
		return next;
	};
	return { person: read('person'), company: read('company') };
}
/** New leaves list people and keep companies as cards. A saved leaf without `layout` stays on cards. */
export function layoutsFor(raw: Record<string, unknown>): ContactsPanelState['layout'] {
	const legacy = raw.query !== undefined || raw.page !== undefined || raw.selectedPath !== undefined;
	const fallback: ContactsPanelState['layout'] = legacy
		? { person: 'card', company: 'card' }
		: { person: 'list', company: 'card' };
	const given = raw.layout && typeof raw.layout === 'object' ? (raw.layout as Record<string, unknown>) : {};
	return { person: mode(given.person, fallback.person), company: mode(given.company, fallback.company) };
}
export function restoreContactsState(raw: Record<string, unknown>): ContactsPanelState {
	const q = raw.query && typeof raw.query === 'object' ? (raw.query as Record<string, unknown>) : {};
	const query = emptyQuery();
	query.kind = q.kind === 'company' ? 'company' : 'person';
	query.sort = q.sort === 'modified' ? 'modified' : 'name';
	query.scope = q.scope === 'fields' ? 'fields' : 'record';
	query.search = typeof q.search === 'string' ? q.search : '';
	for (const key of ['current', 'past', 'regions', 'tags', 'relations'] as const)
		query[key] = Array.isArray(q[key]) ? q[key].filter((value): value is string => typeof value === 'string') : [];
	return {
		query,
		page: typeof raw.page === 'number' && Number.isFinite(raw.page) ? Math.max(0, Math.floor(raw.page)) : 0,
		selectedPath: typeof raw.selectedPath === 'string' ? raw.selectedPath : '',
		selectedId: typeof raw.selectedId === 'string' ? raw.selectedId : '',
		scroll: typeof raw.scroll === 'number' && Number.isFinite(raw.scroll) ? Math.max(0, raw.scroll) : 0,
		focus: typeof raw.focus === 'string' ? raw.focus : '',
		layout: layoutsFor(raw),
		anchors: anchors(raw.anchors),
	};
}
export function emptyPanelState(): ContactsPanelState {
	return restoreContactsState({});
}
/** Layout is the only field that changes. The visible path becomes the other layout's anchor. */
export function applyLayout(state: ContactsPanelState, mode: ContactsLayoutMode, visible = ''): ContactsPanelState {
	const kind = state.query.kind;
	if (state.layout[kind] === mode) return state;
	const current = { ...state.anchors[kind], [state.layout[kind]]: visible };
	if (visible) current[mode] = visible;
	return {
		...state,
		layout: { ...state.layout, [kind]: mode },
		anchors: { ...state.anchors, [kind]: current },
	};
}
