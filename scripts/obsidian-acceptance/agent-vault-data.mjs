import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

// Synthetic CLI processes exercise the real Windows PTY and environment without authenticating.
const fixtureCli = `const fs=require('fs'),path=require('path');const keys=['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TMP','TEMP','TMPDIR','XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_DATA_HOME','XDG_STATE_HOME','CLAUDE_CONFIG_DIR','CODEX_HOME','GEMINI_CLI_HOME','GROK_HOME','PI_CODING_AGENT_DIR','PI_CODING_AGENT_SESSION_DIR','OPENCODE_CONFIG_DIR','NAND_ACCOUNT_ROOT','NAND_ACCOUNT_ID','NAND_ACCOUNT_NAME','NAND_HOOK_DIR'];const env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));fs.writeFileSync(path.join(env.NAND_ACCOUNT_ROOT,'acceptance.json'),JSON.stringify({env,pid:process.pid,cwd:process.cwd()}));console.log('NAND_ACCOUNT_READY');setInterval(()=>{},1000);`;
const rows = [], plugin = 'app.plugins.plugins.nand', root = process.argv[2];
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 30000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(80); } throw Error('Timed out: ' + expression); };
const page = async () => {
	await c.evaluate(`${plugin}.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).some(s=>s.getViewType()==='nand-agent-page'&&s.controller)`);
	await c.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;true`);
};
try {
	runtime = await launchFreshVault({ root, port: 9455, files: { '.nand/acceptance/cli.cjs': fixtureCli, '.obsidian/plugins/nand/accounts/claude/ab/home/.credentials.json': '{"fixture":"old-owned-account"}', '.obsidian/plugins/nand/binaries/nand-pty-old.exe': 'retained old executable fixture' }, settings: { version: 1, namespaces: { app: { language: 'zh', introSeen: true, modules: Object.fromEntries(['home','agent','browser','archives','automations','notifications','icons','comments','sync'].map(id => [id,false])) } } } }); c = runtime.connection;
	await c.evaluate(`${plugin}.setModuleEnabled('agent',true)`);
	check('old-owned-data-requires-cold-restart', await c.evaluate(`${plugin}.moduleState('agent')==='failed'`));
	check('old-account-still-exists-before-restart', (await fs.readFile(path.join(runtime.vault,'.obsidian/plugins/nand/accounts/claude/ab/home/.credentials.json'),'utf8')).includes('old-owned-account'));
	await c.evaluate(`${plugin}.setModuleEnabled('agent',false)`); await c.evaluate(`${plugin}.setModuleEnabled('agent',true)`);
	check('module-reload-cannot-bypass-cold-gate', await c.evaluate(`${plugin}.moduleState('agent')==='failed'`));
	await runtime.restart(); c = runtime.connection; await page();
	const identity = JSON.parse(await fs.readFile(path.join(runtime.vault,'.nand/config/identity.json'),'utf8')), device = Object.keys(identity.devices)[0];
	const owned = path.join(runtime.vault,'.nand/agents',device), cli = path.join(runtime.vault,'.nand/acceptance/cli.cjs');
	check('old-account-retained-under-vault', (await fs.readFile(path.join(owned,'legacy-accounts/files/claude/ab/home/.credentials.json'),'utf8')).includes('old-owned-account'));
	check('old-helper-retained-under-vault', (await fs.readFile(path.join(runtime.vault,'.nand/helpers',device,'legacy-plugin/files/nand-pty-old.exe'),'utf8')).includes('retained old executable'));
	check('plugin-data-retired', !(await fs.stat(path.join(runtime.vault,'.obsidian/plugins/nand/accounts')).catch(() => undefined)) && !(await fs.stat(path.join(runtime.vault,'.obsidian/plugins/nand/binaries')).catch(() => undefined)));
	const providerIds = ['claude-code','codex','gemini','grok','pi','opencode'], probes = [];
	const launch = async (agent, name, legacy) => {
		await c.evaluate(`ac.settings.update(d=>{d.agents.yoloAcknowledged=true;d.agents.agents[${JSON.stringify(agent)}].enabled=true;d.agents.agents[${JSON.stringify(agent)}].cliPath=${JSON.stringify(process.execPath)};d.agents.agents[${JSON.stringify(agent)}].extraArgs=${JSON.stringify('"'+cli+'"')};d.agents.agents[${JSON.stringify(agent)}].accountId=${JSON.stringify(name)}});true`);
		await c.evaluate(`window.agentStarted=null;ac.newAgent(${JSON.stringify(agent)}).then(()=>agentStarted={ok:true},e=>agentStarted={ok:false,message:e.message});true`);
		if (legacy !== undefined) {
			await until(`!!document.querySelector('.suggestion-item')`);
			await runtime.shot('legacy-account-choice');
			const label = legacy === null ? '新建身份，不导入旧凭据' : '导入旧目录：'+legacy;
			check('explicit-legacy-choice-'+name, await c.evaluate(`(()=>{const row=[...document.querySelectorAll('.suggestion-item')].find(el=>el.textContent===${JSON.stringify(label)});row?.click();return !!row})()`));
		}
		await until(`window.agentStarted!==null`); const result = await c.evaluate('agentStarted'); check('launch-'+agent+'-'+name, result.ok, result);
		const directory = path.join(owned,'accounts',agent,name === '' ? 'default' : createHash('sha256').update(name.normalize('NFC')).digest('hex'));
		const file = path.join(directory,'acceptance.json');
		for (let i=0; i<150 && !await fs.stat(file).catch(()=>undefined); i++) await delay(100);
		const probe = JSON.parse(await fs.readFile(file,'utf8')); probes.push(probe);
		check('native-environment-'+agent+'-'+name, probe.env.NAND_ACCOUNT_NAME===name && Object.entries(probe.env).filter(([key])=>!['NAND_ACCOUNT_ID','NAND_ACCOUNT_NAME'].includes(key)).every(([,value])=>value.startsWith(directory+path.sep)||value===directory), probe.env);
		await c.evaluate(`for(const session of ac.sessions.list())if(session.running)ac.sessions.end(session.id,true);true`);
		await until(`ac.sessions.list().every(s=>!s.running)`);
		return probe;
	};
	const imported = await launch('claude-code','a.b','ab');
	check('selected-old-credentials-used', (await fs.readFile(path.join(imported.env.CLAUDE_CONFIG_DIR,'.credentials.json'),'utf8')).includes('old-owned-account'));
	const fresh = await launch('claude-code','ab',null);
	check('lossy-collision-does-not-reuse-credentials', fresh.env.CLAUDE_CONFIG_DIR!==imported.env.CLAUDE_CONFIG_DIR && !(await fs.stat(path.join(fresh.env.CLAUDE_CONFIG_DIR,'.credentials.json')).catch(()=>undefined)));
	for (const agent of providerIds) await launch(agent,'',agent==='claude-code' ? null : undefined);
	const chinese = await launch('codex','中文.账号'), plain = await launch('codex','中文账号');
	check('unicode-and-punctuation-identities-stay-distinct', chinese.env.NAND_ACCOUNT_ROOT!==plain.env.NAND_ACCOUNT_ROOT);
	await c.evaluate(`ac.settings.update(d=>{d.agents.agents.codex.accountId='   '});true`);
	const invalid = await c.evaluate(`ac.newAgent('codex').then(()=>'',e=>e.message)`); check('nonempty-invalid-name-is-visible', /账号/.test(invalid), invalid);
	await c.evaluate(`ac.settings.update(d=>{d.agents.agents.codex.accountId='中文.账号'});true`);
	await runtime.shot('vault-agent-environment');
	await runtime.restart(); c = runtime.connection; await page();
	const restarted = await launch('claude-code','a.b');
	check('binding-survives-cold-restart', restarted.env.CLAUDE_CONFIG_DIR===imported.env.CLAUDE_CONFIG_DIR);
	check('archived-original-survives-new-launches', (await fs.readFile(path.join(owned,'legacy-accounts/files/claude/ab/home/.credentials.json'),'utf8')).includes('old-owned-account'));
	check('native-children-exit', probes.every(({pid})=>{try{process.kill(pid,0);return false;}catch{return true;}}));
} catch(error) { rows.push({name:'acceptance-failure',passed:false,detail:error.stack}); await runtime?.shot('failure').catch(()=>{}); }
finally { if(runtime) {await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({passed:rows.every(row=>row.passed),realAccountsVerified:false,rows},null,2));console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failures:rows.filter(row=>!row.passed)}));await runtime.stop();} }
assert.ok(rows.every(row=>row.passed),'Agent vault acceptance failed');
