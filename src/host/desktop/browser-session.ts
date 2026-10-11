import { FileSystemAdapter, type App } from 'obsidian';
import path from 'node:path';
import { vaultIdentity } from '../obsidian/storage/device-id';
import { absoluteNandPath } from './nand-paths';
import { nativeVaultStorage } from './vault-storage';
import { prepareSessionDirectory, confirmSessionDirectory, clearSessionRecovery } from './browser-session-migration';
import { bundledMain, desktopRemote } from './electron-main';

export interface VaultSession {
	storagePath: string;
	on(event: string, listener: (...args: unknown[]) => void): void;
	removeListener(event: string, listener: (...args: unknown[]) => void): void;
	clearStorageData(): Promise<void>;
	clearCache(): Promise<void>;
	cookies: { get(filter: { url: string }): Promise<Array<{ name: string; value: string }>>; flushStore(): Promise<void> };
}
interface SessionRuntime {
	boot: string;
	active(directory: string): boolean;
	acquire(vault: string, directory: string, downloads: string): { session: VaultSession; onDownloadError(listener: () => void): void; bind(owner: number, token: string): { dispose(): void }; protect(id: number): void; dispose(): void };
}
export const SESSION_RUNTIME_SOURCE = String.raw`
const {session,webContents}=require('electron'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const key=Symbol.for('nand.vault-session.runtime.v1');
const state=globalThis[key]??=( {boot:crypto.randomUUID(),sessions:new Map()} );
exports.boot=state.boot;
exports.active=directory=>webContents.getAllWebContents().some(wc=>!wc.isDestroyed()&&wc.session.storagePath===directory);
const checked=(vault,file)=>{
 const root=fs.realpathSync(vault),relative=path.relative(root,file);
 if(path.isAbsolute(relative)||relative.split(path.sep)[0]!=='.nand')throw Error('browser_session_path');
 let current=root;for(const part of relative.split(path.sep)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('private-storage.symlink');}
 return file;
};
const tree=(vault,directory)=>{checked(vault,directory);for(const item of fs.readdirSync(directory,{withFileTypes:true})){
 const file=path.join(directory,item.name);checked(vault,file);if(item.isDirectory())tree(vault,file);else if(!item.isFile())throw Error('browser_session_unsafe_source');
}};
exports.acquire=(vault,directory,downloads)=>{
 checked(vault,directory);checked(vault,downloads);checked(vault,path.join(directory,'Code Cache'));
 let entry=state.sessions.get(directory);
 if(!entry){
  tree(vault,directory);
  const native=session.fromPath(directory);
  if(native.storagePath!==directory)throw Error('browser_session_path');
  native.setCodeCachePath(path.join(directory,'Code Cache'));
  const failed=owner=>{for(const [listener,guests] of entry.errors)if(guests.has(owner?.id))try{listener();}catch{}};
  const download=(event,item,owner)=>{try{
   if(!entry.refs){event.preventDefault();item.cancel();return;}
   checked(vault,downloads);
   const name=item.getFilename().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(-120)||'download';
   const file=path.join(downloads,crypto.randomUUID()+'-'+name);checked(vault,file);item.setSavePath(file);
   const done=(_event,status)=>{entry.pending.delete(item);if(status==='interrupted')failed(owner);};
   item.once('done',done);entry.pending.set(item,done);
  }catch{event.preventDefault();item.cancel();failed(owner);}};
  entry={native,download,refs:0,closing:[],errors:new Map(),pending:new Map()};state.sessions.set(directory,entry);
  native.on('will-download',download);
  native.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  native.setPermissionCheckHandler(()=>false);
 }
 for(const off of entry.closing.splice(0))off();entry.refs++;let disposed=false;const bindings=new Set(),guests=new Set();
 const track=guest=>{if(guests.has(guest.id))return;guests.add(guest.id);
  const child=window=>track(window.webContents);guest.on('did-create-window',child);
  bindings.add(()=>{guests.delete(guest.id);if(!guest.isDestroyed())guest.removeListener('did-create-window',child)});
 };
 const release=()=>{if(entry.refs)return;const guests=webContents.getAllWebContents().filter(wc=>!wc.isDestroyed()&&wc.session===entry.native);if(guests.length)return;
  for(const off of entry.closing.splice(0))off();entry.native.removeListener('will-download',entry.download);entry.native.setPermissionRequestHandler(null);entry.native.setPermissionCheckHandler(null);state.sessions.delete(directory);
 };
 return {session:entry.native,onDownloadError(listener){if(disposed)return;entry.errors.set(listener,guests);bindings.add(()=>entry.errors.delete(listener));},bind(ownerId,token){
  if(disposed)throw Error('browser_session_closed');
  const owner=webContents.fromId(ownerId);if(!owner||owner.isDestroyed())throw Error('browser_session_closed');
  const hook=(event,prefs,params)=>{if(params.partition!==token)return;
   try{checked(vault,directory);prefs.session=entry.native;delete prefs.partition;prefs.nodeIntegration=false;prefs.contextIsolation=true;prefs.sandbox=true;prefs.webSecurity=true;delete prefs.preload;}
   catch{event.preventDefault();}
  };
  owner.on('will-attach-webview',hook);
  const dispose=()=>{bindings.delete(dispose);if(!owner.isDestroyed())owner.removeListener('will-attach-webview',hook);};bindings.add(dispose);return {dispose};
 },protect(id){
  const guest=webContents.fromId(id);if(disposed||!guest||guest.session!==entry.native)throw Error('browser_session_closed');
  track(guest);
  const guard=(event,url)=>{try{const target=new URL(url);if(!['https:','http:'].includes(target.protocol)||target.username||target.password)event.preventDefault();}catch{event.preventDefault();}};
  guest.setWindowOpenHandler(()=>({action:'deny'}));guest.on('will-navigate',guard);guest.on('will-redirect',guard);
  bindings.add(()=>{if(!guest.isDestroyed()){guest.removeListener('will-navigate',guard);guest.removeListener('will-redirect',guard);}});
 },dispose(){if(disposed)return;disposed=true;for(const dispose of [...bindings])dispose();if(--entry.refs===0){
  for(const [item,done] of entry.pending){item.removeListener('done',done);try{item.cancel();}catch{}}entry.pending.clear();
  for(const wc of webContents.getAllWebContents().filter(wc=>!wc.isDestroyed()&&wc.session===entry.native)){wc.once('destroyed',release);entry.closing.push(()=>{if(!wc.isDestroyed())wc.removeListener('destroyed',release);});}release();
 }}};
};
`;
export interface SessionOptions {
	profile: string;
	legacyPartition?: string;
	ambiguous?: boolean;
	choose?: (sourceMissing?: boolean) => Promise<'copy' | 'fresh'>;
	signal?: AbortSignal;
}
export interface VaultSessionLease {
	session: VaultSession;
	storagePath: string;
	onDownloadError(listener: () => void): void;
	clearRecovery(): Promise<void>;
	bind(element: HTMLElement): void;
	protect(id: number): void;
	dispose(): void;
}
/** One device/profile store is shared by all windows; each caller owns its guest binding and listeners. */
export async function acquireVaultSession(app: App, win: Window, options: SessionOptions): Promise<VaultSessionLease> {
	if (options.signal?.aborted) throw new Error('browser_session_closed');
	if (!(app.vault.adapter instanceof FileSystemAdapter)) throw new Error('browser_session_unavailable');
	if (!/^(default|home-web|home-music|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(options.profile)) throw new Error('browser_session_path');
	const vault = app.vault.adapter.getBasePath(), identity = vaultIdentity(app), remote = desktopRemote(win);
	const relative = `.nand/browser/${identity.deviceId}/profiles/${options.profile}`;
	const runtime = bundledMain<SessionRuntime>(win, SESSION_RUNTIME_SOURCE);
	let source: string | undefined;
	if (options.legacyPartition) {
		if (!/^persist:nand-(?:browser|dashboard)-[a-z\d_%.'!()*~-]+$/i.test(options.legacyPartition)) throw new Error('browser_session_path');
		source = path.join(remote.app.getPath('userData'), 'Partitions', encodeURIComponent(options.legacyPartition.slice(8).toLowerCase()));
	}
	const directory = await prepareSessionDirectory({ vault, relative, source, boot: runtime.boot, active: file => runtime.active(file), ambiguous: options.ambiguous, choose: options.choose });
	if (options.signal?.aborted) throw new Error('browser_session_closed');
	const downloadsRelative = relative + '/downloads';
	await nativeVaultStorage(vault).mkdir(downloadsRelative);
	const downloads = await absoluteNandPath(vault, downloadsRelative);
	if (options.signal?.aborted || win.closed) throw new Error('browser_session_closed');
	const native = runtime.acquire(vault, directory, downloads);
	try {
		await confirmSessionDirectory(vault, relative, runtime.boot);
		if (options.signal?.aborted || win.closed) throw new Error('browser_session_closed');
	} catch (error) { native.dispose(); throw error; }
	let disposed = false;
	return {
		session: native.session, storagePath: directory,
		onDownloadError(listener) { native.onDownloadError(listener); },
		clearRecovery() { if (disposed) return Promise.reject(new Error('browser_session_closed')); return clearSessionRecovery({ vault, relative, source, boot: runtime.boot, active: file => runtime.active(file) }); },
		protect(id) { native.protect(id); },
		bind(element) {
			if (disposed) throw new Error('browser_session_closed');
			const token = 'nand-vault-' + crypto.randomUUID();
			// Obsidian can adopt a webview constructor from the main renderer into a popout.
			// Its guest then attaches to the main WebContents despite belonging to the popout DOM.
			const owners = new Set([remote.getCurrentWebContents().id, desktopRemote(app.workspace.containerEl.win).getCurrentWebContents().id]);
			for (const owner of owners) native.bind(owner, token);
			element.setAttribute('partition', token);
		},
		dispose() { if (disposed) return; disposed = true; native.dispose(); },
	};
}
