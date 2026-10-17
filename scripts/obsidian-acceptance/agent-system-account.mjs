// Real Obsidian: an agent CLI and an ordinary shell started from NAND see the user's real HOME and existing login.
// A fake login lives in the disposable HOME only; no real credentials are read or needed.
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian NAND_PTY_BINARY=$PWD/native/pty-server/target/debug/nand-pty \
//   [NAND_SA_MINIMAL_DIR=~/refs/obsidian-minimal-9.0.2] xvfb-run -a node scripts/obsidian-acceptance/agent-system-account.mjs /tmp/nand-a1-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { captureRealConfig } from './real-config-snapshot.mjs';

const root = process.argv[2], plugin = 'app.plugins.plugins.nand', node = process.execPath;
assert.ok(root && process.env.NAND_PTY_BINARY, 'usage: agent-system-account.mjs <new directory> (NAND_PTY_BINARY required)');
// The fixture CLI records what it sees; it never contacts a service.
const fixtureCli = `const fs=require('fs'),path=require('path');
const home=process.env.HOME,codex=process.env.CODEX_HOME||path.join(home,'.codex');
const keys=['HOME','CODEX_HOME','CLAUDE_CONFIG_DIR','XDG_CONFIG_HOME','OPENAI_API_KEY','NAND_ACCOUNT_ID','NAND_ACCOUNT_NAME','NAND_ACCOUNT_ROOT'];
const read=f=>{try{return fs.readFileSync(f,'utf8')}catch{return null}};
const tag=process.env.PROBE_TAG||((process.env.NAND_ACCOUNT_ID||'x/').split('/')[0]+'-'+(process.env.NAND_ACCOUNT_NAME||'system')),probe={tag,argv:process.argv.slice(2),env:Object.fromEntries(keys.map(k=>[k,process.env[k]])),auth:read(path.join(codex,'auth.json'))};
fs.writeFileSync(path.join(process.env.PROBE_DIR||path.dirname(process.argv[1]),'probe-'+tag+'.json'),JSON.stringify(probe));
console.log('PROBE_READY');setInterval(()=>{},1000);`;
const rows = [];
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name + ' ' + JSON.stringify(detail ?? '')); };
const until = async (expression, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(100); } throw Error('Timed out: ' + expression); };
const page = async () => {
	await c.evaluate(`${plugin}.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).some(s=>s.getViewType()==='nand-agent-page'&&s.controller)`);
	await c.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;true`);
};
const exists = file => fs.stat(file).then(() => true, () => false);
// First of all, before any variable is cleared: fingerprint the developer's real provider files, resolved from the original environment.
const realEnv = { ...process.env }, realHome = os.homedir();
const realBefore = await captureRealConfig(realEnv, realHome);
process.env.OPENAI_API_KEY = 'fixture-key-kept';
for (const key of ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'OPENCODE_CONFIG_DIR', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME']) delete process.env[key];
// A desktop-icon launch: the process PATH is bare, and a login shell exports the real one.
await fs.mkdir(root + '-shell', { recursive: true });
await fs.writeFile(root + '-shell/fake-shell', `#!/bin/sh\nprintf '\\0__NAND_LOGIN_SHELL_ENV_START__\\0PATH=${root}/bin:/usr/bin:/bin\\0__NAND_LOGIN_SHELL_ENV_END__\\0'\n`, { mode: 0o755 });
process.env.SHELL = root + '-shell/fake-shell'; process.env.PATH = '/usr/bin:/bin';
try {
	runtime = await launchFreshVault({ root, port: 9471, files: { '.nand/acceptance/cli.cjs': fixtureCli },
		settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: Object.fromEntries(['home', 'agent', 'browser', 'archives', 'automations', 'notifications', 'icons', 'comments', 'sync'].map(id => [id, id === 'agent'])) } } } });
	c = runtime.connection;
	check('application-env-is-isolated', (await c.evaluate(`[process.env.HOME,process.env.CODEX_HOME,process.env.CLAUDE_CONFIG_DIR]`)).join('|') === path.join(root, 'home') + '||', await c.evaluate('[process.env.HOME,process.env.CODEX_HOME]'));
	const home = path.join(root, 'home'), vault = runtime.vault, cli = path.join(vault, '.nand/acceptance/cli.cjs'), probeDir = path.join(vault, '.nand/acceptance');
	// Fixture CLIs are found only through the login-shell PATH: the process PATH lacks this directory.
	const bin = path.join(root, 'bin'), wrapper = path.join(bin, 'codex');
	await fs.mkdir(bin);
	for (const name of ['codex', 'claude', 'grok', 'gemini', 'pi', 'opencode']) await fs.writeFile(path.join(bin, name), `#!/bin/sh\nexec ${JSON.stringify(node)} ${JSON.stringify(cli)} "$@"\n`, { mode: 0o755 });
	const identity = JSON.parse(await fs.readFile(path.join(vault, '.nand/config/identity.json'), 'utf8')), device = Object.keys(identity.devices)[0];
	const agents = path.join(vault, '.nand/agents', device);
	await runtime.stop();
	// The first start found nothing to adopt and recorded that; this run plants the old default account afterwards.
	await fs.rm(path.join(agents, 'default-account-adopted'), { force: true });
	// The machine already has a Codex login, a Claude settings file with a user hook, a session, and the vault has an old default account.
	await fs.mkdir(path.join(home, '.codex/sessions/2026/01/01'), { recursive: true });
	await fs.mkdir(path.join(home, '.claude'), { recursive: true });
	await fs.writeFile(path.join(home, '.codex/auth.json'), '{"fixture":"system-login"}');
	await fs.writeFile(path.join(home, '.codex/sessions/2026/01/01/rollout-2026-01-01T00-00-00-fixture.jsonl'),
		[JSON.stringify({ type: 'session_meta', payload: { id: 'system-session-1', cwd: vault } }), JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ text: 'hello from the system home' }] } })].join('\n') + '\n');
	const userSettings = { theme: 'keep', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo keep-user-hook' }] }] } };
	await fs.writeFile(path.join(home, '.claude/settings.json'), JSON.stringify(userSettings));
	await fs.mkdir(path.join(agents, 'accounts/codex/default/home/.codex'), { recursive: true });
	await fs.writeFile(path.join(agents, 'accounts/codex/default/home/.codex/auth.json'), '{"fixture":"old-vault-login"}');
	await runtime.restart(); c = runtime.connection; await page();
	await c.evaluate('ac.agents.refresh(true).then(()=>true)');
	check('cli-found-through-login-shell-path', (await c.evaluate('ac.agents.store.getState().detected.codex')) === wrapper, await c.evaluate('ac.agents.store.getState().detected'));
	const configure = (agent, name) => c.evaluate(`ac.settings.update(d=>{d.agents.yoloAcknowledged=true;d.enabled[${JSON.stringify(agent)}]=true;d.agents.agents[${JSON.stringify(agent)}].accountId=${JSON.stringify(name)}});true`);
	const launch = async (agent, name) => {
		const tag = `${agent === 'claude-code' ? 'claude-code' : agent}-${name || 'system'}`;
		await fs.rm(path.join(probeDir, `probe-${tag}.json`), { force: true });
		await configure(agent, name);
		await c.evaluate(`window.agentStarted=null;ac.newAgent(${JSON.stringify(agent)}).then(()=>agentStarted={ok:true},e=>agentStarted={ok:false,message:e.message});true`);
		await until('window.agentStarted!==null'); const started = await c.evaluate('agentStarted'); check('launch-' + tag, started.ok, started);
		const file = path.join(probeDir, `probe-${tag}.json`);
		for (let i = 0; i < 100 && !await exists(file); i++) await delay(100);
		const probe = JSON.parse(await fs.readFile(file, 'utf8'));
		await c.evaluate(`for(const s of ac.sessions.list())if(s.running)ac.sessions.end(s.id,true);true`);
		await until('ac.sessions.list().every(s=>!s.running)');
		return probe;
	};
	// 1. Default account: the CLI sees the real home, the existing login and an exported key.
	const system = await launch('codex', '');
	check('system-home-is-real-home', system.env.HOME === home, system.env);
	check('system-sets-no-cli-home', system.env.CODEX_HOME === undefined && system.env.CLAUDE_CONFIG_DIR === undefined, system.env);
	check('system-reads-existing-login', system.auth === '{"fixture":"system-login"}', system.auth);
	check('system-keeps-api-key', system.env.OPENAI_API_KEY === 'fixture-key-kept', system.env);
	check('system-marker', system.env.NAND_ACCOUNT_ID === 'codex/system' && system.env.NAND_ACCOUNT_NAME === '', system.env);
	check('system-adds-no-codex-storage-override', !system.argv.join(' ').includes('cli_auth_credentials_store'), system.argv);
	check('system-runtime-in-vault', system.env.NAND_ACCOUNT_ROOT === path.join(agents, 'system'), system.env.NAND_ACCOUNT_ROOT);
	// 2. Ordinary shell: same real home, nothing cleared.
	await c.evaluate(`window.shellStarted=null;ac.sessions.create({kind:'shell',title:'probe',file:${JSON.stringify(wrapper)},args:[],env:{PROBE_TAG:'shell'},cwd:${JSON.stringify(vault)}}).then(()=>shellStarted=true,e=>shellStarted=String(e));true`);
	await until('window.shellStarted!==null'); check('shell-started', await c.evaluate('shellStarted') === true, await c.evaluate('shellStarted'));
	for (let i = 0; i < 100 && !await exists(path.join(probeDir, 'probe-shell.json')); i++) await delay(100);
	const shell = JSON.parse(await fs.readFile(path.join(probeDir, 'probe-shell.json'), 'utf8'));
	check('shell-real-home', shell.env.HOME === home && shell.auth === '{"fixture":"system-login"}' && shell.env.OPENAI_API_KEY === 'fixture-key-kept', shell);
	await c.evaluate(`for(const s of ac.sessions.list())if(s.running)ac.sessions.end(s.id,true);true`);
	// 3. Managed accounts keep their isolation.
	const managed = await launch('codex', 'managed');
	check('managed-home-is-isolated', managed.env.HOME.startsWith(path.join(agents, 'accounts/codex')) && managed.env.CODEX_HOME.startsWith(path.join(agents, 'accounts/codex')), managed.env);
	check('managed-has-no-system-login', managed.auth === null, managed.auth);
	check('managed-clears-api-key', managed.env.OPENAI_API_KEY === '', managed.env);
	check('managed-keeps-storage-override', managed.argv.join(' ').includes('cli_auth_credentials_store'), managed.argv);
	// 4. Migration: the old default account became a named managed account and kept its files.
	const accounts = await c.evaluate('ac.settings.get().accounts.codex'), labels = await c.evaluate('ac.settings.get().accountLabels.codex');
	check('legacy-default-registered', Array.isArray(accounts) && accounts.includes('vault-account-legacy') && labels['vault-account-legacy'] === 'Vault account (legacy)', { accounts, labels });
	const legacy = await launch('codex', 'vault-account-legacy');
	check('legacy-default-keeps-login', legacy.auth === '{"fixture":"old-vault-login"}', legacy.auth);
	check('legacy-default-files-untouched', (await fs.readFile(path.join(agents, 'accounts/codex/default/home/.codex/auth.json'), 'utf8')) === '{"fixture":"old-vault-login"}');
	// 5. Adding an account creates an empty managed account: it does not inherit the system login (the user signs in inside it).
	await c.evaluate(`ac.addAccount('codex','Added').then(()=>true)`);
	const added = await launch('codex', 'Added');
	check('added-account-starts-without-login', added.auth === null && added.env.HOME.startsWith(path.join(agents, 'accounts/codex')), added);
	check('no-import-action-offered', !(await c.evaluate('typeof ac.importSystemAccount')).includes('function'));
	check('system-login-untouched', (await fs.readFile(path.join(home, '.codex/auth.json'), 'utf8')) === '{"fixture":"system-login"}');
	// 6. Status hooks: one fixed, vault-independent entry per event in the real Claude settings; user entries kept; nothing removed automatically.
	await c.evaluate(`ac.settings.update(d=>{d.statusHooks=true});true`);
	await launch('claude-code', '');
	const merged = JSON.parse(await fs.readFile(path.join(home, '.claude/settings.json'), 'utf8'));
	const hookText = JSON.stringify(merged.hooks);
	check('hooks-merged-into-real-settings', merged.theme === 'keep' && JSON.stringify(merged.hooks.Stop[0]) === JSON.stringify(userSettings.hooks.Stop[0]) && hookText.includes('nand-hook.sh'), merged);
	check('hook-entry-is-vault-independent', !hookText.includes(vault) && !hookText.includes('.nand/agents') && hookText.includes(path.join(home, '.nand/agent-hooks/nand-hook.sh')));
	check('global-hook-scripts-in-nand-directory', await exists(path.join(home, '.nand/agent-hooks/nand-hook.sh')) && await exists(path.join(home, '.nand/agent-hooks/nand-hook.cjs')));
	check('user-directory-has-no-leftovers', (await fs.readdir(path.join(home, '.claude'))).join() === 'settings.json', await fs.readdir(path.join(home, '.claude')));
	const settled = await fs.readFile(path.join(home, '.claude/settings.json'), 'utf8');
	await c.evaluate(`ac.settings.update(d=>{d.statusHooks=false});true`);
	await delay(1500);
	check('switching-hooks-off-keeps-system-entries', (await fs.readFile(path.join(home, '.claude/settings.json'), 'utf8')) === settled);
	await c.evaluate(`ac.settings.update(d=>{d.statusHooks=true});true`);
	await launch('claude-code', '');
	check('reinstall-is-idempotent', (await fs.readFile(path.join(home, '.claude/settings.json'), 'utf8')) === settled);
	// 6b. Pi: the user's own extension is kept (reported, not replaced); once the name is free NAND writes its fixed file.
	await fs.mkdir(path.join(home, '.pi/agent/extensions'), { recursive: true });
	await fs.writeFile(path.join(home, '.pi/agent/extensions/nand-status.ts'), '// USER CUSTOM CONTENT');
	await launch('pi', '');
	check('pi-user-extension-untouched', (await fs.readFile(path.join(home, '.pi/agent/extensions/nand-status.ts'), 'utf8')) === '// USER CUSTOM CONTENT');
	await fs.rm(path.join(home, '.pi/agent/extensions/nand-status.ts'));
	await launch('pi', '');
	check('pi-extension-installed-when-free', (await fs.readFile(path.join(home, '.pi/agent/extensions/nand-status.ts'), 'utf8')).includes('NAND_HOOK_DIR'));
	// 6c. Only the explicit removal takes them out, and only exactly NAND's entries.
	const removed = await c.evaluate(`ac.removeSystemStatusHooks().then(r=>r,e=>({error:String(e)}))`);
	check('explicit-removal-reports-changes', removed.changed?.length >= 2 && !removed.skipped?.length, removed);
	check('explicit-removal-restores-user-config', JSON.stringify(JSON.parse(await fs.readFile(path.join(home, '.claude/settings.json'), 'utf8'))) === JSON.stringify(userSettings));
	check('explicit-removal-removes-extension-and-scripts', !await exists(path.join(home, '.pi/agent/extensions/nand-status.ts')) && !await exists(path.join(home, '.nand/agent-hooks/nand-hook.sh')));
	// 6d. NAND's own directory and a blank provider file are never forced.
	await fs.writeFile(path.join(home, '.claude/settings.json'), '  \n');
	await c.evaluate(`ac.settings.update(d=>{d.statusHooks=true});true`);
	await launch('claude-code', '');
	check('blank-provider-json-left-alone', (await fs.readFile(path.join(home, '.claude/settings.json'), 'utf8')) === '  \n');
	await fs.writeFile(path.join(home, '.claude/settings.json'), JSON.stringify(userSettings));
	// 7. History reads the real home.
	const history = await c.evaluate(`(async()=>{const h=ac.history();const warnings=await h.scan();const page=await h.query('',0,undefined,'all','account');return {warnings,rows:page.rows.map(r=>({id:r.sessionId,key:r.accountKey,path:r.transcriptPath}))}})().catch(e=>({error:String(e)}))`);
	const row = history.rows?.find(r => r.id === 'system-session-1');
	check('history-lists-system-session', !!row && JSON.parse(row.key).NAND_ACCOUNT_ID === 'codex/system' && row.path.startsWith(home), history);
	// 8. UI: the default row says "System account" with its real location; no import action is offered.
	await c.evaluate(`${plugin}.openWorkbench({feature:'settings',section:'terminal',resourceId:'accounts'})`);
	await until(`document.body.innerText.includes('System account')`);
	const text = await c.evaluate('document.body.innerText');
	check('ui-shows-system-account-and-location', text.includes('System account') && text.includes('~/.codex') && !text.includes('Import from system'), text.slice(0, 600));
	check('ui-lists-legacy-account', text.includes('Vault account (legacy)'));
	const shot = async name => runtime.shot(name);
	await shot('accounts-default-light');
	const minimalDir = process.env.NAND_SA_MINIMAL_DIR;
	await c.evaluate(`app.changeTheme('obsidian');true`); await delay(600); await shot('accounts-default-dark');
	if (minimalDir) {
		const themeDir = path.join(vault, '.obsidian/themes/Minimal');
		await fs.mkdir(themeDir, { recursive: true });
		for (const file of ['theme.css', 'manifest.json']) await fs.copyFile(path.join(minimalDir, file), path.join(themeDir, file));
		await c.evaluate(`app.customCss.setTheme('Minimal');true`); await delay(1200);
		await c.evaluate(`app.changeTheme('obsidian');true`); await delay(600); await shot('accounts-minimal-dark');
		await c.evaluate(`app.changeTheme('moonstone');true`); await delay(600); await shot('accounts-minimal-light');
	}
	// Theme switching rewrites .obsidian/app.json while the host reads it; that host-side noise is not ours.
	const errors = (await c.evaluate('nandAcceptanceErrors')).filter(e => !/\.obsidian\/(app|appearance)\.json/.test(e));
	check('no-console-errors', errors.length === 0, errors);
} catch (error) { rows.push({ name: 'acceptance-failure', passed: false, detail: error.stack }); await runtime?.shot('failure').catch(() => {}); }
finally {
	// Each step is independent: a failure to stop or to write the result must not skip the comparison.
	try {
		if (runtime) {
			await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: rows.every(row => row.passed), rows }, null, 2)).catch(() => {});
			await runtime.stop().catch(error => rows.push({ name: 'stop-failed', passed: false, detail: String(error) }));
		}
	} finally {
		const after = await captureRealConfig(realEnv, realHome);
		rows.push({ name: 'real-provider-files-untouched-after-stop', passed: after === realBefore, detail: after === realBefore ? undefined : { realBefore, after } });
		if (runtime) await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: rows.every(row => row.passed), rows }, null, 2)).catch(() => {});
		console.log(JSON.stringify({ evidence: runtime?.evidence, checks: rows.length, failures: rows.filter(row => !row.passed) }, null, 2));
	}
}
assert.ok(rows.every(row => row.passed), 'System account acceptance failed');
