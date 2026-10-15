import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { requestUrl } from 'obsidian';
import { createStore } from 'zustand/vanilla';
import { TickTickClient, TICKTICK_TIMEOUT_MS } from '../../platform/ticktick/ticktick-service';
import { TickTickLoginDialog } from './TickTickDialogs';
import { TickTickSection } from './TickTickSection';
import { TestProviders } from '../../../../ui/react/test-providers';
import { VisibilityContext } from '../../../../ui/react/contexts';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types';
import type { HomeHost } from '../../services/home-host';
import type { BoardStore } from '../../services/board-store';
import { setLanguage, t } from '../../../../shared/i18n';
vi.mock('obsidian', async (original) => ({ ...(await original<typeof import('obsidian')>()), requestUrl: vi.fn() }));
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.useRealTimers();
	setLanguage('zh');
});
function fixture() {
	const settings = { ...structuredClone(DEFAULT_DASHBOARD_SETTINGS), ticktickCookie: 'old', ticktickCsrf: 'csrf' };
	const listeners = new Set<() => void>();
	const updateSettings = vi.fn(async (fn) => {
		fn(settings);
		listeners.forEach((fn) => fn());
	});
	const host = {
		settings,
		updateSettings,
		subscribeSettings: (fn: () => void) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	} as unknown as HomeHost;
	return { settings, host, updateSettings, listeners };
}
test.each(['unmount', 'close', 'hidden', 'account'])('late login verification cannot save after %s', async (mode) => {
	const f = fixture();
	let finish!: (value: Awaited<ReturnType<TickTickClient['fetchSnapshot']>>) => void;
	vi.spyOn(TickTickClient.prototype, 'fetchSnapshot').mockReturnValue(
		new Promise((resolve) => {
			finish = resolve;
		}),
	);
	const onClose = vi.fn(),
		scene = (visible = true) => (
			<TestProviders>
				<VisibilityContext value={visible}>
					<TickTickLoginDialog host={f.host} settings={f.settings} onClose={onClose} />
				</VisibilityContext>
			</TestProviders>
		);
	const view = render(scene());
	fireEvent.change(screen.getByLabelText(t('settings.ticktickCookie')), { target: { value: 'late' } });
	fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
	if (mode === 'unmount') view.unmount();
	if (mode === 'close') fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
	if (mode === 'hidden') view.rerender(scene(false));
	if (mode === 'account') {
		f.settings.ticktickCookie = '';
		act(() => f.listeners.forEach((fn) => fn()));
	}
	await act(async () => finish({ projects: [], tasks: [], tags: [] }));
	expect(f.updateSettings).not.toHaveBeenCalled();
});
test('manual login validates and commits both credentials once while alive', async () => {
	const f = fixture();
	vi.spyOn(TickTickClient.prototype, 'fetchSnapshot').mockResolvedValue({ projects: [], tasks: [], tags: [] });
	render(
		<TestProviders>
			<TickTickLoginDialog host={f.host} settings={f.settings} onClose={() => {}} />
		</TestProviders>,
	);
	fireEvent.change(screen.getByLabelText(t('settings.ticktickCookie')), { target: { value: 'new' } });
	fireEvent.change(screen.getByLabelText(t('ticktick.csrfLabel')), { target: { value: 'csrf-new' } });
	fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
	await waitFor(() => expect(f.updateSettings).toHaveBeenCalledOnce());
	expect(f.settings.ticktickCookie).toBe('new');
	expect(f.settings.ticktickCsrf).toBe('csrf-new');
});
test('hidden section cancels sequential network reads and releases owner timer', async () => {
	const f = fixture(),
		request = vi.mocked(requestUrl);
	let finish!: (v: Awaited<ReturnType<typeof requestUrl>>) => void;
	request.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}) as ReturnType<typeof requestUrl>,
	);
	const ownerTimer = vi.spyOn(window, 'clearTimeout');
	const store = { host: f.host, state: createStore(() => ({ settings: f.settings })) } as unknown as BoardStore;
	const scene = (visible: boolean) => (
		<TestProviders>
			<VisibilityContext value={visible}>
				<TickTickSection
					store={store}
					column={{ name: 'Tick', cards: [], color: '', sectionType: 'ticktick' }}
				/>
			</VisibilityContext>
		</TestProviders>
	);
	const view = render(scene(true));
	await waitFor(() => expect(request).toHaveBeenCalled());
	const calls = request.mock.calls.length;
	view.rerender(scene(false));
	await act(async () => finish({ status: 200, text: '{}', json: {}, headers: {}, arrayBuffer: new ArrayBuffer(0) }));
	expect(request).toHaveBeenCalledTimes(calls);
	expect(ownerTimer).toHaveBeenCalled();
});
test('write timeout releases busy and refreshes without repeating a write', async () => {
	const f = fixture(),
		request = vi.mocked(requestUrl);
	request.mockReset();
	const task = { id: 't', title: 'Task', projectId: 'p', status: 0, dueDate: new Date().toISOString(), priority: 0 };
	request.mockImplementation((arg) => {
		if (typeof arg !== 'string' && arg.method === 'POST' && arg.url.endsWith('/batch/task'))
			return new Promise(() => {}) as ReturnType<typeof requestUrl>;
		return Promise.resolve({
			status: 200,
			text: JSON.stringify(
				typeof arg !== 'string' && arg.url.endsWith('/check/0') ? { syncTaskBean: { update: [task] } } : [],
			),
		}) as ReturnType<typeof requestUrl>;
	});
	const store = { host: f.host, state: createStore(() => ({ settings: f.settings })) } as unknown as BoardStore;
	render(
		<TestProviders>
			<TickTickSection store={store} column={{ name: 'Tick', cards: [], color: '', sectionType: 'ticktick' }} />
		</TestProviders>,
	);
	await screen.findByText('Task');
	vi.useFakeTimers();
	fireEvent.click(document.querySelector('.dashboard-ticktick-check')!);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(TICKTICK_TIMEOUT_MS);
	});
	expect(screen.getByRole('alert').textContent).toContain(t('ticktick.writeUncertain'));
	expect(document.querySelector('.dashboard-ticktick-check')!.getAttribute('disabled')).toBeNull();
	expect(
		request.mock.calls.filter(([arg]) => typeof arg !== 'string' && arg.url.endsWith('/batch/task')),
	).toHaveLength(1);
});

