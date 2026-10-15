// The retained browser restores page and profile state without running tasks.
import { browserFixture } from './browser-fixture.mjs';
await browserFixture(async ({ runtime, url, p, evaluate, until, check, bind, delay }) => {
 const profile = await evaluate(`${p}.services.peek({owner:'browser',id:'profiles'}).create('Recovery profile')`);
 const id = await evaluate(`${p}.services.peek({owner:'browser',id:'open'}).open({url:${JSON.stringify(url)},profileId:${JSON.stringify(profile.id)},zoom:1.25})`);
 await evaluate(`window.pageId=${JSON.stringify(id)};app.workspace.requestSaveLayout();true`);
 await delay(1500); await runtime.restart();
 await evaluate(`window.pageId=${JSON.stringify(id)};await ${p}.openWorkbench({feature:'browser',resourceId:pageId});true`);
 await until(`!!document.querySelector('[data-page-id="${id}"] webview')`); await bind();
 check('restart-retains-page-account-and-zoom', await evaluate(`surface.state.id===${JSON.stringify(id)}&&surface.state.profileId===${JSON.stringify(profile.id)}&&surface.state.zoom===1.25&&surface.state.url===${JSON.stringify(url)}`));
 const pageLoaded = `(()=>{try{return surface.contentEl.querySelector('webview')?.executeJavaScript('document.body.innerText').then(text=>text.includes('Browser fixture'),()=>false)}catch{return false}})()`;
 await until(pageLoaded);
 check('restart-loads-the-restored-page', true);
 await runtime.shot('browser-restored');
 await evaluate(`${p}.setModuleEnabled('browser',false)`);
 check('disabled-page-releases-native-guest', await evaluate(`!document.querySelector('webview')`));
 await evaluate(`await ${p}.setModuleEnabled('browser',true);await ${p}.openWorkbench({feature:'browser',resourceId:${JSON.stringify(id)}});true`);
 await until(`!!document.querySelector('webview')`);
 await bind(); await until(pageLoaded);
 check('reenable-restores-browser-page', true);
});
