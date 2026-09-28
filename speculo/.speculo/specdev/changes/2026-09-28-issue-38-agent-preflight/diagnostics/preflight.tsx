import {AutomationEditor} from '../../../../../../src/view/automations/editor';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { setLanguage, t } from '../../../../../../src/shared/i18n/index';
import { Notice, Setting, Modal } from 'obsidian';
const {document,window}=parseHTML('<html><body></body></html>');
Object.assign(globalThis,{document,window});
window.require=createRequire(process.cwd()+'/package.json');
const delay=(ms=100)=>new Promise(r=>setTimeout(r,ms));
const hostEl=()=>{const el=document.createElement('div');document.body.append(el);return el};
const observed:any={};
import {TerminalAutomationRuntime} from '../../../../../../src/plugin/workflows/agent-runtime';
import {normalizeAgentSettings} from '../../../../../../src/core/agent-launch/defaults';
async function main(){
setLanguage('zh');const settings=normalizeAgentSettings({});settings.globalPermission='yolo';settings.yoloAcknowledged=false;settings.agents['claude-code'].enabled=true;settings.agents['claude-code'].cliPath='/nonexistent/nand-probe-cli';
let cwdChecks=0;const host:any={app:{loadLocalStorage:()=> 'probe',workspace:{containerEl:{win:window}},vault:{adapter:{exists:async()=>false,getBasePath:()=>{cwdChecks++;return '/nonexistent/nand-vault'}}}},settings:{agentSettings:settings},manifest:{dir:'.obsidian/plugins/nand'}};
const runtime=new TerminalAutomationRuntime(host);let error='';try{await runtime.start({kind:'agent',agentId:'claude-code',cwd:'/nonexistent/nand-vault',prompt:'synthetic',sessionMode:'fresh'},{} as any)}catch(e){error=String(e)}
console.log(JSON.stringify({error,cwdChecks,configuredCli:settings.agents['claude-code'].cliPath}));assert.ok(!error.includes(t('automation.permissionRequired')),'#38 missing CLI and cwd must not be masked by permission confirmation');
}main().catch(e=>{console.error(e.message);process.exitCode=1});
