import { Menu, Modal, Notice, Setting, type App } from 'obsidian';
import { sessionLabel } from './session-label';
import { copySessionId } from './copy-session-id';
import { useEffect, useRef, useState } from 'preact/hooks';
import { AGENT_CATALOG } from '../../core/agent-launch/catalog';
import type { UsageSnapshot } from '../../core/agent-launch/types';
import type { VaultSessionAgent } from '../../core/ai-vault/types';
import { readUsageSnapshots, remainingPercent, usageStatusText } from '../../platform/desktop/agents/usage';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import type { TerminalService } from '../../platform/desktop/terminal/terminal-service';
import { usageContext } from '../../platform/obsidian/agents/usage-context';
import type { NativeHistory } from '../../platform/obsidian/ai-vault/service';
import type { HistoryPage, NativeSessionSummary, NativeUsage } from '../../platform/terminal-server/agent-data-client';
import { getLanguage, onLanguageChanged, t as sharedT } from '../../shared/i18n/index';
import { t } from '../../shared/i18n/terminal-accessor';
import { UsageModal } from '../agent-usage/usage-modal';
import { Icon } from '../primitives/Icon';
import type { WorkbenchHost } from './host';
import type { WorkbenchChange, WorkbenchState } from './workbench-state';

function report(operation: Promise<unknown>): void {
	void operation.catch((error) => { new Notice(String(error)); });
}

export function confirmSessionClose(app: App, action: () => Promise<void>): void {
	const modal = new Modal(app);
	modal.modalEl.addClass('nand-agent-dialog');
	modal.contentEl.createEl('p', { cls: 'nand-agent-dialog-message', text: t('workbench.closeConfirm') });
	new Setting(modal.contentEl)
		.addButton((button) => button.setButtonText(t('common.cancel')).onClick(() => modal.close()))
		.addButton((button) => button.setButtonText(t('workbench.close')).setClass('mod-warning').onClick(() => {
			modal.close(); report(action());
		}));
	modal.open();
}

export function TerminalHeader({ title, cwd, status, search, more, sidebarToggle, sidebarOpen, quickSwitch }: {
	title: string; cwd?: string; status?: PtySession['nativeStatus'];
	search: () => void; more: (event: MouseEvent) => void;
	sidebarToggle?: () => void; sidebarOpen?: boolean; quickSwitch?: () => void;
}) {
	return <>
		{sidebarToggle && <button className="nand-ui-icon-btn terminal-navigation-toggle" aria-label={t('workbench.toggleNavigation')} aria-expanded={sidebarOpen} onClick={sidebarToggle}><Icon name="panel-left" /></button>}
		<strong className="terminal-current-title" title={`${title}\n${t('workbench.backgroundHelp')}`}>{title}</strong>
		{cwd && <span className="terminal-current-cwd" title={cwd}>{cwd}</span>}
		{status && <span className="terminal-current-status" title={t(`workbench.status.${status}`)} aria-label={t(`workbench.status.${status}`)}><i aria-hidden="true" className={`nand-ui-dot nand-session-status-dot is-${status}`} /><span className="terminal-current-status-text">{t(`workbench.status.${status}`)}</span></span>}
		<div className="terminal-header-actions">
			{quickSwitch && <button className="nand-ui-icon-btn" aria-label={t('workbench.quickSwitch')} title={t('workbench.quickSwitch')} onClick={quickSwitch}><Icon name="list" /></button>}
			<button className="nand-ui-icon-btn" aria-label={t('terminal.contextMenu.search')} title={t('terminal.contextMenu.search')} onClick={search}><Icon name="search" /></button>
			<button className="nand-ui-icon-btn" aria-label={t('workbench.more')} title={t('workbench.more')} onClick={more}><Icon name="ellipsis" /></button>
		</div>
	</>;
}

export function NewConversationButton({ host, create, primary = true }: {
	host: WorkbenchHost; create: () => Promise<void>; primary?: boolean;
}) {
	const newMenu = (event: MouseEvent) => {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(t('workbench.shell')).setIcon('terminal').onClick(() => report(create())));
		for (const agent of AGENT_CATALOG.filter((agent) => host.settings.agentSettings.agents[agent.id]?.enabled))
			menu.addItem((item) => item.setTitle(agent.title).onClick(() => report(host.launchAgent(agent.id))));
		const presets = host.settings.presetScripts.filter((preset) => !AGENT_CATALOG.some((agent) => agent.id === preset.id));
		if (presets.length) menu.addSeparator();
		for (const preset of presets) menu.addItem((item) => item.setTitle(preset.name).onClick(() => report(host.runPresetScript(preset))));
		menu.showAtMouseEvent(event);
	};
	return <button className={`nand-ui-btn nand-agent-new-btn${primary ? ' mod-cta' : ' nand-ui-btn-ghost'}`} onClick={newMenu}><Icon name="plus" />{t('workbench.new')}</button>;
}

