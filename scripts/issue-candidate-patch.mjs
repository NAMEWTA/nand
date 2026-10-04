import fs from 'node:fs';
import assert from 'node:assert/strict';
function edit(file, from, to) {const s=fs.readFileSync(file,'utf8');assert.ok(s.includes(from),file+': '+from);fs.writeFileSync(file,s.replace(from,to));}
const general='src/plugin/settings/general.ts';
edit(general,"\t\t.setDesc(t('settings.memoTemplateDesc'))","\t\t.setDesc(memoTemplateDescription(containerEl))");
fs.appendFileSync(general,`\n/** These are fixed Markdown property keys, not translated UI labels. */\nfunction memoTemplateDescription(container: HTMLElement): DocumentFragment {\n\tconst fragment = container.ownerDocument.createDocumentFragment();\n\tfor (const part of t('settings.memoTemplateDesc').split(/(\x60[^\x60]+\x60)/g)) {\n\t\tif (part.startsWith('\x60') && part.endsWith('\x60')) fragment.createEl('code', { text: part.slice(1, -1) });\n\t\telse fragment.createSpan({ text: part });\n\t}\n\treturn fragment;\n}\n`);
const locale='src/shared/i18n/workspace-switcher.ts';
edit(locale,'the fixed property keys "创建时间" and "type" are always set','the fixed property keys `创建时间` and `type` are always set');
edit(locale,'the fixed key "创建时间" and literal "type: memo"','the fixed key `创建时间` and literal `type: memo`');
edit(locale,'创建时间 与 type 始终会写入','`创建时间` 与 `type` 始终会写入');
edit(locale,'内置默认模板：创建时间 + type: memo','内置默认模板：`创建时间` + `type: memo`');
console.log('Fixed schema keys render as code in both native settings paths; no stored key is renamed.');
