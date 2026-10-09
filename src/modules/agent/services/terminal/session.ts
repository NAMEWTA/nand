import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal as Model, type IMarker } from '@xterm/headless';
import type { AgentId } from '../../core/launch/types';
import { KittyFlags, type KeyboardModes } from '../../core/terminal/keyboard';
import { pasteSequence } from '../../core/terminal/paste';
import { parseOsc133, parseOsc633, parseOsc7, PromptHistory, type ShellMark } from '../../core/terminal/shell-marks';

export type ConnectionState = 'starting' | 'connected' | 'disconnected' | 'exited' | 'failed';
export type Activity = 'unknown' | 'running' | 'waiting' | 'idle' | 'exited';
export type SessionKind = 'shell' | 'agent' | 'preset' | 'automation' | 'script';

/** Output for automation observers: text as it arrives, then the exit. */
export type SessionEvent = { kind: 'data'; text: string } | { kind: 'exit'; code: number } | { kind: 'disconnected' };

export interface SessionPort {
	input(sid: number, data: string | Uint8Array): void;
	resize(sid: number, cols: number, rows: number): void;
	acknowledge(sid: number, bytes: number): void;
	end(sid: number, force: boolean): void;
}

export interface SessionColors {
	foreground: string;
	background: string;
	cursor: string;
}

export interface SessionInit {
	id: string;
	sid: number;
	kind: SessionKind;
	title: string;
	cwd: string;
	agentId?: AgentId;
	automated?: boolean;
	cols: number;
	rows: number;
	scrollback: number;
	platform: string;
	colors: () => SessionColors;
}

interface Subscriber {
	listener: (text: string) => void;
	ready: boolean;
	backlog: string[];
}

