import { expect, it, vi } from 'vitest';
import { inSessionBroker } from './session-window';
it('starts work on the persistent window and propagates success and synchronous failure', async () => {
	let scheduled: (() => void) | undefined;
	const broker = {
		setTimeout: vi.fn((fn: () => void) => {
			scheduled = fn;
		}),
	} as unknown as Window;
	const work = vi.fn(async () => 42),
		result = inSessionBroker(broker, work);
	expect(work).not.toHaveBeenCalled();
	scheduled!();
	await expect(result).resolves.toBe(42);
	const failed = inSessionBroker(broker, () => {
		throw Error('closed');
	});
	scheduled!();
	await expect(failed).rejects.toThrow('closed');
});
