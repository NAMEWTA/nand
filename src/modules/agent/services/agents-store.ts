import { createStore } from 'zustand/vanilla';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TerminalSettings, AgentOverride } from '../core/terminal/settings';
import type { AgentId } from '../core/launch/types';
import { availableAgents, type DetectedAgents } from '../core/detection/merge';
import { loginShellPath } from '../platform/desktop/detection/shell-path';
import { probeAgents } from '../platform/desktop/detection/probe';
export class AgentsStore {
	readonly store = createStore<{ detected: DetectedAgents; refreshing: boolean; failed: boolean; error: string }>(
		() => ({ detected: {}, refreshing: false, failed: false, error: '' }),
	);
	private pending?: Promise<void>;
	private path: string | null = null;
	private stopped = false;
	constructor(readonly settings: SettingsHandle<TerminalSettings>) {}
	list() {
		return availableAgents(this.settings.get(), this.store.getState().detected);
	}
	refresh(force = false): Promise<void> {
		if (this.stopped) return Promise.resolve();
		if (this.pending) return this.pending;
		this.store.setState({ refreshing: true });
		this.pending = Promise.resolve().then(async () => {
			try {
				if (force || this.path === null) this.path = await loginShellPath();
				const detected = probeAgents(this.settings.get().overrides, this.path || '');
				if (!this.stopped) this.store.setState({ detected, failed: false, error: '' });
			} catch (error) {
				if (!this.stopped) this.store.setState({ failed: true, error: String(error) });
			} finally {
				if (!this.stopped) this.store.setState({ refreshing: false });
				this.pending = undefined;
			}
		});
		return this.pending;
	}
	async setEnabled(id: AgentId, enabled: boolean) {
		await this.settings.update((draft) => {
			draft.enabled[id] = enabled;
			if (!enabled && draft.defaultAgent === id)
				draft.defaultAgent = availableAgents(draft, this.store.getState().detected)[0]?.id ?? 'claude-code';
		});
	}
	async setDefault(id: AgentId) {
		if (this.list().some((a) => a.id === id))
			await this.settings.update((draft) => {
				draft.defaultAgent = id;
			});
	}
	async saveOverride(id: AgentId, patch: AgentOverride) {
		await this.settings.update((draft) => {
			draft.overrides[id] = { ...draft.overrides[id], ...patch };
		});
		await this.refresh();
	}
	dispose() {
		this.stopped = true;
	}
}
