import type { Schema, SettingsScope } from './schema';

/** On-disk shape of both settings files (`version` marks the namespaced layout). */
export interface SettingsFile {
	version: 1;
	namespaces: Record<string, Record<string, unknown>>;
}

export interface SettingsPersistence {
	load(scope: SettingsScope): Promise<SettingsFile | null>;
	save(scope: SettingsScope, file: SettingsFile): Promise<void>;
}

export interface SettingsTimers {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

export type SaveStatus = 'idle' | 'saving' | 'error';

export interface SettingsHandle<T extends object> {
	/** The current committed value. Treat as read-only; change it with `update`. */
	get(): T;
	/**
	 * Commit a change in memory (subscribers run synchronously), then persist.
	 * The returned promise settles when the write that includes this change finishes.
	 */
	update(recipe: (draft: T) => void | T, options?: { persist?: 'debounced' | 'immediate' }): Promise<void>;
	/** Run `listener` when the selected value changes (compared with `equal`, default `Object.is`). */
	select<R>(selector: (value: T) => R, listener: (next: R, previous: R) => void, equal?: (a: R, b: R) => boolean): () => void;
	subscribe(listener: () => void): () => void;
	/** Persist after an in-place mutation made outside `update` (for callers that hold a reference to the value). */
	touch(options?: { persist?: 'debounced' | 'immediate' }): Promise<void>;
}

interface Namespace {
	schema: Schema<object>;
	value: object;
	listeners: Set<() => void>;
}


/**
 * Namespaced settings with typed schemas, synchronous change notification and debounced persistence.
 * Namespaces that no code has bound yet keep their raw stored values and are written back unchanged,
 * so modules can adopt the store one at a time.
 */
export class SettingsStore {
	private readonly raw: Record<SettingsScope, Record<string, Record<string, unknown>>> = { vault: {}, device: {} };
	private readonly namespaces = new Map<string, Namespace>();
	private readonly statusListeners = new Set<(status: SaveStatus) => void>();
	private timer: unknown;
	private firstPending = 0;
	private waiting: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];
	private writing: Promise<void> = Promise.resolve();
	private currentStatus: SaveStatus = 'idle';
	private readonly persistedListeners = new Set<() => void>();
	private disposed = false;

	constructor(
		private readonly persistence: SettingsPersistence,
		/** `timers` is injected so the host decides which window owns them (popout windows). */
		private readonly options: { timers: SettingsTimers; debounceMs?: number; maxWaitMs?: number; now?: () => number },
	) {}

	/** Read both files; a file that is not in the namespaced layout is ignored (defaults apply). */
	async load(): Promise<void> {
		for (const scope of ['vault', 'device'] as const) {
			const file: unknown = await this.persistence.load(scope);
			if (isSettingsFile(file)) this.raw[scope] = structuredClone(file.namespaces);
		}
	}

	/** True when neither file existed (first run). */
	get empty(): boolean {
		return !Object.keys(this.raw.vault).length && !Object.keys(this.raw.device).length;
	}

	/** Bind a namespace to its schema; the stored value is normalized once. */
	bind<T extends object>(name: string, schema: Schema<T>): SettingsHandle<T> {
		let namespace = this.namespaces.get(name);
		if (!namespace) {
			const stored = { ...(this.raw.vault[name] ?? {}), ...(this.raw.device[name] ?? {}) };
			const hasValue = name in this.raw.vault || name in this.raw.device;
			namespace = { schema, value: schema.normalize(hasValue ? stored : undefined), listeners: new Set() };
			this.namespaces.set(name, namespace);
		}
		return this.handle<T>(name, namespace);
	}

	/** The handle of a namespace bound earlier (undefined when nothing bound it yet). */
	handleOf<T extends object>(name: string): SettingsHandle<T> | undefined {
		const namespace = this.namespaces.get(name);
		return namespace ? this.handle<T>(name, namespace) : undefined;
	}

	onStatus(listener: (status: SaveStatus) => void): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	/** Runs after every successful write (once per coalesced batch). */
	onPersisted(listener: () => void): () => void {
		this.persistedListeners.add(listener);
		return () => this.persistedListeners.delete(listener);
	}

