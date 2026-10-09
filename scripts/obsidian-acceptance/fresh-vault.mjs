// Launch real Obsidian on a NEW disposable vault and profile (never an existing one).
// Requires NAND_OBSIDIAN_EXECUTABLE (absolute) and a root directory that does not exist yet.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';

/**
 * @param {{ root: string; files?: Record<string, string>; settings?: unknown; port?: number }} options
 * `files` are vault-relative paths; `settings` is written to .nand/config/settings.json.
 */
export async function launchFreshVault({ root, files = {}, settings, port = 9237 }) {
	const executable = process.env.NAND_OBSIDIAN_EXECUTABLE;
	assert.ok(executable && path.isAbsolute(executable), 'NAND_OBSIDIAN_EXECUTABLE must be absolute');
	assert.ok(path.isAbsolute(root) && path.parse(root).root !== root, 'root must be an absolute, non-root path');
	await fs.mkdir(root);
	const vault = path.join(root, 'vault');
	const profile = path.join(root, 'profile');
	const evidence = path.join(root, 'evidence');
	const manifest = JSON.parse(await fs.readFile('manifest.json', 'utf8'));
	const pluginDir = path.join(vault, '.obsidian', 'plugins', manifest.id);
	for (const dir of [vault, profile, evidence, pluginDir, path.join(root, 'home'), path.join(root, 'config'), path.join(root, 'runtime'), path.join(vault, '.nand', 'config')]) await fs.mkdir(dir, { recursive: true });
	for (const file of ['main.js', 'styles.css', 'manifest.json']) await fs.copyFile(file, path.join(pluginDir, file));
	await fs.writeFile(path.join(vault, '.obsidian', 'community-plugins.json'), JSON.stringify([manifest.id]));
	await fs.writeFile(path.join(vault, '.obsidian', 'app.json'), JSON.stringify({ livePreview: true }));
	if (settings) await fs.writeFile(path.join(vault, '.nand', 'config', 'settings.json'), JSON.stringify(settings));
	for (const [file, text] of Object.entries(files)) {
		await fs.mkdir(path.dirname(path.join(vault, file)), { recursive: true });
		await fs.writeFile(path.join(vault, file), text);
	}
	await fs.writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ vaults: { abcdef1234567890: { path: vault, ts: Date.now(), open: true } } }));
	const env = { ...process.env, HOME: path.join(root, 'home'), XDG_CONFIG_HOME: path.join(root, 'config'), XDG_RUNTIME_DIR: path.join(root, 'runtime'), NAND_CDP_URL: `http://127.0.0.1:${port}` };
	process.env.NAND_CDP_URL = env.NAND_CDP_URL;
	const session = { connection: undefined, app: undefined, exited: undefined };
	const start = async () => {
		const log = openSync(path.join(evidence, 'application.log'), 'a');
		const app = spawn(executable, ['--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { env, stdio: ['ignore', log, log] });
		closeSync(log);
		session.app = app;
		session.exited = once(app, 'exit');
		const deadline = Date.now() + 90000;
		let connection;
		while (Date.now() < deadline && !connection) {
			if (app.exitCode !== null) throw new Error(`Obsidian exited during startup (${app.exitCode})`);
			try { connection = await connect(); } catch { await delay(250); }
		}
		assert.ok(connection, 'Obsidian did not expose a CDP target');
		// Ready = the trust prompt is answered and onload finished (the workbench exists).
		const ready = `typeof app !== 'undefined' && !!app.workspace?.layoutReady && !!app.plugins?.plugins?.nand?.workbench`;
		while (Date.now() < deadline) {
			await connection.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Trust author and enable plugins');b?.click()})()`).catch(() => undefined);
			if (await connection.evaluate(ready).catch(() => false)) break;
			await delay(150);
		}
		assert.ok(await connection.evaluate(ready), 'NAND did not finish loading');
		session.connection = connection;
	};
	const stop = async () => {
		const { connection, app, exited } = session;
		if (!app) return;
		await connection?.evaluate(`setTimeout(()=>require('@electron/remote').app.quit(),50);true`).catch(() => undefined);
		connection?.close();
		await Promise.race([exited, delay(20000)]);
		if (app.exitCode === null) app.kill('SIGKILL');
		session.app = undefined;
		session.connection = undefined;
	};
	const shot = async (name) => {
		const { data } = await session.connection.send('Page.captureScreenshot', { format: 'png' });
		await fs.writeFile(path.join(evidence, `${name}.png`), Buffer.from(data, 'base64'));
	};
	await start();
	return {
		vault, evidence, stop, shot,
		get connection() { return session.connection; },
		/** Quit normally and start Obsidian again on the same vault and profile. */
		restart: async () => { await stop(); await start(); },
	};

}
