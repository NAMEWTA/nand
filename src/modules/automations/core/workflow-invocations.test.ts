import { expect, test, vi } from 'vitest';
import { AutomationService } from './service';
import { automationDocuments } from './documents';
import { AutomationError } from '../../../shared/automation/errors';
import type { AutomationActionCompletion, AutomationActionHandle, AutomationDefinition, AutomationSourcePort } from '../../../shared/automation/types';
import type { AutomationWorkflowRequest } from '../api';
import type { ActionExecutor } from './actions/executor';
import type { TextStorage } from '../../../shared/storage/ports';

const deferred = <T>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const request = (): AutomationWorkflowRequest => ({ invocationId: 'reviewed-run', title: 'Reviewed form', source: { kind: 'browser-workflow', path: 'flow.md', id: 'flow' },
	action: { kind: 'browser-workflow', workflowId: 'flow', version: 1, variables: { message: 'hello' }, scope: [{ id: 'form', pageId: 'page', profileId: 'account' }] } });
async function fixture() {
	const files = new Map<string, string>(); let fail = false;
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, text) => { if (fail) throw Error('disk full'); files.set(path, text); } };
	const sources: AutomationSourcePort = { list: async () => [], save: async () => {}, remove: async () => {}, open: async () => {}, createTask: async () => {} };
	const completion = deferred<AutomationActionCompletion>();
	const handle: AutomationActionHandle = { completion: completion.promise, cancel: vi.fn(async () => {}), open: vi.fn(async () => {}) };
	const execute = vi.fn<ActionExecutor['execute']>(async (_action, context) => {
		expect(JSON.parse(files.get('runtime.json')!).runs.some((row: { id: string }) => row.id === context.run.id)).toBe(true);
		return { message: '', handle };
	});
	const validate = vi.fn<NonNullable<ActionExecutor['validate']>>(async action => {
		if (action.kind === 'browser-workflow' && 'secret' in action.variables) throw Error('runtime-secret-value');
	});
	const notify = vi.fn(async () => {});
	const make = () => new AutomationService(storage, 'runtime.json', 'device', sources, () => undefined, notify, true, { executor: { execute, validate } });
	const service = make(); await service.load();
	return { service, make, files, execute, validate, handle, completion, notify, fail: (value: boolean) => { fail = value; } };
}

test('workflow invocation has one durable run, retains no runtime grant, and follows actual non-terminal completion', async () => {
	const f = await fixture(); const input = request();
	const first = f.service.invokeWorkflow(input, { authorizationId: 'memory-grant' }), second = f.service.invokeWorkflow(input);
	input.action.variables.message = 'changed after calling';
	const [receipt, duplicate] = await Promise.all([first, second]);
	expect(receipt).toEqual(duplicate); expect(receipt.status).toBe('running'); expect(f.execute).toHaveBeenCalledTimes(1);
	expect(f.files.get('runtime.json')).not.toContain('memory-grant'); expect(f.execute.mock.calls[0]?.[1].authorizationId).toBe('memory-grant');
	await f.service.openRun(f.service.state.runs[0]!); expect(f.handle.open).toHaveBeenCalledOnce();
	f.completion.resolve({ status: 'succeeded', message: '', output: 'workflow-run.md' });
	await vi.waitFor(() => expect(f.service.workflowReceipt(request().invocationId)?.status).toBe('succeeded'));
	expect(f.service.workflowReceipt(request().invocationId)?.runId).toBe(receipt.runId);
	await f.service.shutdown(); const restarted = f.make(); await restarted.load();
	expect((await restarted.invokeWorkflow(request())).runId).toBe(receipt.runId); expect(f.execute).toHaveBeenCalledTimes(1);
	await expect(restarted.invokeWorkflow(input)).rejects.toMatchObject({ code: 'invocationConflict' }); await restarted.shutdown();
});

test('cancellation while launching aborts admission and cancels a late handle without recording success', async () => {
	const f = await fixture(), entered = deferred<void>(), release = deferred<void>(); let signal!: AbortSignal;
	f.execute.mockImplementation(async (_action, context) => { signal = context.signal; entered.resolve(); await release.promise; return { message: '', handle: f.handle }; });
	const pending = f.service.invokeWorkflow(request()); await entered.promise;
	await f.service.stop(f.service.state.runs[0]!); expect(signal.aborted).toBe(true);
	release.resolve(); expect((await pending).status).toBe('cancelled'); expect(f.handle.cancel).toHaveBeenCalledOnce();
	f.completion.resolve({ status: 'succeeded', message: 'late' }); await f.service.shutdown();
	expect(f.service.state.runs[0]?.status).toBe('cancelled');
});

