/** Node-only client embedded in main.js; no second release artifact or global install. */
export const BROWSER_CLI_SOURCE = String.raw`#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),net=require('node:net'),crypto=require('node:crypto');
const args=process.argv.slice(2), params={};let method=args.shift();
if(method==='tab')method='tab.'+args.shift();
for(let i=0;i<args.length;i++){const a=args[i];if(!a.startsWith('--'))throw Error('Expected --flag');const eq=a.indexOf('=');if(eq>2){params[a.slice(2,eq)]=a.slice(eq+1);continue}const k=a.slice(2);params[k]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true}
if(!method||method==='help'){
 console.log('NAND browser: tab list/create/switch/close; goto/back/forward/reload/stop; snapshot; click/dblclick/hover/fill/type/select/check/focus/get/keypress/drag; scroll/wait/viewport; screenshot; console/network.\nUse --connection <path> or NAND_BROWSER_CONTEXT. Page operations require --page <id>; element operations require --revision <snapshot revision> and --element @eN. All responses are JSON.\nExamples: tab create --url https://example.com; snapshot --page ID; fill --page ID --revision 1 --element @e2 --value text; screenshot --page ID --output shot.png');process.exit(0)
}
let metadata;try{metadata=JSON.parse(fs.readFileSync(params.connection||process.env.NAND_BROWSER_CONTEXT,'utf8'))}catch(e){console.log(JSON.stringify({ok:false,error:{code:'browser_connection_missing',message:'Use --connection PATH or NAND_BROWSER_CONTEXT from the current NAND instance.'}}));process.exit(1)}delete params.connection;delete params.json;
for(const k of ['hard','full','checked'])if(params[k]!==undefined)params[k]=params[k]===true||params[k]==='true';
const output=params.output;delete params.output;
const requestId=crypto.randomUUID(),socket=net.createConnection(metadata.endpoint);let buffer='',settled=false;
const finish=(code,result)=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();console.log(JSON.stringify(result));process.exitCode=code};
const timer=setTimeout(()=>finish(1,{ok:false,error:{code:'browser_timeout'}}),70000);
socket.setEncoding('utf8');socket.on('error',e=>finish(1,{ok:false,error:{code:'browser_connection_failed',message:e.message}}));
socket.on('close',()=>{if(!settled)finish(1,{ok:false,error:{code:'browser_connection_closed'}})});
socket.on('connect',()=>socket.write(JSON.stringify({id:requestId,token:process.env.NAND_BROWSER_TOKEN,method,params})+'\n'));
socket.on('data',chunk=>{buffer+=chunk;if(buffer.length>90000000)return finish(1,{ok:false,error:{code:'browser_response_too_large'}});const end=buffer.indexOf('\n');if(end<0)return;
 try{const r=JSON.parse(buffer.slice(0,end));if(r.id!==requestId)throw Error('Response ID mismatch');if(output&&r.ok&&r.result&&typeof r.result.dataUrl==='string'){const m=r.result.dataUrl.match(/^data:image\/png;base64,(.+)$/s);if(!m)throw Error('Invalid PNG');fs.writeFileSync(output,Buffer.from(m[1],'base64'),{flag:'wx'});r.result={path:require('node:path').resolve(output)}}finish(r.ok?0:1,r)}catch(e){finish(1,{ok:false,error:{code:'browser_client_error',message:e.message}})}
});
`;
