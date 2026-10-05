import type { ModuleGates } from './settings/nav';

export interface ModuleEffects {
	before?: (flags: Readonly<ModuleGates>) => Promise<void>;
	browser?: (enabled: boolean) => void;
	automation: (enabled: boolean) => Promise<void>;
	contacts: (enabled: boolean) => Promise<void>;
	dashboard: (enabled: boolean) => Promise<void> | void;
	editor: (enabled: boolean) => Promise<void> | void;
	iconic: (enabled: boolean) => Promise<void>;
	terminalActive: () => boolean;
	terminal: (enabled: boolean) => Promise<void>;
}

/** Serialize module transitions without replacing an already running terminal. */
export class ModuleLifecycle {
	private pending: Promise<void> = Promise.resolve();
	private disposed = false;

	apply(readFlags: () => ModuleGates, desktop: boolean, effects: ModuleEffects): Promise<void> {
		const next = this.pending.then(async () => {
			if (this.disposed) return;
			const flags = { ...readFlags() };
			await effects.before?.(flags);
			if (this.disposed) return;
			effects.browser?.(flags.browser);
			// Stop owned automation work before another module can remove its runtime.
			if (!flags.automation) await effects.automation(false);
			if (this.disposed) return;
			await effects.dashboard(flags.dashboard);
			if (this.disposed) return;
			await effects.editor(flags.editor);
			if (this.disposed) return;
			await effects.contacts(flags.contacts);
			if (this.disposed) return;
			const terminal = desktop && flags.terminal;
			if (terminal !== effects.terminalActive()) await effects.terminal(terminal);
			if (this.disposed) return;
			await effects.iconic(flags.iconic);
			if (!this.disposed && flags.automation) await effects.automation(true);
		});
		// Keep the caller's rejection, but allow a later request to recover.
		this.pending = next.catch(() => undefined);
		return next;
	}

	dispose(): void {
		this.disposed = true;
	}
}
