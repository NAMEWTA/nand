import { connect } from './cdp.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const c = await connect();
try {
	const result = await c.evaluate(
		`(async()=>{await app.plugins.plugins.nand.openDashboard();await new Promise(r=>setTimeout(r,200));const v=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view,adapter=app.vault.adapter,originalWrite=adapter.write.bind(adapter),file=v.sync.file;let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);let held=false;adapter.write=async(path,data,opts)=>{if(!held&&path.startsWith('.dashboard-backup/')){held=true;enter();await gate}return originalWrite(path,data,opts)};try{const saving=v.sync.updateBanner({quote:'Native local conflict fixture'}).then(()=>({saved:true}),()=>({saved:false}));await entered;const before=await app.vault.read(file);await app.vault.process(file,current=>current+'\\n<!-- Native external conflict fixture -->\\n');release();const outcome=await saving;const disk=await app.vault.read(file);const names=(await adapter.list('.dashboard-backup/conflicts')).files;const recovery=await adapter.read(names.find(p=>p.endsWith(v.sync.conflict.id+'.json')));await v.sync.reloadFromDisk();return {...outcome,externalPreserved:disk.includes('Native external conflict fixture'),localPreserved:recovery.includes('Native local conflict fixture'),basePreserved:JSON.parse(recovery).base===before,unblocked:!v.sync.blocked}}finally{adapter.write=originalWrite;release?.()}})()`,
	);
	assert.deepEqual(result, {
		saved: false,
		externalPreserved: true,
		localPreserved: true,
		basePreserved: true,
		unblocked: true,
	});
	await fs.writeFile(
		`${process.env.NAND_ACCEPTANCE_DIR || '/tmp/nand-issue-acceptance'}/dashboard-native-conflict.json`,
		JSON.stringify({ passed: true, ...result }, null, 2),
	);
	console.log(result);
} finally {
	c.close();
}
