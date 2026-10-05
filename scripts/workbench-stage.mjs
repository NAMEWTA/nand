// Temporary reviewed native acceptance correction; removed before final review.
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'src/view/hosts/obsidian/workbench-view.tsx';
let source = readFileSync(path, 'utf8');
if (!source.includes('private open =')) throw new Error('Unexpected native view baseline');
source = source.replace('private open =', 'private requestNavigation =').replaceAll('this.open(', 'this.requestNavigation(').replace('navigate={this.open}', 'navigate={this.requestNavigation}');
writeFileSync(path, source);
const probePath = 'scripts/obsidian-acceptance/workbench-probe.mjs';
let probe = readFileSync(probePath, 'utf8');
// Settings persistence and module activation are deliberately separate APIs.
probe = probe.replaceAll('await p.saveSettings();', 'await p.saveSettings();await p.applyModuleFlags();');
// Failure evidence includes runtime state, not just a screenshot.
probe = probe.replace("try { await shot('failure'); } catch {}", "try { await shot('failure'); await fs.writeFile(path.join(dir,'diagnostic.json'),JSON.stringify(await call(`(()=>{const v=${wb};return {errors:window.nandWorkbenchErrors,state:v?.getState(),keys:v?Object.keys(v):[],html:v?.contentEl?.innerHTML?.slice(0,12000)}})()`),null,2)); } catch {}");
writeFileSync(probePath, probe);
