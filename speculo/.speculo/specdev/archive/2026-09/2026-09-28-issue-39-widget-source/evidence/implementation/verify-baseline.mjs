import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { build } = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nand-widget-red-'));
try {
 const old = execFileSync('git', ['show', '5356993:src/platform/obsidian/dashboard/automation.ts'], { encoding: 'utf8' });
 await build({ entryPoints: ['scripts/verify-automation.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), alias: { obsidian: './scripts/obsidian-stub.ts' }, plugins: [{name:'baseline-source-only',setup(b){b.onLoad({filter:/platform\/obsidian\/dashboard\/automation\.ts$/},()=>({contents:old,loader:'ts'}));}}] });
 const result = spawnSync(process.execPath, ['--test', path.join(dir, 'test.cjs')], { encoding: 'utf8', env: {...process.env,TZ:'America/New_York'} });
 process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode=result.status;
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
