import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PI_EXTENSION, OPENCODE_EXTENSION } from './native-extensions';

async function spool(run: (directory: string) => Promise<void>) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-hooks-test-'));
	const saved = {
		dir: process.env.NAND_HOOK_DIR,
		token: process.env.NAND_HOOK_TOKEN,
		owner: process.env.NAND_NATIVE_OWNER,
	};
	process.env.NAND_HOOK_DIR = directory;
	process.env.NAND_HOOK_TOKEN = 'test';
	delete process.env.NAND_NATIVE_OWNER;
	try {
		await run(directory);
	} finally {
		for (const [key, value] of Object.entries({
			NAND_HOOK_DIR: saved.dir,
			NAND_HOOK_TOKEN: saved.token,
			NAND_NATIVE_OWNER: saved.owner,
		}))
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		await fs.rm(directory, { recursive: true, force: true });
	}
}
async function events(directory: string): Promise<string[]> {
	return Promise.all(
		(await fs.readdir(directory))
			.filter((file) => file.endsWith('.json'))
			.map(async (file) => JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')).event as string),
	);
}

test('Pi reports completion only after a native idle check, and suppresses repeated settlement', async () =>
	spool(async (directory) => {
		const handlers = new Map<string, (event: Record<string, unknown>, ctx: unknown) => void>();
		const module = await import(`data:text/javascript,${encodeURIComponent(PI_EXTENSION)}#${Date.now()}`);
		module.default({
			on: (key: string, fn: (event: Record<string, unknown>, ctx: unknown) => void) => handlers.set(key, fn),
		});
		let idle = false;
		const ctx = {
			cwd: directory,
			isIdle: () => idle,
			sessionManager: { getSessionId: () => 'root', getSessionFile: () => 'root.jsonl' },
		};
		handlers.get('agent_start')!({}, ctx);
		handlers.get('agent_end')!({}, ctx);
		await new Promise((r) => setTimeout(r, 25));
		assert.equal((await events(directory)).filter((e) => e === 'Stop').length, 0);
		idle = true;
		handlers.get('agent_settled')!({}, ctx);
		handlers.get('agent_settled')!({}, ctx);
		assert.equal((await events(directory)).filter((e) => e === 'Stop').length, 1);
		handlers.get('session_shutdown')!({}, ctx);
	}));

test('OpenCode ignores child idle and recoverable errors but accepts root busy/idle', async () =>
	spool(async (directory) => {
		const module = await import(`data:text/javascript,${encodeURIComponent(OPENCODE_EXTENSION)}#${Date.now()}`);
		const plugin = await module.NandStatus({
			client: {
				session: {
					get: async ({ path: { id } }: { path: { id: string } }) => ({
						data: { directory, parentID: id === 'child' ? 'root' : undefined },
					}),
				},
			},
		});
		await plugin.event({
			event: { type: 'session.status', properties: { sessionID: 'root', status: { type: 'busy' } } },
		});
		await plugin.event({ event: { type: 'session.error', properties: { sessionID: 'root' } } });
		await plugin.event({
			event: { type: 'session.status', properties: { sessionID: 'child', status: { type: 'idle' } } },
		});
		assert.deepEqual(await events(directory), ['UserPromptSubmit']);
		await plugin.event({
			event: { type: 'session.status', properties: { sessionID: 'root', status: { type: 'idle' } } },
		});
		assert.equal((await events(directory)).filter((e) => e === 'Stop').length, 1);
	}));
