/** Node-only client embedded in main.js; no second release artifact or global install. */
export const BROWSER_CLI_SOURCE = String.raw`#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),net=require('node:net'),crypto=require('node:crypto');
const args=process.argv.slice(2), params={};let method=args.shift();
const failure=(code,retryAction)=>({ok:false,error:{code,message:code,reason:code,retryAction}});
if(method==='tab')method='tab.'+args.shift();
try{for(let i=0;i<args.length;i++){const a=args[i];if(!a.startsWith('--'))throw Error('Expected --flag');const eq=a.indexOf('=');if(eq>2){params[a.slice(2,eq)]=a.slice(eq+1);continue}const k=a.slice(2);params[k]=args[i+1]!==undefined&&!args[i+1].startsWith('--')?args[++i]:true}}
catch{console.log(JSON.stringify(failure('browser_invalid_argument','check-command-arguments')));process.exit(1)}
if(process.env.NAND_BROWSER_TASK&&params.taskId===undefined)params.taskId=process.env.NAND_BROWSER_TASK;
if(!method||method==='help'){
 console.log('NAND browser: tab list/create/switch/close; goto/back/forward/reload/stop; snapshot; click/dblclick/hover/fill/type/select/check/focus/get/keypress/drag; scroll/wait/viewport; screenshot; console/network.\nUse --connection <path> or NAND_BROWSER_CONTEXT. Page operations require --page <id>; element operations require --revision <snapshot revision> and --element @eN. All responses are JSON.\nExplicit grants allow only selected operations and pages. Keep NAND_BROWSER_TASK from the issued connection. Scoped fill also requires --expectedValue (use --expectedValue= for an empty draft). Submission-capable actions require confirmation in NAND.\nExamples: tab create --url https://example.com; snapshot --page ID; fill --page ID --revision 1 --element @e2 --value text --expectedValue=; screenshot --page ID --output shot.png');process.exit(0)
}
let metadata;try{metadata=JSON.parse(fs.readFileSync(params.connection||process.env.NAND_BROWSER_CONTEXT,'utf8'))}catch{console.log(JSON.stringify(failure('browser_connection_missing','request-new-grant')));process.exit(1)}delete params.connection;delete params.json;
for(const k of ['hard','full','checked'])if(params[k]!==undefined)params[k]=params[k]===true||params[k]==='true';
const output=params.output;delete params.output;
let socket;try{if(!metadata||typeof metadata.endpoint!=='string'||!metadata.endpoint)throw Error();socket=net.createConnection(metadata.endpoint)}catch{console.log(JSON.stringify(failure('browser_connection_invalid','request-new-grant')));process.exit(1)}
const requestId=crypto.randomUUID();let buffer='',settled=false;
const finish=(code,result)=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();console.log(JSON.stringify(result));process.exitCode=code};
const timer=setTimeout(()=>finish(1,failure('browser_timeout','check-outcome-in-browser')),70000);
socket.setEncoding('utf8');socket.on('error',()=>finish(1,failure('browser_connection_failed','request-new-grant')));
socket.on('close',()=>{if(!settled)finish(1,failure('browser_connection_closed','check-outcome-in-browser'))});
socket.on('connect',()=>socket.write(JSON.stringify({id:requestId,token:process.env.NAND_BROWSER_TOKEN,method,params})+'\n'));
socket.on('data',chunk=>{buffer+=chunk;if(buffer.length>90000000)return finish(1,failure('browser_response_too_large','request-smaller-result'));const end=buffer.indexOf('\n');if(end<0)return;
 try{const r=JSON.parse(buffer.slice(0,end));if(r.id!==requestId)throw Error('Response ID mismatch');if(output&&r.ok&&r.result&&typeof r.result.dataUrl==='string'){const m=r.result.dataUrl.match(/^data:image\/png;base64,(.+)$/s);if(!m)throw Error('Invalid PNG');fs.writeFileSync(output,Buffer.from(m[1],'base64'),{flag:'wx'});r.result={path:require('node:path').resolve(output)}}finish(r.ok?0:1,r)}catch{finish(1,failure('browser_client_error','check-response-and-output-path'))}
});
`;
