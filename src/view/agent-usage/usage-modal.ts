import { Modal, type App } from 'obsidian';
import type { UsageSnapshot, UsageWindow } from '../../core/agent-launch/types';
import { remainingPercent } from '../../platform/desktop/agents/usage';
import { t } from '../../shared/i18n/terminal-accessor';

export class UsageModal extends Modal {
	constructor(
		app: App,
		private readonly snapshots: UsageSnapshot[],
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('terminal-usage-modal');
		contentEl.createEl('h2', { text: t('agents.usageTitle') });
		contentEl.createEl('p', { text: t('agents.usageIntro') });

		if (this.snapshots.length === 0) {
			contentEl.createEl('p', { text: t('agents.usageEmpty') });
			return;
		}

		for (const snapshot of this.snapshots) {
			const card = contentEl.createDiv({ cls: 'terminal-usage-card' });
			const title = snapshot.account ? `${snapshot.provider} · ${snapshot.account}` : snapshot.provider;
			card.createEl('h3', { text: title });
			if (snapshot.stale) card.createEl('p', { text: `${t('agents.usageStale')} · ${snapshot.status}` });
			if (snapshot.checkedAt)
				card.createEl('small', {
					text: `${t('agents.usageUpdated')} ${new Date(snapshot.checkedAt).toLocaleString()}`,
				});
			if (snapshot.windows.length === 0) {
				card.createEl('p', { text: snapshot.status });
				continue;
			}
			for (const window of snapshot.windows) {
				const row = card.createDiv({ cls: 'terminal-usage-row' });
				row.createSpan({ cls: 'terminal-usage-name', text: windowLabel(window) });
				const track = row.createDiv({ cls: 'terminal-usage-track' });
				const pct = window.usedPct ?? 0;
				const fill = track.createDiv({ cls: 'terminal-usage-fill' });
				fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
				if (pct >= 80) fill.addClass('is-high');
				else if (pct >= 60) fill.addClass('is-mid');
				const remaining = window.usedPct === null ? null : remainingPercent(window);
				row.createSpan({
					cls: 'terminal-usage-pct',
					text: remaining === null ? '-' : t('agents.usageRemaining', { remaining }),
				});
				const refresh = refreshLabel(window);
				row.createSpan({ cls: 'terminal-usage-reset', text: refresh });
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function windowLabel(window: UsageWindow): string {
	if (window.name === '每月') return t('agents.usageWindowMonth');
	if (window.name === '5小时') return t('agents.usageWindowSession');
	if (window.name === '每周') return t('agents.usageWindowWeek');
	return window.name;
}

function refreshLabel(window: UsageWindow): string {
	const name =
		window.name === '每月'
			? t('agents.refreshMonth')
			: window.name === '5小时'
				? t('agents.refreshSession')
				: window.name === '每周'
					? t('agents.refreshWeek')
					: t('agents.refreshGeneric');
	return window.resetAt ? `${name} ${new Date(window.resetAt).toLocaleString()}` : name;
}
