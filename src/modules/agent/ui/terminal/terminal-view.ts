import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal, type ILink, type ITheme } from '@xterm/xterm';
import { Notice, Platform, TFile, type App } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { encodeKey, type KeyDescription } from '../../core/terminal/keyboard';
import { findFileReferences } from '../../core/terminal/links';
import { droppedPaths } from '../../core/terminal/paste';
import type { TerminalSettings } from '../../core/terminal/settings';
import { droppedFilePath, openPath, resolveReference, vaultFilePath } from '../../platform/desktop/files';
import type { TerminalSession } from '../../services/terminal/session';
import type { HiddenRendererRetention } from './hidden-renderer-retention';
import { StableTerminalFit } from './stable-terminal-fit';
import { TerminalPresentation } from './terminal-presentation';

export interface TerminalViewHost {
	app: App;
	settings(): TerminalSettings;
	retention: HiddenRendererRetention;
	vaultPath(): string | undefined;
	focused(view: TerminalView): void;
	menu(view: TerminalView, event: MouseEvent): void;
}

export interface SearchOptions {
	caseSensitive: boolean;
	regex: boolean;
}

function cssVar(el: HTMLElement, name: string): string {
	return el.win.getComputedStyle(el).getPropertyValue(name).trim();
}

/** Device-query sequences only the session model answers; a view must not answer them too. */
function swallowQueries(term: Terminal): void {
	const parser = term.parser;
	const swallow = () => true;
	for (const prefix of ['', '>', '=']) parser.registerCsiHandler(prefix ? { prefix, final: 'c' } : { final: 'c' }, swallow);
	parser.registerCsiHandler({ final: 'n' }, swallow);
	parser.registerCsiHandler({ prefix: '?', final: 'n' }, swallow);
	parser.registerCsiHandler({ intermediates: '$', final: 'p' }, swallow);
	parser.registerCsiHandler({ prefix: '?', intermediates: '$', final: 'p' }, swallow);
	parser.registerCsiHandler({ prefix: '>', final: 'q' }, swallow);
	parser.registerCsiHandler({ prefix: '?', final: 'u' }, swallow);
	parser.registerDcsHandler({ intermediates: '$', final: 'q' }, swallow);
	for (const ident of [10, 11, 12]) parser.registerOscHandler(ident, (data) => data === '?');
}

/** One visible terminal bound to a session. Closing the view never ends the session. */
export class TerminalView {
	readonly el: HTMLElement;
	private term?: Terminal;
	private fit?: FitAddon;
	private searchAddon?: SearchAddon;
	private webgl?: WebglAddon;
	private presentation?: TerminalPresentation;
	private fitter?: StableTerminalFit;
	private observer?: ResizeObserver;
	private visible = false;
	private disposed = false;
	private fontDelta = 0;
	private readonly cleanups: Array<() => void> = [];

	constructor(parent: HTMLElement, readonly session: TerminalSession, private readonly host: TerminalViewHost) {
		this.el = parent.createDiv({ cls: 'nand-terminal-view' });
		this.el.dataset.session = session.id;
	}

	private theme(): ITheme {
		const settings = this.host.settings();
		const el = this.el;
		const background = settings.useObsidianTheme ? cssVar(el, '--background-primary') : settings.background || cssVar(el, '--background-primary');
		const foreground = settings.useObsidianTheme ? cssVar(el, '--text-normal') : settings.foreground || cssVar(el, '--text-normal');
		el.style.setProperty('--nand-terminal-background', background);
		return {
			background,
			foreground,
			cursor: foreground,
			cursorAccent: background,
			selectionBackground: cssVar(el, '--text-selection') || 'rgba(128,128,128,0.35)',
		};
	}

	private fontFamily(): string {
		const configured = this.host.settings().fontFamily.trim();
		return configured || cssVar(this.el, '--font-monospace') || 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
	}

