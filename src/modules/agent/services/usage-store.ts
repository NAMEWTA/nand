import { getLanguage, t } from '../../../shared/i18n';
import { createStore } from 'zustand/vanilla';
import type { AgentUsage, UsageSnapshot } from '../api';
import type { AgentController } from './controller';
import type { AgentId } from '../core/launch/types';
import { getAgent } from '../core/launch/catalog';
/** Module-owned rate-limit projection. One reader, one schedule and a focus refresh shared by all leaves. */
export class UsageStore implements AgentUsage {
	readonly store = createStore<UsageSnapshot>(() => ({ providers: [], refreshing: false }));
	private off: () => void;
	private release: () => void;
	private lastRefreshAt = 0;
	private language = '';
	private disposed = false;
	private windows = new Map<Window, number>();
	private focus = () => {
		if (Date.now() - this.lastRefreshAt > this.controller.settings.get().usageRefreshSec * 500)
			void this.refresh().catch(() => {});
	};
	constructor(
		private controller: Pick<AgentController, 'usage' | 'usageAgents' | 'subscribe' | 'settings'>,
		win: Window,
	) {
		this.off = controller.subscribe(() => this.update());
		this.release = controller.usage.retain();
		this.observeWindow(win);
		this.update();
	}
	observeWindow(win: Window): () => void {
		if (this.disposed) return () => {};
		if (!this.windows.has(win)) win.addEventListener('focus', this.focus);
		this.windows.set(win, (this.windows.get(win) ?? 0) + 1);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			const count = (this.windows.get(win) ?? 1) - 1;
			if (count) this.windows.set(win, count);
			else {
				this.windows.delete(win);
				win.removeEventListener('focus', this.focus);
			}
		};
	}
	private update() {
		if (this.disposed) return;
		this.language = getLanguage();
		const state = this.controller.usage.getState(),
			previous = this.store.getState();
		if (!state.refreshing && state.snapshots.length)
			this.lastRefreshAt = Math.max(...state.snapshots.map((s) => s.checkedAt ?? 0));
		const providers = this.controller.usageAgents().map((id) => {
			const item = state.snapshots.find((s) => s.agentId === id),
				retained = previous.providers.find((p) => p.id === id);
			const status: NonNullable<UsageSnapshot['providers'][number]['rateStatus']> = state.refreshing
				? 'fetching'
				: state.error
					? 'error'
					: !item
						? 'idle'
						: item.failed
							? 'error'
							: item.windows.length
								? 'ok'
								: 'unavailable';
			const windows = (item?.windows ?? []).flatMap((w) =>
				w.usedPct === null
					? []
					: [
							{
								key: /5|session/i.test(w.name)
									? 'session'
									: /week|周/i.test(w.name)
										? 'weekly'
										: /month|月/i.test(w.name)
											? 'monthly'
											: w.name,
								label:
									w.name === '5小时'
										? t('agent.usage.session')
										: w.name === '每周'
											? t('agent.usage.week')
											: w.name === '每月'
												? t('agent.usage.month')
												: w.name,
								windowMinutes: /5/.test(w.name) ? 300 : /week|周/i.test(w.name) ? 10080 : undefined,
								usedPercent: Math.max(0, Math.min(100, w.usedPct)),
								resetsAt: w.resetAt ? Date.parse(w.resetAt) || undefined : undefined,
							},
						],
			);
			const current = this.controller.settings.get().agents.agents[id].accountId;
			return {
				id,
				provider: getAgent(id).usage,
				name: getAgent(id).title,
				account: item?.account ?? current,
				accountId: current,
				rateStatus: status,
				updatedAt: item?.checkedAt,
				planType: item?.planType,
				status: status,
				statusLabel: item?.statusKey ? t(`agent.usage.status.${item.statusKey}`) : item?.status,
				error: state.error ?? (item?.failed ? item.status : undefined),
				failed: item?.failed || !!state.error,
				stale: item?.stale || !!state.error || !!item?.failed,
				windows:
					item?.failed && !windows.length && retained?.accountId === current ? retained.windows : windows,
				accounts: ['claude-code', 'codex'].includes(id)
					? [...new Set(['', current, ...(this.controller.settings.get().accounts[id] ?? [])])].map(
							(name) => ({
								id: name,
								name:
									this.controller.settings.get().accountLabels[id]?.[name] ||
									name ||
									t('agent.manage.defaultAccount'),
								selected: name === current,
							}),
						)
					: undefined,
			};
		});
		this.store.setState({ providers, refreshing: state.refreshing, lastRefreshAt: this.lastRefreshAt }, true);
	}
	snapshot = (): UsageSnapshot => {
		if (this.language !== getLanguage()) this.update();
		return this.store.getState();
	};
	subscribe = (listener: () => void) => this.store.subscribe(listener);
	async refresh() {
		await this.controller.usage.refresh(true);
		this.lastRefreshAt = Date.now();
	}
	async selectAccount(provider: string, accountId: string) {
		if (!['claude-code', 'codex'].includes(provider)) return;
		const id = provider as AgentId,
			names = [
				'',
				this.controller.settings.get().agents.agents[id].accountId,
				...(this.controller.settings.get().accounts[id] ?? []),
			];
		if (!names.includes(accountId)) return;
		await this.controller.settings.update((draft) => {
			draft.agents.agents[id].accountId = accountId;
		});
		await this.refresh();
	}
	setDisplay() {
		/* The shell owns display preferences; the transport always supplies used percentages. */
	}
	dispose() {
		this.disposed = true;
		this.off();
		this.release();
		for (const win of this.windows.keys()) win.removeEventListener('focus', this.focus);
		this.windows.clear();
	}
}
