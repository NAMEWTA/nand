// Real native input against the production task UI; imported by the workspace acceptance runner.
export async function createPromptFixtures({ c, root, click, type, until, button, check }) {
 const library = root + '.querySelector(".nand-browser-workspace-prompts")';
 const field = title => '[...' + library + '.querySelectorAll("label")].find(e=>e.querySelector("span")?.textContent===' + JSON.stringify(title) + ').querySelector("input,textarea")';
 await click(library + '.querySelector("summary")');
 for (const [title, body] of [['First template', 'First instructions'], ['Second template', '# Second instructions\n\n- Check sources']]) {
  await click(button('New template', library));
  await type(field('Template title'), title); await type(field('Template Markdown'), body);
  await click(button('Save template', library));
  await until('bw.snapshot().templates.some(t=>t.title===' + JSON.stringify(title) + ')&&!' + button('Save template', library));
 }
 const templates = await c.evaluate('bw.snapshot().templates');
 const first = templates.find(row => row.title === 'First template'), second = templates.find(row => row.title === 'Second template');
 const card = title => '[...' + library + '.querySelectorAll("section")].find(e=>e.querySelector("label")?.textContent===' + JSON.stringify(title) + ')';
 await click(button('Move up', card('Second template')));
 await until('bw.snapshot().templates.find(t=>t.title==="Second template").order===0');
 for (const title of ['First template', 'Second template']) await click(card(title) + '.querySelector("input[type=checkbox]")');
 await until('bw.snapshot().tasks[0].promptTemplateIds?.length===2');
 await click(card('Second template') + '.querySelector("summary")');
 check('prompt-preview-renders-markdown-and-order-is-independent-of-selection-order', await c.evaluate(card('Second template') + '.querySelector(".nand-browser-answer h1")?.textContent==="Second instructions"&&bw.snapshot().templates.find(t=>t.title==="Second template").order===0'));
 check('prompt-management-never-types-or-sends-in-website', await c.evaluate('wv.executeJavaScript("fixtureCount()===0&&document.querySelector(\'.fixture-composer\').value===\'\'")'));
 await click(library + '.querySelector("summary")');
 return { first: first.id, second: second.id, prefix: '# Second instructions\n\n- Check sources\n\nFirst instructions\n\n' };
}

export async function editPromptFixtures({ c, root, click, type, until, button, check, fixtures }) {
 const library = root + '.querySelector(".nand-browser-workspace-prompts")';
 const card = title => '[...' + library + '.querySelectorAll("section")].find(e=>e.querySelector("label")?.textContent===' + JSON.stringify(title) + ')';
 const field = title => '[...' + library + '.querySelectorAll("label")].find(e=>e.querySelector("span")?.textContent===' + JSON.stringify(title) + ').querySelector("input,textarea")';
 const frozen = await c.evaluate('JSON.stringify(bw.snapshot().turns)');
 await click(library + '.querySelector("summary")');
 await click(button('Edit template', card('First template')));
 await type(field('Template title'), 'Renamed template'); await type(field('Template Markdown'), 'New instructions');
 await click(button('Save template', library));
 await until('bw.snapshot().templates.some(t=>t.title==="Renamed template")&&!' + button('Save template', library));
 check('prompt-rename-keeps-stable-id-and-historical-snapshot', await c.evaluate('bw.snapshot().templates.find(t=>t.title==="Renamed template").id===' + JSON.stringify(fixtures.first) + '&&JSON.stringify(bw.snapshot().turns)===' + JSON.stringify(frozen)));
 await click(button('Remove template', card('Renamed template')));
 check('prompt-removal-reviews-local-scope-before-changing-content', await c.evaluate('bw.snapshot().templates.length===2&&' + library + '.textContent.includes("Historical copies remain")'));
 await click(button('Confirm template removal', library));
 await until('bw.snapshot().templates.length===1&&!' + button('Confirm template removal', library) + '&&!' + button('New template', library) + '.disabled');
 check('prompt-removal-clears-current-selection-and-keeps-all-sent-snapshots', await c.evaluate('JSON.stringify(bw.snapshot().turns)===' + JSON.stringify(frozen) + '&&JSON.stringify(bw.snapshot().tasks[0].promptTemplateIds)===' + JSON.stringify(JSON.stringify([fixtures.second]))));
 check('prompt-edits-did-not-submit-another-question', await c.evaluate('wv.executeJavaScript("fixtureCount()===6")'));
 // Leave the library open for the existing full theme/width and touch-target matrix.
}
