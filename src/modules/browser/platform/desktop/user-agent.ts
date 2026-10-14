// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/browser/browser-process-user-agent.ts, browser-session-ua.ts, browser-google-auth-ua.ts
import { bundledMain } from '../../../../host/desktop/electron-main';
export function cleanElectronUserAgent(userAgent: string): string {
	if (!userAgent.includes('(KHTML, like Gecko)')) return userAgent;
	return userAgent.replace(/\s+Electron\/\S+/, '').replace(/(\)\s+)(?:[^)\s]+\s+)*?(Chrome\/)/, '$1$2');
}
export const USER_AGENT_SOURCE = String.raw`
const {session,webContents}=require('electron'),key=Symbol.for('nand.browser.ua.v1'),entries=globalThis[key]??=new Map();
exports.install=(directory,mode)=>{
 if(mode!=='cleaned')return {dispose(){}};
 let entry=entries.get(directory);
 if(!entry){const s=session.fromPath(directory),raw=s.getUserAgent(),clean=raw.includes('(KHTML, like Gecko)')?raw.replace(/\s+Electron\/\S+/,'').replace(/(\)\s+)(?:[^)\s]+\s+)*?(Chrome\/)/,'$1$2'):raw;
 const os=process.platform==='darwin'?'Macintosh; Intel Mac OS X 10.15':process.platform==='win32'?'Windows NT 10.0; Win64; x64':'X11; Linux x86_64';
 const firefox='Mozilla/5.0 ('+os+'; rv:140.0) Gecko/20100101 Firefox/140.0';
 const auth=url=>{try{return ['accounts.google.com','accounts.youtube.com'].includes(new URL(url).hostname)}catch{return false}};
 s.setUserAgent(clean);s.webRequest.onBeforeSendHeaders({urls:['http://*/*','https://*/*']},(details,callback)=>{
  const useFirefox=auth(details.url)||(details.resourceType!=='mainFrame'&&auth(details.referrer||''));const ua=useFirefox?firefox:clean,headers=details.requestHeaders;
  const uaKey=Object.keys(headers).find(k=>k.toLowerCase()==='user-agent')||'User-Agent';headers[uaKey]=ua;
  if(useFirefox)for(const k of Object.keys(headers))if(k.toLowerCase().startsWith('sec-ch-ua'))delete headers[k];
  if(details.resourceType==='mainFrame'){const wc=webContents.fromId(details.webContentsId);if(wc&&!wc.isDestroyed())wc.setUserAgent(ua);}
  callback({requestHeaders:headers});
 });entry={s,raw,refs:0};entries.set(directory,entry);}
 entry.refs++;let disposed=false;return{dispose(){if(disposed)return;disposed=true;if(--entry.refs===0){entry.s.webRequest.onBeforeSendHeaders(null);entry.s.setUserAgent(entry.raw);entries.delete(directory)}}};
};`;
export function installUserAgent(win: Window, directory: string, mode: 'cleaned' | 'native'): { dispose(): void } {
	return bundledMain<{ install(directory: string, mode: string): { dispose(): void } }>(win, USER_AGENT_SOURCE).install(
		directory,
		mode,
	);
}