export function SessionSidebar({ host, service, active, select, close, state, onStateChange }: {
	host: WorkbenchHost; service: TerminalService; active: string;
	select: (terminal: PtySession) => void; close: (terminal: PtySession) => Promise<void>;
	state: WorkbenchState; onStateChange: WorkbenchChange;
}) {
	const [, redraw] = useState(0);
	useEffect(() => service.subscribe(() => redraw((n) => n + 1)), [service]);
	const sessionMenu = (event: MouseEvent, terminal: PtySession) => {
		const menu = new Menu();
		const clipboard = (event.currentTarget as HTMLElement).ownerDocument.defaultView?.navigator.clipboard;
		menu.addItem((item) => item.setTitle(t('workbench.sessionId', { id: terminal.id })).setDisabled(true));
		menu.addItem((item) => item.setTitle(t('workbench.copySessionId')).setIcon('copy').onClick(() => {
			void copySessionId(terminal.id, clipboard);
		}));
		menu.addSeparator();
		menu.addItem((item) => item.setTitle(t('workbench.close')).setIcon('x').onClick(() => confirmSessionClose(host.app, () => close(terminal))));
		menu.showAtMouseEvent(event);
	};
	const query = state.sessionQuery.trim().toLocaleLowerCase();
	const allTerminals = service.getAllTerminals();
	const terminals = allTerminals.filter((terminal) => !query || `${terminal.getTitle()} ${terminal.getCwd()} ${terminal.id} ${sessionLabel(terminal, allTerminals)} ${terminal.agentId ?? ''} ${AGENT_CATALOG.find((agent) => agent.id === terminal.agentId)?.title ?? ''}`.toLocaleLowerCase().includes(query));
	return <>
		<input type="search" className="terminal-session-search" aria-label={t('workbench.searchSessions')} placeholder={t('workbench.searchSessions')} value={state.sessionQuery} onInput={(event) => onStateChange({ sessionQuery: event.currentTarget.value })} />
		<div className="nand-ui-list nand-session-list">
			{terminals.map((terminal) => {
				const name = terminal.getTitle(), status = t(`workbench.status.${terminal.nativeStatus}`);
				const agent = AGENT_CATALOG.find((agent) => agent.id === terminal.agentId)?.title || t('workbench.shell');
				return <div className="nand-session-row" key={terminal.id} data-terminal-id={terminal.id}>
					<button className={`nand-ui-list-item${terminal.id === active && !state.showHistory ? ' is-active' : ''}`} data-terminal-id={terminal.id} title={`${name}\n${terminal.getCwd()}\n${status}`} onClick={() => {
						onStateChange({ showHistory: false, drawerOpen: false }); select(terminal);
					}}>
						<span className="nand-session-title-row"><span className="nand-ui-list-item-title">{name}</span><small className="nand-session-short-id">{sessionLabel(terminal, allTerminals)}</small></span>
						<span className="nand-session-row-meta"><i aria-hidden="true" className={`nand-ui-dot nand-session-status-dot is-${terminal.nativeStatus}`} /><small className="nand-session-row-status">{agent} · {status}</small></span>
					</button>
					<button className="nand-ui-icon-btn nand-session-more" aria-label={t('workbench.sessionActions', { name })} title={t('workbench.more')} onClick={(event) => sessionMenu(event, terminal)}><Icon name="ellipsis" /></button>
				</div>;
			})}
		</div>
		{!terminals.length && <p className="nand-history-empty">{t(query ? 'workbench.noSessionMatches' : 'workbench.noOpenSessions')}</p>}
	</>;
}

