/**
 * Screen replay is serialized with live writes. Adapted from Orca v1.4.217
 * terminal-structural-replay-coordinator.ts (MIT, Lovecast Inc., 2026).
 * NAND's headless session is authoritative; a hidden presentation retains no ANSI tail.
 */
export interface TerminalPresentationPort {
	subscribe(output: (text: string) => void): () => void;
	reset(): void;
	write(text: string, parsed: () => void): void;
	beforeReplay(): void;
	afterReplay(): void;
	error(error: unknown): void;
}
type PresentationTask =
	| { kind: 'replay'; generation: number }
	| { kind: 'write'; generation: number; text: string; snapshot: boolean }
	| { kind: 'action'; generation: number; run: () => void };

export class TerminalPresentation {
	private visible = false;
	private disposed = false;
	private generation = 0;
	private queue: PresentationTask[] = [];
	private pendingChars = 0;
	private busy = false;
	private awaitingSnapshot = false;
	private unsubscribe: (() => void) | null = null;
	private completeWrite: (() => void) | null = null;
	private port: TerminalPresentationPort;
	private maxPendingChars: number;
	constructor(port: TerminalPresentationPort, maxPendingChars = 2_000_000) {
		this.port = port;
		this.maxPendingChars = maxPendingChars;
	}
	setVisible(visible: boolean): void {
		if (this.disposed || visible === this.visible) return;
		this.visible = visible;
		this.invalidate();
		if (visible) this.replay();
	}
	/** A grid change invalidates queued output interpreted in the previous geometry. */
	refresh(): void {
		if (!this.visible || this.disposed) return;
		this.invalidate();
		this.replay();
	}
	afterParsed(run: () => void): void {
		if (!this.visible || this.disposed) return;
		this.queue.push({ kind: 'action', generation: this.generation, run });
		this.drain();
	}
	private invalidate(): void {
		this.generation++;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.queue = [];
		this.pendingChars = 0;
		this.awaitingSnapshot = false;
	}
	private replay(): void {
		this.queue.push({ kind: 'replay', generation: this.generation });
		this.drain();
	}
	private enqueue(text: string, generation: number, snapshot: boolean): void {
		if (!this.visible || generation !== this.generation || this.disposed) return;
		const task: PresentationTask = { kind: 'write', generation, text, snapshot };
		if (snapshot) {
			this.awaitingSnapshot = false;
			this.queue.unshift(task);
		} else this.queue.push(task);
		if (!snapshot) this.pendingChars += text.length;
		if (!snapshot && this.pendingChars > this.maxPendingChars) {
			// Never splice escape sequences. Recover the current screen after the active write.
			this.invalidate();
			this.replay();
			return;
		}
		this.drain();
	}
	private drain(): void {
		if (this.busy || this.awaitingSnapshot || !this.visible || this.disposed) return;
		this.busy = true;
		void this.process().catch((error) => { this.invalidate(); this.port.error(error); }).finally(() => {
			this.busy = false;
			if (this.visible && !this.awaitingSnapshot && this.queue.length) this.drain();
		});
	}
	private async process(): Promise<void> {
		while (this.visible && !this.disposed) {
			if (this.awaitingSnapshot) return;
			const task = this.queue.shift();
			if (!task) return;
			if (task.generation !== this.generation) continue;
			if (task.kind === 'action') {
				task.run();
				continue;
			}
			if (task.kind === 'replay') {
				this.port.beforeReplay();
				this.port.reset();
				this.awaitingSnapshot = true;
				let snapshot = true;
				const unsubscribe = this.port.subscribe((text) => {
					const initial = snapshot;
					snapshot = false;
					this.enqueue(text, task.generation, initial);
				});
				if (task.generation !== this.generation || !this.visible || this.disposed) unsubscribe();
				else this.unsubscribe = unsubscribe;
				continue;
			}
			if (!task.snapshot) this.pendingChars -= task.text.length;
			await new Promise<void>((resolve, reject) => {
				this.completeWrite = resolve;
				try { this.port.write(task.text, resolve); }
				catch (error) { this.completeWrite = null; reject(error instanceof Error ? error : new Error(String(error))); }
			});
			this.completeWrite = null;
			if (task.snapshot && task.generation === this.generation && this.visible && !this.disposed) this.port.afterReplay();
		}
	}
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.visible = false;
		this.invalidate();
		// xterm disposal may discard its pending write callback.
		this.completeWrite?.();
		this.completeWrite = null;
	}
}
