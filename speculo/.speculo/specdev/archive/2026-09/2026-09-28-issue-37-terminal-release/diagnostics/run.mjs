// Public, pinned release asset; no user vault, account, or installed service is touched.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
if(process.platform!=='linux'||process.arch!=='x64')throw Error('This captured release probe requires Linux x64');
const url='https://github.com/NAMEWTA/nand/releases/download/0.0.1/rust-terminal-servers-linux-x64';
const expected='b28fa7ee45c72f1a1740840839ec0a52fb455694e598afe7512a0bcc7c75def1';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nand-release-diagnosis-'));
try{let bytes;if(process.env.NAND_DIAG_RELEASE_BINARY)bytes=await fs.readFile(process.env.NAND_DIAG_RELEASE_BINARY);else{const response=await fetch(url);if(!response.ok)throw Error('Release download failed: '+response.status);bytes=Buffer.from(await response.arrayBuffer())}
const sha=crypto.createHash('sha256').update(bytes).digest('hex');if(sha!==expected)throw Error('Pinned release digest mismatch');const binary=path.join(dir,'server');await fs.writeFile(binary,bytes,{mode:0o700});console.log(JSON.stringify({url,sha256:sha}));
const result=spawnSync(process.execPath,[path.join(path.dirname(fileURLToPath(import.meta.url)),'probe.mjs'),binary],{encoding:'utf8',timeout:15000});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.error)console.error('Probe process could not run: '+result.error.message);if(result.signal)console.error('Probe terminated by '+result.signal);console.log('probe_exit='+String(result.status));process.exitCode=result.status??1;
}finally{await fs.rm(dir,{recursive:true,force:true})}
