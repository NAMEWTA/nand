/** One mount owns one abort signal and an exactly-once cleanup set, including late async resources. */
export class WidgetLifetime {
	private readonly controller = new AbortController();
	private readonly resources = new Set<() => void>();
	private readonly registered = new WeakSet<() => void>();
	constructor(private readonly onError: (error: unknown) => void) {}
	get signal(): AbortSignal { return this.controller.signal; }
	register = (dispose: () => void): void => {
		if (this.registered.has(dispose)) return;
		this.registered.add(dispose);
		if (this.signal.aborted) this.release(dispose);
		else this.resources.add(dispose);
	};
	dispose = (): void => {
		if (this.signal.aborted) return;
		this.controller.abort();
		for (const dispose of this.resources) this.release(dispose);
		this.resources.clear();
	};
	private release(dispose: () => void): void { try { dispose(); } catch (error) { this.onError(error); } }
}
