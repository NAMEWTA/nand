// Temporary reviewed implementation stage 2a; removed before final review.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
const read = (path) => readFileSync(path, 'utf8');
const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text.trimStart(), 'utf8'); };
const replace = (path, before, after) => { const text = read(path); if (!text.includes(before)) throw new Error('Missing reviewed anchor: ' + path + ' ' + before); put(path, text.replace(before, after)); };
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
replace('src/view/workbench/navigation-state.ts', '!/[\\u0000-\\u001f]/.test(value)', '![...value].some((character) => character.charCodeAt(0) < 32)');
put('src/view/hosts/obsidian/native-surface.ts', String.raw`
import { Component, setIcon, setTooltip, type App, type Menu, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';

/** A real native host supplies capabilities. This is not an ItemView or a fake leaf. */
export interface NativeSurfaceContext {
	app: App;
	leaf: WorkspaceLeaf;
	contentEl: HTMLElement;
	containerEl: HTMLElement;
	embedded?: boolean;
	addAction?: (icon: string, title: string, callback: (event: MouseEvent) => void) => HTMLElement;
	close: () => void;
}

/** Native rendering lifetime shared by standalone leaves and workbench pages. */
export abstract class NativeSurface extends Component {
	constructor(readonly context: NativeSurfaceContext) { super(); }
	get app(): App { return this.context.app; }
	get leaf(): WorkspaceLeaf { return this.context.leaf; }
	get contentEl(): HTMLElement { return this.context.contentEl; }
	get containerEl(): HTMLElement { return this.context.containerEl; }
	get embedded(): boolean { return this.context.embedded === true; }
	abstract getViewType(): string;
	abstract getDisplayText(): string;
	abstract getIcon(): string;
	onOpen(): Promise<void> { return Promise.resolve(); }
	onClose(): Promise<void> { return Promise.resolve(); }
	onResize(): void { /* A presentation can opt in to native resize notification. */ }
	onPaneMenu(menu: Menu): void { void menu; }
	getState(): Record<string, unknown> { return {}; }
	setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		void state; void result; return Promise.resolve();
	}
	addAction(icon: string, title: string, callback: (event: MouseEvent) => void): HTMLElement {
		if (this.context.addAction) return this.context.addAction(icon, title, callback);
		const button = this.contentEl.createEl('button', { cls: 'nand-ui-icon-btn', attr: { type: 'button', 'aria-label': title } });
		setIcon(button, icon); setTooltip(button, title);
		this.registerDomEvent(button, 'click', callback);
		return button;
	}
}

export interface NativeSurfaceOwner { getNativeSurfaces(): readonly NativeSurface[]; }

/** Enumerate current native owners instead of retaining global active views or roots. */
export function nativeSurfaces(app: App): NativeSurface[] {
	const result: NativeSurface[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		const owner = leaf.view as typeof leaf.view & Partial<NativeSurfaceOwner>;
		if (typeof owner.getNativeSurfaces === 'function') result.push(...owner.getNativeSurfaces());
	});
	return result;
}
`);

