import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
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
	private run(operation: () => Promise<unknown>): void {
		void operation().catch((error) => new Notice(String(error)));
	}
	private draw(): void {
		const service = this.host.service;
		const list = service.definitions.filter(
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
		const selected = service.definitions.find((d) => d.id === this.selected);
		const runs = selected
			? service.state.runs
					.filter((r) => r.automationId === selected.id)
					.slice()
					.reverse()
			: [];
		const next = (d: AutomationDefinition) => {
			if (!d.enabled) return '—';
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
								<strong>{d.name}</strong>
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
								<button onClick={() => this.run(() => service.run(selected))}>
									{t('automation.run')}
								</button>
								<button onClick={() => this.host.edit(selected)}>{t('automation.edit')}</button>
								<button
									onClick={() =>
										this.run(() => service.save({ ...selected, enabled: !selected.enabled }))
									}
								>
									{t(`automation.${selected.enabled ? 'pause' : 'resume'}`)}
								</button>
								<button onClick={() => this.run(() => service.remove(selected))}>
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
									{run.message && <p>{run.message}</p>}
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