	get status(): SaveStatus {
		return this.currentStatus;
	}

	/** Write pending changes now. */
	flush(): Promise<void> {
		return this.schedule('immediate');
	}

	/** Flush and stop accepting writes. */
	async dispose(): Promise<void> {
		if (this.timer !== undefined) await this.flush();
		await this.writing.catch(() => undefined);
		this.disposed = true;
	}

	private handle<T extends object>(name: string, namespace: Namespace): SettingsHandle<T> {
		const notify = () => {
			for (const listener of [...namespace.listeners]) listener();
		};
		return {
			get: () => namespace.value as T,
			update: (recipe, options) => {
				const draft = structuredClone(namespace.value) as T;
				const returned = recipe(draft);
				namespace.value = namespace.schema.normalize(returned === undefined ? draft : returned);
				notify();
				return this.schedule(options?.persist ?? 'debounced');
			},
			select: (selector, listener, equal = Object.is) => {
				let previous = selector(namespace.value as T);
				const run = () => {
					const next = selector(namespace.value as T);
					if (equal(next, previous)) return;
					const before = previous;
					previous = next;
					listener(next, before);
				};
				namespace.listeners.add(run);
				return () => namespace.listeners.delete(run);
			},
			subscribe: (listener) => {
				namespace.listeners.add(listener);
				return () => namespace.listeners.delete(listener);
			},
			touch: (options) => {
				notify();
				return this.schedule(options?.persist ?? 'debounced');
			},
		};
	}

	private schedule(mode: 'debounced' | 'immediate'): Promise<void> {
		if (this.disposed) return Promise.reject(new Error('Settings store is disposed'));
		const promise = new Promise<void>((resolve, reject) => this.waiting.push({ resolve, reject }));
		const timers = this.options.timers;
		const now = this.options.now ?? (() => Date.now());
		if (this.timer === undefined) this.firstPending = now();
		if (this.timer !== undefined) timers.clear(this.timer);
		const waited = now() - this.firstPending;
		const delay = mode === 'immediate' ? 0 : Math.max(0, Math.min(this.options.debounceMs ?? 250, (this.options.maxWaitMs ?? 1000) - waited));
		this.timer = timers.set(() => {
			this.timer = undefined;
			this.write();
		}, delay);
		return promise;
	}

	private write(): void {
		const batch = this.waiting;
		this.waiting = [];
		const files = this.snapshot();
		this.setStatus('saving');
		this.writing = this.writing
			.catch(() => undefined)
			.then(async () => {
				await this.persistence.save('vault', files.vault);
				await this.persistence.save('device', files.device);
			})
			.then(
				() => {
					this.setStatus('idle');
					for (const waiter of batch) waiter.resolve();
					for (const listener of [...this.persistedListeners]) listener();
				},
				(error: unknown) => {
					this.setStatus('error');
					for (const waiter of batch) waiter.reject(error);
				},
			);
	}

	private snapshot(): Record<SettingsScope, SettingsFile> {
		const files: Record<SettingsScope, SettingsFile> = {
			vault: { version: 1, namespaces: structuredClone(this.raw.vault) },
			device: { version: 1, namespaces: structuredClone(this.raw.device) },
		};
		for (const [name, namespace] of this.namespaces) {
			for (const scope of ['vault', 'device'] as const) {
				const part = namespace.schema.pick(namespace.value, scope) as Record<string, unknown>;
				if (Object.keys(part).length) files[scope].namespaces[name] = structuredClone(part);
				else delete files[scope].namespaces[name];
			}
		}
		return files;
	}

	private setStatus(status: SaveStatus): void {
		if (this.currentStatus === status) return;
		this.currentStatus = status;
		for (const listener of [...this.statusListeners]) listener(status);
	}
}

function isSettingsFile(value: unknown): value is SettingsFile {
	return !!value && typeof value === 'object' && (value as { version?: unknown }).version === 1
		&& !!(value as { namespaces?: unknown }).namespaces && typeof (value as { namespaces?: unknown }).namespaces === 'object';
}
