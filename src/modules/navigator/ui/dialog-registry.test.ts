// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { DialogRegistry } from './dialog-registry';

const dialog = () => { const state = { closed: 0 }; return { state, handle: { close: () => { state.closed++; } } }; };

test('stopping closes every open dialog once', () => {
	const registry = new DialogRegistry();
	const a = dialog();
	const b = dialog();
	registry.track(a.handle);
	registry.track(b.handle);
	expect(registry.size).toBe(2);
	registry.stop();
	expect([a.state.closed, b.state.closed]).toEqual([1, 1]);
	expect(registry.size).toBe(0);
	registry.stop();
	expect([a.state.closed, b.state.closed]).toEqual([1, 1]);
});

test('a dialog that closed by itself is not closed again', () => {
	const registry = new DialogRegistry();
	const a = dialog();
	const untrack = registry.track(a.handle);
	untrack();
	registry.stop();
	expect(a.state.closed).toBe(0);
});

test('a dialog that arrives after stopping is closed at once', () => {
	const registry = new DialogRegistry();
	registry.stop();
	const late = dialog();
	registry.track(late.handle);
	expect(late.state.closed).toBe(1);
	expect(registry.isStopped).toBe(true);
	expect(registry.size).toBe(0);
});
