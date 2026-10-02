import assert from 'node:assert/strict';
import test from 'node:test';
import { ModuleLifecycle, type ModuleEffects } from './module-lifecycle';

function fixture(active = true) {
	const calls: string[] = [];
	const leaves = [
		{ session: 'one', output: 'keep-one' },
		{ session: 'two', output: 'keep-two' },
	];
	const original = [...leaves];
	const flags = {
		browser: true,
		automation: true,
		dashboard: true,
		editor: true,
		terminal: active,
		iconic: false,
		contacts: true,
	};
	const lifecycle = new ModuleLifecycle();
	const effects: ModuleEffects = {
		automation: async () => {},
		contacts: async () => {},
		iconic: async () => {},
		dashboard: () => {},
		editor: () => {},
		terminalActive: () => active,
		terminal: async (enabled) => {
			calls.push(enabled ? 'activate' : 'deactivate');
			active = enabled;
			for (let i = 0; i < leaves.length; i++) {
				calls.push('leaf.open');
				leaves[i] = { session: enabled ? `new-${i}` : 'off', output: '' };
			}
		},
	};
	return {
		lifecycle,
		effects,
		flags,
		calls,
		leaves,
		original,
		apply: (desktop = true) => lifecycle.apply(() => flags, desktop, effects),
	};
}

test('board and editor toggles preserve every terminal session and output', async () => {
	const f = fixture();
	for (let cycle = 0; cycle < 10; cycle++) {
		for (const key of ['dashboard', 'editor'] as const) {
			f.flags[key] = false;
			await f.apply();
			f.flags[key] = true;
			await f.apply();
		}
	}
	assert.deepEqual(f.calls, []);
	f.leaves.forEach((leaf, i) => assert.equal(leaf, f.original[i]));
});

test('only real terminal transitions replace leaves; repeated flags are no-ops', async () => {
	const f = fixture();
	f.flags.terminal = false;
	await f.apply();
	await f.apply();
	f.flags.terminal = true;
	await f.apply();
	await f.apply();
	assert.deepEqual(f.calls, ['deactivate', 'leaf.open', 'leaf.open', 'activate', 'leaf.open', 'leaf.open']);
});

test('mobile never activates a terminal', async () => {
	const f = fixture(false);
	f.flags.terminal = true;
	await f.apply(false);
	assert.deepEqual(f.calls, []);
});

test('queued requests read the latest flags and wait for shutdown', async () => {
	const f = fixture();
	let release!: () => void;
	let started!: () => void;
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	const entered = new Promise<void>((resolve) => {
		started = resolve;
	});
	const transition = f.effects.terminal;
	f.effects.terminal = async (enabled) => {
		if (!enabled) {
			started();
			await waiting;
		}
		await transition(enabled);
	};
	f.flags.terminal = false;
	const off = f.apply();
	await entered;
	f.flags.terminal = true;
	const on = f.apply();
	assert.deepEqual(f.calls, []);
	release();
	await Promise.all([off, on]);
	assert.equal(f.effects.terminalActive(), true);
	assert.equal(f.calls.filter((call) => call === 'activate').length, 1);
});

test('a rejected transition does not poison the queue', async () => {
	const f = fixture(false);
	f.flags.terminal = true;
	const transition = f.effects.terminal;
	f.effects.terminal = async () => {
		throw new Error('start failed');
	};
	await assert.rejects(f.apply(), /start failed/);
	f.effects.terminal = transition;
	await f.apply();
	assert.equal(f.effects.terminalActive(), true);
});

test('unload prevents pending module work from starting services', async () => {
	const f = fixture(false);
	f.flags.terminal = true;
	const pending = f.apply();
	f.lifecycle.dispose();
	await pending;
	assert.deepEqual(f.calls, []);
});

test('unload during comment handoff cannot start later modules', async () => {
	const f = fixture(false);
	f.flags.terminal = true;
	let release!: () => void;
	let entered!: () => void;
	const started = new Promise<void>(resolve => { entered = resolve; });
	const barrier = new Promise<void>(resolve => { release = resolve; });
	f.effects.editor = async () => { entered(); await barrier; };
	f.effects.contacts = async () => { f.calls.push('contacts'); };
	const pending = f.apply();
	await started;
	f.lifecycle.dispose();
	release();
	await pending;
	assert.deepEqual(f.calls, []);
});

test('archive transitions run on mobile without restarting the terminal', async () => {
	const f = fixture(false);
	const values: boolean[] = [];
	f.effects.contacts = async (enabled) => {
		values.push(enabled);
	};
	await f.apply(false);
	f.flags.contacts = false;
	await f.apply(false);
	assert.deepEqual(values, [true, false]);
	assert.deepEqual(f.calls, []);
});


test('automation stops before its terminal dependency and repeated toggles preserve independent sessions', async () => {
 const f = fixture(); const order: string[] = [];
 f.effects.automation = async enabled => { order.push(`automation:${enabled}`); };
 const terminal = f.effects.terminal;
 f.effects.terminal = async enabled => { order.push(`terminal:${enabled}`); await terminal(enabled); };
 for (let i = 0; i < 5; i++) {
  f.flags.automation = false; await f.apply(); f.flags.automation = true; await f.apply();
 }
 assert.deepEqual(f.calls, []); f.leaves.forEach((leaf, i) => assert.equal(leaf, f.original[i]));
 order.length = 0; f.flags.automation = false; f.flags.terminal = false; await f.apply();
 assert.deepEqual(order, ['automation:false', 'terminal:false']);
 order.length = 0; f.flags.automation = true; f.flags.terminal = true; await f.apply();
 assert.deepEqual(order, ['terminal:true', 'automation:true']);
});
