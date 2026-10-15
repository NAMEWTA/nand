import { VisibilityContext } from '../../../../ui/react/contexts';
import type { AgentDispatchRequest } from '../../../agent/api';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import { setLanguage, t } from '../../../../shared/i18n';
import { DEFAULT_DASHBOARD_SETTINGS, type SkillShortcut } from '../../core/board/types/model';
import type { BoardStore } from '../../services/board-store';
import { QuickCaptureWidget, FileSearchWidget } from './InputWidgets';
import { SkillWidget } from './SkillWidget';
import { normalizeDashboardSettings } from '../../core/board/settings';
vi.mock('sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
afterEach(cleanup);
function fixture() {
	setLanguage('en');
	const skill: SkillShortcut = { id: 'review', label: 'Review', icon: 'sparkles', agentId: 'codex', skillName: 'review', promptTemplate: '{{input}}', directSend: false, destination: { kind: 'fresh', cwd: '' } };
	const state = createStore(() => ({ settings: { ...structuredClone(DEFAULT_DASHBOARD_SETTINGS), skillWidgetButtons: [skill] }, path: 'Board', data: { skills: [] } }));
	const dispatch = vi.fn(async (_request: AgentDispatchRequest) => ({ invocationId: 'test', delivery: 'pasted' as const })),
		capture = vi.fn(async () => {}), openFile = vi.fn(async () => {}), save = vi.fn(async () => {});
	const files = ['One', 'Two'].map((name) => ({ path: `Notes/${name}.md`, basename: name, extension: 'md', stat: { mtime: 0 } }));
	const store = { state, capture, openFile, settings: save, searchFiles: () => files, recentFiles: () => files,
		widgets: { acquireDispatch: async () => ({ dispatch }), agents: () => [{ id: 'codex', title: 'Codex' }] } } as unknown as BoardStore;
	return { store, capture, openFile, dispatch, save, skill };
}
test('capture ignores IME Enter, guards concurrent submissions and keeps a failed draft', async () => {
	const f = fixture(); let reject!: (reason: Error) => void;
	f.capture.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
	render(<TestProviders><QuickCaptureWidget store={f.store} /></TestProviders>);
	const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Keep this thought' } });
	fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(f.capture).not.toHaveBeenCalled();
	fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.keyDown(input, { key: 'Enter' }); expect(f.capture).toHaveBeenCalledExactlyOnceWith('Keep this thought');
	reject(new Error('offline')); await waitFor(() => expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false));
	expect((input as HTMLInputElement).value).toBe('Keep this thought');
});
test('file search floats results, cancels with Escape and opens the keyboard-selected file', async () => {
	const f = fixture(); render(<TestProviders><FileSearchWidget store={f.store} /></TestProviders>);
	const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Notes' } });
	fireEvent.keyDown(input, { key: 'Enter' }); await screen.findByText('One');
	fireEvent.keyDown(input, { key: 'Escape' }); await waitFor(() => expect(screen.queryByText('One')).toBeNull()); expect(f.openFile).not.toHaveBeenCalled();
	fireEvent.keyDown(input, { key: 'Enter' }); await screen.findByText('One');
	fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' }); expect(f.openFile).toHaveBeenCalledExactlyOnceWith('Notes/Two.md', true);
});
test('standalone skills preview edited text and keep their configuration separate from board chips', async () => {
	const f = fixture(); render(<TestProviders><SkillWidget store={f.store} /></TestProviders>);
	fireEvent.click(screen.getByLabelText('Review')); const prompt = await screen.findByLabelText(t('home.dashboard.prompt'));
	fireEvent.change(prompt, { target: { value: 'Reviewed draft' } }); fireEvent.click(screen.getByText(t('common.save')));
	await waitFor(() => expect(f.dispatch).toHaveBeenCalledTimes(1)); expect(f.dispatch.mock.calls[0]?.[0]).toMatchObject({ finalPrompt: 'Reviewed draft', files: [], source: { kind: 'widget', path: 'Board.md', id: 'skills' } });
	fireEvent.click(screen.getByLabelText(t('skillsWidget.configure'))); await screen.findByLabelText(t('home.dashboard.name'));
	fireEvent.click(screen.getByText(t('common.cancel'))); expect(f.save).not.toHaveBeenCalled();
	const normalized = normalizeDashboardSettings({ widgetSkillsEnabled: true, skillWidgetButtons: [f.skill] });
	expect(normalized.skillWidgetButtons).toEqual([f.skill]); expect(normalized.widgetSkillsEnabled).toBe(true);
});

test('capture preserves a draft entered during the pending save', async () => {
 const f=fixture(); let resolve!:()=>void;
 f.capture.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 render(<TestProviders><QuickCaptureWidget store={f.store}/></TestProviders>);
 const input=screen.getByRole('textbox') as HTMLInputElement;
 fireEvent.change(input,{target:{value:'submitted A'}}); fireEvent.keyDown(input,{key:'Enter'});
 fireEvent.change(input,{target:{value:'unsent B'}}); resolve();
 await waitFor(()=>expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false));
 expect(input.value).toBe('unsent B');
});
test('capture preserves an unsent draft while the page is hidden', async () => {
 const f=fixture();
 const node=(visible:boolean)=><TestProviders><VisibilityContext value={visible}><QuickCaptureWidget store={f.store}/></VisibilityContext></TestProviders>;
 const view=render(node(true));
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'unsent thought'}});
 view.rerender(node(false)); view.rerender(node(true));
 expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('unsent thought');
});
