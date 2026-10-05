import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';

const identities = {
 DASHBOARD_VIEW_TYPE: 'nand-dashboard-view', CONTACTS_VIEW_TYPE: 'nand-contacts-view',
 AUTOMATION_VIEW_TYPE: 'nand-automation-view', BROWSER_VIEW_TYPE: 'nand-browser-view', TERMINAL_VIEW_TYPE: 'terminal-view',
};
for (const [file, name, surfaceName, identity, title, icon] of [
 ['dashboard/view/dashboard-view.ts', 'DashboardView', 'DashboardSurface', 'DASHBOARD_VIEW_TYPE', 'main.dashboard', 'home'],
 ['contacts/view.tsx', 'ContactsView', 'ContactsPresentation', 'CONTACTS_VIEW_TYPE', 'contacts.title', 'contact-round'],
 ['automations/view.tsx', 'AutomationView', 'AutomationPresentation', 'AUTOMATION_VIEW_TYPE', 'automation.title', 'timer'],
 ['browser/browser-view.tsx', 'BrowserView', 'BrowserPresentation', 'BROWSER_VIEW_TYPE', 'browser.title', 'globe'],
 ['terminal/terminal-view.ts', 'TerminalView', 'TerminalSurface', 'TERMINAL_VIEW_TYPE', 'terminal.defaultTitle', 'terminal'],
]) {
 test(name + ' exposes native identity before super() has initialized the shared presentation', () => {
  const initial = [];
  class ItemView {
   constructor(leaf) {
    this.app = leaf.app; this.leaf = leaf; this.contentEl = leaf.contentEl; this.containerEl = leaf.contentEl;
    // Obsidian reads native title/icon during its base constructor, not just after onOpen.
    initial.push(this.getViewType(), this.getDisplayText(), this.getIcon());
   }
   addChild(child) { return child; }
  }
  class Surface {
   constructor(context) { this.context = context; }
   getViewType() { return identities[identity]; }
   getDisplayText() { return 'Resource-specific title'; }
   getState() { return { safe: 'state' }; }
  }
  const dependencies = { ItemView, [surfaceName]: Surface, ...identities, t: (key) => key };
  const output = ts.transpileModule(fs.readFileSync('src/view/' + file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: () => dependencies }, { filename: file });
  const leaf = { app: {}, contentEl: {}, detach() {} };
  const view = name === 'TerminalView' ? new exports[name](leaf, null, {}) : new exports[name](leaf, {});
  assert.deepEqual(initial, [identities[identity], title, icon]);
  assert.equal(view.getDisplayText(), 'Resource-specific title');
  assert.equal(view.getNativeSurfaces()[0], view.surface);
  assert.equal(view.surface.context.leaf, leaf, 'The real leaf is passed through, never a fake nested leaf');
 });
}

test('one Ribbon registration owner and no workbench business-store duplicate', () => {
 const files = [];
 function visit(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const path = directory + '/' + entry.name; if (entry.isDirectory()) visit(path); else if (/\.tsx?$/.test(path) && !path.endsWith('.test.ts')) files.push(path); } }
 visit('src');
 const owners = files.filter((path) => /\.addRibbonIcon\s*\(/.test(fs.readFileSync(path, 'utf8')));
 assert.deepEqual(owners, ['src/plugin/workbench/surfaces/ribbon.ts']);
 const ribbon = fs.readFileSync(owners[0], 'utf8');
 assert.match(ribbon, /stableRibbon\(plugin, 'home'/);
 assert.match(fs.readFileSync('src/plugin/ribbon.ts','utf8'), /ribbon-/);
 for (const directory of ['src/core/home', 'src/platform/home', 'src/view/home']) assert.equal(fs.existsSync(directory), false);
 for (const path of files.filter((path) => path.startsWith('src/view/workbench/'))) {
  const text = fs.readFileSync(path, 'utf8');
  assert.doesNotMatch(text, /from ['"].*(?:plugin\/|platform\/|obsidian|electron|xterm)/, path + ': the shell must only consume presentation contracts');
 }
});