export function HistorySidebar({ history, state, onStateChange, ownerWindow }: { history: NativeHistory; host?: WorkbenchHost; state: WorkbenchState; onStateChange: WorkbenchChange; ownerWindow?: Window }) {
	const [revision, redraw] = useState(history.revision);
	const [page, setPage] = useState<HistoryPage & { offset: number }>();
	const [busy, setBusy] = useState(false), [error, setError] = useState('');
	const controls = useRef<HTMLDivElement>(null);
	useEffect(() => history.subscribe(() => redraw(history.revision)), [history]);
	useEffect(() => {
		if (state.navigation !== 'history') return;
		const abort = new AbortController();
		setBusy(true); setError('');
		const load = async () => {
			try {
				if (!history.hasScanned) {
					const warnings = await history.scan(abort.signal);
					if (!abort.signal.aborted) setError(warnings.join('\n'));
				}
				const next = await history.query(state.historyQuery.trim(), state.historyOffset, abort.signal, state.historyFilter);
				if (abort.signal.aborted) return;
				const lastOffset = Math.max(0, Math.floor((next.total - 1) / 100) * 100);
				if (state.historyOffset > lastOffset) onStateChange({ historyOffset: lastOffset });
				else setPage({ ...next, offset: state.historyOffset });
			} catch (error) {
				if (!abort.signal.aborted) setError(String(error));
			} finally { if (!abort.signal.aborted) setBusy(false); }
		};
		const win = ownerWindow ?? controls.current?.ownerDocument.defaultView;
		const timer = win?.setTimeout(() => { void load(); }, state.historyQuery.trim() ? 200 : 0);
		return () => { abort.abort(); if (timer !== undefined) win?.clearTimeout(timer); };
	}, [history, state.navigation, state.historyQuery, state.historyOffset, state.historyFilter, revision, ownerWindow]);
	const refresh = async () => {
		setBusy(true); setError('');
		try { setError((await history.refresh()).join('\n')); }
		catch (error) { setError(String(error)); }
		finally { setBusy(false); }
	};
	return <>
		<div className="nand-history-controls" ref={controls}>
			<input type="search" aria-label={t('workbench.search')} placeholder={t('workbench.search')} value={state.historyQuery} onInput={(event) => onStateChange({ historyQuery: event.currentTarget.value, historyOffset: 0 })} />
			<div className="terminal-history-filter-row">
				<select className="dropdown" aria-label={t('workbench.filter')} value={state.historyFilter} onChange={(event) => onStateChange({ historyFilter: event.currentTarget.value as WorkbenchState['historyFilter'], historyOffset: 0 })}>
					{(['active', 'favorite', 'archived'] as const).map((filter) => <option key={filter} value={filter}>{t(`workbench.${filter === 'active' ? 'all' : filter}`)}</option>)}
				</select>
				<button className="nand-ui-icon-btn" disabled={busy} aria-label={t('workbench.refresh')} title={t('workbench.refresh')} onClick={() => void refresh()}><Icon name="refresh-cw" /></button>
			</div>
		</div>
		{busy && <p className="nand-history-status" role="status">{t('workbench.loading')}</p>}
		{error && <details className="nand-history-issues" open><summary>{t('workbench.scanIssues')}</summary><pre>{error}</pre></details>}
		<div className="nand-ui-list nand-history-list">
			{page?.rows.map((session) => <div key={session.key} className="nand-history-row">
				<button className={`nand-ui-list-item${state.showHistory && state.selectedHistory?.key === session.key ? ' is-active' : ''}`} onClick={() => onStateChange({ selectedHistory: session, showHistory: true, drawerOpen: false })}>
					<strong className="nand-ui-list-item-title">{history.meta(session.key).favorite ? <span className="nand-history-favorite">★ </span> : ''}{history.meta(session.key).title || session.title}</strong>
					<small className="nand-ui-list-item-meta">{session.agentId} · {new Date(session.modifiedAtMs).toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}</small>
					<small className="nand-ui-list-item-meta nand-history-tags">{(history.meta(session.key).tags ?? []).join(' · ')}</small>
				</button>
			</div>)}
		</div>
		{page && page.total === 0 && !busy && <p className="nand-history-empty">{t(state.historyQuery.trim() || state.historyFilter !== 'active' ? 'workbench.noMatches' : 'workbench.empty')}</p>}
		{page && page.total > 100 && <div className="nand-history-pagination">
			<span className="nand-history-range">{t('workbench.range', { start: page.offset + 1, end: page.offset + page.rows.length, total: page.total })}</span>
			<button className="nand-ui-icon-btn" disabled={busy || page.offset === 0} onClick={() => onStateChange({ historyOffset: Math.max(0, page.offset - 100) })} aria-label={t('workbench.previous')} title={t('workbench.previous')}><Icon name="chevron-left" /></button>
			<button className="nand-ui-icon-btn nand-history-page-next" disabled={busy || page.offset + 100 >= page.total} onClick={() => onStateChange({ historyOffset: page.offset + 100 })} aria-label={t('workbench.next')} title={t('workbench.next')}><Icon name="chevron-right" /></button>
		</div>}
	</>;
}

