import type {
	ContributionAccess,
	ContributionPoint,
	Lease,
	ModuleContext,
	ModuleEnvironment,
	ModuleId,
	ModuleInstance,
	ModuleManifest,
	ModuleState,
	ServiceAccess,
	ServiceKey,
} from '../contracts/module';

export interface RegistryHost {
	readonly env: ModuleEnvironment;
	/** The persisted on/off flag of a module. */
	enabled(id: ModuleId): boolean;
	/** Build the context for a new instance; `lifetime` is created and unloaded by the host. */
	createContext(manifest: ModuleManifest, services: ServiceAccess, contributions: ContributionAccess): ModuleContext;
	/** Release the context's lifetime component. */
	releaseContext(context: ModuleContext): void;
	/** A module failed to load, activate or dispose; other modules continue. */
	report(id: ModuleId, phase: 'activate' | 'dispose', error: unknown): void;
}

interface Entry {
	manifest: ModuleManifest;
	state: ModuleState;
	instance?: ModuleInstance;
	context?: ModuleContext;
	controller?: AbortController;
	error?: unknown;
	/** Serializes this module's transitions. */
	tail: Promise<void>;
	activating?: Promise<boolean>;
}

const key = (value: { owner: ModuleId; id: string }) => `${value.owner}:${value.id}`;

/**
 * Owns module instances. Each module moves through
 * off/unsupported → idle → loading → active → disposing → idle|off, or failed (retried on the next apply).
 * Failures are isolated: a module that throws is marked failed and every other module continues.
 */
export class ModuleRegistry {
	private readonly entries = new Map<ModuleId, Entry>();
	private readonly providers = new Map<string, { value: unknown; owner: ModuleId }>();
	private readonly serviceWatchers = new Map<string, Set<(value: unknown) => void>>();
	private readonly contributions = new Map<string, Map<ModuleId, unknown>>();
	private readonly contributionWatchers = new Map<string, Set<() => void>>();
	private readonly listeners = new Set<() => void>();
	private applying: Promise<void> = Promise.resolve();
	private disposed = false;

	readonly services: ServiceAccess = {
		peek: <T>(service: ServiceKey<T>) => this.providers.get(key(service))?.value as T | undefined,
		acquire: async <T>(service: ServiceKey<T>, signal?: AbortSignal): Promise<Lease<T> | undefined> => {
			if (!(await this.activate(service.owner)) || signal?.aborted) return undefined;
			const provider = this.providers.get(key(service));
			const entry = this.entries.get(service.owner);
			if (!provider || !entry?.controller) return undefined;
			return { value: provider.value as T, revoked: entry.controller.signal };
		},
		watch: <T>(service: ServiceKey<T>, listener: (value: T | undefined) => void) => {
			const id = key(service);
			const set = this.serviceWatchers.get(id) ?? new Set<(value: unknown) => void>();
			const wrapped = (value: unknown) => listener(value as T | undefined);
			set.add(wrapped);
			this.serviceWatchers.set(id, set);
			return () => set.delete(wrapped);
		},
	};

	readonly contributionAccess: ContributionAccess = {
		collect: async <T>(point: ContributionPoint<T>, options?: { activate?: boolean }) => {
			if (options?.activate) {
				const owners = [...this.entries.values()].filter((entry) => entry.manifest.contributes?.some((item) => key(item) === key(point)));
				await Promise.all(owners.map((entry) => this.activate(entry.manifest.id)));
			}
			const values = this.contributions.get(key(point)) ?? new Map<ModuleId, unknown>();
			return [...values].map(([module, value]) => ({ module, value: value as T }));
		},
		watch: (point, listener) => {
			const id = key(point);
			const set = this.contributionWatchers.get(id) ?? new Set();
			set.add(listener);
			this.contributionWatchers.set(id, set);
			return () => set.delete(listener);
		},
	};

	constructor(
		manifests: readonly ModuleManifest[],
		private readonly host: RegistryHost,
	) {
		for (const manifest of [...manifests].sort((a, b) => a.order - b.order)) {
			if (this.entries.has(manifest.id)) throw new Error(`Duplicate module ${manifest.id}`);
			this.entries.set(manifest.id, { manifest, state: 'off', tail: Promise.resolve() });
		}
	}

	manifests(): ModuleManifest[] {
		return [...this.entries.values()].map((entry) => entry.manifest);
	}

	state(id: ModuleId): ModuleState {
		return this.entries.get(id)?.state ?? 'off';
	}

	instance<T extends ModuleInstance = ModuleInstance>(id: ModuleId): T | undefined {
		const entry = this.entries.get(id);
		return entry?.state === 'active' ? (entry.instance as T) : undefined;
	}

	error(id: ModuleId): unknown {
		return this.entries.get(id)?.error;
	}