function extract({ path, surfacePath, oldName, newName, nativeImport, hostType, hostImport, domain, constant }) {
	const original = read(path);
	const ast = ts.createSourceFile(path, original, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
	const declaration = ast.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === oldName);
	if (!declaration) throw new Error('Missing class ' + oldName);
	let source = original.replace(new RegExp('\\b' + oldName + '\\b', 'g'), newName);
	source = source.replace('extends ItemView', 'extends NativeSurface').replace(/\bleaf: WorkspaceLeaf,?/g, (match) => 'context: NativeSurfaceContext' + (match.endsWith(',') ? ',' : '')).replace('super(leaf);', 'super(context);');
	// Remove only the reviewed native import bindings, preserving all other imports and formatting.
	source = source.replace(/\bItemView,\s*/g, '').replace(/\btype WorkspaceLeaf,?\s*/g, '').replace(/\bWorkspaceLeaf,\s*/g, '');
	source = "import { NativeSurface, type NativeSurfaceContext } from '" + nativeImport + "';\n" + source;
	const fields = [], methods = [];
	const lifecycle = new Set(['onOpen', 'onClose', 'getState', 'setState']);
	for (const member of declaration.members) {
		if (!member.name || !ts.isIdentifier(member.name)) continue;
		if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.StaticKeyword)) continue;
		const name = member.name.text;
		if (ts.isMethodDeclaration(member) || (ts.isPropertyDeclaration(member) && member.type && ts.isFunctionTypeNode(member.type))) {
			if (!lifecycle.has(name)) methods.push('\t' + name + '(...args: Parameters<' + newName + "['" + name + "']>): ReturnType<" + newName + "['" + name + "']> { return this.surface." + name + '(...args); }');
		} else if (ts.isPropertyDeclaration(member) || ts.isGetAccessorDeclaration(member)) {
			fields.push('\tget ' + name + '(): ' + newName + "['" + name + "'] { return this.surface." + name + '; }');
			if (ts.isPropertyDeclaration(member) && !member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)) fields.push('\tset ' + name + '(value: ' + newName + "['" + name + "']) { this.surface." + name + ' = value; }');
		}
	}
	put(surfacePath, source);
	const basename = './' + surfacePath.split('/').at(-1).replace(/\.tsx?$/, '');
	put(path, `import { ItemView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';\nimport { ${newName} } from '${basename}';\nimport type { ${hostType} } from '${hostImport}';\n${constant ? `export { ${constant} } from '${basename}';\n` : ''}\n/** Original native identity; business presentation is shared with the workbench. */\nexport class ${oldName} extends ItemView {\n\treadonly surface: ${newName};\n\tconstructor(leaf: WorkspaceLeaf, host: ${hostType}) {\n\t\tsuper(leaf);\n\t\tthis.surface = this.addChild(new ${newName}({\n\t\t\tapp: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl,\n\t\t\taddAction: (icon, title, callback) => this.addAction(icon, title, callback),\n\t\t\tclose: () => this.leaf.detach(),\n\t\t}, host));\n\t}\n\tgetNativeSurfaces(): readonly ${newName}[] { return [this.surface]; }\n\tonOpen(): Promise<void> { return this.surface.onOpen(); }\n\tonClose(): Promise<void> { return this.surface.onClose(); }\n\tgetState(): Record<string, unknown> { return this.surface.getState(); }\n\tasync setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {\n\t\tawait this.surface.setState(state, result);\n\t\tawait super.setState(state, result);\n\t}\n${fields.join('\n')}\n${methods.join('\n')}\n}\n`);
	for (const file of walk(domain)) {
		if (file === path || file === surfacePath || !/\.tsx?$/.test(file)) continue;
		let text = read(file);
		if (!text.includes(oldName)) continue;
		text = text.replace(new RegExp('\\b' + oldName + '\\b', 'g'), newName);
		const oldBase = path.split('/').at(-1).replace(/\.tsx?$/, '');
		const newBase = surfacePath.split('/').at(-1).replace(/\.tsx?$/, '');
		text = text.replace(new RegExp("(['\"])([^'\"]*\\/)" + oldBase + "(['\"])", 'g'), '$1$2' + newBase + '$3');
		put(file, text);
	}
}
extract({ path: 'src/view/dashboard/view/dashboard-view.ts', surfacePath: 'src/view/dashboard/view/dashboard-surface.ts', oldName: 'DashboardView', newName: 'DashboardSurface', nativeImport: '../../hosts/obsidian/native-surface', hostType: 'DashboardHost', hostImport: '../host', domain: 'src/view/dashboard' });
extract({ path: 'src/view/contacts/view.tsx', surfacePath: 'src/view/contacts/contacts-presentation.tsx', oldName: 'ContactsView', newName: 'ContactsPresentation', nativeImport: '../hosts/obsidian/native-surface', hostType: 'ContactsHost', hostImport: './host', domain: 'src/view/contacts', constant: 'CONTACTS_VIEW_TYPE' });
extract({ path: 'src/view/automations/view.tsx', surfacePath: 'src/view/automations/automation-presentation.tsx', oldName: 'AutomationView', newName: 'AutomationPresentation', nativeImport: '../hosts/obsidian/native-surface', hostType: 'AutomationViewHost', hostImport: './panel-contract', domain: 'src/view/automations', constant: 'AUTOMATION_VIEW_TYPE' });
for (const file of walk('src/view/dashboard')) {
	if (!/\.tsx?$/.test(file)) continue;
	const text = read(file);
	if (text.includes('this.containerEl.children[1]')) put(file, text.replaceAll('this.containerEl.children[1]', 'this.contentEl'));
}
replace('src/plugin/main.ts', 'showModuleDisabled.call(leaf.view);', 'showModuleDisabled.call(leaf.view.surface);');
// Native-only assumptions are made visible in the implementation log for follow-up review.
for (const dir of ['src/view/dashboard', 'src/view/contacts', 'src/view/automations']) {
	for (const path of walk(dir)) {
		if (!/\.tsx?$/.test(path)) continue;
		read(path).split('\n').forEach((line, index) => { if (/this\.leaf|containerEl\.children/.test(line)) console.log(path + ':' + (index + 1) + ' ' + line.trim()); });
	}
}