test('owner disable aborts active workflows; external cancellation stays attached after launch returns', async () => {
	const f = await fixture(), abort = new AbortController();
	await f.service.invokeWorkflow(request(), { signal: abort.signal }); abort.abort();
	await vi.waitFor(() => expect(f.service.state.runs[0]?.status).toBe('cancelled'));
	expect(f.execute.mock.calls[0]?.[1].signal.aborted).toBe(true); expect(f.handle.cancel).toHaveBeenCalledOnce();
	f.completion.resolve({ status: 'succeeded', message: 'late completion' });
	await f.service.setExecutionEnabled(false); expect(f.service.state.runs[0]?.status).toBe('cancelled'); await f.service.shutdown();
	const next = await fixture(); await next.service.invokeWorkflow(request()); await next.service.setExecutionEnabled(false);
	expect(next.execute.mock.calls[0]?.[1].signal.aborted).toBe(true); expect(next.handle.cancel).toHaveBeenCalledOnce();
	next.completion.resolve({ status: 'interrupted', message: '' }); await next.service.shutdown();
});

test('failed persistence cannot start a workflow; corrected retry and restart preserve single-run identity', async () => {
	const f = await fixture(); f.fail(true);
	await expect(f.service.invokeWorkflow(request())).rejects.toThrow('disk full'); expect(f.execute).not.toHaveBeenCalled();
	f.fail(false); const receipt = await f.service.invokeWorkflow(request()); expect(f.execute).toHaveBeenCalledOnce();
	await f.service.shutdown(); const restarted = f.make(); await restarted.load();
	expect(await restarted.invokeWorkflow(request())).toMatchObject({ runId: receipt.runId, status: 'interrupted' });
	expect(f.execute).toHaveBeenCalledOnce(); f.completion.resolve({ status: 'interrupted', message: '' }); await restarted.shutdown();
});

test('invalid secret inputs are rejected before journaling and unavailable scheduled runs preserve a redacted failure', async () => {
	const f = await fixture(), input = request(); input.action.variables.secret = 'runtime-secret-value';
	await expect(f.service.invokeWorkflow(input)).rejects.toThrow('runtime-secret-value');
	expect(f.service.state.runs).toHaveLength(0); expect(f.files.get('runtime.json')).not.toContain('runtime-secret-value');
	const definition: AutomationDefinition = { id: 'scheduled', name: 'Workflow', enabled: true, deviceId: 'device', revision: 1,
		action: input.action, schedule: { kind: 'once', at: 1 }, channels: [], notifyOn: 'never', graceMinutes: 0, createdAt: 1, updatedAt: 1 };
	const failed = await f.service.run(definition, 'scheduled', 1, 1);
	expect(failed?.status).toBe('failed'); expect(f.files.get('runtime.json')).not.toContain('runtime-secret-value'); expect(f.execute).not.toHaveBeenCalled();
	f.validate.mockRejectedValue(new AutomationError('workflowUnavailable'));
	const unavailable = await f.service.run({ ...definition, id: 'off', action: request().action }, 'scheduled', 1, 1);
	expect(unavailable).toMatchObject({ status: 'failed', errorCode: 'workflowUnavailable' });
	expect(f.service.state.cursors['off:1']).toBe(1); await f.service.shutdown();
});

test('workflow definitions round-trip through the shared Markdown codec with explicit version, variables and scope', () => {
	const definition: AutomationDefinition = { id: 'scheduled', name: 'Workflow', enabled: true, deviceId: 'device', revision: 1,
		action: request().action, schedule: { kind: 'manual' }, channels: [], notifyOn: 'never', graceMinutes: 0, createdAt: 1, updatedAt: 1 };
	const decoded = automationDocuments.decode(automationDocuments.encode({ definitions: [definition] }));
	expect(decoded.definitions).toEqual([definition]);
});

test('workflow completion and cancellation errors do not persist runtime secret text', async () => {
	const f = await fixture(); await f.service.invokeWorkflow(request()); f.completion.reject(Error('private-runtime-input'));
	await vi.waitFor(() => expect(f.service.state.runs[0]?.status).toBe('failed'));
	expect(f.service.state.runs[0]?.errorCode).toBe('workflowInvalid'); expect(f.files.get('runtime.json')).not.toContain('private-runtime-input'); await f.service.shutdown();
	const next = await fixture(); await next.service.invokeWorkflow(request());
	vi.mocked(next.handle.cancel).mockRejectedValueOnce(Error('private-runtime-input'));
	await expect(next.service.stop(next.service.state.runs[0]!)).rejects.toThrow('private-runtime-input');
	expect(next.service.state.runs[0]?.status).toBe('unknown'); expect(next.files.get('runtime.json')).not.toContain('private-runtime-input'); await next.service.shutdown();
});
