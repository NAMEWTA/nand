import { Chart } from 'chart.js';
import type { EventRef, HoverParent } from 'obsidian';
import { App, Component, TFile } from 'obsidian';
import { render, type ComponentChild } from 'preact';
import { SUPPORTED_FILE_EXTS } from '../../../shared/file-types';

/** One resource and interaction scope per dashboard root, including detached render trees. */
export class DashboardRenderContext {
	constructor(readonly root: HTMLElement) {}
	readonly panels = new Set<HTMLElement>();
	readonly chartInstances = new Map<string, Chart>();

	readonly scanningSignatures = new Map<string, string>();
	readonly taskDragSource = { current: null as { cardId: string; taskPath: number[] } | null };
	readonly docDragSource = { current: null as { cardId: string; docPath: number[] } | null };
	hoverParent: HoverParent | null = null;
	noteOpener: ((file: TFile, subpath?: string) => void) | null = null;
	markdownComponent: Component | null = null;
}
const contexts = new WeakMap<HTMLElement, DashboardRenderContext>();
export function bindRenderContext(element: HTMLElement, context: DashboardRenderContext): void {
	contexts.set(element, context);
}
export function getRenderContext(element: HTMLElement): DashboardRenderContext {
	let current: HTMLElement | null = element;
	while (current) {
		const context = contexts.get(current);
		if (context) return context;
		if (current.classList.contains('nand-dashboard-root') || !current.parentElement) break;
		current = current.parentElement;
	}
	const context = new DashboardRenderContext(current ?? element);
	contexts.set(current ?? element, context);
	return context;
}
export function destroyChart(element: HTMLElement, cardId: string): void {
	const charts = getRenderContext(element).chartInstances;
	charts.get(cardId)?.destroy();
	charts.delete(cardId);
}
export function mountDashboardPanel(element: HTMLElement, panel: ComponentChild): void {
	getRenderContext(element).panels.add(element);
	render(panel, element);
}
/** Release nested panels before a partial DOM replacement (for example a mobile widget tab). */
export function unmountDashboardPanelsIn(container: HTMLElement): void {
	const context = getRenderContext(container);
	for (const element of context.panels) {
		if (!container.contains(element)) continue;
		render(null, element);
		context.panels.delete(element);
	}
}
export function destroyDashboardPanels(root: HTMLElement, preserveWidgets?: HTMLElement | null): void {
	const context = getRenderContext(root);
	for (const element of context.panels) {
		if (preserveWidgets?.contains(element)) continue;
		render(null, element);
		context.panels.delete(element);
	}
}
export function destroyAllCharts(root: HTMLElement, preserveWidgets?: HTMLElement | null): void {
	const context = getRenderContext(root);
	for (const chart of context.chartInstances.values()) chart.destroy();
	context.chartInstances.clear();

	context.taskDragSource.current = null;
	context.docDragSource.current = null;
}
export function getCSSVar(element: HTMLElement, name: string): string {
	const root = element.closest<HTMLElement>('.nand-dashboard-root') ?? getRenderContext(element).root;
	return root.ownerDocument.defaultView?.getComputedStyle(root).getPropertyValue(name).trim() ?? '';
}
export function isAccentLight(element: HTMLElement): boolean {
	return isLightColor(getCSSVar(element, '--db-accent'));
}

export function isLightColor(color: string): boolean {
	const value = color.trim();
	if (value.startsWith('rgb')) {
		const nums = value.match(/[\d.]+/g);
		if (!nums || nums.length < 3) return false;
		return relativeLuminance(Number(nums[0]), Number(nums[1]), Number(nums[2])) > 0.179;
	}
	const hex = value.replace(/^#/, '');
	if (!/^[0-9a-fA-F]+$/.test(hex)) return false;
	const full =
		hex.length === 3
			? hex
					.split('')
					.map((c) => c + c)
					.join('')
			: hex;
	if (full.length !== 6) return false;
	return (
		relativeLuminance(
			parseInt(full.slice(0, 2), 16),
			parseInt(full.slice(2, 4), 16),
			parseInt(full.slice(4, 6), 16),
		) > 0.179
	);
}

export function relativeLuminance(r: number, g: number, b: number): number {
	const toLinear = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export const VAULT_FILE_EXTS = SUPPORTED_FILE_EXTS;

export function getSearchableFiles(app: App) {
	return app.vault.getFiles().filter((f) => !f.path.startsWith('.') && VAULT_FILE_EXTS.has(f.extension));
}

const basenameIndexes = new WeakMap<App, { index: Map<string, TFile>; refs: EventRef[] }>();
export function ensureBasenameIndex(app: App): Map<string, TFile> {
	const cached = basenameIndexes.get(app);
	if (cached) return cached.index;
	const index = new Map<string, TFile>();
	const indexFile = (file: unknown) => {
		if (
			file instanceof TFile &&
			!file.path.startsWith('.') &&
			VAULT_FILE_EXTS.has(file.extension) &&
			!index.has(file.basename)
		)
			index.set(file.basename, file);
	};
	for (const file of app.vault.getFiles()) indexFile(file);
	const refs = [
		app.vault.on('create', indexFile),
		app.vault.on('delete', (file) => {
			if (file instanceof TFile && index.get(file.basename) === file) index.delete(file.basename);
		}),
		app.vault.on('rename', (file, oldPath) => {
			const oldBasename =
				oldPath
					.split('/')
					.pop()
					?.replace(/\.[^.]+$/, '') ?? '';
			if (index.get(oldBasename) === file) index.delete(oldBasename);
			indexFile(file);
		}),
	];
	basenameIndexes.set(app, { index, refs });
	return index;
}
export function teardownBasenameIndex(app: App): void {
	for (const ref of basenameIndexes.get(app)?.refs ?? []) app.vault.offref(ref);
	basenameIndexes.delete(app);
}

export function resolveNoteFile(app: App, rawPath: string): TFile | null {
	const direct = app.vault.getFileByPath(rawPath);
	if (direct) return direct;
	const withMd = rawPath.includes('.') ? rawPath : `${rawPath}.md`;
	const tried = app.vault.getFileByPath(withMd);
	if (tried) return tried;
	const basename = rawPath.split('/').pop()?.replace(/\.md$/, '') ?? '';
	if (basename) {
		return ensureBasenameIndex(app).get(basename) ?? null;
	}
	return null;
}
