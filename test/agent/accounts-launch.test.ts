import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { App } from 'obsidian';
import { expect, test, vi } from 'vitest';
import { nativeVaultStorage } from '../../src/host/desktop/vault-storage';
import { initializeTestDevice } from '../fixtures/vault-storage';
import { normalizeAgentSettings } from '../../src/modules/agent/core/launch/defaults';
import { launchAgent, resumeAgent, type LaunchHost, type LaunchRequest } from '../../src/modules/agent/services/launch/launcher';

test('launch and resume derive an owned account environment instead of accepting stored path overrides', async () => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-agent-launch-'));
	vi.stubGlobal('window', { require: createRequire(import.meta.url) });
	const app = { vault: { adapter: { ...nativeVaultStorage(vault), getBasePath: () => vault } } } as unknown as App;
	const settings = normalizeAgentSettings(null); settings.yoloAcknowledged = true; settings.agents.codex.cliPath = process.execPath;
	const started: LaunchRequest[] = [];
	const host: LaunchHost = { app, getVaultPath: () => vault, getAgentSettings: () => settings, saveAgentSettings: async () => {}, start: async request => { started.push(request); } };
	try {
		await initializeTestDevice(app);
		await launchAgent(host, 'codex');
		expect(started[0]?.env.CODEX_HOME).toContain(path.join(vault, '.nand', 'agents'));
		expect(started[0]?.args).toContain('cli_auth_credentials_store="file"');
		expect(started[0]?.args).toContain('sqlite_home=' + JSON.stringify(started[0]!.env.CODEX_HOME));
		const session = { agentId: 'codex' as const, title: 'Resume', cwd: vault, sessionId: 'fixture', modifiedAtMs: 1, env: { ...started[0]!.env, CODEX_HOME: path.join(vault, 'outside') } };
		await expect(resumeAgent(host, session)).rejects.toThrow();
		expect(started).toHaveLength(1);
		await resumeAgent(host, { ...session, env: started[0]!.env });
		expect(started[1]?.env).toEqual(started[0]?.env);
		const outside = path.join(vault, 'outside-session.jsonl'); await writeFile(outside, 'external');
		await expect(resumeAgent(host, { ...session, env: started[0]!.env, transcriptPath: outside })).rejects.toThrow();
		expect(started).toHaveLength(2);
	} finally { vi.unstubAllGlobals(); await rm(vault, { recursive: true, force: true }); }
}, 30000);
