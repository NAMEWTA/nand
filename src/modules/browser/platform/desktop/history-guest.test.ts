import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { HISTORY_GUEST_SOURCE } from './history-guest';

function fixture() {
	const owners = [1, 2].map(() => Object.assign(new EventEmitter(), { isDestroyed: () => false }));
	const exports: { prepare?: (ids: number[], token: string, ready: (id: number) => void) => { dispose(): void } } =
		{};
	runInNewContext(HISTORY_GUEST_SOURCE, {
		exports,
		require: () => ({ webContents: { fromId: (id: number) => owners[id - 1] } }),
	});
	return { owners, prepare: exports.prepare! };
}

it('suppresses only the bound guest bootstrap and releases both owners before handing off its id', () => {
	const { owners, prepare } = fixture(),
		ready = vi.fn();
	prepare([1, 2], 'bound-token', ready);
	const unrelated = { partition: 'other', instanceId: 3, src: 'https://other.test/' };
	owners[0]!.emit('will-attach-webview', {}, {}, unrelated);
	expect(unrelated.src).toBe('https://other.test/');
	const ours = { partition: 'bound-token', instanceId: 4, src: 'about:blank' };
	owners[1]!.emit('will-attach-webview', {}, {}, ours);
	expect(ours.src).toBe('');
	owners[1]!.emit('did-attach-webview', {}, { id: 10, viewInstanceId: 3 });
	expect(ready).not.toHaveBeenCalled();
	owners[1]!.emit('did-attach-webview', {}, { id: 11, viewInstanceId: 4 });
	expect(ready).toHaveBeenCalledExactlyOnceWith(11);
	for (const owner of owners) expect(owner.eventNames()).toEqual([]);
});

it('cancels listeners when the page closes before attachment', () => {
	const { owners, prepare } = fixture(),
		ready = vi.fn();
	const binding = prepare([1, 2], 'bound-token', ready);
	binding.dispose();
	binding.dispose();
	for (const owner of owners) expect(owner.eventNames()).toEqual([]);
	expect(ready).not.toHaveBeenCalled();
});