function editHistory(history: NativeHistory, host: WorkbenchHost, session: NativeSessionSummary): void {
	const modal = new Modal(host.app), meta = history.meta(session.key);
	modal.modalEl.addClass('nand-agent-dialog');
	let title = meta.title || session.title, tags = (meta.tags ?? []).join(', ');
	new Setting(modal.contentEl).setName(t('workbench.rename')).addText((input) => input.setValue(title).onChange((value) => { title = value; }));
	new Setting(modal.contentEl).setName(t('workbench.tags')).addText((input) => input.setValue(tags).onChange((value) => { tags = value; }));
	new Setting(modal.contentEl).addButton((button) => button.setButtonText(sharedT('automation.save')).onClick(() => {
		report(history.update(session.key, { title: title.trim(), tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }));
		modal.close();
	}));
	modal.open();
}

export function HistoryPreview({ history, host, state, onStateChange, focusTerminal }: {
	history: NativeHistory; host: WorkbenchHost; state: WorkbenchState; onStateChange: WorkbenchChange; focusTerminal?: () => void;
}) {
	const [, redraw] = useState(history.revision);
	const [busy, setBusy] = useState(false), [error, setError] = useState('');
	useEffect(() => history.subscribe(() => redraw(history.revision)), [history]);
	const selected = state.selectedHistory;
	useEffect(() => {
		if (!selected) return;
		const abort = new AbortController();
		setBusy(true); setError('');
		void history.read(selected, abort.signal).then((full) => {
			if (!abort.signal.aborted && state.selectedHistory?.key === selected.key) onStateChange({ preview: full });
		}).catch((error) => { if (!abort.signal.aborted) setError(String(error)); })
			.finally(() => { if (!abort.signal.aborted) setBusy(false); });
		return () => abort.abort();
	}, [history, selected?.key, history.indexRevision]);
	if (!selected) return null;
	const full = state.preview?.key === selected.key ? state.preview : null;
	const meta = history.meta(selected.key);
	const returnToTerminal = () => { onStateChange({ showHistory: false, drawerOpen: false }); focusTerminal?.(); };
	const resume = async () => {
		if (state.resumeKey) return;
		state.resumeKey = selected.key; onStateChange({ resumeKey: selected.key });
		try {
			await host.resumeSession({ ...selected, agentId: selected.agentId as VaultSessionAgent, env: JSON.parse(selected.accountKey) as Record<string, string> });
			returnToTerminal();
		} catch (error) { new Notice(String(error)); }
		finally { state.resumeKey = null; onStateChange({ resumeKey: null }); }
	};
	const exportSession = async () => {
		if (state.exportKey) return;
		state.exportKey = selected.key; onStateChange({ exportKey: selected.key });
		try {
			const file = await history.export(selected);
			try { await host.app.workspace.getLeaf('tab').openFile(file); }
			catch (error) { throw new Error(t('workbench.exportOpenFailed', { path: file.path, message: error instanceof Error ? error.message : String(error) })); }
			new Notice(t('workbench.exported', { path: file.path }));
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
		finally { state.exportKey = null; onStateChange({ exportKey: null }); }
	};
	// Metadata subscriptions repaint actions/title; index revisions alone reread transcripts.
	return <section className="nand-history-preview" aria-label={t('workbench.historyPreview')}>
		<div className="nand-history-actions">
			<button className="nand-ui-btn nand-ui-btn-ghost terminal-history-back" onClick={returnToTerminal}><Icon name="arrow-left" />{t('workbench.backToTerminal')}</button>
			<button className="mod-cta nand-ui-btn nand-history-resume" disabled={!!state.resumeKey} aria-busy={!!state.resumeKey} onClick={() => void resume()}><Icon name="play" />{t(state.resumeKey ? 'workbench.resuming' : 'workbench.resume')}</button>
			<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => editHistory(history, host, selected)}><Icon name="pencil" />{t('workbench.rename')}</button>
			<button className="nand-ui-btn nand-ui-btn-ghost" aria-pressed={!!meta.favorite} onClick={() => report(history.update(selected.key, { favorite: !meta.favorite }))}><Icon name="star" />{t(meta.favorite ? 'workbench.unfavorite' : 'workbench.favorite')}</button>
			<button className="nand-ui-btn nand-ui-btn-ghost" aria-pressed={!!meta.archived} onClick={() => report(history.update(selected.key, { archived: !meta.archived }))}><Icon name="archive" />{t(meta.archived ? 'workbench.unarchive' : 'workbench.archived')}</button>
			<button className="nand-ui-btn nand-ui-btn-ghost" disabled={!!state.exportKey} onClick={() => void exportSession()}><Icon name="file-output" />{t('workbench.export')}</button>
		</div>
		<h2 className="terminal-history-title">{meta.title || full?.title || selected.title}</h2>
		<div className="terminal-history-meta"><span>{selected.agentId}</span><span title={full?.cwd || selected.cwd}>{full?.cwd || selected.cwd}</span><UsageTotals usage={full?.usage || selected.usage} /></div>
		{busy && <p className="nand-history-status" role="status">{t('workbench.loading')}</p>}
		{error && <p className="nand-history-issues" role="alert">{error}</p>}
		<pre className="nand-history-transcript" tabIndex={0}>{full?.text ?? ''}</pre>
	</section>;
}

