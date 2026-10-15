import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { TickTickClient, TICKTICK_TIMEOUT_MS } from './ticktick-service';
vi.mock('obsidian', () => ({ requestUrl: vi.fn() }));
const request = vi.mocked(requestUrl);
const response = (body: unknown, status = 200) => ({
	status,
	text: JSON.stringify(body),
	json: body,
	headers: {},
	arrayBuffer: new ArrayBuffer(0),
});
beforeEach(() => {
	request.mockReset();
	vi.stubGlobal('window', globalThis);
});
test('TickTick snapshot normalizes malformed rows and caches reads until a successful write', async () => {
	request.mockResolvedValue(
		response({
			projectProfiles: [null, { id: 'p', name: 'Project' }],
			syncTaskBean: {
				update: [
					null,
					{ id: 't', title: 'Task', projectId: 'p', items: [null, { id: 's', title: 'Subtask' }] },
				],
			},
		}),
	);
	const client = new TickTickClient('dida365', 'token', '8000', 'csrf');
	const snapshot = await client.fetchSnapshot();
	expect(snapshot.tasks).toHaveLength(1);
	expect(snapshot.tasks[0]?.items).toEqual([{ id: 's', title: 'Subtask', status: 0 }]);
	await client.fetchSnapshot();
	expect(request).toHaveBeenCalledTimes(1);
	await client.updateTask('p', 't', { title: 'Edited', priority: 5 });
	const sent = request.mock.calls[1]![0];
	expect(sent).toMatchObject({
		url: 'https://api.dida365.com/api/v2/batch/task',
		method: 'POST',
		headers: { Cookie: 't=token; _csrf_token=csrf', 'X-Crsftoken': 'csrf' },
	});
	expect(JSON.parse(typeof sent === 'string' ? '' : (sent.body as string))).toEqual({
		update: [{ projectId: 'p', id: 't', title: 'Edited', priority: 5 }],
	});
	await client.fetchSnapshot();
	expect(request).toHaveBeenCalledTimes(3);
});
test('read-only cookies never send writes, completion and restore use Apex batch API', async () => {
	const readonly = new TickTickClient('ticktick', 'token');
	await expect(readonly.completeTask('p', 't')).rejects.toThrow('NO_CSRF');
	expect(request).not.toHaveBeenCalled();
	request.mockResolvedValue(response({}));
	const client = new TickTickClient('ticktick', 'token', undefined, 'csrf');
	await client.completeTask('p', 't');
	await client.uncompleteTask('p', 't');
	const bodies = request.mock.calls.map(([arg]) => JSON.parse(typeof arg === 'string' ? '' : (arg.body as string)));
	expect(bodies[0]).toMatchObject({
		update: [{ projectId: 'p', id: 't', status: 2, completedTime: expect.any(String) }],
	});
	expect(bodies[1]).toEqual({ update: [{ projectId: 'p', id: 't', status: 0 }] });
});
test.each([
	[401, 'BAD_COOKIE'],
	[429, 'RATE_LIMITED'],
	[500, 'HTTP_500'],
])('failed writes remain observable (%i)', async (status, reason) => {
	request.mockResolvedValue(response({}, status));
	const client = new TickTickClient('dida365', 'token', undefined, 'csrf');
	await expect(client.updateTask('p', 't', { status: 2 })).rejects.toThrow(reason);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});
test('hung reads and writes time out without retries and release timers', async () => {
	vi.useFakeTimers();
	request.mockImplementation(() => new Promise(() => {}) as ReturnType<typeof requestUrl>);
	const client = new TickTickClient('dida365', 'token', undefined, 'csrf');
	const read = expect(client.fetchSnapshot()).rejects.toThrow('TIMEOUT');
	const write = expect(client.updateTask('p', 't', { title: 'new' })).rejects.toThrow('WRITE_TIMEOUT');
	await vi.advanceTimersByTimeAsync(TICKTICK_TIMEOUT_MS);
	await Promise.all([read, write]);
	expect(request).toHaveBeenCalledTimes(2);
	expect(vi.getTimerCount()).toBe(0);
});
test('abort settles immediately, prevents queued reads and late responses from populating cache', async () => {
	vi.useFakeTimers();
	let finish!: (value: ReturnType<typeof response>) => void;
	request.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}) as ReturnType<typeof requestUrl>,
	);
	const client = new TickTickClient('dida365', 'token'),
		abort = new AbortController();
	const read = expect(client.fetchSnapshot({ signal: abort.signal })).rejects.toThrow('CANCELLED');
	abort.abort();
	await read;
	finish(response({ inboxId: 'stale' }));
	await Promise.resolve();
	await expect(client.fetchCompleted({ signal: abort.signal })).rejects.toThrow('CANCELLED');
	expect(request).toHaveBeenCalledTimes(1);
	expect(vi.getTimerCount()).toBe(0);
	request.mockResolvedValue(response({ inboxId: 'fresh' }));
	expect((await client.fetchSnapshot()).inboxId).toBe('fresh');
	expect(request).toHaveBeenCalledTimes(2);
});
