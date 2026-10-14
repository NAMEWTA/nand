import { bundledMain } from '../../../../../host/desktop/electron-main';
import type { ImportCookie } from '../../../core/cookies';
/** Bundled code only; paths and Cookie contents cross the bridge as structured arguments. */
export const COOKIE_SESSION_SOURCE = String.raw`
const {session}=require('electron');
const normalize=d=>d.replace(/^\.+/,'').toLowerCase();
const details=c=>({url:(c.secure?'https':'http')+'://'+normalize(c.domain)+(c.path||'/'),name:c.name,value:c.value,...(c.hostOnly?{}:{domain:c.domain}),path:c.path||'/',secure:!!c.secure,httpOnly:!!c.httpOnly,...(c.expirationDate?{expirationDate:c.expirationDate}:{}),sameSite:c.sameSite||'unspecified'});
exports.count=async directory=>(await session.fromPath(directory).cookies.get({})).length;
exports.clear=async(directory,origin)=>{const s=session.fromPath(directory);if(origin)await s.clearStorageData({origin});else await s.clearStorageData({storages:['cookies']});await s.cookies.flushStore()};
exports.write=async(directory,cookies)=>{
 const target=session.fromPath(directory), staging=session.fromPartition('nand-cookie-validation-'+require('node:crypto').randomUUID());
 const valid=[];let failed=0;
 try {for(const c of cookies){try{await staging.cookies.set(details(c));valid.push(c)}catch{failed++}}}finally{await staging.clearStorageData()}
 if(!valid.length)return {imported:0,failed};
 const domains=new Set(valid.map(c=>normalize(c.domain)));
 const belongs=c=>{const d=normalize(c.domain);return d!=='google.com'&&!d.endsWith('.google.com')&&domains.has(d)};
 // Expire the canonical domain/name/path tuple. cookies.remove(url,name) also matches parent domains.
 const expire=c=>target.cookies.set({...details(c),value:'',expirationDate:1});
 const before=(await target.cookies.get({})).filter(belongs);
 let imported=0;
 try{
  for(const c of before)await expire(c);
  for(const c of valid){try{await target.cookies.set(details(c));imported++}catch{failed++}}
  if(!imported)throw Error('No Cookies could be imported');
  await target.cookies.flushStore();return {imported,failed};
 }catch(error){
  for(const c of (await target.cookies.get({})).filter(belongs))await expire(c);
  for(const c of before)await target.cookies.set(details(c));
  await target.cookies.flushStore();throw error;
 }
};`;
interface CookieSessionAPI {
	count(directory: string): Promise<number>;
	clear(directory: string, origin?: string): Promise<void>;
	write(directory: string, cookies: ImportCookie[]): Promise<{ imported: number; failed: number }>;
}
export function cookieSession(win: Window): CookieSessionAPI {
	return bundledMain<CookieSessionAPI>(win, COOKIE_SESSION_SOURCE);
}
