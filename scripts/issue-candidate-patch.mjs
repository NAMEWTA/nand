import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
function edit(file, from, to) { const text=fs.readFileSync(file,'utf8'); assert.ok(text.includes(from),'Missing anchor: '+file+' '+from.slice(0,70));fs.writeFileSync(file,text.replace(from,to)); }
function put(file,text){assert.ok(!fs.existsSync(file),'File exists: '+file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function span(file,from,to,replacement){const text=fs.readFileSync(file,'utf8'),start=text.indexOf(from),end=text.indexOf(to,start+from.length);assert.ok(start>=0&&end>start,file);fs.writeFileSync(file,text.slice(0,start)+replacement+text.slice(end));}
function messages(file,en,zh){for(const [lang,values] of Object.entries({en,zh}))edit(file,'\t'+lang+': {','\t'+lang+': {\n'+Object.entries(values).map(([k,v])=>'\t\t'+JSON.stringify(k)+': '+JSON.stringify(v)+',').join('\n'));}
put('src/core/dashboard/save-state.ts',String.raw`import { t } from '../../shared/i18n/index';
export const DASHBOARD_CONFLICT_DIR = '.nand/recovery/dashboard/conflicts';
export type DashboardSaveStatus = 'saved' | 'saving' | 'conflict-pending' | 'conflict-saved' | 'recovery-error' | 'save-error';
export interface DashboardSaveState {
	status: DashboardSaveStatus;
	localRevision: number;
	recoveryRevision: number;
	recoveryPath: string | null;
	detail: string;
}
export class DashboardSaveError extends Error {
	constructor(readonly code: 'conflict' | 'saveFailed' | 'recoveryFailed' | 'changed' | 'closed', message: string) { super(message); this.name = 'DashboardSaveError'; }
}
export function dashboardSaveMessage(state: Readonly<DashboardSaveState>): string {
	if (state.status === 'saved') return '';
	const keys = { saving: 'dashboard.sync.saving', 'conflict-pending': 'dashboard.sync.conflictPending', 'conflict-saved': 'dashboard.sync.conflict', 'recovery-error': 'dashboard.sync.recoveryFailed', 'save-error': 'dashboard.sync.saveFailed' };
	return t(keys[state.status], { path: state.recoveryPath ?? DASHBOARD_CONFLICT_DIR });
}
`);
const sync='src/platform/obsidian/dashboard/sync.ts';
edit(sync,"import { ensureDirectory }", "import { DASHBOARD_CONFLICT_DIR, DashboardSaveError, dashboardSaveMessage, type DashboardSaveState, type DashboardSaveStatus } from '../../../core/dashboard/save-state';\nimport { ensureDirectory }");
edit(sync,"import { t } from '../../../shared/i18n/index';","import { onLanguageChanged, t } from '../../../shared/i18n/index';");
edit(sync,'\tprivate conflictSaved = false;\n','');
edit(sync,'export class SyncEngine {',String.raw`export class SyncEngine {
	private localRevision = 0;
	private recoveryRevision = 0;
	private saveState: Readonly<DashboardSaveState> = Object.freeze({ status: 'saved', localRevision: 0, recoveryRevision: 0, recoveryPath: null, detail: '' });
	private saveListeners = new Set<(state: Readonly<DashboardSaveState>) => void>();
	private saveNotice: Notice | null = null;
	private languageCleanup: (() => void) | null = null;
	private closingTask: Promise<void> | null = null;
	private closed = false;

	getSaveState(): Readonly<DashboardSaveState> { return this.saveState; }
	getLocalDraft(): string { return this.data ? serialize(this.data) : ''; }
	onSaveStateUpdate(callback: (state: Readonly<DashboardSaveState>) => void): () => void {
		this.saveListeners.add(callback); callback(this.saveState);
		return () => this.saveListeners.delete(callback);
	}
	private setSaveState(status: DashboardSaveStatus, detail = ''): void {
		this.saveState = Object.freeze({ status, localRevision: this.localRevision, recoveryRevision: this.recoveryRevision,
			recoveryPath: this.conflict ? DASHBOARD_CONFLICT_DIR + '/' + this.conflict.id + '.json' : null, detail });
		for (const callback of this.saveListeners) callback(this.saveState);
		this.refreshSaveNotice();
	}
	private refreshSaveNotice(): void {
		if (this.saveState.status === 'saved') { this.saveNotice?.hide(); this.saveNotice = null; return; }
		if (this.saveState.status === 'saving' && !this.saveNotice) return;
		const message = dashboardSaveMessage(this.saveState);
		if (this.saveNotice) this.saveNotice.setMessage(message);
		else this.saveNotice = new Notice(message, 0);
	}
	private saveFailure(error: unknown): DashboardSaveError {
		const detail = error instanceof Error ? error.message : String(error);
		const recovered = this.recoveryRevision === this.localRevision;
		const conflict = error instanceof DashboardSaveError && error.code === 'conflict';
		this.setSaveState(this.blocked ? conflict ? recovered ? 'conflict-saved' : 'conflict-pending' : 'recovery-error' : 'save-error', detail);
		return error instanceof DashboardSaveError ? error : new DashboardSaveError(this.blocked ? 'recoveryFailed' : 'saveFailed', detail);
	}
	private assertOpen(): void {
		if (this.closed) throw new DashboardSaveError('closed', t('dashboard.sync.closed'));
	}
	/** Drains admitted work. A durable recovery copy does not mean the original note was saved. */
	async flush(): Promise<void> {
		if (this.deferredWriteTimer !== null) { window.clearTimeout(this.deferredWriteTimer); this.deferredWriteTimer = null; }
		let queue: Promise<void>;
		do { queue = this.writeQueue; await queue; } while (queue !== this.writeQueue);
		if (!this.localDirty) return;
		try { await this.writeToDisk(true); }
		catch (error) {
			if (!(error instanceof DashboardSaveError && error.code === 'conflict' && this.recoveryRevision === this.localRevision)) throw error;
		}
	}
	async retrySave(): Promise<void> { await this.flush(); }
	close(): Promise<void> {
		if (this.closingTask) return this.closingTask;
		this.closed = true;
		this.unregisterFileWatchers();
		const closing = this.flush().finally(() => this.destroy());
		this.closingTask = closing;
		void closing.then(() => { if (this.closingTask === closing) this.closingTask = null; }, () => { if (this.closingTask === closing) this.closingTask = null; });
		return closing;
	}
`);
edit(sync,'\tasync init(): Promise<void> {','\tasync init(): Promise<void> {\n\t\tif (this.closingTask) await this.closingTask;\n\t\tthis.closed = false;\n\t\tthis.languageCleanup ??= onLanguageChanged(() => this.refreshSaveNotice());');
edit(sync,'\tdestroy(): void {','\tdestroy(): void {\n\t\tthis.closed = true;\n\t\tthis.languageCleanup?.();\n\t\tthis.languageCleanup = null;\n\t\tthis.saveListeners.clear();\n\t\tif (this.saveState.status !== \'save-error\' && this.saveState.status !== \'recovery-error\') { this.saveNotice?.hide(); this.saveNotice = null; }');
span(sync,'\tasync reloadFromDisk(): Promise<void> {','\n\t/**\n\t * Re-point',String.raw`	async reloadFromDisk(): Promise<void> {
		this.assertOpen();
		if (this.deferredWriteTimer !== null) { window.clearTimeout(this.deferredWriteTimer); this.deferredWriteTimer = null; }
		this.writeQueuePending++;
		const task = this.writeQueue.then(async () => {
			try {
				const revision = this.localRevision;
				const file = this.file && this.app.vault.getFileByPath(this.file.path);
				if (!file) throw new DashboardSaveError('saveFailed', t('dashboard.sync.sourceMissing'));
				const remote = await this.app.vault.read(file);
				if (revision !== this.localRevision) throw new DashboardSaveError('changed', t('dashboard.sync.changed'));
				if (this.localDirty) {
					this.conflict ??= { id: crypto.randomUUID(), path: file.path, base: this.baseline ?? '', local: this.getLocalDraft(), candidate: this.getLocalDraft(), remote };
					this.blocked = true;
					await this.saveConflict(this.getLocalDraft(), revision);
				}
				if (revision !== this.localRevision) throw new DashboardSaveError('changed', t('dashboard.sync.changed'));
				if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
				this.file = file; this.baseline = remote; this.data = parse(remote);
				this.blocked = false; this.localDirty = false; this.conflict = null; this.recoveryRevision = 0;
				this.setSaveState('saved'); this.notifyCallbacks('external');
			} catch (error) { throw this.saveFailure(error); }
			finally { this.writeQueuePending--; }
		});
		this.writeQueue = task.catch(() => undefined);
		await task;
	}
`);
edit(sync,'\tprivate scheduleDeferredWrite(): void {\n\t\tthis.localDirty = true;','\tprivate scheduleDeferredWrite(): void {\n\t\tthis.localRevision++;\n\t\tthis.localDirty = true;\n\t\tthis.setSaveState(this.blocked ? \'conflict-pending\' : \'saving\');');
span(sync,'\tprivate async writeToDisk(silent = false): Promise<void> {','\n\tprivate async createBackup(',String.raw`	private async writeToDisk(silent = false): Promise<void> {
		if (!this.data || !this.file) return;
		this.localDirty = true;
		const fileRef = this.file, content = serialize(this.data), revision = ++this.localRevision;
		this.setSaveState(this.blocked ? 'conflict-pending' : 'saving');
		this.writeQueuePending++;
		const task = this.writeQueue.then(async () => {
			try {
				if (this.blocked) {
					await this.saveConflict(content, revision);
					throw new DashboardSaveError('conflict', dashboardSaveMessage(this.saveState));
				}
				const base = this.baseline;
				if (base === null) throw new DashboardSaveError('saveFailed', t('dashboard.sync.sourceMissing'));
				await this.createBackup(base);
				let remote = base, conflict = false;
				try {
					await this.app.vault.process(fileRef, current => {
						remote = current;
						if (current !== base) { conflict = true; throw new DashboardSaveError('conflict', t('dashboard.sync.conflictPending')); }
						return content;
					});
				} catch (error) {
					if (conflict) {
						this.blocked = true;
						this.conflict = { id: crypto.randomUUID(), path: fileRef.path, base, local: content, candidate: content, remote };
						await this.saveConflict(content, revision);
					}
					throw error;
				}
				this.baseline = content;
				if (revision === this.localRevision) { this.localDirty = false; this.setSaveState('saved'); }
			} catch (error) { throw this.saveFailure(error); }
			finally { this.writeQueuePending--; }
		});
		// Only the internal queue observes rejection here. Public operations still reject.
		this.writeQueue = task.catch(() => undefined);
		if (!silent) this.notifyCallbacks('local');
		await task;
	}

	/** Called only inside the ordered write/reload queue, with an immutable revision snapshot. */
	private async saveConflict(local: string, revision: number): Promise<void> {
		const conflict = this.conflict;
		if (!conflict) throw new DashboardSaveError('recoveryFailed', t('dashboard.sync.recoveryFailed'));
		this.setSaveState('conflict-pending');
		const record = { ...conflict, local, revision };
		const adapter = this.app.vault.adapter;
		await ensureDirectory(adapter, DASHBOARD_CONFLICT_DIR);
		await adapter.write(DASHBOARD_CONFLICT_DIR + '/' + conflict.id + '.json', JSON.stringify(record, null, 2));
		this.conflict = record;
		this.recoveryRevision = revision;
		this.setSaveState(revision === this.localRevision ? 'conflict-saved' : 'conflict-pending');
	}
`);
{
 let text=fs.readFileSync(sync,'utf8');const ast=ts.createSourceFile(sync,text,ts.ScriptTarget.Latest,true);const klass=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='SyncEngine');
 const exempt=new Set(['init','flush','retrySave','reloadFromDisk','refresh','switchFile']);const inserts=[];
 for(const member of klass.members){if(!ts.isMethodDeclaration(member)||!member.body)continue;const name=member.name.getText(ast);const modifiers=member.modifiers?.map(m=>m.kind)??[];
 if(modifiers.includes(ts.SyntaxKind.PrivateKeyword)||exempt.has(name))continue;
 if(modifiers.includes(ts.SyntaxKind.AsyncKeyword)||name.startsWith('toggleCollapse'))inserts.push(member.body.getStart(ast)+1);
 }
 for(const p of inserts.sort((a,b)=>b-a))text=text.slice(0,p)+'\n\t\tthis.assertOpen();'+text.slice(p);fs.writeFileSync(sync,text);
}
edit('scripts/obsidian-stub.ts','\t\tNotice.messages.push(message);\n\t}\n\tshow() {}','\t\tNotice.messages.push(message);\n\t}\n\tsetMessage(message: string) { Notice.messages.push(message); return this; }\n\tshow() {}');
put('src/view/dashboard/save-feedback.ts',String.raw`import { Notice } from 'obsidian';
import { DashboardSaveError } from '../../core/dashboard/save-state';
import { t } from '../../shared/i18n/index';
/** Expected save errors already own a per-dashboard state/notice. Unknown errors remain visible. */
export function reportDashboardFailure(error: unknown): void {
	if (error instanceof DashboardSaveError) return;
	new Notice(t('dashboard.sync.operationFailed', { detail: error instanceof Error ? error.message : String(error) }));
}
/** Observe at the UI boundary, but return the ORIGINAL rejected promise for callers which await it. */
export function observeDashboardPromise<T>(promise: Promise<T>): Promise<T> {
	void promise.catch(reportDashboardFailure);
	return promise;
}
export function guardDashboardCallbacks<T extends object>(actions: T): T {
	const guarded = { ...actions };
	for (const key of Object.keys(actions)) {
		const action: unknown = Reflect.get(actions, key);
		if (typeof action !== 'function') continue;
		Reflect.set(guarded, key, (...args: unknown[]): unknown => {
			try {
				const result: unknown = Reflect.apply(action, undefined, args);
				if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function')
					void observeDashboardPromise(Promise.resolve(result as PromiseLike<unknown>));
				return result;
			} catch (error) { reportDashboardFailure(error); return undefined; }
		});
	}
	return guarded;
}
`);
edit('src/view/dashboard/view/callbacks.ts','\t\t\tvoid this.sync.deleteCard(cardId);','\t\t\tawait this.sync.deleteCard(cardId);');
edit('src/view/dashboard/view/callbacks.ts','\t\t\tvoid this.sync.deleteTask(cardId, taskPath);','\t\t\tawait this.sync.deleteTask(cardId, taskPath);');
edit('src/view/dashboard/view/callbacks.ts','export function createCallbacks(this: DashboardView) {\n\treturn {','export function createCallbacks(this: DashboardView) {\n\treturn guardDashboardCallbacks({');
edit('src/view/dashboard/view/callbacks.ts','\n\t};\n}\n\nexport function handleFileDrop','\n\t});\n}\n\nexport function handleFileDrop');
edit('src/view/dashboard/view/callbacks.ts',"import { Notice, TFile }", "import { guardDashboardCallbacks } from '../save-feedback';\nimport { Notice, TFile }");
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const syncAst=ts.createSourceFile(sync,fs.readFileSync(sync,'utf8'),ts.ScriptTarget.Latest,true);
const syncClass=syncAst.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='SyncEngine');
const asyncNames=new Set(syncClass.members.filter(n=>ts.isMethodDeclaration(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)&&!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword)).map(n=>n.name.getText(syncAst)));
asyncNames.add('close'); asyncNames.delete('init');
for(const file of walk('src/view/dashboard')){
 if(!/\.tsx?$/.test(file)||file.endsWith('save-feedback.ts'))continue;
 let text=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),ranges=[];
 function visit(n){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.expression.getText(ast)==='this.sync'&&asyncNames.has(n.expression.name.text)){
 let outer=n;while(ts.isPropertyAccessExpression(outer.parent)&&['then','catch','finally'].includes(outer.parent.name.text)&&ts.isCallExpression(outer.parent.parent))outer=outer.parent.parent;
 ranges.push([outer.getStart(ast),outer.end]); }ts.forEachChild(n,visit);}
 visit(ast);if(!ranges.length)continue;
 const positions=[];for(const [start,end] of ranges){positions.push([start,'observeDashboardPromise('],[end,')']);}
 for(const [p,value]of positions.sort((a,b)=>b[0]-a[0]))text=text.slice(0,p)+value+text.slice(p);
 let relative=path.relative(path.dirname(file),'src/view/dashboard/save-feedback').replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;
 text="import { observeDashboardPromise } from '"+relative+"';\n"+text;fs.writeFileSync(file,text);
}
edit('src/view/dashboard/view/lifecycle.ts','\tthis.sync.destroy();\n\tthis.contentEl.empty();','\tthis.contentEl.empty();\n\tawait observeDashboardPromise(this.sync.close());');
{ const p='src/view/dashboard/view/lifecycle.ts'; const text=fs.readFileSync(p,'utf8'); if(!text.includes("import { observeDashboardPromise }")) fs.writeFileSync(p,"import { observeDashboardPromise } from '../save-feedback';\n"+text); }
put('src/view/dashboard/SaveStatePanel.tsx',String.raw`import { useLayoutEffect, useState } from 'preact/hooks';
import { h, render } from 'preact';
import { dashboardSaveMessage } from '../../core/dashboard/save-state';
import type { SyncEngine } from '../../platform/obsidian/dashboard/sync';
import { onLanguageChanged, t } from '../../shared/i18n/index';
import { observeDashboardPromise } from './save-feedback';
import { showConfirmDialog } from './ui/confirm-dialog';
import type { App } from 'obsidian';
export function SaveStatePanel({ engine, app, owner }: { engine: SyncEngine; app: App; owner: Document }) {
	const [state, setState] = useState(engine.getSaveState());
	const [, repaint] = useState(0);
	useLayoutEffect(() => engine.onSaveStateUpdate(setState), [engine]);
	useLayoutEffect(() => onLanguageChanged(() => repaint(value => value + 1)), []);
	if (state.status === 'saved' || state.status === 'saving') return null;
	const copy = (text: string) => { const clipboard = owner.defaultView?.navigator.clipboard; if (clipboard) void observeDashboardPromise(clipboard.writeText(text)); };
	const reload = async () => {
		if (await showConfirmDialog(app, { title: t('dashboard.sync.reload'), message: t('dashboard.sync.reloadConfirm') })) await engine.reloadFromDisk();
	};
	return <div class="dashboard-save-state" role="status" aria-live="polite" data-save-status={state.status}>
		<p>{dashboardSaveMessage(state)}</p>
		{state.detail && state.status.endsWith('error') && <code>{state.detail}</code>}
		<button type="button" onClick={() => copy(engine.getLocalDraft())}>{t('dashboard.sync.copyDraft')}</button>
		{state.recoveryPath && <button type="button" onClick={() => copy(state.recoveryPath!)}>{t('dashboard.sync.copyPath')}</button>}
		<button type="button" disabled={state.status === 'conflict-pending'} onClick={() => { void observeDashboardPromise(engine.retrySave()); }}>{t('dashboard.sync.retry')}</button>
		<button type="button" disabled={state.status === 'conflict-pending'} onClick={() => { void observeDashboardPromise(reload()); }}>{t('dashboard.sync.reload')}</button>
	</div>;
}
export function mountSaveState(container: HTMLElement, engine: SyncEngine, app: App): () => void {
	const root = container.createDiv({ cls: 'dashboard-save-state-host' });
	render(h(SaveStatePanel, { engine, app, owner: container.ownerDocument }), root);
	return () => { render(null, root); root.remove(); };
}
`);
edit('src/view/dashboard/view/render.ts',"import type { DashboardData }", "import { mountSaveState } from '../SaveStatePanel';\nimport type { DashboardData }");
edit('src/view/dashboard/view/render.ts',"\tconst mainLayout = container.createDiv({ cls: 'dashboard-main' });", "\tthis.cleanupFns.push(mountSaveState(container, this.sync, this.app));\n\tconst mainLayout = container.createDiv({ cls: 'dashboard-main' });");
edit('styles.css','.dashboard-quicknote-empty {',String.raw`.dashboard-save-state-host { flex: 0 0 auto; min-width: 0; }
.dashboard-save-state { display: flex; flex-wrap: wrap; align-items: center; gap: var(--size-4-2); padding: var(--size-4-3); border: 1px solid var(--background-modifier-border); background: var(--background-secondary); color: var(--text-normal); }
.dashboard-save-state p { flex: 1 0 100%; margin: 0; overflow-wrap: anywhere; }
.dashboard-save-state code { flex: 1 0 100%; white-space: pre-wrap; overflow-wrap: anywhere; }
.dashboard-quicknote-empty {`);
{
 const file='src/shared/i18n/workspace-switcher.ts';
 edit(file,'This dashboard changed outside NAND. Saving is paused. Your edits are kept in .dashboard-backup/conflicts. Review the copies, then use Restore or reopen the dashboard to reload.','Saving to the original dashboard is paused. The current edits are saved in the recovery copy at {path}. Review or copy them before reloading the original.');
 edit(file,'看板已被外部修改，保存已暂停。你的修改保存在 .dashboard-backup/conflicts。请先检查副本，再通过恢复或重新打开看板载入磁盘内容。','看板原文保存已暂停。当前修改已保存到恢复副本 {path}。请先检查或复制修改，再重新载入原文。');
 messages(file,{
 'dashboard.sync.saving':'Saving dashboard edits…', 'dashboard.sync.conflictPending':'Saving to the original is paused. The latest edits are not yet saved to a recovery copy. Keep this view open.',
 'dashboard.sync.copyPath':'Copy recovery path', 'dashboard.sync.copyDraft':'Copy local draft', 'dashboard.sync.retry':'Retry saving', 'dashboard.sync.reload':'Reload original',
 'dashboard.sync.reloadConfirm':'Save the latest local draft to a recovery copy, then replace this view with the original file on disk?', 'dashboard.sync.sourceMissing':'The dashboard file is missing. Keep or copy the local draft before continuing.',
 'dashboard.sync.changed':'New edits arrived while reloading. The local draft was kept; review it and retry.', 'dashboard.sync.closed':'This dashboard is closing. Reopen it before editing.', 'dashboard.sync.operationFailed':'The dashboard operation failed: {detail}'
 },{
 'dashboard.sync.saving':'正在保存看板修改…','dashboard.sync.conflictPending':'原文保存已暂停，最新修改尚未保存到恢复副本。请保持当前视图打开。',
 'dashboard.sync.copyPath':'复制副本路径','dashboard.sync.copyDraft':'复制当前草稿','dashboard.sync.retry':'重试保存','dashboard.sync.reload':'重新载入原文',
 'dashboard.sync.reloadConfirm':'将最新草稿保存到恢复副本后，使用磁盘上的原文替换当前视图？','dashboard.sync.sourceMissing':'看板文件不存在。继续操作前，请保留或复制当前草稿。',
 'dashboard.sync.changed':'重新载入期间出现了新修改，已保留当前草稿。请检查后重试。','dashboard.sync.closed':'此看板正在关闭，请重新打开后编辑。','dashboard.sync.operationFailed':'看板操作失败：{detail}'
 });
}
put('scripts/regressions/issue-conflict-revisions.mjs',String.raw`import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SyncEngine } from '../../src/platform/obsidian/dashboard/sync.ts';
import { DashboardSaveError } from '../../src/core/dashboard/save-state.ts';
import { observeDashboardPromise, guardDashboardCallbacks } from '../../src/view/dashboard/save-feedback.ts';
import { generateDefaultMarkdown } from '../../src/core/dashboard/parser/default-document.ts';
import { parse, serialize } from '../../src/core/dashboard/parser/index.ts';
import { setLanguage } from '../../src/shared/i18n/index.ts';
import { TFile, Notice } from '../obsidian-stub.ts';
globalThis.window=globalThis;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function fixture(name='Board'){
 let disk=generateDefaultMarkdown();const copies=new Map(), handlers=new Map();let beforeWrite=async()=>{};
 const file=Object.assign(new TFile(),{path:name+'.md',basename:name,extension:'md'});
 const app={vault:{getFileByPath:p=>p===file.path?file:null,read:async()=>disk,process:async(f,fn)=>{disk=fn(disk);for(const cb of handlers.get('modify')??[])cb(f);return disk;},on:(name,cb)=>{handlers.set(name,[...(handlers.get(name)??[]),cb]);return {name,cb};},offref:ref=>handlers.set(ref.name,(handlers.get(ref.name)??[]).filter(cb=>cb!==ref.cb)),adapter:{exists:async()=>true,mkdir:async()=>{},list:async()=>({files:[...copies.keys()]}),remove:async p=>copies.delete(p),write:async(p,text)=>{await beforeWrite(p,text);copies.set(p,text);}}}};
 const engine=new SyncEngine(app,{dashboardFile:file.path});await engine.init();
 return {engine,copies,app,get disk(){return disk;},set disk(text){disk=text;},set beforeWrite(fn){beforeWrite=fn;},recovery(){return JSON.parse([...copies].find(([p])=>p.includes('/conflicts/'))[1]);}};
}
async function conflict(f){f.disk+='\n<!-- external edit -->\n';await assert.rejects(f.engine.updateBanner({quote:'local'}));}
test('queued A/B/C revisions after a first conflict retain C and external bytes',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred();let held=false;
 f.beforeWrite=async p=>{if(!held&&!p.includes('/conflicts/')){held=true;entered.resolve();await release.promise;}};
 const a=assert.rejects(f.engine.updateBanner({quote:'A'}));await entered.promise;
 const b=assert.rejects(f.engine.updateBanner({quote:'B'})),c=assert.rejects(f.engine.updateBanner({quote:'C'}));f.disk+='\n<!-- outside -->';const outside=f.disk;release.resolve();await Promise.all([a,b,c]);
 assert.equal(f.disk,outside);assert.equal(parse(f.recovery().local).banner.quote,'C');assert.equal(f.recovery().revision,f.engine.getSaveState().localRevision);assert.equal(f.engine.getSaveState().status,'conflict-saved');await f.engine.close();
});
test('an older recovery completion cannot mark a newer edit saved',async()=>{
 const f=await fixture();await conflict(f);const first=deferred(),release=deferred(),second=deferred(),releaseSecond=deferred();let index=0;
 f.beforeWrite=async p=>{if(p.includes('/conflicts/')){index++;if(index===1){first.resolve();await release.promise;}if(index===2){second.resolve();await releaseSecond.promise;}}};
 const a=assert.rejects(f.engine.updateBanner({quote:'older'}));await first.promise;const b=assert.rejects(f.engine.updateBanner({quote:'latest'}));release.resolve();await second.promise;
 assert.equal(f.engine.getSaveState().status,'conflict-pending');assert.ok(f.engine.getSaveState().recoveryRevision<f.engine.getSaveState().localRevision);
 releaseSecond.resolve();await Promise.all([a,b]);assert.equal(parse(f.recovery().local).banner.quote,'latest');await f.engine.close();
});
test('recovery failure remains explicit; retry persists the latest snapshot',async()=>{
 const f=await fixture();await conflict(f);f.beforeWrite=async p=>{if(p.includes('/conflicts/'))throw Error('recovery disk unavailable');};
 await assert.rejects(f.engine.updateBanner({quote:'latest failed'}));assert.equal(f.engine.getSaveState().status,'recovery-error');assert.notEqual(parse(f.recovery().local).banner.quote,'latest failed');
 await assert.rejects(f.engine.reloadFromDisk());assert.equal(f.engine.getData().banner.quote,'latest failed');
 f.beforeWrite=async()=>{};await f.engine.retrySave();assert.equal(parse(f.recovery().local).banner.quote,'latest failed');assert.equal(f.engine.getSaveState().status,'conflict-saved');await f.engine.close();
});
test('normal close drains a quiet change into recovery and separate boards never share copies',async()=>{
 const a=await fixture('A'),b=await fixture('B');await conflict(a);await conflict(b);
 a.engine.toggleCollapseTaskQuiet('demo-todo-1',[0]);await a.engine.close();
 assert.equal(parse(a.recovery().local).columns[1].cards[0].tasks[0].collapsed,true);assert.notEqual(a.recovery().id,b.recovery().id);await b.engine.close();
});
test('reload refuses to discard a newer revision admitted during recovery IO',async()=>{
 const f=await fixture();await conflict(f);const entered=deferred(),release=deferred();let held=false;
 f.beforeWrite=async p=>{if(p.includes('/conflicts/')&&!held){held=true;entered.resolve();await release.promise;}};
 const reload=assert.rejects(f.engine.reloadFromDisk(),e=>e instanceof DashboardSaveError&&e.code==='changed');await entered.promise;
 const edit=assert.rejects(f.engine.updateBanner({quote:'keep during reload'}));release.resolve();await Promise.all([reload,edit]);assert.equal(f.engine.getData().banner.quote,'keep during reload');assert.equal(parse(f.recovery().local).banner.quote,'keep during reload');await f.engine.close();
});
test('observed UI promises still reject to awaiting callers but ignored events do not leak',async()=>{
 const failures=[];const listener=e=>failures.push(e);process.on('unhandledRejection',listener);
 try{const error=new DashboardSaveError('conflict','handled by save state');const promise=Promise.reject(error);assert.equal(observeDashboardPromise(promise),promise);await assert.rejects(promise,e=>e===error);
 const callbacks=guardDashboardCallbacks({onToggle:async()=>{throw error;},settings:{id:1}});callbacks.onToggle();await new Promise(r=>setImmediate(r));assert.deepEqual(failures,[]);assert.deepEqual(callbacks.settings,{id:1});}finally{process.off('unhandledRejection',listener);}
});
test('both languages show actual recovery path and no obsolete directory',async()=>{
 const f=await fixture();await conflict(f);for(const language of ['zh','en','zh']){setLanguage(language);const message=Notice.messages.at(-1);assert.ok(message.includes(f.engine.getSaveState().recoveryPath));assert.ok(!message.includes('.dashboard-backup'));}await f.engine.close();
});
`);
edit('scripts/run-safety-regressions.mjs',"\t'issue-content-targets',","\t'issue-content-targets',\n\t'issue-conflict-revisions',");
console.log('Applied #121 revision-ordered recovery, explicit state UI, awaitable UI feedback and deterministic concurrency regressions.');
