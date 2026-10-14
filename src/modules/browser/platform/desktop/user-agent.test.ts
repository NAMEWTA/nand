import { it, expect } from 'vitest';
import vm from 'node:vm';
import { USER_AGENT_SOURCE,cleanElectronUserAgent } from './user-agent';
it('cleans Electron and Obsidian identity and limits Firefox UA to Google authentication',()=>{
 const raw='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Obsidian/1.13.7 Chrome/150.0.0.0 Electron/41.0.0 Safari/537.36';
 const clean=cleanElectronUserAgent(raw);expect(clean).not.toMatch(/Electron|Obsidian/);expect(clean).toContain('Chrome/150');
 type Details={url:string;resourceType:string;referrer?:string;webContentsId?:number;requestHeaders:Record<string,string>};let hook:((details:Details,cb:(r:{requestHeaders:Record<string,string>})=>void)=>void)|null=null,ua=raw;
 const s={getUserAgent:()=>ua,setUserAgent:(value:string)=>{ua=value;},webRequest:{onBeforeSendHeaders:(_filter:unknown,next:typeof hook)=>{hook=next??null;}}};
 const exports={} as {install:(directory:string,mode:string)=>{dispose():void}};
 vm.runInNewContext(USER_AGENT_SOURCE,{exports,URL,process:{platform:'linux'},require:()=>({session:{fromPath:()=>s},webContents:{fromId:()=>undefined}})});
 const a=exports.install('/session','cleaned'),b=exports.install('/session','cleaned');expect(ua).toBe(clean);
 const headers=(url:string,resourceType='mainFrame',referrer='')=>{let result:Record<string,string>={};hook!({url,resourceType,referrer,requestHeaders:{'User-Agent':raw,'sec-ch-ua':'Chromium'}},r=>{result=r.requestHeaders;});return result;};
 expect(headers('https://accounts.google.com/login')['User-Agent']).toContain('Firefox/140');expect(headers('https://accounts.google.com/login')['sec-ch-ua']).toBeUndefined();expect(headers('https://www.google.com/')['User-Agent']).toBe(clean);expect(headers('https://asset.test/a','script','https://accounts.google.com/login')['User-Agent']).toContain('Firefox/140');
 a.dispose();expect(ua).toBe(clean);b.dispose();expect(ua).toBe(raw);expect(hook).toBeNull();
});