	/** Create the xterm presentation (first time the view is shown). */
	private mount(): void {
		if (this.term || this.disposed) return;
		const settings = this.host.settings();
		const term = new Terminal({
			allowProposedApi: true,
			cols: this.session.cols,
			rows: this.session.rows,
			scrollback: settings.scrollback,
			fontFamily: this.fontFamily(),
			fontSize: settings.fontSize + this.fontDelta,
			lineHeight: settings.lineHeight,
			cursorStyle: settings.cursorStyle,
			cursorBlink: settings.cursorBlink,
			theme: this.theme(),
			macOptionIsMeta: false,
			rightClickSelectsWord: false,
			windowsPty: Platform.isWin ? { backend: 'conpty' } : undefined,
		});
		this.term = term;
		this.fit = new FitAddon();
		this.searchAddon = new SearchAddon();
		term.loadAddon(this.fit);
		term.loadAddon(this.searchAddon);
		term.loadAddon(new WebLinksAddon((event, uri) => {
			event.preventDefault();
			window.open(uri);
		}));
		swallowQueries(term);
		term.open(this.el);
		this.loadRenderer();
		term.registerLinkProvider({ provideLinks: (line, callback) => callback(this.fileLinks(line)) });
		term.onData((data) => this.session.input(data));
		term.onBinary((data) => this.session.input(Uint8Array.from(data, (char) => char.charCodeAt(0) & 0xff)));
		term.attachCustomKeyEventHandler((event) => this.key(event));
		term.textarea?.addEventListener('focus', () => this.host.focused(this));
		this.listen(this.el, 'paste', (event: ClipboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			const text = event.clipboardData?.getData('text/plain') ?? '';
			if (text) this.session.paste(text);
		}, true);
		this.listen(this.el, 'contextmenu', (event: MouseEvent) => {
			event.preventDefault();
			this.host.menu(this, event);
		});
		this.listen(this.el, 'dragover', (event: DragEvent) => {
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		});
		this.listen(this.el, 'drop', (event: DragEvent) => this.drop(event));
		this.presentation = new TerminalPresentation({
			subscribe: (output) => this.session.subscribe(output),
			reset: () => term.reset(),
			write: (text, parsed) => term.write(text, parsed),
			beforeReplay: () => undefined,
			afterReplay: () => term.scrollToBottom(),
			error: (error) => console.error('[NAND terminal]', error),
		});
		this.fitter = new StableTerminalFit({
			propose: () => {
				const grid = this.fit?.proposeDimensions();
				return grid && Number.isFinite(grid.cols) && Number.isFinite(grid.rows) ? { cols: grid.cols, rows: grid.rows } : undefined;
			},
			current: () => ({ cols: term.cols, rows: term.rows }),
			measurable: () => this.visible && this.el.isConnected && this.el.clientWidth > 0 && this.el.clientHeight > 0,
			apply: (grid) => {
				term.resize(grid.cols, grid.rows);
				this.session.resize(grid.cols, grid.rows);
				this.presentation?.refresh();
			},
			error: (error) => console.error('[NAND terminal]', error),
		});
		this.observer = new ResizeObserver(() => this.fitter?.request(this.el.win));
		this.observer.observe(this.el);
	}

