import { actionText } from '../core/switch-action';
import { actionDescriptors } from '../core/actions/executor';
import { nextOccurrence } from '../core/schedule';
import type { AutomationDefinition } from '../../../shared/automation/types';
import { getLanguage, t } from '../../../shared/i18n';
import { Icon } from '../../../ui/primitives/Icon';
import type { AutomationPanelActions, AutomationPanelState, AutomationViewHost } from './panel-contract';

import { badge, statusBadge } from './status-presentation';
import { AutomationRunList } from './AutomationRunList';

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
			<div className="nand-automation-load-error nand-ui-card">
				<p className="nand-automation-load-error-title">
					<Icon className="nand-automation-load-error-icon" name="alert-triangle" />
					{t('automation.failedLoad')}
				</p>
				<pre>{host.service.loadError}</pre>
				<button
					className="mod-cta nand-ui-btn"
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
	const enabled = service.executionEnabled !== false;
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
		if (!enabled || !d.enabled || !currentIds.has(d.id)) return '—';
		try {
			const value = nextOccurrence(d.schedule, Date.now());
			return value ? new Date(value).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US') : '—';
		} catch {
			return t('automation.invalid');
		}
	};
	const status = (d: AutomationDefinition) => {
		const run = [...service.state.runs].reverse().find(r => r.automationId === d.id && r.revision === d.revision);
		if (run) return run.status;
		if (d.schedule.kind === 'once' && (service.state.cursors[`${d.id}:${d.revision}`] ?? -Infinity) >= d.schedule.at)
			return 'processed';
		return 'pending';
	};
	const editable = !!selected && enabled && currentIds.has(selected.id);
	return (
		<>
			<div className="nand-automation-header">
				<div className="nand-automation-toolbar nand-ui-toolbar">
					<button className="mod-cta nand-ui-btn" disabled={!enabled} onClick={() => host.edit()}>
						<Icon name="plus" />
						{t('automation.new')}
					</button>
					<span className="nand-ui-spacer" />
					<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => host.inbox()}>
						<Icon name="bell" />
						{t('automation.inbox')}
					</button>
					<button
						className="nand-ui-btn nand-ui-btn-ghost"
						disabled={!enabled}
						onClick={() => actions.clearHistory()}
					>
						<Icon name="history" />
						{t('automation.clearHistory')}
					</button>
				</div>
				<div className="nand-automation-filters">
					<label className="nand-automation-filter nand-automation-filter--search nand-ui-field">
						<span>{t('automation.search')}</span>
						<input
							type="search"
							aria-label={t('automation.search')}
							placeholder={t('automation.search')}
							value={state.search}
							onInput={(e) => {
								state.search = e.currentTarget.value;
								refresh();
							}}
						/>
					</label>
					<label className="nand-automation-filter nand-ui-field">
						<span>{t('automation.actionFilter')}</span>
						<select
							className="dropdown"
							aria-label={t('automation.actionFilter')}
							value={state.filter}
							onChange={(e) => {
								state.filter = e.currentTarget.value;
								refresh();
							}}
						>
							{['', 'enabled', 'disabled', ...actionDescriptors.map(action => action.kind)].map((key) => (
								<option key={key} value={key}>
									{t(`automation.${key || 'all'}`)}
								</option>
							))}
						</select>
					</label>
					<label className="nand-automation-filter nand-ui-field">
						<span>{t('automation.agentFilter')}</span>
						<select
							className="dropdown"
							aria-label={t('automation.agentFilter')}
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
					</label>
				</div>
				<p className={`setting-item-description nand-automation-notice${enabled ? '' : ' is-off'}`}>
					<Icon className="nand-automation-notice-icon" name={enabled ? 'info' : 'alert-triangle'} />
					<span>{t(enabled ? 'automation.localOnly' : 'automation.moduleOff')}</span>
				</p>
			</div>
			<div className={`nand-automation-layout${selected ? ' has-detail' : ''}`}>
				<div className="nand-automation-list nand-ui-list nand-ui-scroll">
					{list.length === 0 && (
						<p className="nand-automation-empty">
							<Icon className="nand-automation-empty-icon" name="timer" />
							<span>{t('automation.empty')}</span>
						</p>
					)}
					{list.map((d) => {
						const current = currentIds.has(d.id);
						const rowStatus = status(d);
						return (
							<button
								key={d.id}
								className={`nand-ui-list-item nand-automation-item${state.selected === d.id ? ' is-active' : ''}${current ? '' : ' is-history'}`}
								onClick={() => {
									state.selected = d.id;
									refresh();
								}}
							>
								<strong className="nand-ui-list-item-title">
									{d.name}
									{!current ? ` · ${t('automation.history')}` : ''}
								</strong>
								<span className="nand-automation-item-badges">
									<span className={badge()}>{t(`automation.${d.action.kind}`)}</span>
									<span className={badge(d.enabled ? 'success' : undefined)}>
										<span className="nand-ui-dot" aria-hidden="true" />
										{t(`automation.${d.enabled ? 'enabled' : 'disabled'}`)}
									</span>
								</span>
								<small className="nand-ui-list-item-meta nand-automation-item-next">
									<Icon className="nand-automation-meta-icon" name="clock" />
									{next(d)}
								</small>
								<small className={`${statusBadge(rowStatus)} nand-automation-item-status`}>
									{t(`automation.${rowStatus}`)}
								</small>
							</button>
						);
					})}
				</div>
				{selected ? (
					<div className="nand-automation-detail nand-ui-scroll">
						<section className="nand-automation-detail-card nand-ui-card">
							<header className="nand-automation-detail-header">
								<div className="nand-automation-detail-heading">
									<h3>{selected.name}</h3>
									<div className="nand-automation-item-badges">
										<span className={badge()}>{t(`automation.${selected.action.kind}`)}</span>
										<span className={badge(selected.enabled ? 'success' : undefined)}>
											<span className="nand-ui-dot" aria-hidden="true" />
											{t(`automation.${selected.enabled ? 'enabled' : 'disabled'}`)}
										</span>
									</div>
								</div>
								<div className="nand-automation-toolbar nand-automation-detail-actions nand-ui-toolbar">
									<button
										className="nand-ui-btn"
										disabled={!editable}
										onClick={() => actions.run(() => service.run(selected))}
									>
										<Icon name="play" />
										{t('automation.run')}
									</button>
									<button className="nand-ui-btn" disabled={!editable} onClick={() => host.edit(selected)}>
										<Icon name="pencil" />
										{t('automation.edit')}
									</button>
									<button
										className="nand-ui-btn"
										disabled={!editable}
										onClick={() =>
											actions.run(() => service.save({ ...selected, enabled: !selected.enabled }))
										}
									>
										<Icon name={selected.enabled ? 'pause' : 'play'} />
										{t(`automation.${selected.enabled ? 'pause' : 'resume'}`)}
									</button>
									<button
										className="nand-ui-btn nand-ui-btn-ghost nand-automation-btn-danger"
										disabled={!editable}
										onClick={() => actions.remove(selected)}
									>
										<Icon name="trash-2" />
										{t('automation.delete')}
									</button>
								</div>
							</header>
							<div className="nand-automation-meta">
								<p className="nand-automation-meta-row">
									<Icon className="nand-automation-meta-icon" name="monitor" />
									<span>
										{selected.deviceId === service.deviceId
											? t('automation.localDevice')
											: t('automation.otherDevice')}
									</span>
								</p>
								<p className="nand-automation-meta-row">
									<Icon className="nand-automation-meta-icon" name="clock" />
									<span>
										{t('automation.next')}{t('automation.colon')}{next(selected)}
									</span>
								</p>
								{selected.source && (
									<button
										className="nand-ui-btn nand-ui-btn-ghost nand-automation-source"
										onClick={() => actions.run(() => service.sources.open(selected.source!))}
									>
										<Icon name="file-text" />
										{t('automation.source')}
									</button>
								)}
							</div>
							{host.pin && currentIds.has(selected.id) && <button type="button" className="nand-ui-btn" onClick={() => actions.run(() => host.pin!(selected))}>{t('automation.pin')}</button>}
							{selected.action.kind !== 'browser-workflow' && <><div className="nand-ui-section-label">{t('automation.prompt')}</div>
							<p className="nand-automation-prompt">
								{actionText(selected.action)}
							</p></>}
						</section>
						<div className="nand-automation-section-head">
							<h4>{t('automation.history')}</h4>
							<span className={`${badge()} nand-automation-count`}>{runs.length}</span>
						</div>
						<AutomationRunList runs={runs} service={service} actions={actions} />
					</div>
				) : (
					<div className="nand-automation-placeholder" aria-hidden="true">
						<Icon name="timer" />
					</div>
				)}
			</div>
		</>
	);
}
