// Temporary reviewed implementation stage 2a, corrected native contracts.
import './workbench-extraction.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const edit = (path, before, after) => {
 const text = readFileSync(path, 'utf8');
 if (!text.includes(before)) throw new Error('Missing reviewed anchor: ' + path);
 writeFileSync(path, text.replace(before, after));
};
edit('src/view/hosts/obsidian/native-surface.ts', 'onPaneMenu(menu: Menu): void { void menu; }', "onPaneMenu(menu: Menu, source = ''): void { void menu; void source; }");
edit('src/view/dashboard/view/dashboard-surface.ts', ', WorkspaceLeaf }', ' }');
edit('src/view/dashboard/view/sidebar.ts', "import { DASHBOARD_VIEW_TYPE } from './view-type';", "import { nativeSurfaces } from '../../hosts/obsidian/native-surface';");
edit('src/view/dashboard/view/sidebar.ts', 'for (const leaf of this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)) {\n\t\tconst other = leaf.view as DashboardSurface | undefined;', 'for (const other of nativeSurfaces(this.app)) {');
