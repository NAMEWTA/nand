import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sonnerStyles } from './sonner-styles.mjs';
import { radixOwnerDocument } from './radix-owner-document.mjs';
import { connect } from './obsidian-acceptance/cdp.mjs';

const root = path.resolve(import.meta.dirname, '..');
const chromeExecutable = process.env.NAND_CHROME_EXECUTABLE ?? 'google-chrome';
const obsidianAsar = process.env.NAND_OBSIDIAN_ASAR ?? '/opt/Obsidian/resources/obsidian.asar';
try { fs.accessSync(obsidianAsar); execFileSync(chromeExecutable, ['--version'], { stdio: 'ignore' }); }
catch { console.log('verify-ui-runtime: 跳过（未找到 Chrome 或 Obsidian；可设置 NAND_CHROME_EXECUTABLE / NAND_OBSIDIAN_ASAR）'); process.exit(0); }
const work = process.env.NAND_UI_EVIDENCE ?? fs.mkdtempSync(path.join(os.tmpdir(), 'nand-ui-runtime-'));
fs.mkdirSync(work, { recursive: true });
// Actual host CSS, with the final production stylesheet (no synthetic utility build).
const asar = fs.readFileSync(obsidianAsar);
const header = JSON.parse(asar.subarray(16, 16 + asar.readUInt32LE(12)).toString());
const entry = header.files['app.css'];
const offset = 8 + asar.readUInt32LE(4) + Number(entry.offset);
fs.writeFileSync(path.join(work, 'app.css'), asar.subarray(offset, offset + entry.size));
await build({ entryPoints: ['scripts/fixtures/ui-runtime.tsx'], outfile: path.join(work, 'runtime.js'), bundle: true, jsx: 'automatic', jsxImportSource: 'react', platform: 'browser', format: 'iife', alias: { obsidian: path.join(root, 'scripts/obsidian-stub.ts') }, plugins: [sonnerStyles, radixOwnerDocument], define: { 'process.env.NODE_ENV': '"production"' } });
const head = `<link rel="stylesheet" href="${pathToFileURL(path.join(work, 'app.css'))}"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'styles.css'))}"><style>body{padding:24px;overflow:auto}.fixture-root{width:540px}.fixture-controls,.fixture-adjacent{display:flex;align-items:center}.fixture-controls{gap:8px}.fixture-isolated{display:flex;align-items:center;gap:64px;margin:32px 0}.fixture-root>input,.fixture-root>textarea{margin:12px 0}iframe{position:absolute;left:650px;top:0;width:640px;height:900px}</style>`;
fs.writeFileSync(path.join(work, 'runtime.html'), `<!doctype html><meta charset="utf-8">${head}<iframe srcdoc='${head}'></iframe><script src="runtime.js"></script>`);
const port = 9500 + Math.floor(Math.random() * 300);
const chrome = spawn(chromeExecutable, ['--headless=new', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(work, 'profile')}`, '--window-size=1400,1100', 'about:blank'], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let cdp;
const result = { errors: [] };
try {
	process.env.NAND_CDP_URL = `http://127.0.0.1:${port}`;
	for (let i = 0; i < 50 && !cdp; i++) { try { cdp = await connect('about:blank'); } catch { await delay(100); } }
	assert(cdp, 'Chrome CDP available');
	cdp.on('Runtime.exceptionThrown', details => result.errors.push(details));
	await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
	await cdp.send('Page.navigate', { url: pathToFileURL(path.join(work, 'runtime.html')).href });
	// The fixture bundles React and two documents; a loaded machine can need far more than a few seconds.
	let ready = false;
	for (let i = 0; i < 300 && !ready; i++) { ready = await cdp.evaluate('!!window.uiFixture?.controls.other').catch(() => false); if (!ready) await delay(100); }
	assert(ready, 'UI runtime fixture did not become ready within 30s');
	await delay(250);
	const evaluate = cdp.evaluate;
	const snapshot = () => evaluate(`Object.fromEntries(Object.entries(uiFixture.docs).map(([id,d])=>{const w=d.defaultView;const wheel=new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100});d.body.dispatchEvent(wheel);const touch=new w.Event('touchmove',{bubbles:true,cancelable:true});d.body.dispatchEvent(touch);return [id,{dialogs:d.querySelectorAll('[role=dialog]').length,guards:d.querySelectorAll('[data-radix-focus-guard]').length,lock:d.body.getAttribute('data-scroll-locked'),wheel:wheel.defaultPrevented,touch:touch.defaultPrevented,pointer:d.body.style.pointerEvents,styles:d.head.querySelectorAll('style').length,hidden:d.querySelectorAll('[aria-hidden=true]').length,listeners:uiFixture.listenerCounts(d)}]}))`);
	const setOpen = async (id, part, value) => { await evaluate(`uiFixture.controls.${id}(${JSON.stringify(part)},${value})`); await delay(250);
		if (!value && ['dialog', 'sheet'].includes(part)) {
			for (let i = 0; i < 100; i++) {
				if (await evaluate(`!uiFixture.docs.${id}.querySelector('[data-slot=${part}-content]')`)) break;
				await delay(50);
			}
			assert(await evaluate(`!uiFixture.docs.${id}.querySelector('[data-slot=${part}-content]')`), `${id} ${part} closed`);
			await delay(50);
		}
	};
	const hitTest = () => evaluate(`Object.fromEntries(Object.entries(uiFixture.docs).map(([id,d])=>{
		const measure=e=>{const r=e.getBoundingClientRect(),s=d.defaultView.getComputedStyle(e,'::before'),pseudo=s.content!=='none',w=Math.max(r.width,pseudo?parseFloat(s.width)||0:0),h=Math.max(r.height,pseudo?parseFloat(s.height)||0:0);return {x:r.x+(r.width-w)/2,y:r.y+(r.height-h)/2,w,h}};
		const minimum=d.defaultView.matchMedia('(pointer: coarse)').matches?44:32;
		const controls=[...d.querySelectorAll('.fixture-controls button,.fixture-adjacent button,.fixture-isolated button,.fixture-root>input,.fixture-root>textarea,[data-slot=resizable-handle],[data-slot=scroll-area-scrollbar]')].filter(e=>!e.parentElement.hasAttribute('data-hit-group')).map(e=>{
			const r=e.getBoundingClientRect(),hit=measure(e);const points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>{const target=d.elementFromPoint(r.x+r.width/2+x*(minimum/2-1),r.y+r.height/2+y*(minimum/2-1));return target===e||e.contains(target)});
			return {name:e.getAttribute('aria-label')||e.dataset.slot||e.textContent,visual:[r.width,r.height],hit:[hit.w,hit.h],isolated:!!e.closest('.fixture-isolated'),points};
		});
		const groups=[...d.querySelectorAll('.fixture-controls [data-hit-group]')].map(e=>{const r=e.getBoundingClientRect(),boxes=[...e.querySelectorAll('button')].map(measure);return {name:e.dataset.slot||e.getAttribute('role'),visual:[r.width,r.height],hit:[Math.max(...boxes.map(b=>b.x+b.w))-Math.min(...boxes.map(b=>b.x)),Math.max(...boxes.map(b=>b.y+b.h))-Math.min(...boxes.map(b=>b.y))],group:true}});
		return [id,[...controls,...groups]];
	}))`);
	for (const coarse of [false, true]) {
		await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: coarse }); await delay(100);
		const sample = await hitTest(); result[coarse ? 'touch' : 'desktop'] = sample;
		for (const controls of Object.values(sample)) for (const control of controls) {
			assert(control.hit.every(size => size >= (coarse ? 44 : 32) - .1), JSON.stringify(control));
			if (control.isolated) assert(control.points.every(Boolean), `isolated hit testing: ${JSON.stringify(control)}`);
		}
		const layouts = await evaluate(`Object.fromEntries(Object.entries(uiFixture.docs).map(([id,d])=>{
			const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
			return [id,Object.fromEntries([...d.querySelectorAll('[data-case]')].map(row=>[row.dataset.case,{
				container:box(row), controls:[...row.querySelectorAll('button,a')].map(e=>({box:box(e),parent:e.parentElement.dataset.case||e.parentElement.dataset.slot||e.parentElement.getAttribute('role'),display:d.defaultView.getComputedStyle(e).display,ref:e.dataset.ref,marginLeft:d.defaultView.getComputedStyle(e).marginLeft,margin:[d.defaultView.getComputedStyle(e).marginTop,d.defaultView.getComputedStyle(e).marginRight,d.defaultView.getComputedStyle(e).marginBottom,d.defaultView.getComputedStyle(e).marginLeft],position:d.defaultView.getComputedStyle(e).position,pseudoWidth:parseFloat(d.defaultView.getComputedStyle(e,'::before').width),pseudoHeight:parseFloat(d.defaultView.getComputedStyle(e,'::before').height)})),
				after:row.querySelector(':scope > span')?box(row.querySelector(':scope > span')):null,
				label:row.querySelector('label')?{opacity:d.defaultView.getComputedStyle(row.querySelector('label')).opacity,cursor:d.defaultView.getComputedStyle(row.querySelector('label')).cursor,previous:row.querySelector('label').previousElementSibling.dataset.slot}:null,
				wrappers:row.querySelectorAll('.nand-hit-target').length
			}]))];
		}))`);
		result[coarse ? 'layoutTouch' : 'layoutDesktop'] = layouts;
		for (const [id, rows] of Object.entries(layouts)) {
			for (const row of Object.values(rows)) assert.equal(row.wrappers, 0);
			const stretch=rows.stretch.controls[0]; assert.equal(stretch.box.height,36,id+' stretch stays 36px'); assert.deepEqual(stretch.margin,['0px','0px','0px','0px']); assert.equal(stretch.position,'relative');
			assert(stretch.pseudoHeight >= (coarse?44:32));
			for(const name of ['connected','orca-split']) {
				const [a,b]=rows[name].controls; assert.equal(b.box.x-a.box.x-a.box.width,0,id+' '+name+' joined border');
				for(const item of [a,b]) { assert.equal(item.box.height,24); assert.deepEqual(item.margin,['0px','0px','0px','0px']); }
			}
			for(const item of rows.connected.controls) assert(item.pseudoWidth<=item.box.width,'joined items keep their inline partition');
			assert.deepEqual(rows.connected.controls.map(c=>c.box.width),[34,33]);
			assert.equal(rows['row-top'].controls[0].box.y,rows['row-top'].after.y); assert.equal(rows['row-top'].controls[0].box.height,20);
			assert.equal(rows.positioned.controls[0].position,'absolute'); assert.equal(rows.positioned.controls[0].box.x-rows.positioned.container.x,12);
			assert.equal(rows.full.controls[0].box.width, 300, id + ' w-full');
			assert.equal(rows.full.controls[0].parent, 'full');
			for (const name of ['flex', 'compact-flex']) for (const control of rows[name].controls) { assert.equal(control.box.width, 146, id + ' ' + name); assert.equal(control.parent, name); }
			for (const name of ['hidden', 'hidden-attribute', 'compact-hidden']) {
				for (const control of rows[name].controls) assert.equal(control.display, 'none', id + ' ' + name);
				assert.equal(rows[name].after.x, rows[name].container.x, id + ' no hidden footprint');
			}
			assert.deepEqual(rows.peer.label, { opacity: '0.5', cursor: 'not-allowed', previous: 'checkbox' });
			assert.deepEqual(rows.grid.controls.map(c => c.box.width), [300,146,146]);
			assert.equal(rows.grid.controls[0].parent, 'grid');
			assert.equal(rows.style.controls[0].box.width, 120); assert.equal(rows.style.controls[0].marginLeft, '12px');
			assert.equal(rows['as-child'].controls[0].box.width, 300); assert.equal(rows['as-child'].controls[0].ref, 'A');
			assert.equal(rows['as-child'].controls[0].parent, 'as-child');
			assert.deepEqual(rows.group.controls.map(c => c.box.width), [150.5,149.5]); // Original first-item border contributes one pixel.
			for (const control of rows.group.controls) assert.equal(control.parent, 'toggle-group');
			for (const control of rows.segmented.controls) { assert.equal(control.box.width, 147); assert.equal(control.parent, 'radiogroup'); }
		}
		for (const controls of Object.values(sample)) {
			assert.equal(controls.find(c => c.name === 'small icon').visual[1], 24);
			assert.equal(controls.find(c => c.name === 'switch').visual[1], 20);
			assert.equal(controls.find(c => c.name === 'checkbox').visual[1], 16);
		}
	}
	for(const id of Object.keys(result.desktop)) {
		const compact=row=>row.filter(c=>!['input','textarea','resize','scroll-area-scrollbar'].includes(c.name)).map(({name,visual})=>({name,visual}));
		assert.deepEqual(compact(result.desktop[id]),compact(result.touch[id]),id+' pointer mode must not resize compact controls');
		for(const name of Object.keys(result.layoutDesktop[id])) {
			const sizes=rows=>rows[name].controls.map(c=>({width:c.box.width,height:c.box.height,margin:c.margin}));
			assert.deepEqual(sizes(result.layoutDesktop[id]),sizes(result.layoutTouch[id]),id+' '+name+' unchanged layout box');
		}
	}
	// Explicit widths and parent layout stay authoritative; no geometry is read back into margins.
	await evaluate(`for(const d of Object.values(uiFixture.docs)){d.querySelector('[data-layout]').style.width='360px';const e=d.querySelector('[data-case=style] button');e.style.width='20px';e.style.padding='0'}`); await delay(200);
	result.resized = await evaluate(`Object.fromEntries(Object.entries(uiFixture.docs).map(([id,d])=>{const e=d.querySelector('[data-case=style] button'),s=d.defaultView.getComputedStyle(e);return [id,{full:d.querySelector('[data-case=full] button').getBoundingClientRect().width,flex:[...d.querySelectorAll('[data-case=flex] button')].map(e=>e.getBoundingClientRect().width),visual:e.getBoundingClientRect().width,margin:s.marginRight}]}))`);
	for(const row of Object.values(result.resized)) assert.deepEqual(row,{full:360,flex:[176,176],visual:20,margin:'0px'});
	await evaluate(`for(const d of Object.values(uiFixture.docs)){d.querySelector('[data-layout]').style.width='300px';const e=d.querySelector('[data-case=style] button');e.style.width='120px';e.style.removeProperty('padding')}`); await delay(200);
	await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(s => fs.writeFileSync(path.join(work, 'layout.png'), Buffer.from(s.data, 'base64')));
	result.visualDetails = await evaluate(`Object.fromEntries(Object.entries(uiFixture.docs).map(([id,d])=>[id,{divider:d.defaultView.getComputedStyle(d.querySelector('[data-slot=resizable-handle]'),'::after').width,scrollThumb:d.defaultView.getComputedStyle(d.querySelector('[data-slot=scroll-area-thumb]'),'::before').width}]))`);
	for (const value of Object.values(result.visualDetails)) assert.deepEqual(value, {divider:'1px',scrollThumb:'9px'});
	await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	await evaluate(`uiFixture.docs.main.body.style.pointerEvents='auto';uiFixture.docs.other.body.style.pointerEvents='inherit'`);
	result.before = await snapshot();
	await setOpen('other', 'dialog', true); result.otherOpen = await snapshot();
	assert.deepEqual(result.otherOpen.main, result.before.main);
	assert.equal(result.otherOpen.other.lock, '1'); assert.equal(result.otherOpen.other.guards, 2);
	assert(result.otherOpen.other.wheel && result.otherOpen.other.touch);
	assert.equal(result.otherOpen.other.pointer, 'none');
	// A second window must not take over the first window's scroll/focus stack.
	await setOpen('main', 'dialog', true); result.bothOpen = await snapshot();
	for (const value of Object.values(result.bothOpen)) { assert.equal(value.lock, '1'); assert.equal(value.guards, 2); assert(value.wheel && value.touch); }
	await setOpen('main', 'dialog', false); result.mainClosed = await snapshot();
	assert.deepEqual(result.mainClosed.main, result.before.main);
	assert.deepEqual(result.mainClosed.other, result.otherOpen.other);
	// Nested modal (Select) must retain the surrounding Dialog's lock on close.
	await evaluate(`uiFixture.docs.other.querySelector('[data-slot=select-trigger]').dispatchEvent(new uiFixture.docs.other.defaultView.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`); await delay(300);
	result.selectOpen = await evaluate(`({open:!!uiFixture.docs.other.querySelector('[role=listbox]'),active:uiFixture.docs.other.activeElement?.textContent,lock:uiFixture.docs.other.body.getAttribute('data-scroll-locked')})`);
	assert(result.selectOpen.open); assert.equal(result.selectOpen.lock, '2'); assert.match(result.selectOpen.active, /Alpha/);
	await evaluate(`uiFixture.docs.other.activeElement.dispatchEvent(new uiFixture.docs.other.defaultView.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`); await delay(300);
	assert.deepEqual(await snapshot(), result.otherOpen);
	// Close glyphs keep the original visual size and expose a full target.
	result.closeTarget = await evaluate(`(()=>{const d=uiFixture.docs.other,e=d.querySelector('[data-slot=dialog-close]'),r=e.getBoundingClientRect(),s=d.defaultView.getComputedStyle(e,'::before');const hit=d.elementFromPoint(r.x+r.width/2-15,r.y+r.height/2-15);return {visual:[r.width,r.height],hit:[parseFloat(s.width),parseFloat(s.height)],clickable:hit===e||e.contains(hit)}})()`);
	assert(result.closeTarget.hit.every(size => size >= 32)); assert(result.closeTarget.clickable);
	await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true }); await delay(100);
	result.closeTouch = await evaluate(`(()=>{const d=uiFixture.docs.other,e=d.querySelector('[data-slot=dialog-close]'),r=e.getBoundingClientRect(),s=d.defaultView.getComputedStyle(e,'::before');const hit=d.elementFromPoint(r.x+r.width/2-21,r.y+r.height/2-21);return {visual:[r.width,r.height],hit:[parseFloat(s.width),parseFloat(s.height)],clickable:hit===e||e.contains(hit)}})()`);
	assert(result.closeTouch.hit.every(size => size >= 44)); assert(result.closeTouch.clickable);
	await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	await setOpen('other', 'dialog', false); result.after = await snapshot(); assert.deepEqual(result.after, result.before);
	// Host tokens are live, including a non-default token value and reduced motion.
	await evaluate(`for(const d of Object.values(uiFixture.docs)){d.body.style.setProperty('--anim-duration-fast','73ms');d.body.style.setProperty('--anim-duration-moderate','141ms')}`);
	await setOpen('other', 'dialog', true);
	result.motion = await evaluate(`(()=>{const d=uiFixture.docs.other,s=e=>d.defaultView.getComputedStyle(e);return {dialog:s(d.querySelector('[role=dialog]')).animationDuration,progress:s(d.querySelector('[data-slot=progress-indicator]')).transitionDuration,property:s(d.querySelector('[data-slot=progress-indicator]')).transitionProperty,switch:s(d.querySelector('[data-slot=switch-thumb]')).transitionDuration}})()`);
	assert.equal(result.motion.dialog, '0.073s'); assert.equal(result.motion.progress, '0.141s'); assert.equal(result.motion.switch, '0.073s'); assert.equal(result.motion.property, 'transform, opacity');
	await setOpen('other', 'dialog', false); await setOpen('other', 'sheet', true);
	result.motion.sheet = await evaluate(`uiFixture.docs.other.defaultView.getComputedStyle(uiFixture.docs.other.querySelector('[data-slot=sheet-content]')).animationDuration`); assert.equal(result.motion.sheet, '0.141s');
	await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
	result.reduced = await evaluate(`(()=>{const d=uiFixture.docs.other,s=d.defaultView.getComputedStyle(d.querySelector('[data-slot=sheet-content]'));return {animation:s.animationName,transition:s.transitionDuration}})()`);
	assert.deepEqual(result.reduced, { animation: 'none', transition: '0s' });
	await setOpen('other', 'sheet', false);
	await cdp.send('Emulation.setEmulatedMedia', { features: [] });
	await evaluate(`(()=>{const d=uiFixture.docs.other,e=d.querySelector('[data-slot=dropdown-menu-trigger]');e.focus();e.dispatchEvent(new d.defaultView.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))})()`); await delay(250);
	if (await evaluate(`uiFixture.docs.other.activeElement.getAttribute('role') === 'menu'`)) { await evaluate(`(()=>{const d=uiFixture.docs.other;d.activeElement.dispatchEvent(new d.defaultView.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))})()`); await delay(100); }
	const menuFirst = await evaluate(`uiFixture.docs.other.activeElement.textContent`);
	assert.equal(menuFirst, 'One');
	await evaluate(`(()=>{const d=uiFixture.docs.other;d.activeElement.dispatchEvent(new d.defaultView.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))})()`); await delay(100);
	const menuNext = await evaluate(`uiFixture.docs.other.activeElement.textContent`);
	assert.equal(menuNext, 'Submenu'); result.menuKeyboard = { first: menuFirst, next: menuNext };
	await setOpen('other', 'menu', false);
	result.semantic = [];
	for (const theme of ['theme-light', 'theme-dark']) {
		await evaluate(`(()=>{const d=uiFixture.docs.other;d.body.className='${theme}';for(const el of d.querySelectorAll('.nand-ui')){el.style.setProperty('--foreground','rgb(20,80,140)');el.style.setProperty('--popover','rgb(240,230,220)')}})()`);
		for (const kind of ['dropdown-menu', 'context-menu']) {
			if (kind === 'dropdown-menu') await setOpen('other', 'menu', true);
			else { await evaluate(`uiFixture.docs.other.getElementById('other-context').dispatchEvent(new uiFixture.docs.other.defaultView.MouseEvent('contextmenu',{bubbles:true,clientX:100,clientY:400}))`); await delay(250); }
			await setOpen('other', 'sub', true);
			const color = await evaluate(`(()=>{const d=uiFixture.docs.other,e=d.querySelector('[data-slot=${kind}-sub-trigger]'),test=d.createElement('span');test.style.backgroundColor='color-mix(in oklab, rgb(20,80,140) ${theme === 'theme-dark' ? 14 : 8}%, transparent)';d.body.append(test);const result={state:e?.dataset.state,actual:d.defaultView.getComputedStyle(e).backgroundColor,expected:d.defaultView.getComputedStyle(test).backgroundColor};test.remove();return result})()`);
			assert.equal(color.state, 'open'); assert.equal(color.actual, color.expected); result.semantic.push({ theme, kind, ...color });
			await setOpen('other', 'sub', false);
			if (kind === 'dropdown-menu') await setOpen('other', 'menu', false);
			else { await evaluate(`uiFixture.docs.other.activeElement.dispatchEvent(new uiFixture.docs.other.defaultView.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`); await delay(250); }
		}
	}
	await cdp.send('Page.captureScreenshot', { format: 'png' }).then(s => fs.writeFileSync(path.join(work, 'runtime.png'), Buffer.from(s.data, 'base64')));
	await evaluate('uiFixture.unmount()'); await delay(250); result.unmounted = await snapshot();
	result.observers = await evaluate('uiFixture.observerCounts()'); assert.deepEqual(result.observers, {main:0,other:0});
	result.resizeErrors = await evaluate('uiFixture.resizeErrors'); assert.deepEqual(result.resizeErrors, []);
	for (const value of Object.values(result.unmounted)) { assert.equal(value.lock, null); assert.equal(value.guards, 0); assert(!value.wheel && !value.touch); assert.deepEqual(value.listeners, {}); }
	assert.deepEqual(result.errors, []); result.passed = true;
} catch (error) { if(cdp) await cdp.send('Page.captureScreenshot',{format:'png'}).then(s=>fs.writeFileSync(path.join(work,'failure.png'),Buffer.from(s.data,'base64'))); result.passed = false; result.error = String(error.stack ?? error); throw error; }
finally { fs.writeFileSync(path.join(work, 'result.json'), JSON.stringify(result, null, 2) + '\n'); cdp?.close(); chrome.kill(); }
console.log(`UI runtime regression passed: ${work}`);
