import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
	encodeControl,
	encodeInput,
	FrameDecoder,
	FRAME_CONTROL,
	FRAME_OUTPUT,
	HELPER_PROTOCOL,
} from '../../../core/terminal/frames';

export interface HelperEvents {
	output(session: number, bytes: Uint8Array): void;
	exit(session: number, code: number | null, signal: string | null): void;
	/** The helper process ended (crash, kill or shutdown). */
	closed(reason: string): void;
}

export interface SpawnOptions {
	file: string;
	args: string[];
	cwd?: string;
	env: Record<string, string>;
	cols: number;
	rows: number;
}

interface Pending<T> {
	resolve(value: T): void;
	reject(error: Error): void;
}

const HANDSHAKE_TIMEOUT = 10_000;
const HISTORY_TIMEOUT = 120_000;

/** One native helper process: sessions and history requests over framed stdio. */
export class PtyHelper {
	private readonly decoder = new FrameDecoder();
	private readonly spawns = new Map<number, Pending<number | null>>();
	private readonly requests = new Map<string, Pending<unknown> & { cleanup(): void }>();
	private hello?: Pending<Record<string, unknown>>;
	private ended = false;
	private stderr = '';
	pid = 0;
	version = '';

	private constructor(private readonly child: ChildProcessWithoutNullStreams, private readonly events: HelperEvents, private readonly win: Window) {
		child.stdout.on('data', (chunk: Buffer) => this.receive(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
		child.stderr.on('data', (chunk: Buffer) => { this.stderr = (this.stderr + chunk.toString('utf8')).slice(-4000); });
		child.on('error', (error) => this.close(error.message));
		child.on('exit', (code, signal) => this.close(signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`));
		child.stdin.on('error', () => undefined);
	}

	/** Start the helper and complete the protocol handshake. */
	static async start(binary: string, events: HelperEvents, win: Window = window): Promise<PtyHelper> {
		const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
		const helper = new PtyHelper(child, events, win);
		const hello = await new Promise<Record<string, unknown>>((resolve, reject) => {
			const timer = win.setTimeout(() => reject(new Error('The terminal helper did not answer the handshake')), HANDSHAKE_TIMEOUT);
			helper.hello = {
				resolve: (message) => { win.clearTimeout(timer); resolve(message); },
				reject: (error) => { win.clearTimeout(timer); reject(error); },
			};
			helper.send({ type: 'hello', protocol: HELPER_PROTOCOL });
		}).catch((error: unknown) => {
			helper.dispose();
			throw error instanceof Error ? error : new Error(String(error));
		});
		if (hello.accepted !== true || hello.protocol !== HELPER_PROTOCOL) {
			helper.dispose();
			throw new Error(`The terminal helper speaks protocol ${String(hello.protocol)}; this plugin needs ${HELPER_PROTOCOL}. Install the matching release.`);
		}
		helper.pid = typeof hello.pid === 'number' ? hello.pid : 0;
		helper.version = typeof hello.version === 'string' ? hello.version : '';
		return helper;
	}

	get alive(): boolean {
		return !this.ended;
	}

	private send(message: Record<string, unknown>): void {
		this.write(encodeControl(message));
	}

	private write(bytes: Uint8Array): void {
		if (this.ended) return;
		this.child.stdin.write(bytes);
	}

	private receive(chunk: Uint8Array): void {
		let frames;
		try {
			frames = this.decoder.push(chunk);
		} catch (error) {
			this.close(error instanceof Error ? error.message : String(error));
			this.child.kill();
			return;
		}
		for (const frame of frames) {
			if (frame.kind === FRAME_OUTPUT) this.events.output(frame.session, frame.bytes);
			else if (frame.kind === FRAME_CONTROL) this.control(frame.message);
		}
	}

	private control(message: Record<string, unknown>): void {
		const sid = typeof message.sid === 'number' ? message.sid : -1;
		switch (message.type) {
			case 'hello':
				this.hello?.resolve(message);
				this.hello = undefined;
				return;
			case 'spawned':
				this.spawns.get(sid)?.resolve(typeof message.pid === 'number' ? message.pid : null);
				this.spawns.delete(sid);
				return;
			case 'spawn-failed':
				this.spawns.get(sid)?.reject(new Error(typeof message.message === 'string' ? message.message : 'The session could not start'));
				this.spawns.delete(sid);
				return;
			case 'exit':
				this.events.exit(sid, typeof message.code === 'number' ? message.code : null, typeof message.signal === 'string' ? message.signal : null);
				return;
			case 'history-result': {
				const id = typeof message.rid === 'string' ? message.rid : '';
				const pending = this.requests.get(id);
				if (!pending) return;
				this.requests.delete(id);
				pending.cleanup();
				if (typeof message.error === 'string') pending.reject(new Error(message.error));
				else pending.resolve(message.data);
				return;
			}
			case 'error':
				console.warn('[NAND terminal helper]', message.message);
		}
	}

	spawnSession(sid: number, options: SpawnOptions): Promise<number | null> {
		if (this.ended) return Promise.reject(new Error('The terminal helper is not running'));
		return new Promise((resolve, reject) => {
			this.spawns.set(sid, { resolve, reject });
			this.send({ type: 'spawn', sid, file: options.file, args: options.args, cwd: options.cwd ?? null, env: options.env, cols: options.cols, rows: options.rows });
		});
	}

	input(sid: number, data: string | Uint8Array): void {
		this.write(encodeInput(sid, data));
	}

	resize(sid: number, cols: number, rows: number): void {
		this.send({ type: 'resize', sid, cols: Math.max(1, Math.floor(cols)), rows: Math.max(1, Math.floor(rows)) });
	}

	acknowledge(sid: number, bytes: number): void {
		if (bytes > 0) this.send({ type: 'ack', sid, bytes });
	}

	end(sid: number, force = false): void {
		this.send({ type: 'end', sid, force });
	}

	history<T>(op: 'scan' | 'query' | 'read', payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
		if (this.ended) return Promise.reject(new Error('History service disconnected'));
		return new Promise<T>((resolve, reject) => {
			const rid = crypto.randomUUID();
			const cancel = () => {
				this.send({ type: 'history', op: 'cancel', rid });
				const pending = this.requests.get(rid);
				this.requests.delete(rid);
				pending?.cleanup();
				reject(new Error('History request cancelled'));
			};
			const timer = this.win.setTimeout(cancel, HISTORY_TIMEOUT);
			this.requests.set(rid, {
				resolve: (value) => resolve(value as T),
				reject,
				cleanup: () => {
					this.win.clearTimeout(timer);
					signal?.removeEventListener('abort', cancel);
				},
			});
			signal?.addEventListener('abort', cancel, { once: true });
			if (signal?.aborted) return cancel();
			this.send({ type: 'history', op, rid, payload });
		});
	}

	private close(reason: string): void {
		if (this.ended) return;
		this.ended = true;
		const detail = this.stderr.trim() ? `${reason}: ${this.stderr.trim().split('\n').pop()}` : reason;
		const error = new Error(`The terminal helper stopped (${detail})`);
		this.hello?.reject(error);
		for (const pending of this.spawns.values()) pending.reject(error);
		this.spawns.clear();
		for (const pending of this.requests.values()) {
			pending.cleanup();
			pending.reject(new Error('History service disconnected'));
		}
		this.requests.clear();
		this.events.closed(detail);
	}

	/** Close stdin (the helper ends its sessions and exits); kill it if it lingers. */
	dispose(): void {
		if (!this.ended) {
			try {
				this.child.stdin.end();
			} catch {
				// Already closed.
			}
			const child = this.child;
			this.win.setTimeout(() => {
				if (child.exitCode === null && child.signalCode === null) child.kill();
			}, 4000);
		}
		this.close('closed');
	}
}
