// Native load errors and hidden capture guards remain after diagnostics collection is removed.
import { browserFixture } from './browser-fixture.mjs';
await browserFixture(async ({ runtime, url, evaluate, check }) => {
 await evaluate(`window.captureMount=surface.contentEl.createDiv();captureMount.style.height='400px';window.capture=host.createPage({...surface.state,id:'diagnostic-fixture'},captureMount,()=>{});await capture.ready;await capture.initialLoad;true`);
 await evaluate(`captureMount.style.display='none';true`);
 check('hidden-capture-fails-promptly', await evaluate(`capture.screenshot().then(()=>false,e=>e.code==='browser_capture_not_visible')`));
 await evaluate(`captureMount.style.display='';await capture.navigate(${JSON.stringify(url + 'failure')}).catch(()=>{});true`);
 check('failed-load-has-visible-state', await evaluate('!!capture.state.error'));
 await evaluate(`await capture.navigate(${JSON.stringify(url)});true`);
 check('navigation-recovers-after-load-error', await evaluate('capture.state.error===null'));
 await runtime.shot('browser-error-recovered');
 await evaluate(`host.releasePage('diagnostic-fixture');captureMount.remove();true`);
});