	private listen<K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, handler: (event: HTMLElementEventMap[K]) => void, capture = false): void {
		el.addEventListener(type, handler, capture);
		this.cleanups.push(() => el.removeEventListener(type, handler, capture));
	}

	private loadRenderer(): void {
		if (!this.term || this.webgl || this.host.settings().renderer !== 'webgl') return;
		try {
			const webgl = new WebglAddon();
			webgl.onContextLoss(() => {
				webgl.dispose();
				if (this.webgl === webgl) this.webgl = undefined;
			});
			this.term.loadAddon(webgl);
			this.webgl = webgl;
		} catch {
			// The DOM renderer stays in use.
		}
	}

	private releaseRenderer(): void {
		this.webgl?.dispose();
		this.webgl = undefined;
	}

	private key(event: KeyboardEvent): boolean {
		const term = this.term;
		if (!term) return true;
		const mod = Platform.isMacOS ? event.metaKey : event.ctrlKey;
		if (event.type === 'keydown') {
			// Copy with a selection (Ctrl+C without one interrupts; Ctrl+Shift+C always copies).
			if (event.key.toLowerCase() === 'c' && ((mod && term.hasSelection()) || (event.ctrlKey && event.shiftKey))) {
				void this.copy();
				event.preventDefault();
				return false;
			}
			// Paste goes through the DOM paste event (sanitized there).
			if (event.key.toLowerCase() === 'v' && (mod || (event.ctrlKey && event.shiftKey))) return false;
		}
		const composing = event.isComposing || event.key === 'Process';
		const description: KeyDescription = {
			type: event.type === 'keyup' ? 'keyup' : 'keydown',
			key: event.key,
			code: event.code,
			shift: event.shiftKey,
			alt: event.altKey,
			ctrl: event.ctrlKey,
			meta: event.metaKey,
			repeat: event.repeat,
			capsLock: event.getModifierState?.('CapsLock') ?? false,
		};
		const modes = this.session.keyboard;
		if (event.type === 'keypress') return !modes.win32;
		const encoded = encodeKey(description, modes, composing);
		if (encoded === undefined) return event.type === 'keydown' || !modes.win32;
		event.preventDefault();
		this.session.input(encoded);
		return false;
	}

	private fileLinks(line: number): ILink[] {
		const term = this.term;
		const text = term?.buffer.active.getLine(line - 1)?.translateToString(true) ?? '';
		return findFileReferences(text).map((ref) => ({
			range: { start: { x: ref.start + 1, y: line }, end: { x: ref.end, y: line } },
			text: text.slice(ref.start, ref.end),
			activate: () => void this.openReference(ref.path, ref.line),
		}));
	}

	private async openReference(reference: string, line?: number): Promise<void> {
		const target = resolveReference(reference, this.session.cwd, this.host.vaultPath());
		if (target?.kind === 'vault') {
			const file = this.host.app.vault.getAbstractFileByPath(target.path);
			if (file instanceof TFile) {
				await this.host.app.workspace.getLeaf('tab').openFile(file, line ? { eState: { line: Math.max(0, line - 1) } } : undefined);
				return;
			}
		} else if (target?.kind === 'external') {
			await openPath(target.path);
			return;
		}
		new Notice(t('agent.referenceMissing'));
	}

	private drop(event: DragEvent): void {
		event.preventDefault();
		const vault = this.host.vaultPath();
		const paths: string[] = [];
		const dragged = (this.host.app as unknown as { dragManager?: { draggable?: { file?: { path: string }; files?: Array<{ path: string }> } } }).dragManager?.draggable;
		const files = dragged?.files ?? (dragged?.file ? [dragged.file] : []);
		if (vault && files.length) {
			for (const file of files) paths.push(vaultFilePath(vault, file.path));
		} else {
			for (const file of Array.from(event.dataTransfer?.files ?? [])) {
				const local = droppedFilePath(file);
				if (local) paths.push(local);
			}
		}
		if (paths.length) {
			this.session.input(droppedPaths(paths, Platform.isWin ? 'win32' : 'posix'));
			return;
		}
		const text = event.dataTransfer?.getData('text/plain');
		if (text) this.session.paste(text);
		else new Notice(t('agent.dropEmpty'));
	}

	setVisible(visible: boolean): void {
		if (this.disposed) return;
		if (visible) this.mount();
		if (visible === this.visible) {
			if (visible) this.fitter?.request(this.el.win);
			return;
		}
		this.visible = visible;
		this.el.toggleClass('is-hidden', !visible);
		if (visible) {
			this.host.retention.release(this);
			this.loadRenderer();
			this.fitter?.request(this.el.win);
		} else {
			this.fitter?.cancel();
			if (this.webgl) this.host.retention.retain(this, () => this.releaseRenderer());
		}
		this.presentation?.setVisible(visible);
	}

	/** Settings changed: font, cursor, theme and renderer follow immediately. */
	applySettings(): void {
		const term = this.term;
		if (!term) return;
		const settings = this.host.settings();
		term.options.fontFamily = this.fontFamily();
		term.options.fontSize = settings.fontSize + this.fontDelta;
		term.options.lineHeight = settings.lineHeight;
		term.options.cursorStyle = settings.cursorStyle;
		term.options.cursorBlink = settings.cursorBlink;
		term.options.scrollback = settings.scrollback;
		term.options.theme = this.theme();
		if (settings.renderer !== 'webgl') this.releaseRenderer();
		else if (this.visible) this.loadRenderer();
		this.fitter?.request(this.el.win);
	}

	focus(): void {
		this.term?.focus();
	}

	get hasSelection(): boolean {
		return !!this.term?.hasSelection();
	}

	async copy(plain = false): Promise<void> {
		const selection = this.term?.getSelection() ?? '';
		if (!selection) return;
		await navigator.clipboard.writeText(plain ? selection.replace(/[ \t]+$/gm, '') : selection);
	}

	async paste(): Promise<void> {
		const text = await navigator.clipboard.readText();
		if (text) this.session.paste(text);
	}

	selectAll(): void {
		this.term?.selectAll();
	}

	selectLine(): void {
		const term = this.term;
		if (!term) return;
		const row = term.buffer.active.baseY + term.buffer.active.cursorY;
		term.selectLines(row, row);
	}

	clear(): void {
		this.term?.clear();
	}

	clearScrollback(): void {
		this.session.clearScrollback();
		this.term?.clear();
	}

	zoom(step: -1 | 0 | 1): void {
		this.fontDelta = step === 0 ? 0 : Math.max(-6, Math.min(16, this.fontDelta + step));
		this.applySettings();
	}

	find(query: string, direction: 'next' | 'previous', options: SearchOptions): boolean {
		if (!this.searchAddon || !query) return false;
		const search = { caseSensitive: options.caseSensitive, regex: options.regex, incremental: false };
		return direction === 'next' ? this.searchAddon.findNext(query, search) : this.searchAddon.findPrevious(query, search);
	}

	clearSearch(): void {
		this.searchAddon?.clearDecorations();
		this.term?.clearSelection();
	}

	/** Scroll to the previous/next prompt or the last failed command (shell integration marks). */
	jump(kind: 'previous' | 'next' | 'failed'): void {
		const term = this.term;
		if (!term) return;
		const prompts = this.session.prompts();
		if (!prompts.lines.length) {
			new Notice(t('agent.noPrompts'));
			return;
		}
		const from = term.buffer.active.viewportY;
		const line = kind === 'failed' ? prompts.lastFailed() : kind === 'previous' ? prompts.previous(from) : prompts.next(from);
		if (line === undefined) {
			if (kind === 'failed') new Notice(t('agent.noFailed'));
			return;
		}
		term.scrollToLine(line);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.host.retention.release(this);
		this.presentation?.dispose();
		this.fitter?.cancel();
		this.observer?.disconnect();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
		this.releaseRenderer();
		this.term?.dispose();
		this.el.remove();
	}
}
