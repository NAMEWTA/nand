
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
async function main(){
setLanguage('zh'); observed.zh=[t('terminalAgent.commands.openTerminal'),t('terminalAgent.ribbon.terminalTooltip'),t('intro.body'),t('about.intro1')];setLanguage('en');observed.en=[t('iconic.menu.changeIcon'),t('intro.body')];console.log(JSON.stringify(observed));assert.ok(observed.zh[0].includes('打开 NAND'),'#32 terminal command must have brand spacing');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
