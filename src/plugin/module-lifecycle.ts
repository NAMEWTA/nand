import type { ModuleGates } from './settings/nav';

export interface ModuleEffects {
	dashboard: (enabled: boolean) => Promise<void> | void;
	editor: (enabled: boolean) => void;
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
			await effects.dashboard(flags.dashboard);
			if (this.disposed) return;
			effects.editor(flags.editor);
			const terminal = desktop && flags.terminal;
			if (terminal !== effects.terminalActive()) await effects.terminal(terminal);
		});
		// Keep the caller's rejection, but allow a later request to recover.
		this.pending = next.catch(() => undefined);
		return next;
	}

	dispose(): void {
		this.disposed = true;
	}
}