function UsageTotals({ usage }: { usage?: NativeUsage }) {
	if (!usage?.known) return <span className="nand-agent-usage-totals">{t('workbench.usageUnknown')}</span>;
	return <span className="nand-agent-usage-totals">
		{usage.partial ? `${t('workbench.usagePartial')} · ` : ''}
		{t('workbench.tokens')}: {usage.input.toLocaleString()} / {usage.output.toLocaleString()} · {t('workbench.cache')}: {usage.cacheRead.toLocaleString()} / {usage.cacheWrite.toLocaleString()}
		{usage.cost !== null ? ` · $${usage.cost.toFixed(4)}` : ` · ${t('workbench.costUnknown')}`}
	</span>;
}

export function UsageFooter({ host, history, ownerWindow, visible = true }: { host: WorkbenchHost; history: NativeHistory; ownerWindow?: Window; visible?: boolean }) {
	const [, redraw] = useState(0);
	useEffect(() => onLanguageChanged(() => redraw((n) => n + 1)), []);
	const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]), [usage, setUsage] = useState<NativeUsage>();
	useEffect(() => {
		if (!visible) return;
		let alive = true, busy = false;
		const win = ownerWindow ?? host.app.workspace.containerEl.win;
		const shown = () => win.document?.visibilityState !== 'hidden';
		const refresh = async () => {
			if (busy || !shown()) return; busy = true;
			try {
				const [next, aggregate] = await Promise.all([
					readUsageSnapshots(AGENT_CATALOG.filter((agent) => host.settings.agentSettings.agents[agent.id]?.enabled && host.settings.agentSettings.agents[agent.id]?.showUsage).map((agent) => agent.id), usageContext(host)),
					history.usage(),
				]);
				if (alive) { setSnapshots(next); setUsage(aggregate); }
			} catch { /* History navigation exposes native errors. */ }
			finally { busy = false; }
		};
		void refresh();
		const timer = win.setInterval(() => { void refresh(); }, Math.max(60, host.settings.agentSettings.usageRefreshSec) * 1000);
		const onVisibility = () => { if (shown()) void refresh(); };
		win.document?.addEventListener('visibilitychange', onVisibility);
		return () => { alive = false; win.clearInterval(timer); win.document?.removeEventListener('visibilitychange', onVisibility); };
	}, [host, history, ownerWindow, visible]);
	useEffect(() => {
		if (!visible) return;
		let alive = true;
		const off = history.subscribe(() => {
			if ((ownerWindow ?? host.app.workspace.containerEl.win).document?.visibilityState === 'hidden') return;
			void history.usage().then((next) => { if (alive) setUsage(next); }).catch(() => {});
		});
		return () => { alive = false; off(); };
	}, [history, host, ownerWindow, visible]);
	const providerText = snapshots.map((snapshot) => `${snapshot.provider}: ${snapshot.windows[0]?.usedPct !== null && snapshot.windows[0] ? remainingPercent(snapshot.windows[0]) + '%' : usageStatusText(snapshot)}`).join(' · ');
	return <>
		<div className="terminal-compact-links">
			<button className="nand-ui-btn nand-ui-btn-ghost nand-agent-usage-pill" title={providerText || t('agents.usageTitle')} onClick={() => new UsageModal(host.app, snapshots).open()}><Icon name="gauge" />{t('agents.usageTitle')}</button>
			<button className="nand-ui-icon-btn" aria-label={sharedT('automation.title')} title={sharedT('automation.title')} onClick={() => report(host.openAutomationCenter())}><Icon name="timer" /></button>
			<button className="nand-ui-icon-btn" aria-label={sharedT('automation.inbox')} title={sharedT('automation.inbox')} onClick={() => host.openNotificationCenter()}><Icon name="bell" /></button>
		</div>
		<details className="terminal-usage-details"><summary>{t('workbench.vaultUsage')}</summary><UsageTotals usage={usage} /><span className="terminal-provider-usage">{providerText}</span></details>
	</>;
}
