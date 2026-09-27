import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ESLint } from 'eslint';
const directory = await fs.mkdtemp(path.resolve('src/promise-regression-'));
const file = path.join(directory, 'callbacks.ts');
try {
  await fs.writeFile(file, `import { ButtonComponent, Setting } from 'obsidian';
declare const button: ButtonComponent;
declare const setting: Setting;
void Promise.resolve().finally(() => button.setDisabled(false));
void Promise.resolve().then(() => setting.addDropdown(() => {}));
void Promise.resolve().finally(() => { button.setDisabled(false); });
void Promise.resolve().then(() => { setting.addDropdown(() => {}); });
`);
  const eslint = new ESLint();
  const results = await eslint.lintFiles([file]);
  const diagnostics = results.flatMap((r) => r.messages).filter((r) => r.ruleId === 'nand/no-obsidian-thenable');
  if (!diagnostics.length) console.log(results.flatMap((r) => r.messages));
  assert.deepEqual(diagnostics.map((d) => d.line), [4, 5]);
  console.log('Promise callback guard passed against real Obsidian control types');
} finally { await fs.rm(directory, { recursive: true, force: true }); }