	supported(id: ModuleId): boolean {
		const manifest = this.entries.get(id)?.manifest;
		if (!manifest) return false;
		return this.host.env.desktop ? manifest.platforms.desktop : manifest.platforms.mobile;
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Reconcile every module with its flag. Disabled modules are disposed in reverse order, then
	 * enabled modules whose activation matches `phases` are activated in order. Calls are serialized.
	 */
	apply(phases: ReadonlyArray<'startup' | 'layout-ready'> = ['startup']): Promise<void> {
		const run = this.applying.then(async () => {
			const entries = [...this.entries.values()];
			for (const entry of [...entries].reverse()) {
				const id = entry.manifest.id;
				if (this.host.enabled(id) && this.supported(id)) continue;
				await this.deactivate(id, 'disabled');
				this.setState(entry, this.supported(id) ? 'off' : 'unsupported');
			}
			for (const entry of entries) {
				const id = entry.manifest.id;
				if (!this.host.enabled(id) || !this.supported(id)) continue;
				if (entry.state === 'off' || entry.state === 'unsupported') this.setState(entry, 'idle');
				const activation = entry.manifest.activation;
				if (activation !== 'on-demand' && phases.includes(activation)) await this.activate(id);
			}
		});
		this.applying = run.catch(() => undefined);
		return run;
	}

	/** Activate one module (no-op when active); resolves false when it is off, unsupported or failed. */
	activate(id: ModuleId): Promise<boolean> {
		const entry = this.entries.get(id);
		if (!entry || this.disposed) return Promise.resolve(false);
		if (entry.state === 'active') return Promise.resolve(true);
		if (!this.host.enabled(id) || !this.supported(id)) return Promise.resolve(false);
		if (entry.activating) return entry.activating;
		const run = this.transition(entry, async () => {
			if (entry.state === 'active') return true;
			if (!this.host.enabled(id) || !this.supported(id) || this.disposed) return false;
			this.setState(entry, 'loading');
			const controller = new AbortController();
			const context = this.host.createContext(entry.manifest, this.services, this.contributionAccess);
			let instance: ModuleInstance | undefined;
			try {
				const { default: factory } = await entry.manifest.load();
				instance = await factory(context);
				await instance.activate?.(controller.signal);
			} catch (error) {
				entry.error = error;
				try {
					await instance?.dispose('disabled');
				} catch {
					// The original activation error is what is reported.
				}
				this.host.releaseContext(context);
				this.setState(entry, 'failed');
				this.host.report(id, 'activate', error);
				return false;
			}
			entry.instance = instance;
			entry.context = context;
			entry.controller = controller;
			entry.error = undefined;
			for (const [service, value] of instance.services ?? []) this.provide(service, value, id);
			for (const [point, value] of instance.contributions ?? []) this.contribute(point, id, value);
			this.setState(entry, 'active');
			return true;
		});
		entry.activating = run.finally(() => {
			entry.activating = undefined;
		});
		return entry.activating;
	}

	/** Dispose every module (reverse order) and refuse further activation. */
	async dispose(): Promise<void> {
		await this.applying;
		const entries = [...this.entries.values()].reverse();
		for (const entry of entries) await this.deactivate(entry.manifest.id, 'unload');
		this.disposed = true;
		this.listeners.clear();
	}

	/**
	 * Plugin unload (Obsidian does not await `onunload`): dispose active modules in reverse order without
	 * waiting for asynchronous cleanup. Errors are reported, never thrown.
	 */
	disposeNow(): void {
		this.disposed = true;
		for (const entry of [...this.entries.values()].reverse()) {
			const id = entry.manifest.id;
			if (entry.state !== 'active' || !entry.instance) continue;
			entry.controller?.abort();
			this.withdraw(id);
			try {
				const result = entry.instance.dispose('unload');
				if (result instanceof Promise) result.catch((error: unknown) => this.host.report(id, 'dispose', error));
			} catch (error) {
				this.host.report(id, 'dispose', error);
			}
			if (entry.context) this.host.releaseContext(entry.context);
			entry.instance = undefined;
			entry.context = undefined;
			entry.controller = undefined;
			entry.state = 'off';
		}
		this.listeners.clear();
	}

	private deactivate(id: ModuleId, reason: 'disabled' | 'unload'): Promise<void> {
		const entry = this.entries.get(id);
		if (!entry) return Promise.resolve();
		return this.transition(entry, async () => {
			if (entry.state === 'failed') {
				entry.error = undefined;
				return;
			}
			if (entry.state !== 'active' || !entry.instance) return;
			const { instance, context, controller } = entry;
			this.setState(entry, 'disposing');
			controller?.abort();
			this.withdraw(id);
			try {
				await instance.dispose(reason);
			} catch (error) {
				this.host.report(id, 'dispose', error);
			}
			if (context) this.host.releaseContext(context);
			entry.instance = undefined;
			entry.context = undefined;
			entry.controller = undefined;
			this.setState(entry, 'idle');
		});
	}

	private transition<T>(entry: Entry, step: () => Promise<T>): Promise<T> {
		const run = entry.tail.then(step);
		entry.tail = run.then(() => undefined, () => undefined);
		return run;
	}

	private provide(service: ServiceKey<unknown>, value: unknown, owner: ModuleId): void {
		this.providers.set(key(service), { value, owner });
		for (const listener of [...(this.serviceWatchers.get(key(service)) ?? [])]) listener(value);
	}

	private contribute(point: ContributionPoint<unknown>, owner: ModuleId, value: unknown): void {
		const values = this.contributions.get(key(point)) ?? new Map<ModuleId, unknown>();
		values.set(owner, value);
		this.contributions.set(key(point), values);
		for (const listener of [...(this.contributionWatchers.get(key(point)) ?? [])]) listener();
	}

	private withdraw(owner: ModuleId): void {
		for (const [id, provider] of [...this.providers]) {
			if (provider.owner !== owner) continue;
			this.providers.delete(id);
			for (const listener of [...(this.serviceWatchers.get(id) ?? [])]) listener(undefined);
		}
		for (const [id, values] of this.contributions) {
			if (!values.delete(owner)) continue;
			for (const listener of [...(this.contributionWatchers.get(id) ?? [])]) listener();
		}
	}

	private setState(entry: Entry, state: ModuleState): void {
		if (entry.state === state) return;
		entry.state = state;
		for (const listener of [...this.listeners]) listener();
	}
}
