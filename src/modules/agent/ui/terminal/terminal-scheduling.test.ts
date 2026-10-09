import assert from 'node:assert/strict';
import { test } from 'vitest';
import { TerminalPresentation } from './terminal-presentation';
import { StableTerminalFit, type TerminalGrid } from './stable-terminal-fit';
import { HiddenRendererRetention } from './hidden-renderer-retention';

const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

function presentationFixture(budget = 100) {
	let snapshot = 'snapshot';
	const listeners = new Set<(text: string) => void>();
	const parsed: (() => void)[] = [], log: string[] = [], errors: unknown[] = [];
	const presentation = new TerminalPresentation({
		subscribe(output) { output(snapshot); listeners.add(output); return () => listeners.delete(output); },
		beforeReplay: () => log.push('before'), reset: () => log.push('reset'),
		write(text, done) { log.push(text); parsed.push(done); },
		afterReplay: () => log.push('restored'), error: (error) => errors.push(error),
	}, budget);
	return {
		presentation, listeners, log, errors, parsed,
		setSnapshot: (text: string) => { snapshot = text; },
		emit: (text: string) => { for (const output of listeners) output(text); },
		async parse() { assert.ok(parsed.length); parsed.shift()!(); await settled(); },
	};
}

test('replay, live output and dependent actions wait for each public write callback', async () => {
	const f = presentationFixture();
	f.presentation.setVisible(true);
	f.emit('increment');
	f.presentation.afterParsed(() => f.log.push('navigation'));
	assert.deepEqual(f.log, ['before', 'reset', 'snapshot']);
	await f.parse();
	assert.deepEqual(f.log, ['before', 'reset', 'snapshot', 'restored', 'increment']);
	await f.parse();
	assert.equal(f.log.at(-1), 'navigation');
	assert.deepEqual(f.errors, []);
	f.presentation.dispose();
});

test('pausing during a pending write waits for it before resetting to the next snapshot', async () => {
	const f = presentationFixture();
	f.presentation.setVisible(true);
	f.emit('obsolete delta');
	f.presentation.setVisible(false);
	assert.equal(f.listeners.size, 0);
	f.setSnapshot('new snapshot');
	f.presentation.setVisible(true);
	assert.deepEqual(f.log, ['before', 'reset', 'snapshot']);
	await f.parse();
	assert.deepEqual(f.log, ['before', 'reset', 'snapshot', 'before', 'reset', 'new snapshot']);
	await f.parse();
	assert.equal(f.log.at(-1), 'restored');
	assert.ok(!f.log.includes('obsolete delta'));
	f.presentation.dispose();
});

test('visible overflow resets from a complete screen instead of slicing any escape sequence', async () => {
	const f = presentationFixture(20);
	f.presentation.setVisible(true);
	f.setSnapshot('\x1b[31mcomplete screen\x1b[0m');
	f.emit('\x1b]52;c;' + 'A'.repeat(40));
	assert.equal(f.listeners.size, 0);
	await f.parse();
	assert.deepEqual(f.log, ['before', 'reset', 'snapshot', 'before', 'reset', '\x1b[31mcomplete screen\x1b[0m']);
	await f.parse();
	assert.equal(f.listeners.size, 1);
	f.presentation.dispose();
});

test('an asynchronous initial snapshot precedes actions and is exempt from the delta budget', async () => {
	let initial: ((text: string) => void) | undefined;
	const log: string[] = [];
	const presentation = new TerminalPresentation({
		subscribe(output) { initial = output; return () => {}; },
		beforeReplay: () => {}, reset: () => {},
		write(text, done) { log.push(text); done(); }, afterReplay: () => {},
		error: (error) => { throw error; },
	}, 1);
	presentation.setVisible(true);
	presentation.afterParsed(() => log.push('action'));
	await settled();
	assert.deepEqual(log, []);
	initial!('large snapshot');
	initial!('x');
	await settled();
	assert.deepEqual(log, ['large snapshot', 'action', 'x']);
	presentation.dispose();
});

test('disposing with a discarded xterm callback cancels subsequent writes and restores', async () => {
	const f = presentationFixture();
	f.presentation.setVisible(true);
	f.emit('discarded');
	f.presentation.dispose();
	await settled();
	assert.equal(f.listeners.size, 0);
	assert.deepEqual(f.log, ['before', 'reset', 'snapshot']);
});

function windowFrames() {
	let id = 0;
	const frames = new Map<number, FrameRequestCallback>(), cancelled: number[] = [];
	const win = {
		requestAnimationFrame(cb: FrameRequestCallback) { frames.set(++id, cb); return id; },
		cancelAnimationFrame(frame: number) { cancelled.push(frame); frames.delete(frame); },
	} as unknown as Window;
	return { win, frames, cancelled, tick() { const queued = [...frames.values()]; frames.clear(); for (const frame of queued) frame(0); } };
}

test('fit coalesces requests, waits for two stable grids and avoids unchanged native resizes', () => {
	const f = windowFrames(), applied: TerminalGrid[] = [];
	let current = { cols: 80, rows: 24 }, proposed = { cols: 90, rows: 25 };
	const fit = new StableTerminalFit({ propose: () => proposed, current: () => current, measurable: () => true, apply: (grid) => { applied.push(grid); current = grid; } });
	fit.request(f.win); fit.request(f.win);
	assert.equal(f.frames.size, 1);
	f.tick();
	assert.deepEqual(applied, []);
	proposed = { cols: 92, rows: 26 };
	f.tick();
	assert.deepEqual(applied, []);
	f.tick();
	assert.deepEqual(applied, [{ cols: 92, rows: 26 }]);
	fit.request(f.win); f.tick();
	assert.equal(applied.length, 1);
	assert.equal(f.frames.size, 0);
});

test('fit bounds an unstable layout to eight frames and cancels in its originating window', () => {
	const first = windowFrames(), second = windowFrames(), applied: TerminalGrid[] = [];
	let samples = 0;
	const fit = new StableTerminalFit({ propose: () => ({ cols: 90 + samples++, rows: 24 }), current: () => ({ cols: 80, rows: 24 }), measurable: () => true, apply: (grid) => applied.push(grid) });
	fit.request(first.win);
	fit.request(second.win);
	assert.equal(first.cancelled.length, 1);
	assert.equal(first.frames.size, 0);
	for (let i = 0; i < 8; i++) second.tick();
	assert.equal(samples, 8);
	assert.deepEqual(applied, [{ cols: 97, rows: 24 }]);
	assert.equal(second.frames.size, 0);
	fit.request(second.win); fit.cancel();
	assert.equal(second.cancelled.length, 1);
});

test('hidden WebGL retention evicts the least recently hidden renderer with a budget of two', () => {
	const retention = new HiddenRendererRetention(2), evicted: string[] = [];
	const a = {}, b = {}, c = {}, d = {};
	retention.retain(a, () => evicted.push('a'));
	retention.retain(b, () => evicted.push('b'));
	retention.retain(a, () => evicted.push('a'));
	retention.retain(c, () => evicted.push('c'));
	assert.deepEqual(evicted, ['b']);
	retention.release(a);
	retention.retain(d, () => evicted.push('d'));
	assert.deepEqual(evicted, ['b']);
	retention.retain(b, () => evicted.push('b'));
	assert.deepEqual(evicted, ['b', 'c']);
});
