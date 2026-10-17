// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { UndoLedger } from './undo-ledger';

const rec = (path: string) => [{ path }];

function setup(ttl = 30_000, limit = 3) {
	const timers = new Map<number, { callback: () => void; ms: number }>();
	let next = 0;
	const ledger = new UndoLedger({ set: (callback, ms) => { timers.set(++next, { callback, ms }); return next; }, clear: (handle) => { timers.delete(handle as number); } }, ttl, limit);
	return { ledger, timers, fire: () => { for (const [key, timer] of [...timers]) { timers.delete(key); timer.callback(); } } };
}

test('entries are separate: retiring one never touches another, and retiring twice is harmless', () => {
	const { ledger } = setup();
	const retired: number[] = [];
	const a = ledger.add(rec('a'), () => retired.push(1));
	const b = ledger.add(rec('b'), () => retired.push(2));
	ledger.retire(a);
	ledger.retire(a);
	ledger.retire(999);
	expect(retired).toEqual([1]);
	expect(ledger.has(b)).toBe(true);
	expect(ledger.latest()).toBe(b);
	expect(ledger.records(b)).toEqual(rec('b'));
	expect(ledger.records(a)).toBeUndefined();
});

test('entries expire after 30 seconds and release their restore points', () => {
	const { ledger, timers, fire } = setup();
	const retired: string[] = [];
	const id = ledger.add(rec('a'), () => retired.push('a'));
	expect([...timers.values()][0]?.ms).toBe(30_000);
	fire();
	expect(ledger.has(id)).toBe(false);
	expect(ledger.records(id)).toBeUndefined();
	expect(retired).toEqual(['a']);
	expect(ledger.size).toBe(0);
});

test('the oldest entries are dropped (and their prompts released) beyond the limit', () => {
	const { ledger } = setup(30_000, 2);
	const retired: string[] = [];
	ledger.add(rec('a'), () => retired.push('a'));
	ledger.add(rec('b'), () => retired.push('b'));
	ledger.add(rec('c'), () => retired.push('c'));
	expect(retired).toEqual(['a']);
	expect(ledger.size).toBe(2);
});

test('clearing releases everything once, and a timer cannot fire for a retired entry', () => {
	const { ledger, timers } = setup();
	const retired: string[] = [];
	ledger.add(rec('a'), () => retired.push('a'));
	ledger.add(rec('b'), () => retired.push('b'));
	ledger.clear();
	expect(retired.sort()).toEqual(['a', 'b']);
	expect(timers.size).toBe(0);
	expect(ledger.latest()).toBeUndefined();
});

test('an entry keeps only what is left to undo', () => {
	const { ledger } = setup();
	const id = ledger.add([{ path: 'a' }, { path: 'b' }], () => undefined);
	ledger.update(id, [{ path: 'b' }]);
	expect(ledger.records(id)).toEqual([{ path: 'b' }]);
});
