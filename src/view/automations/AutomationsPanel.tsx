import { nextOccurrence } from '../../core/automations/schedule';
import type { AutomationDefinition } from '../../shared/automation/types';
import { isActiveRun } from '../../shared/automation/types';
import { automationMessage } from '../../shared/automation/errors';
import { getLanguage, t } from '../../shared/i18n';
import type { AutomationPanelActions, AutomationPanelState, AutomationViewHost } from './panel-contract';

export function AutomationsPanel({
	host,
	state,
	refresh,
	actions,
}: {
	host: AutomationViewHost;
	state: AutomationPanelState;
	refresh: () => void;
	actions: AutomationPanelActions;
}) {
	if (host.service.loadError) {
		return (
			<div>
				<p>{t('automation.failedLoad')}</p>
				<pre>{host.service.loadError}</pre>
				<button
					onClick={() =>
						actions.run(async () => {
							await host.retry();
							refresh();
						})
					}
				>
					{t('automation.retry')}
				</button>
			</div>
		);
	}
	const service = host.service;
	const definitions = [...service.definitions];
	const currentIds = new Set(definitions.map((d) => d.id));
	for (const run of service.state.runs)
		if (run.definition && !definitions.some((d) => d.id === run.automationId)) definitions.push(run.definition);
	const list = definitions.filter(
		(d) =>
			(!state.agentFilter || (d.action.kind === 'agent' && d.action.agentId === state.agentFilter)) &&
			`${d.name} ${JSON.stringify(d.action)}`.toLowerCase().includes(state.search.toLowerCase()) &&
			(!state.filter ||
				(state.filter === 'enabled'
					? d.enabled
					: state.filter === 'disabled'
						? !d.enabled
						: d.action.kind === state.filter)),
	);
	const selected = definitions.find((d) => d.id === state.selected);
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
			return value ? new Date(value).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US') : '—';
		} catch {
			return t('automation.invalid');
		}
	};
	return (
		<>
			<div className="nand-automation-toolbar">
				<button onClick={() => host.edit()}>{t('automation.new')}</button>
				<button onClick={() => host.inbox()}>{t('automation.inbox')}</button>
				<button onClick={() => actions.clearHistory()}>{t('automation.clearHistory')}</button>
				<input
					aria-label={t('automation.search')}
					placeholder={t('automation.search')}
					value={state.search}
					onInput={(e) => {
						state.search = e.currentTarget.value;
						refresh();
					}}
				/>
				<select
					aria-label={t('automation.action')}
					value={state.filter}
					onChange={(e) => {
						state.filter = e.currentTarget.value;
						refresh();
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
					value={state.agentFilter}
					onChange={(e) => {
						state.agentFilter = e.currentTarget.value;
						refresh();
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
							className={state.selected === d.id ? 'is-active' : ''}
							onClick={() => {
								state.selected = d.id;
								refresh();
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
							<button onClick={() => actions.run(() => service.sources.open(selected.source!))}>
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
								onClick={() => actions.run(() => service.run(selected))}
							>
								{t('automation.run')}
							</button>
							<button disabled={!currentIds.has(selected.id)} onClick={() => host.edit(selected)}>
								{t('automation.edit')}
							</button>
							<button
								disabled={!currentIds.has(selected.id)}
								onClick={() =>
									actions.run(() => service.save({ ...selected, enabled: !selected.enabled }))
								}
							>
								{t(`automation.${selected.enabled ? 'pause' : 'resume'}`)}
							</button>
							<button disabled={!currentIds.has(selected.id)} onClick={() => actions.remove(selected)}>
								{t('automation.delete')}
							</button>
						</div>
						<p>
							{t('automation.next')}{t('automation.colon')}{next(selected)}
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
									{new Date(run.startedAt).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')} · {t(`automation.${run.status}`)}
								</span>
								{(run.errorCode || run.message) && (
									<p>{automationMessage(run)}</p>
								)}
								{run.usage?.known && (
									<p>
										{t('automation.tokens')}{t('automation.colon')}{run.usage.input} / {run.usage.output}
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
										onClick={() => actions.run(async () => service.agent()?.open(run.terminalId!))}
									>
										{t('automation.open')}
									</button>
								)}
								{isActiveRun(run) && (
									<button onClick={() => actions.run(() => service.stop(run))}>
										{t('automation.stop')}
									</button>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</>
	);
}
