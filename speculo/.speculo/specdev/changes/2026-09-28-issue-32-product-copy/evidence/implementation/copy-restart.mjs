import {connect} from './cdp.mjs';import fs from 'node:fs/promises';
const c=await connect();try{console.log(await c.evaluate(`(async()=>{for(let i=0;i<90&&!app.plugins.plugins.nand?.automationHost;i++)await new Promise(r=>setTimeout(r,500));if(!app.plugins.plugins.nand?.automationHost)throw Error('plugin startup timeout');return {ready:true,language:app.plugins.plugins.nand.settings.language,introSeen:app.plugins.plugins.nand.settings.introSeen}})()`));}finally{c.close()}
await import('./copy-acceptance.mjs');
