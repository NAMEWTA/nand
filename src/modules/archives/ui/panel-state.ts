import { emptyQuery } from '../core/index-store';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import type { ContactsLayoutMode, ContactsPanelState } from './panel-contract';

/** Fields the workbench may persist for an archive page. Runtime focus and history stay out. */
export const CONTACTS_PAGE_STATE_KEYS = ['query', 'page', 'selectedPath', 'selectedId', 'scroll', 'layout', 'anchors'] as const;

export function contactsTarget(state: ContactsPanelState): WorkbenchTarget {
	const resourceId = state.selectedId || state.selectedPath || undefined;
	return resourceId
		? { feature: 'contacts', section: state.query.kind, resourceId }
		: { feature: 'contacts', section: state.query.kind };
}

/** Enter one archive group. Detail, history and filters belong to the previous group. */
export function showContactKind(state: ContactsPanelState, kind: ContactsPanelState['query']['kind']): ContactsPanelState {
	return {
		...state,
		query: { ...emptyQuery(), kind },
		page: 0,
		selectedPath: '',
		selectedId: '',
		focus: '',
	};
}

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
/** Per-kind layout preference chosen earlier (settings), used when the leaf has none of its own. */
export type PreferredLayouts = Partial<Record<'person' | 'company', ContactsLayoutMode>>;
/** Saved leaves without a valid choice keep cards; new leaves list people. Explicit choices take precedence. */
export function layoutsFor(raw: Record<string, unknown>, preferred: PreferredLayouts = {}): ContactsPanelState['layout'] {
	const saved = CONTACTS_PAGE_STATE_KEYS.some((key) => Object.hasOwn(raw, key));
	const fallback: ContactsPanelState['layout'] = { person: saved ? 'card' : 'list', company: 'card' };
	const given = raw.layout && typeof raw.layout === 'object' ? (raw.layout as Record<string, unknown>) : {};
	return {
		person: mode(given.person, mode(preferred.person, fallback.person)),
		company: mode(given.company, mode(preferred.company, fallback.company)),
	};
}
export function restoreContactsState(raw: Record<string, unknown>, preferred: PreferredLayouts = {}): ContactsPanelState {
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
		layout: layoutsFor(raw, preferred),
		anchors: anchors(raw.anchors),
	};
}
export function emptyPanelState(preferred: PreferredLayouts = {}): ContactsPanelState {
	return restoreContactsState({}, preferred);
}
/** Keep each layout's anchor. A layout's first visit starts at the currently visible record. */
export function applyLayout(state: ContactsPanelState, mode: ContactsLayoutMode, visible = ''): ContactsPanelState {
	const kind = state.query.kind;
	if (state.layout[kind] === mode) return state;
	const current = { ...state.anchors[kind], [state.layout[kind]]: visible };
	if (visible && !current[mode]) current[mode] = visible;
	return {
		...state,
		layout: { ...state.layout, [kind]: mode },
		anchors: { ...state.anchors, [kind]: current },
	};
}
