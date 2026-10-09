import assert from 'node:assert/strict';
import { test } from 'vitest';
import { serviceKey, type ModuleContext, type ModuleId, type ModuleInstance, type ModuleManifest } from '../contracts/module';
import { ModuleRegistry, type RegistryHost } from './registry';

type Behavior = { fail?: 'load' | 'activate' | 'dispose'; activation?: ModuleManifest['activation']; mobile?: boolean; service?: string };

function setup(behaviors: Partial<Record<ModuleId, Behavior>>, flags: Partial<Record<ModuleId, boolean>> = {}, env = { desktop: true, mobile: false, phone: false }) {
	const log: string[] = [];
	const reports: string[] = [];
	const created: Partial<Record<ModuleId, number>> = {};
	const manifests: ModuleManifest[] = (Object.keys(behaviors) as ModuleId[]).map((id, index) => {
		const behavior = behaviors[id]!;
		return {
			id,
			order: index,
			icon: id,
			titleKey: id,
			descriptionKey: id,
			platforms: { desktop: true, mobile: behavior.mobile ?? true },
			defaultEnabled: true,
			activation: behavior.activation ?? 'startup',
			provides: behavior.service ? [serviceKey(id, behavior.service)] : [],
			load: async () => {
				if (behavior.fail === 'load') throw new Error(`${id} load`);
				return {
					default: (): ModuleInstance => {
						created[id] = (created[id] ?? 0) + 1;
						return {
							activate: () => {
								if (behavior.fail === 'activate') throw new Error(`${id} activate`);
								log.push(`+${id}`);
							},
							dispose: (reason) => {
								log.push(`-${id}:${reason}`);
								if (behavior.fail === 'dispose') throw new Error(`${id} dispose`);
							},
							services: behavior.service ? [[serviceKey(id, behavior.service), `${id}-service`]] : [],
						};
					},
				};
			},
		};
	});
	const state = { ...flags };
	const host: RegistryHost = {
		env,
		enabled: (id) => state[id] ?? true,
		createContext: (manifest) => ({ id: manifest.id }) as unknown as ModuleContext,
		releaseContext: () => undefined,
		report: (id, phase, error) => reports.push(`${id}:${phase}:${(error as Error).message}`),
	};
	const registry = new ModuleRegistry(manifests, host);
	return { registry, log, reports, created, flags: state };
}

test('a module that throws is marked failed while every other module still activates', async () => {
	const { registry, log, reports } = setup({ home: {}, agent: { fail: 'activate' }, icons: {}, browser: { fail: 'load' } });
	await registry.apply();
	// The half-activated agent instance is disposed so it cannot leak resources.
	assert.deepEqual(log, ['+home', '-agent:disabled', '+icons']);
	assert.equal(registry.state('agent'), 'failed');
	assert.equal(registry.state('browser'), 'failed');
	assert.equal(registry.state('icons'), 'active');
	assert.deepEqual(reports, ['agent:activate:agent activate', 'browser:activate:browser load']);
});

test('modules enable in order and disable in reverse order; re-enabling creates a new instance', async () => {
	const { registry, log, created, flags } = setup({ home: {}, agent: {}, automations: {} });
	await registry.apply();
	flags.home = false;
	flags.automations = false;
	await registry.apply();
	assert.deepEqual(log, ['+home', '+agent', '+automations', '-automations:disabled', '-home:disabled']);
	assert.equal(registry.state('home'), 'off');
	flags.home = true;
	await registry.apply();
	assert.equal(created.home, 2);
	assert.equal(registry.state('home'), 'active');
});

test('modules unsupported on this platform never load', async () => {
	const { registry, log } = setup({ home: {}, agent: { mobile: false } }, {}, { desktop: false, mobile: true, phone: true });
	await registry.apply();
	assert.deepEqual(log, ['+home']);
	assert.equal(registry.state('agent'), 'unsupported');
	assert.equal(await registry.activate('agent'), false);
});

test('on-demand modules activate through acquire and leases are revoked on dispose', async () => {
	const { registry, log } = setup({ agent: { activation: 'on-demand', service: 'sessions' } });
	await registry.apply();
	assert.deepEqual(log, []);
	assert.equal(registry.services.peek(serviceKey('agent', 'sessions')), undefined);
	const seen: unknown[] = [];
	registry.services.watch(serviceKey<string>('agent', 'sessions'), (value) => seen.push(value));
	const lease = await registry.services.acquire(serviceKey<string>('agent', 'sessions'));
	assert.equal(lease?.value, 'agent-service');
	assert.equal(lease?.revoked.aborted, false);
	await registry.dispose();
	assert.equal(lease?.revoked.aborted, true);
	assert.deepEqual(seen, ['agent-service', undefined]);
	assert.deepEqual(log, ['+agent', '-agent:unload']);
	assert.equal(await registry.activate('agent'), false);
});

test('a failed module is retried on the next apply, and dispose errors are reported, not thrown', async () => {
	const behaviors: Partial<Record<ModuleId, Behavior>> = { home: { fail: 'activate' }, icons: { fail: 'dispose' } };
	const { registry, reports, flags } = setup(behaviors);
	await registry.apply();
	assert.equal(registry.state('home'), 'failed');
	delete behaviors.home!.fail;
	await registry.apply();
	assert.equal(registry.state('home'), 'active');
	flags.icons = false;
	await registry.apply();
	assert.equal(registry.state('icons'), 'off');
	assert.ok(reports.includes('icons:dispose:icons dispose'));
});

test('concurrent applies and activations are serialized per module', async () => {
	const { registry, created } = setup({ home: {}, comments: {} });
	await Promise.all([registry.apply(), registry.apply(), registry.activate('home'), registry.activate('home')]);
	assert.equal(created.home, 1);
	assert.equal(created.comments, 1);
});

test('layout-ready modules wait for their phase', async () => {
	const { registry, log } = setup({ home: {}, icons: { activation: 'layout-ready' } });
	await registry.apply(['startup']);
	assert.deepEqual(log, ['+home']);
	assert.equal(registry.state('icons'), 'idle');
	await registry.apply(['startup', 'layout-ready']);
	assert.deepEqual(log, ['+home', '+icons']);
});
