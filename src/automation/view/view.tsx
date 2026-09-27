import { ItemView, Modal, Setting, Notice, type WorkspaceLeaf } from 'obsidian';
import { render } from 'preact/compat';
import { onLanguageChanged, t } from '../../shared/i18n';
import { isActiveRun, type AutomationDefinition } from '../../shared/automation/types';
import type { AutomationService } from '../service';
import { nextOccurrence } from '../schedule';

export const AUTOMATION_VIEW_TYPE = 'nand-automation-view';
export interface AutomationViewHost {
	service: AutomationService;
	edit(definition?: AutomationDefinition): void;
	inbox(): void;
	retry(): Promise<void>;
}
export class AutomationView extends ItemView {
	private unsubscribe?: () => void;
	private selected = '';
	private search = '';
	private filter = '';
	private agentFilter = '';
	constructor(
		leaf: WorkspaceLeaf,
		private host: AutomationViewHost,
	) {
		super(leaf);
	}
	getViewType(): string {
		return AUTOMATION_VIEW_TYPE;
	}
	getDisplayText(): string {
		return t('automation.title');
	}
	getIcon(): string {
		return 'timer';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-automation-view');
		this.unsubscribe = this.host.service.subscribe(() => this.draw());
		this.register(onLanguageChanged(() => this.draw()));
		this.register(
			this.contentEl.onWindowMigrated(() => {
				render(null, this.contentEl);
				this.draw();
			}),
		);
		this.draw();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		this.unsubscribe?.();
		render(null, this.contentEl);
		return Promise.resolve();
	}
	private clearHistory(): void {
		const modal = new Modal(this.app);
		modal.contentEl.createEl('p', { text: t('automation.clearHistoryConfirm') });
		new Setting(modal.contentEl)
			.addButton((b) => b.setButtonText(t('automation.cancel')).onClick(() => modal.close()))
			.addButton((b) =>
				b
					.setButtonText(t('automation.clearHistory'))
					.setClass('mod-warning')
					.onClick(() => {
						modal.close();
						this.run(() => this.host.service.clearHistory());
					}),
			);
		modal.open();
	}
	private remove(definition: AutomationDefinition): void {
		const modal = new Modal(this.app);
		modal.contentEl.createEl('p', { text: t('automation.deleteConfirm') });
		new Setting(modal.contentEl)
			.addButton((b) => b.setButtonText(t('automation.cancel')).onClick(() => modal.close()))
			.addButton((b) =>
				b.setButtonText(t('automation.delete')).onClick(() => {
					modal.close();
					this.run(() => this.host.service.remove(definition));
				}),
			);
		modal.open();
	}
	showRun(id: string): void {
		this.selected = this.host.service.state.runs.find((r) => r.id === id)?.automationId ?? '';
		this.draw();
	}
	private run(operation: () => Promise<unknown>): void {
		void operation().catch((error) => new Notice(String(error)));
	}
	private draw(): void {
		if (this.host.service.loadError) {
			render(
				<div>
					<p>{t('automation.failedLoad')}</p>
					<pre>{this.host.service.loadError}</pre>
					<button
						onClick={() =>
							this.run(async () => {
								await this.host.retry();
								this.draw();
							})
						}
					>
						{t('automation.retry')}
					</button>
				</div>,
				this.contentEl,
			);
			return;
		}
		const service = this.host.service;
		const definitions = [...service.definitions];
		const currentIds = new Set(definitions.map((d) => d.id));
		for (const run of service.state.runs)
			if (run.definition && !definitions.some((d) => d.id === run.automationId)) definitions.push(run.definition);
		const list = definitions.filter(
			(d) =>
				(!this.agentFilter || (d.action.kind === 'agent' && d.action.agentId === this.agentFilter)) &&
				`${d.name} ${JSON.stringify(d.action)}`.toLowerCase().includes(this.search.toLowerCase()) &&
				(!this.filter ||
					(this.filter === 'enabled'
						? d.enabled
						: this.filter === 'disabled'
							? !d.enabled
							: d.action.kind === this.filter)),
		);
		const selected = definitions.find((d) => d.id === this.selected);
		const runs = selected
			? service.state.runs
					.filter((r) => r.automationId === selected.id)
					.slice()
					.reverse()
			: [];
		const next = (d: AutomationDefinition) => {
			if (!d.enabled || !currentIds.has(d.id)) return '—';
			try {
				const value = nextOccurrence(d.schedule, Date.now());
				return value ? new Date(value).toLocaleString() : '—';
			} catch {
				return t('automation.invalid');
			}
		};
		render(
			<>
				<div className="nand-automation-toolbar">
					<button onClick={() => this.host.edit()}>{t('automation.new')}</button>
					<button onClick={() => this.host.inbox()}>{t('automation.inbox')}</button>
					<button onClick={() => this.clearHistory()}>{t('automation.clearHistory')}</button>
					<input
						aria-label={t('automation.search')}
						placeholder={t('automation.search')}
						value={this.search}
						onInput={(e) => {
							this.search = e.currentTarget.value;
							this.draw();
						}}
					/>
					<select
						aria-label={t('automation.action')}
						value={this.filter}
						onChange={(e) => {
							this.filter = e.currentTarget.value;
							this.draw();
						}}
					>
						{['', 'enabled', 'disabled', 'agent', 'notify', 'create-task'].map((key) => (
							<option key={key} value={key}>
								{t(`automation.${key || 'all'}`)}
							</option>
						))}
					</select>
					<select
						aria-label={t('automation.agent')}
						value={this.agentFilter}
						onChange={(e) => {
							this.agentFilter = e.currentTarget.value;
							this.draw();
						}}
					>
						<option value="">{t('automation.all')}</option>
						{service
							.agent()
							?.listAgents()
							.map((agent) => (
								<option key={agent.id} value={agent.id}>
									{agent.title}
								</option>
							))}
					</select>
				</div>
				<p className="setting-item-description">{t('automation.localOnly')}</p>
				<div className="nand-automation-layout">
					<div className="nand-automation-list">
						{list.length === 0 && <p>{t('automation.empty')}</p>}
						{list.map((d) => (
							<button
								key={d.id}
								className={this.selected === d.id ? 'is-active' : ''}
								onClick={() => {
									this.selected = d.id;
									this.draw();
								}}
							>
								<strong>
									{d.name}
									{!currentIds.has(d.id) ? ` · ${t('automation.history')}` : ''}
								</strong>
								<span>
									{t(`automation.${d.action.kind}`)} ·{' '}
									{t(`automation.${d.enabled ? 'enabled' : 'disabled'}`)}
								</span>
								<small>{next(d)}</small>
								<small>
									{t(
										`automation.${[...service.state.runs].reverse().find((r) => r.automationId === d.id)?.status || 'pending'}`,
									)}
								</small>
							</button>
						))}
					</div>
					{selected && (
						<div className="nand-automation-detail">
							<h3>{selected.name}</h3>
							{selected.source && (
								<button onClick={() => this.run(() => service.sources.open(selected.source!))}>
									{t('automation.source')}
								</button>
							)}
							<p>
								{selected.deviceId === service.deviceId
									? t('automation.localDevice')
									: t('automation.otherDevice')}
							</p>
							<div className="nand-automation-toolbar">
								<button
									disabled={!currentIds.has(selected.id)}
									onClick={() => this.run(() => service.run(selected))}
								>
									{t('automation.run')}
								</button>
								<button
									disabled={!currentIds.has(selected.id)}
									onClick={() => this.host.edit(selected)}
								>
									{t('automation.edit')}
								</button>
								<button
									disabled={!currentIds.has(selected.id)}
									onClick={() =>
										this.run(() => service.save({ ...selected, enabled: !selected.enabled }))
									}
								>
									{t(`automation.${selected.enabled ? 'pause' : 'resume'}`)}
								</button>
								<button disabled={!currentIds.has(selected.id)} onClick={() => this.remove(selected)}>
									{t('automation.delete')}
								</button>
							</div>
							<p>
								{t('automation.next')}: {next(selected)}
							</p>
							<pre>
								{selected.action.kind === 'agent'
									? selected.action.prompt
									: selected.action.kind === 'notify'
										? selected.action.body
										: selected.action.text}
							</pre>
							<h4>{t('automation.history')}</h4>
							{runs.map((run) => (
								<div className="nand-automation-run" key={run.id}>
									<span>
										{new Date(run.startedAt).toLocaleString()} · {t(`automation.${run.status}`)}
									</span>
									{(run.errorCode || run.message) && (
										<p>{run.errorCode ? t(`automation.${run.errorCode}`) : run.message}</p>
									)}
									{run.usage?.known && (
										<p>
											{t('automation.tokens')}: {run.usage.input} / {run.usage.output}
											{run.usage.cost !== null ? ` · $${run.usage.cost.toFixed(4)}` : ''}
										</p>
									)}
									{run.output && (
										<details>
											<summary>{t('automation.output')}</summary>
											<pre>{run.output}</pre>
										</details>
									)}
									{run.terminalId && (
										<button
											onClick={() => this.run(async () => service.agent()?.open(run.terminalId!))}
										>
											{t('automation.open')}
										</button>
									)}
									{isActiveRun(run) && (
										<button onClick={() => this.run(() => service.stop(run))}>
											{t('automation.stop')}
										</button>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</>,
			this.contentEl,
		);
	}
}
