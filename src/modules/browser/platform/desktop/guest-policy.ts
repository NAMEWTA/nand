import { BrowserError } from '../../core/model';
import type { ElectronBrowserApi, GuestContents } from './electron-api';
import { bundledMain } from '../../../../host/desktop/electron-main';

/** Electron requires synchronous decisions. Renderer remote callbacks cannot return them.
 * This fixed, bundled policy is loaded in the main process; webpage data is never code.
 * Popup classification follows Orca browser-manager-guest-popup-policy.ts (d74388f, MIT).
 */
export const GUEST_POLICY_SOURCE = String.raw`'use strict';
const {webContents}=require('electron');
const allowed=url=>{if(url==='about:blank')return true;try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}};
const policyKey=Symbol.for('nand.browser.guest-policies.v2');
const policies=globalThis[policyKey]??=new WeakMap();
const origin=url=>{try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.origin:null}catch{return null}};
const permissions=new Set(['media','geolocation','notifications','clipboard-read','fullscreen']);
exports.install=(id,directory,notify,grants={})=>{
 const guest=webContents.fromId(id);
 if(!guest||guest.getType()!=='webview'||guest.getLastWebPreferences().nodeIntegration)throw Error('Invalid NAND guest');
 const nativeSession=guest.session;
 if(nativeSession.storagePath!==directory)throw Error('Mismatched NAND session');
 let policy=policies.get(nativeSession);
 if(!policy){
  policy={grants:{},owners:new Map()};policies.set(nativeSession,policy);
 }
  const check=(wc,permission,url)=>{const requesting=origin(url),top=origin(wc?.getURL());return !!requesting&&requesting===top&&permissions.has(permission)&&policy.owners.has(wc?.id)&&policy.grants[requesting+'|'+permission]===true};
  nativeSession.setPermissionCheckHandler((wc,permission,securityOrigin)=>check(wc,permission,securityOrigin));
  nativeSession.setPermissionRequestHandler((wc,permission,callback,details)=>{
   const url=details?.requestingUrl||wc?.getURL();const granted=check(wc,permission,url);callback(granted);
   if(!granted)policy.owners.get(wc?.id)?.('permission',JSON.stringify({origin:origin(url),permission}));
  });
 policy.grants={...grants};policy.owners.set(guest.id,notify);
 let disposed=false,lastOpen=0;const children=new Set(),offs=[];
 const on=(target,event,fn)=>{target.on(event,fn);offs.push(()=>{if(!target.isDestroyed?.())target.removeListener(event,fn)})};
 const guard=(e,url)=>{if(!allowed(url))e.preventDefault()};
 guest.setWindowOpenHandler(details=>{
  if(disposed||!allowed(details.url))return {action:'deny'};
  if(Date.now()-lastOpen<250||children.size>=8)return {action:'deny'};lastOpen=Date.now();
  if((details.frameName&&!['_blank','_new'].includes(details.frameName))||details.features)return {action:'allow',overrideBrowserWindowOptions:{autoHideMenuBar:true,frame:true,closable:true,fullscreen:false,alwaysOnTop:false,webPreferences:{session:nativeSession,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}}};
  if(details.url!=='about:blank')notify('open',details.url);return {action:'deny'};
 });
 on(guest,'will-navigate',guard);on(guest,'will-redirect',guard);
 on(guest,'before-input-event',(event,input)=>{
  if(input.type!=='keyDown')return;
  if(input.key==='Escape')notify('shortcut','Escape');
 });
 on(guest,'did-create-window',(child,details)=>{
  const childId=child.webContents.id;
  policy.owners.set(childId,notify);
  children.add(child);child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  const childOffs=[];const childOn=(target,event,fn)=>{target.on(event,fn);childOffs.push(()=>target.removeListener(event,fn))};
  childOn(child.webContents,'will-navigate',guard);childOn(child.webContents,'will-redirect',guard);
  const title=()=>{if(!child.isDestroyed()){try{child.setTitle(new URL(child.webContents.getURL()).origin)}catch{child.setTitle('NAND')}}};
  childOn(child.webContents,'did-navigate',title);childOn(child,'page-title-updated',e=>{e.preventDefault();title()});
  child.once('closed',()=>{policy.owners.delete(childId);children.delete(child);for(const off of childOffs)try{off()}catch{};clearTimeout(resumeTimer)});
  // Obsidian may leave a webview-created native child without its initial navigation.
  // Keep Chromium's opener and resume only that untouched child; never replace a redirect.
  const resumeTimer=setTimeout(()=>{if(disposed||child.isDestroyed()||child.webContents.getURL()||child.webContents.isLoading())return;
   const options={httpReferrer:details.referrer};
   if(details.postBody){options.postData=details.postBody.data;options.extraHeaders='Content-Type: '+details.postBody.contentType+(details.postBody.boundary?'; boundary='+details.postBody.boundary:'')}
   child.webContents.loadURL(details.url,options).catch(()=>{});
  },250);offs.push(()=>clearTimeout(resumeTimer));
 });
 return {setGrants(grants){policy.grants={...grants}},dispose(){if(disposed)return;disposed=true;policy.owners.delete(guest.id);for(const off of offs.splice(0))off();for(const child of children)if(!child.isDestroyed())child.close();children.clear();if(!guest.isDestroyed())guest.setWindowOpenHandler(()=>({action:'deny'}))}};
};
`;

export function installGuestPolicy(
	win: Window,
	api: ElectronBrowserApi,
	guest: GuestContents,
	partition: string,
	notify: (event: string, value: string) => void,
	grants: Record<string, boolean> = {},
): { dispose(): void; setGrants(grants: Record<string, boolean>): void } {
	if (!api.require) throw new BrowserError('browser_unavailable');
	const policy = bundledMain<{
		install(id: number, partition: string, notify: (event: string, value: string) => void, grants: Record<string, boolean>): { dispose(): void; setGrants(grants: Record<string, boolean>): void };
	}>(win, GUEST_POLICY_SOURCE);
	const instance = policy.install(guest.id, partition, notify, grants);
	return { setGrants: value => instance.setGrants(value), dispose: () => {
		try {
			instance.dispose();
		} catch {
			/* Host process closed. */
		}
	} };
}
