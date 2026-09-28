import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { once } from 'node:events';
const WebSocket = createRequire('/srv/nand/package.json')('ws');
export async function connect(url='app://obsidian.md/index.html') {
 const targets=await (await fetch('http://127.0.0.1:9229/json')).json();
 const target=targets.find(t=>t.type==='page' && t.url===url);
 if(!target) throw Error('No Obsidian page');
 const ws=new WebSocket(target.webSocketDebuggerUrl); await once(ws,'open');
 let serial=0; const pending=new Map(); const events=[];
 ws.on('message',bytes=>{const m=JSON.parse(bytes);if(m.method)events.push(m);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 return {send,evaluate,events,close:()=>ws.close()};
}
if(process.argv[2]){const c=await connect();try{console.log(JSON.stringify(await c.evaluate(await fs.readFile(process.argv[2],'utf8')),null,2));}finally{c.close();}}
