import {RecordEditorModal} from '../../../../../../src/view/contacts/forms';import {newRecord} from '../../../../../../src/core/contacts/model';
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
delete (globalThis as any).document;delete (globalThis as any).window;
const labels:string[]=[];const buttons:string[]=[];
const control:any={setValue(){return this},setCta(){return this},setDisabled(){return this},setDesc(){return this},setButtonText(v:string){buttons.push(v);return this},onClick(){return this},onChange(){return this},addOption(){return this},inputEl:{}};
(Setting.prototype as any).addButton=function(cb:any){cb(control);return this};(Setting.prototype as any).addTextArea=function(cb:any){cb(control);return this};
const original=Setting.prototype.setName;Setting.prototype.setName=function(s:string){labels.push(s);return original.call(this,s)};
(Modal.prototype as any).setTitle=function(s:string){observed.title=s};
const record=newRecord('person');record.path='Contacts/test.md';record.fields.name='Synthetic';const controller:any={app:{},root:'Contacts',subscribe:()=>()=>{},index:{get:()=>record}};
const editor:any=new RecordEditorModal(controller,record,'relation',undefined,()=>{});editor.modalEl={addClass(){}};editor.onOpen();observed.buttons=buttons;observed.labels=labels;console.log(JSON.stringify(observed));assert.ok(!buttons.includes('清除筛选'),'#31 relation clear action must not be labeled clear filters');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