test.each(['zh', 'en'] as const)(
	'edit timeout shows a localized uncertainty warning inside the active dialog (%s)',
	async (language) => {
		setLanguage(language);
		const f = fixture(),
			request = vi.mocked(requestUrl);
		request.mockReset();
		const task = {
			id: 't',
			title: 'Edit timeout',
			projectId: 'p',
			status: 0,
			dueDate: new Date().toISOString(),
			priority: 0,
		};
		request.mockImplementation((arg) => {
			if (typeof arg !== 'string' && arg.method === 'POST' && arg.url.endsWith('/batch/task'))
				return new Promise(() => {}) as ReturnType<typeof requestUrl>;
			return Promise.resolve({
				status: 200,
				text: JSON.stringify(
					typeof arg !== 'string' && arg.url.endsWith('/check/0') ? { syncTaskBean: { update: [task] } } : [],
				),
			}) as ReturnType<typeof requestUrl>;
		});
		const store = { host: f.host, state: createStore(() => ({ settings: f.settings })) } as unknown as BoardStore;
		render(
			<TestProviders>
				<TickTickSection
					store={store}
					column={{ name: 'Tick', cards: [], color: '', sectionType: 'ticktick' }}
				/>
			</TestProviders>,
		);
		await screen.findByText(task.title);
		fireEvent.click(screen.getByRole('button', { name: t('ticktick.editTask') }));
		const dialog = screen.getByRole('dialog');
		fireEvent.change(within(dialog).getByLabelText(t('ticktick.dueDate')), { target: { value: '2026-12-31' } });
		vi.useFakeTimers();
		fireEvent.click(within(dialog).getByRole('button', { name: t('common.save') }));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(TICKTICK_TIMEOUT_MS);
		});
		const alert = within(dialog).getByRole('alert');
		expect(alert.textContent).toBe(t('ticktick.writeUncertain'));
		expect(alert.textContent).not.toMatch(/WRITE_TIMEOUT|Error:/);
		expect(alert.textContent).toContain(
			language === 'zh' ? '可能已在服务端生效' : 'may already have been applied on the server',
		);
		expect(alert.textContent).toContain(language === 'zh' ? '请刷新确认' : 'Refresh to confirm');
		expect(alert.closest('[aria-hidden="true"], [hidden], [inert]')).toBeNull();
		expect(
			within(dialog)
				.getByRole('button', { name: t('common.save') })
				.hasAttribute('disabled'),
		).toBe(false);
		expect((within(dialog).getByLabelText(t('ticktick.dueDate')) as HTMLInputElement).value).toBe('2026-12-31');
		expect(
			request.mock.calls.filter(([arg]) => typeof arg !== 'string' && arg.url.endsWith('/batch/task')),
		).toHaveLength(1);
		expect(
			request.mock.calls.filter(([arg]) => typeof arg !== 'string' && arg.url.endsWith('/check/0')).length,
		).toBeGreaterThanOrEqual(2);
	},
);