/** `#rrggbb` (or `#rgb`) as the `rgb:rrrr/gggg/bbbb` form used in OSC color replies. */
export function oscColor(hex: string): string | undefined {
	let value = hex.trim().replace(/^#/, '');
	if (/^[0-9a-f]{3}$/i.test(value)) value = value.split('').map((c) => c + c).join('');
	if (!/^[0-9a-f]{6}/i.test(value)) return undefined;
	const part = (at: number) => value.slice(at, at + 2).repeat(2).toLowerCase();
	return `rgb:${part(0)}/${part(2)}/${part(4)}`;
}

/**
 * One terminal session. Its headless model is authoritative: every output byte is parsed here first,
 * device queries are answered from here (so hidden and automation sessions never stall), and visible
 * views replay a snapshot of it before following live output.
 */
export class TerminalSession {
	readonly id: string;
	readonly sid: number;
	readonly kind: SessionKind;
	readonly agentId?: AgentId;
	readonly automated: boolean;
	readonly createdAt = Date.now();
	readonly startCwd: string;
	cwd: string;
	connection: ConnectionState = 'starting';
	activity: Activity;
	exitCode?: number;
	error?: string;
	pid?: number;
	private autoTitle: string;
	private userTitle = '';
	private readonly model: Model;
	private readonly serializer = new SerializeAddon();
	private readonly decoder = new TextDecoder('utf-8');
	private readonly subscribers = new Set<Subscriber>();
	private readonly observers = new Set<(event: SessionEvent) => void>();
	private readonly changes = new Set<() => void>();
	private readonly kitty = new KittyFlags();
	private win32 = false;
	private readonly marks: Array<{ marker: IMarker; exitCode?: number }> = [];
	private port?: SessionPort;
	private disposed = false;
	private readonly platform: string;
	private readonly colors: () => SessionColors;

	constructor(init: SessionInit) {
		this.id = init.id;
		this.sid = init.sid;
		this.kind = init.kind;
		this.agentId = init.agentId;
		this.automated = init.automated === true;
		this.autoTitle = init.title;
		this.cwd = this.startCwd = init.cwd;
		this.platform = init.platform;
		this.colors = init.colors;
		this.activity = init.agentId ? 'unknown' : 'idle';
		// Size reports in characters (XTWINOPS 18) come from the model itself.
		this.model = new Model({ cols: init.cols, rows: init.rows, scrollback: init.scrollback, allowProposedApi: true, windowOptions: { getWinSizeChars: true } });
		this.model.loadAddon(this.serializer);
		this.installHandlers();
	}

	private installHandlers(): void {
		const model = this.model;
		// Replies the headless parser produces itself (DA, CPR, DSR, DECRQM, DECRQSS).
		model.onData((data) => this.reply(data));
		model.onBinary((data) => this.reply(data));
		model.onTitleChange((title) => {
			if (!title || title === this.autoTitle) return;
			this.autoTitle = title.slice(0, 200);
			this.changed();
		});
		model.buffer.onBufferChange((buffer) => {
			this.kitty.screen = buffer.type === 'alternate' ? 'alt' : 'main';
		});
		// Kitty keyboard protocol: push, pop, set and query the enhancement flags.
		model.parser.registerCsiHandler({ prefix: '>', final: 'u' }, (params) => {
			this.kitty.push(Number(params[0] ?? 0) || 0);
			return true;
		});
		model.parser.registerCsiHandler({ prefix: '<', final: 'u' }, (params) => {
			this.kitty.pop(Number(params[0] ?? 1) || 1);
			return true;
		});
		model.parser.registerCsiHandler({ prefix: '=', final: 'u' }, (params) => {
			this.kitty.set(Number(params[0] ?? 0) || 0, Number(params[1] ?? 1) || 1);
			return true;
		});
		model.parser.registerCsiHandler({ prefix: '?', final: 'u' }, () => {
			this.reply(this.kitty.report());
			return true;
		});
		// Private mode the model does not track for us: win32-input-mode (9001).
		const privateMode = (enabled: boolean) => (params: (number | number[])[]) => {
			for (const param of params) {
				if (param === 9001) this.win32 = enabled;
			}
			return false;
		};
		model.parser.registerCsiHandler({ prefix: '?', final: 'h' }, privateMode(true));
		model.parser.registerCsiHandler({ prefix: '?', final: 'l' }, privateMode(false));
		// Soft and hard resets clear keyboard enhancements.
		model.parser.registerEscHandler({ final: 'c' }, () => {
			this.kitty.reset();
			this.win32 = false;
			return false;
		});
		// Foreground, background and cursor color queries follow the view's theme.
		for (const [ident, key] of [[10, 'foreground'], [11, 'background'], [12, 'cursor']] as const) {
			model.parser.registerOscHandler(ident, (data) => {
				if (data !== '?') return false;
				const color = oscColor(this.colors()[key]);
				if (color) this.reply(`\x1b]${ident};${color}\x1b\\`);
				return true;
			});
		}
		model.parser.registerOscHandler(133, (data) => this.mark(parseOsc133(data)));
		model.parser.registerOscHandler(633, (data) => this.mark(parseOsc633(data)));
		model.parser.registerOscHandler(7, (data) => this.mark(parseOsc7(data, this.platform)));
	}

	private mark(mark: ShellMark | undefined): boolean {
		if (!mark) return false;
		if (mark.kind === 'cwd') {
			if (mark.cwd && mark.cwd !== this.cwd) {
				this.cwd = mark.cwd;
				this.changed();
			}
		} else if (mark.kind === 'prompt-start') {
			const marker = this.model.registerMarker(0);
			if (marker) {
				this.marks.push({ marker });
				marker.onDispose(() => {
					const index = this.marks.findIndex((entry) => entry.marker === marker);
					if (index >= 0) this.marks.splice(index, 1);
				});
			}
		} else if (mark.kind === 'command-finished') {
			const last = this.marks[this.marks.length - 1];
			if (last && last.exitCode === undefined) last.exitCode = mark.exitCode ?? 0;
		}
		return true;
	}

	private reply(data: string): void {
		if (this.connection === 'connected') this.port?.input(this.sid, data);
	}

	private changed(): void {
		for (const listener of [...this.changes]) listener();
	}

	/** Connected to the helper (the process started). */
	attach(port: SessionPort, pid: number | null): void {
		this.port = port;
		this.pid = pid ?? undefined;
		this.connection = 'connected';
		this.changed();
	}

	fail(message: string): void {
		this.connection = 'failed';
		this.error = message;
		this.activity = 'exited';
		this.writeLocal(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
		this.changed();
	}

	get title(): string {
		return this.userTitle || this.autoTitle;
	}
	get renamed(): boolean {
		return !!this.userTitle;
	}
	rename(title: string): void {
		this.userTitle = title.trim().slice(0, 200);
		this.changed();
	}

	get running(): boolean {
		return this.connection === 'connected' || this.connection === 'starting';
	}

	get keyboard(): KeyboardModes {
		return { kitty: this.kitty.current, win32: this.win32 };
	}
	get bracketedPaste(): boolean {
		return this.model.modes.bracketedPasteMode;
	}
	/** The CLI is waiting for typed input: it enabled bracketed paste. */
	inputReady(): boolean {
		return this.connection === 'connected' && this.model.modes.bracketedPasteMode;
	}
	get cols(): number {
		return this.model.cols;
	}
	get rows(): number {
		return this.model.rows;
	}

	/** Output bytes from the helper. */
	receive(bytes: Uint8Array): void {
		if (this.disposed) return;
		const text = this.decoder.decode(bytes, { stream: true });
		const size = bytes.length;
		this.model.write(text, () => this.port?.acknowledge(this.sid, size));
		if (!text) return;
		this.fanout(text);
		for (const observer of [...this.observers]) observer({ kind: 'data', text });
	}

	private fanout(text: string): void {
		for (const subscriber of this.subscribers) {
			if (subscriber.ready) subscriber.listener(text);
			else subscriber.backlog.push(text);
		}
	}

	private writeLocal(text: string): void {
		this.model.write(text);
		this.fanout(text);
	}

	exit(code: number | null, signal: string | null): void {
		if (this.connection === 'exited') return;
		const tail = this.decoder.decode();
		if (tail) this.receive(new TextEncoder().encode(tail));
		this.connection = 'exited';
		this.activity = 'exited';
		this.exitCode = code ?? (signal ? -1 : 0);
		this.writeLocal(`\r\n\x1b[2m[${signal ? `Process ended: ${signal}` : `Process exited: ${this.exitCode}`}]\x1b[0m\r\n`);
		for (const observer of [...this.observers]) observer({ kind: 'exit', code: this.exitCode });
		this.changed();
	}

	/** The helper went away; the process is gone with it. */
	disconnect(reason: string): void {
		if (!this.running) return;
		this.connection = 'disconnected';
		this.activity = 'exited';
		this.error = reason;
		this.writeLocal(`\r\n\x1b[31m[Terminal helper stopped: ${reason}]\x1b[0m\r\n`);
		for (const observer of [...this.observers]) observer({ kind: 'disconnected' });
		this.changed();
	}

	setActivity(activity: Activity): void {
		if (this.activity === activity || !this.running) return;
		this.activity = activity;
		this.changed();
	}

	input(data: string | Uint8Array): void {
		if (this.connection !== 'connected' || !data.length) return;
		this.port?.input(this.sid, data);
	}

	/** Paste as one block: sanitized and bracketed when the application asked for it. */
	paste(text: string): void {
		this.input(pasteSequence(text, this.bracketedPaste));
	}

	resize(cols: number, rows: number): void {
		cols = Math.max(2, Math.floor(cols));
		rows = Math.max(1, Math.floor(rows));
		if (cols === this.model.cols && rows === this.model.rows) return;
		this.model.resize(cols, rows);
		if (this.connection === 'connected') this.port?.resize(this.sid, cols, rows);
	}

	/** Hang up (or kill with `force`). */
	end(force = false): void {
		if (this.connection === 'connected') this.port?.end(this.sid, force);
	}

	/** Snapshot first, then live output, with nothing lost or repeated in between. */
	subscribe(listener: (text: string) => void): () => void {
		const subscriber: Subscriber = { listener, ready: false, backlog: [] };
		this.subscribers.add(subscriber);
		this.model.write('', () => {
			if (!this.subscribers.has(subscriber)) return;
			listener(this.snapshot());
			for (const text of subscriber.backlog) listener(text);
			subscriber.backlog = [];
			subscriber.ready = true;
		});
		return () => this.subscribers.delete(subscriber);
	}

	snapshot(): string {
		return this.serializer.serialize({ scrollback: this.model.options.scrollback ?? 1000 });
	}

	/** Plain text of the last `lines` rows (automation output, previews). */
	text(lines = 200): string {
		const buffer = this.model.buffer.active;
		const out: string[] = [];
		for (let y = Math.max(0, buffer.length - lines); y < buffer.length; y++) out.push(buffer.getLine(y)?.translateToString(true) ?? '');
		return out.join('\n').replace(/\n+$/, '');
	}

	observe(listener: (event: SessionEvent) => void): () => void {
		this.observers.add(listener);
		return () => this.observers.delete(listener);
	}

	onChange(listener: () => void): () => void {
		this.changes.add(listener);
		return () => this.changes.delete(listener);
	}

	/** Prompt lines (buffer rows) for navigation, with each command's result. */
	prompts(): PromptHistory {
		const history = new PromptHistory();
		for (const { marker, exitCode } of this.marks) {
			if (marker.isDisposed || marker.line < 0) continue;
			history.prompt(marker.line);
			if (exitCode !== undefined) history.finished(exitCode);
		}
		return history;
	}

	clearScrollback(): void {
		this.model.clear();
		this.fanout('\x1b[3J');
	}

	setScrollback(lines: number): void {
		this.model.options.scrollback = lines;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.subscribers.clear();
		this.observers.clear();
		this.changes.clear();
		this.model.dispose();
	}
}
