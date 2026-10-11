import { afterEach, expect, test, vi } from 'vitest';
import { SessionMaterialService } from './session-material';
import type { AgentController } from './controller';
import type { AgentId } from '../api';

function fixture() {
	vi.useFakeTimers();
	const session = { id: 'selected', agentId: 'codex' as AgentId, title: 'Codex', running: true, automated: false, activity: 'waiting', ready: false,
		inputReady: () => session.ready, paste: vi.fn() };
	let current = session;
	const open = vi.fn(async () => {}), show = vi.fn();
	const host = { app: { workspace: { containerEl: { win: { setInterval, clearInterval } } } },
		sessions: { get: () => current, list: () => [current] }, open, show } as unknown as AgentController;
	const delivery = new SessionMaterialService(host);
	const material = { title: 'Material', text: 'Final {{literal}}', files: ['A.md', 'B.md'] };
	return { delivery, session, open, show, material, replace: () => { current = { ...session }; }, attach: (signal?: AbortSignal) => delivery.attachMaterial('selected', material, { agentId: 'codex', signal }) };
}
afterEach(() => { vi.useRealTimers(); });

test('only the requested interactive agent receives one unsent block, including files', async () => {
	const f = fixture(); f.session.ready = true;
	await f.attach();
	expect(f.session.paste.mock.calls).toEqual([['Material\nFinal {{literal}}\nA.md\nB.md']]);
	expect(f.show).toHaveBeenCalledWith('selected');
	expect(vi.getTimerCount()).toBe(0);
	expect(await f.delivery.list()).toEqual([{ id: 'selected', title: 'Codex', agentId: 'codex' }]);
});

test('invalid targets and pre-cancelled calls never open or paste', async () => {
	const f = fixture(); const abort = new AbortController(); abort.abort();
	await expect(f.attach(abort.signal)).rejects.toMatchObject({ code: 'cancelled' });
	f.session.automated = true; await expect(f.attach()).rejects.toMatchObject({ code: 'missing' });
	f.session.automated = false; f.session.agentId = 'claude-code';
	await expect(f.attach()).rejects.toMatchObject({ code: 'targetChanged' });
	f.session.agentId = 'codex'; f.session.activity = 'running';
	await expect(f.attach()).rejects.toMatchObject({ code: 'busy' });
	expect(f.open).not.toHaveBeenCalled(); expect(f.session.paste).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
});

test('one pending delivery reserves its session and releases the reservation after arrival', async () => {
	const f = fixture(); const pending = f.attach();
	await expect(f.attach()).rejects.toMatchObject({ code: 'busy' });
	f.session.ready = true; await vi.advanceTimersByTimeAsync(50); await pending;
	await f.attach(); expect(f.session.paste).toHaveBeenCalledTimes(2);
	expect(vi.getTimerCount()).toBe(0);
});

test('replacement of the selected session during opening cannot redirect delivery', async () => {
	const f = fixture(); let opened!: () => void;
	f.open.mockImplementation(() => new Promise(resolve => { opened = resolve; }));
	const pending = f.attach(); const rejected = expect(pending).rejects.toMatchObject({ code: 'targetChanged' });
	f.replace(); f.session.ready = true; opened(); await rejected;
	expect(f.session.paste).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

test('the ten second deadline includes opening the page and late opening never pastes', async () => {
	const f = fixture(); let opened!: () => void;
	f.open.mockImplementation(() => new Promise(resolve => { opened = resolve; }));
	const rejected = expect(f.attach()).rejects.toMatchObject({ code: 'timeout' });
	await vi.advanceTimersByTimeAsync(10_000); await rejected;
	f.session.ready = true; opened(); await vi.advanceTimersByTimeAsync(100);
	expect(f.session.paste).not.toHaveBeenCalled(); expect(f.session.running).toBe(true); expect(vi.getTimerCount()).toBe(0);
});

test('page cancellation and module disposal release waiters and prevent a late paste', async () => {
	const f = fixture(); const abort = new AbortController();
	const added = vi.spyOn(abort.signal, 'addEventListener'), removed = vi.spyOn(abort.signal, 'removeEventListener');
	const first = expect(f.attach(abort.signal)).rejects.toMatchObject({ code: 'cancelled' });
	abort.abort(); await first;
	expect(removed.mock.calls[0]?.[1]).toBe(added.mock.calls[0]?.[1]);
	const second = expect(f.attach()).rejects.toMatchObject({ code: 'cancelled' });
	f.delivery.dispose(); await second; f.session.ready = true; await vi.advanceTimersByTimeAsync(100);
	expect(vi.getTimerCount()).toBe(0); expect(f.session.paste).not.toHaveBeenCalled();
	expect(await f.delivery.list()).toEqual([]);
	await expect(f.attach()).rejects.toMatchObject({ code: 'cancelled' });
});

test('a paste exception rejects the delivery and frees its timer and reservation', async () => {
	const f = fixture(); f.session.ready = true; f.session.paste.mockImplementationOnce(() => { throw Error('fixture'); });
	await expect(f.attach()).rejects.toThrow('fixture');
	expect(vi.getTimerCount()).toBe(0); await f.attach();
	expect(f.session.paste).toHaveBeenCalledTimes(2);
});
