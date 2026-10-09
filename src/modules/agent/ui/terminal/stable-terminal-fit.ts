/** Stable-grid scheduling adapted from Orca v1.4.217 pane-fit-resize-observer.ts.
 * MIT, Copyright (c) 2026 Lovecast Inc. Uses public FitAddon/xterm APIs only.
 */
export interface TerminalGrid { cols: number; rows: number }
export interface StableTerminalFitPort {
	propose(): TerminalGrid | undefined;
	current(): TerminalGrid;
	measurable(): boolean;
	apply(grid: TerminalGrid): void;
	error?(error: unknown): void;
}
function equal(a: TerminalGrid | undefined, b: TerminalGrid | undefined): boolean {
	return !!a && !!b && a.cols === b.cols && a.rows === b.rows;
}
export class StableTerminalFit {
	private win: Window | null = null;
	private frame: number | null = null;
	private port: StableTerminalFitPort;
	constructor(port: StableTerminalFitPort) { this.port = port; }
	request(win: Window): void {
		if (this.win !== win) this.cancel();
		if (this.frame !== null || !this.port.measurable()) return;
		this.win = win;
		let previous: TerminalGrid | undefined, frames = 0;
		const sample = () => {
			this.frame = null;
			if (!this.port.measurable() || this.win !== win) return;
			let grid: TerminalGrid | undefined;
			try { grid = this.port.propose(); }
			catch (error) { this.port.error?.(error); return; }
			if (!grid || grid.cols < 2 || grid.rows < 1) return;
			frames++;
			if (equal(grid, this.port.current())) return;
			if (equal(grid, previous) || frames >= 8) {
				this.port.apply(grid);
				return;
			}
			previous = grid;
			this.frame = win.requestAnimationFrame(sample);
		};
		this.frame = win.requestAnimationFrame(sample);
	}
	cancel(): void {
		if (this.frame !== null) this.win?.cancelAnimationFrame(this.frame);
		this.frame = null;
		this.win = null;
	}
}
