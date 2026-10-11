// Combined production consumer journey. Only the agent provider is a named local fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export async function exerciseWorkspaceDelivery({ c, p, root, click, type, until, button, check, runtime, taskId }) {
 const json = JSON.stringify, panel = root + '.querySelector(".nand-browser-synthesis")';
 const guestScript=(guest,body)=>guest+'.executeJavaScript('+json(body)+')';
 const sourceSnapshot='JSON.stringify((()=>{const {syntheses,...data}=bw.snapshot();for(const key of ["tasks","turns","exchanges","templates"])data[key].sort((a,b)=>a.id.localeCompare(b.id));return data})(),(_key,value)=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value)';
 const before = await c.evaluate(sourceSnapshot);
 const exported = root + '.querySelector(".nand-browser-workspace-export")';
 await click(exported + '.querySelector("summary")'); await click(button('Preview Markdown export', exported));
 await until('!!' + exported + '.querySelector("textarea")');
 const markdown = await c.evaluate(exported + '.querySelector("textarea").value');
 await click(button('Save export in vault', exported)); await until(exported + '.textContent.includes("Saved: ")');
 const exportFiles = await fs.readdir(path.join(runtime.vault, 'NAND/AI Workspace/Exports'));
 check('delivery-restarted-multisite-history-exports-exact-current-markdown', exportFiles.length === 1 && await fs.readFile(path.join(runtime.vault, 'NAND/AI Workspace/Exports', exportFiles[0]), 'utf8') === markdown && markdown.includes('DeepSeek') && markdown.includes('Kimi'));

 await c.evaluate(String.raw`(async()=>{
  const plugin=${p},services=plugin.registry.services,original=services.peek;
  const provider=(await plugin.registry.contributionAccess.collect({owner:'agent',id:'run-contexts'})).find(row=>row.module==='browser').value;
  window.deliveryCalls=[];window.deliveryAssistantObserved=false;
  window.restoreDeliveryOwner=()=>{services.peek=original};
  const runner={run:async request=>{
   deliveryCalls.push({context:!!request.runContext,prompt:request.prompt});request.onState?.({status:'running',terminalId:'delivery-fixture'});
   if(!request.runContext)return{status:'succeeded',text:'# Local combined synthesis\n\nReviewed the two selected saved captures.'};
   const lease=await provider.resolve(request.runContext.handle,{runId:'delivery-assistant',cwd:app.vault.adapter.getBasePath(),signal:request.signal});
   if(!lease)throw Error('No scoped lease');
   try{
    const env=lease.env,endpoint=JSON.parse(require('node:fs').readFileSync(env.NAND_BROWSER_CONTEXT,'utf8')).endpoint;
    const observed=await new Promise((resolve,reject)=>{const socket=require('node:net').createConnection(endpoint);let body='';
     socket.setEncoding('utf8');socket.on('error',reject);socket.setTimeout(10000,()=>{socket.destroy();reject(Error('Scoped observation timed out'))});
     socket.on('connect',()=>socket.write(JSON.stringify({id:'combined-read',token:env.NAND_BROWSER_TOKEN,method:'snapshot',params:{page:deliveryTarget.pageId}})+'\n'));
     socket.on('data',chunk=>{body+=chunk;if(!body.includes('\n'))return;socket.destroy();resolve(JSON.parse(body.split('\n')[0]))});
    });
    if(!observed.ok)throw Error(observed.error.code);window.deliveryAssistantObserved=true;
    request.onState?.({status:'needs-attention',terminalId:'delivery-fixture'});
    await new Promise(resolve=>{if(request.signal.aborted)resolve();else request.signal.addEventListener('abort',resolve,{once:true})});
    return{status:'cancelled',text:'Stopped after local observation'};
   }finally{await lease.dispose()}
  },open:async()=>{}};
  const ports={directory:{list:()=>[{id:'codex',title:'Local owner fixture',enabled:true,installed:true}]},sessions:{list:async()=>[]},'prompt-runner':runner};
  services.peek=key=>key.owner==='agent'?ports[key.id]:original(key);return true;
 })()`);
 try {
  await click(panel + '.querySelector("input[type=checkbox]").closest("label")');
  await until(panel + '.querySelectorAll("select")[1]?.options.length===2');
  await click(panel + '.querySelectorAll("select")[1]');
  for(const [key,code] of [['ArrowDown',40],['Enter',13]])for(const kind of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type:kind,key,windowsVirtualKeyCode:code});
  await type(panel + '.querySelector("input[type=text]")','Combined evidence synthesis');
  await type(panel + '.querySelector("textarea")','Compare the selected source copies; preserve uncertainty.');
  for(const label of ['DeepSeek','Kimi'])await click('[...'+panel+'.querySelectorAll("fieldset label")].find(e=>e.textContent.includes('+json(label)+'))');
  await click(button('Review synthesis material and target',panel));await until('!!'+button('Authorize and run once',panel));
  check('delivery-synthesis-review-reuses-restored-captures-before-any-call',await c.evaluate('deliveryCalls.length===0&&'+panel+'.querySelector("[data-synthesis-id]").textContent.includes("Kimi")'));
  await click(button('Authorize and run once',panel));await until(panel+'.textContent.includes("Synthesis completed")');
  check('delivery-synthesis-calls-owner-once-without-changing-source-history',await c.evaluate('deliveryCalls.length===1&&bw.snapshot().syntheses.length===1&&'+sourceSnapshot+'==='+json(before)));
  await runtime.shot('delivery-synthesis');

  const html=await fs.readFile('scripts/fixtures/workflow-page.html','utf8');
  const server=createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(html)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
   const url='http://127.0.0.1:'+server.address().port+'/form/';
   await c.evaluate(`(async()=>{window.deliveryProfiles=${p}.services.peek({owner:'browser',id:'profiles'});window.deliveryA=await deliveryProfiles.create('Combined account A');window.deliveryB=await deliveryProfiles.create('Combined account B');window.deliveryTarget=await bc.open({url:${json(url)},profileId:deliveryA.id,target:'tab'});window.deliveryOther=await bc.open({url:${json(url)},profileId:deliveryB.id,target:'tab'});return true})()`);
   await until('bc.list().length===2&&bc.list().every(p=>!p.loading)');
   await c.evaluate(`window.deliveryGuestA=document.querySelector('[data-page-id="'+deliveryTarget.pageId+'"] webview');window.deliveryGuestB=document.querySelector('[data-page-id="'+deliveryOther.pageId+'"] webview');true`);
   await until('deliveryGuestA.executeJavaScript("!!window.resetWorkflow")');
   await c.evaluate(guestScript('deliveryGuestA','document.cookie="fixtureAccount=A";localStorage.fixtureAccount="A";true'));
   check('delivery-two-accounts-use-distinct-partitions-and-isolated-storage',await c.evaluate('deliveryGuestA.getAttribute("partition")!==deliveryGuestB.getAttribute("partition")&&'+guestScript('deliveryGuestB','!document.cookie.includes("fixtureAccount")&&!localStorage.fixtureAccount')));
   await c.evaluate(`(async()=>{window.deliveryAssistant=${p}.services.peek({owner:'browser',id:'assistant'});await deliveryAssistant.initialize();window.deliveryReview=await deliveryAssistant.review({title:'Combined handover',goal:'Observe this account and wait for human takeover',targets:[deliveryTarget],operations:['snapshot'],maxOperations:5,timeoutMs:60000,destination:{kind:'automatic',agentId:'codex'}});window.deliveryPromise=deliveryAssistant.start(deliveryReview.id);return true})()`);
   await until('deliveryAssistantObserved');
   await c.evaluate('deliveryAssistant.takeover(deliveryReview.id,deliveryTarget)');await until('!deliveryAssistant.busy(deliveryReview.id)');
   check('delivery-human-takeover-releases-assistant-owner-before-workflow',await c.evaluate('deliveryAssistant.snapshot().find(t=>t.id===deliveryReview.id).status==="paused"&&deliveryCalls.length===2'));

   await c.evaluate(p+'.setModuleEnabled("automations",true)');
   await c.evaluate(`window.deliveryFlows=${p}.services.peek({owner:'browser',id:'workflows'});window.deliveryOwner=${p}.services.peek({owner:'automations',id:'workflow-invocations'});deliveryFlows.initialize()`);
   const account=await c.evaluate('deliveryA.id'), target=await c.evaluate('deliveryTarget');
   const element={role:'text input',name:'Message'}, condition=value=>({kind:'value',element,equals:value});
   const spec={id:'combined-flow',version:1,title:'Combined native edit',description:'Local account-bound flow',variables:[],targetScope:[{id:'form',profileId:account,origin:new URL(url).origin,pathPrefix:'/form/'}],consequenceClass:'page-input',createdAt:1,updatedAt:1,steps:[{id:'fill',target:'form',operation:'fill',args:{element,value:'Shared owner after takeover'},precondition:[condition('')],postcondition:[condition('Shared owner after takeover')]}]};
   await c.evaluate(`(async()=>{await deliveryFlows.save(${json(spec)});window.deliveryFlowReview=await deliveryFlows.review('combined-flow',{},[{id:'form',pageId:deliveryTarget.pageId,profileId:deliveryTarget.profileId}]);await deliveryFlows.invoke(deliveryFlowReview.id);return true})()`);
   await until('deliveryOwner.receipt(deliveryFlowReview.id)?.status==="succeeded"');
   check('delivery-workflow-uses-released-page-and-one-shared-owner-receipt',await c.evaluate('deliveryFlows.records().some(r=>r.runId===deliveryOwner.receipt(deliveryFlowReview.id).runId&&r.phase==="succeeded")&&'+guestScript('deliveryGuestA','document.querySelector("#message").value==="Shared owner after takeover"')));
   check('delivery-workflow-keeps-other-account-draft-unchanged',await c.evaluate(guestScript('deliveryGuestB','document.querySelector("#message").value===""')));

   const grant=await c.evaluate(`(async()=>{window.deliveryAccess=${p}.services.peek({owner:'browser',id:'external-access'});return deliveryAccess.create({purpose:'Read reviewed account after workflow',targets:[deliveryTarget],operations:['snapshot'],minutes:1,maxOperations:5})})()`);
   const cli=async(args)=>{try{const r=await promisify(execFile)(process.execPath,[grant.environment.NAND_BROWSER_CLI,...args],{env:{...process.env,...grant.environment}});return JSON.parse(r.stdout)}catch(error){if(error.stdout)return JSON.parse(error.stdout);throw error}};
   const read=await cli(['snapshot','--page',target.pageId,'--profileId',account]);
   check('delivery-generated-cli-observes-workflow-result-through-scoped-grant',read.ok&&read.result.snapshot.includes('Message'));
   const denied=await cli(['snapshot','--page',target.pageId,'--profileId',await c.evaluate('deliveryB.id')]);
   check('delivery-generated-cli-rejects-other-account',!denied.ok&&denied.error.code==='browser_scoped_grant_scope');
   await c.evaluate('deliveryAccess.revoke('+json(grant.grant.id)+')');
   check('delivery-revoke-invalidates-the-same-generated-cli-credential',!(await cli(['snapshot','--page',target.pageId])).ok);
   check('delivery-all-consumers-leave-captured-history-intact',await c.evaluate(sourceSnapshot+'==='+json(before)));
   await c.evaluate(p+'.openWorkbench({feature:"browser",section:"access"},window)');await until('!!document.querySelector(".nand-browser-access")');await runtime.shot('delivery-revoked-grant');
   await c.evaluate('restoreDeliveryOwner();true');
   await c.evaluate('(async()=>{for(const page of bc.list())await bc.close(page.target);app.workspace.requestSaveLayout();await new Promise(resolve=>setTimeout(resolve,1000));return true})()');
   await runtime.restart();c=runtime.connection;
   await c.evaluate(`(async()=>{window.bw=${p}.services.peek({owner:'browser',id:'workspace'});window.bc=${p}.services.peek({owner:'browser',id:'control'});await bw.initialize();window.deliveryAssistant=${p}.services.peek({owner:'browser',id:'assistant'});await deliveryAssistant.initialize();window.deliveryFlows=${p}.services.peek({owner:'browser',id:'workflows'});await deliveryFlows.initialize();return true})()`);
   const restored=await c.evaluate(`({source:${sourceSnapshot},syntheses:bw.snapshot().syntheses.map(s=>s.status),pages:bc.list(),assistant:deliveryAssistant.snapshot().map(t=>t.status),workflows:deliveryFlows.records().map(r=>r.phase),grants:${p}.services.peek({owner:'browser',id:'external-access'}).list().length})`);
   await fs.writeFile(path.join(runtime.evidence,'delivery-restart-state.json'),json({expected:JSON.parse(before),actual:JSON.parse(restored.source),...restored,source:undefined},null,2));
   check('delivery-restart-keeps-history-and-results-without-new-guests-or-grants',restored.source===before&&restored.syntheses.length===1&&restored.pages.length===0&&restored.assistant.includes('paused')&&restored.workflows.includes('succeeded')&&restored.grants===0,{sourceMatches:restored.source===before,syntheses:restored.syntheses,pages:restored.pages,assistant:restored.assistant,workflows:restored.workflows,grants:restored.grants});
   await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai",resourceId:'+json(taskId)+'},window)');
   // Return the new CDP connection to the caller after the combined restart.
   return c;
  } finally { await new Promise(resolve=>server.close(resolve)); }
 } finally { await c.evaluate('window.restoreDeliveryOwner?.();true').catch(()=>{}); }
}
