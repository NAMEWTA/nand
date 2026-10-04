import assert from 'node:assert/strict';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { SaveStatus, type SaveStatusSource } from '../src/view/primitives/SaveStatus';
import { HabitPanel } from '../src/view/dashboard/habit/HabitPanel';
import type { SaveState } from '../src/shared/storage/durable-state';
import { t } from '../src/shared/i18n';

/** Real Preact rendering: hiding success must never hide failure, conflict or retry actions. */
export async function verifyOpenIssuePanels(document: Document): Promise<void> {
	const root = document.createElement('div'); document.body.append(root);
	const listeners = new Set<() => void>();
	let state: SaveState = { status: 'saved' }, retries = 0, edits = 0;
	const source: SaveStatusSource = {
		get saveState() { return state; },
		subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
		retrySave: async () => { retries++; state = { status: 'saved' }; listeners.forEach(listener => listener()); },
	};
	try {
		await act(() => render(h(SaveStatus, { source, showSaved: false }), root));
		assert.equal(root.childElementCount, 0);
		await act(() => { state = { status: 'saving' }; listeners.forEach(listener => listener()); });
		assert.equal(root.querySelector('[role=status] span')?.textContent, t('storage.saving'));
		for (const status of ['unsaved', 'conflict'] as const) {
			await act(() => { state = { status, error: 'fixture error' }; listeners.forEach(listener => listener()); });
			assert.equal(root.querySelector('details p')?.textContent, 'fixture error');
			assert.ok(root.querySelector('button'));
		}
		await act(() => root.querySelector<HTMLButtonElement>('button')!.click());
		assert.equal(retries, 1); assert.equal(root.childElementCount, 0);
		await act(() => render(h(SaveStatus, { source }), root));
		assert.equal(root.querySelector('span')?.textContent, t('storage.saved'), 'Other surfaces retain their success indicator');
		await act(() => render(h(HabitPanel, { rows: [], loading: true, unavailable: true, toggle: () => { edits++; }, add: () => { edits++; }, backfill: () => { edits++; }, statistics: () => { edits++; } }), root));
		assert.equal(root.querySelector('.dashboard-sidebar-habit-empty')?.textContent, t('habit.loading'));
		root.querySelectorAll<HTMLElement>('[role=button]').forEach(button => button.click());
		assert.equal(edits, 0, 'An incomplete startup snapshot cannot be edited as an empty library');
	} finally { await act(() => render(null, root)); root.remove(); }
	assert.equal(listeners.size, 0, 'Unmount releases storage subscriptions');
	console.log('Issue panels: saved/saving/failure/conflict/retry and initial-loading guards passed');
}
