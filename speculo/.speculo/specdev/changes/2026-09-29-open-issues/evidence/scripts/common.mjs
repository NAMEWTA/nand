import fs from 'node:fs/promises';
export const dir='/tmp/nand-issue-audit';
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function metrics(c,width,height=740){await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(120);}
export async function shot(c,name){await fs.writeFile(`${dir}/${name}.png`,Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
export async function language(c,lang){return c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;p.settings.language=${JSON.stringify(lang)};await p.saveSettings();await p.loadSettings();await new Promise(r=>setTimeout(r,100));})()`);}
export async function init(c){await c.evaluate(`window.auditRect=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=e.ownerDocument.defaultView.getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,client:e.clientWidth,scroll:e.scrollWidth,text:e.textContent,color:s.color,bg:s.backgroundColor,whiteSpace:s.whiteSpace,display:s.display}}`);}
export async function escape(c){for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
