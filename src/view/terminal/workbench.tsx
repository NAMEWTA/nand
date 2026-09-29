import { Menu, Modal, Notice, Setting, type App } from 'obsidian';
import { useEffect, useRef, useState } from 'preact/hooks';
import { AGENT_CATALOG } from '../../core/agent-launch/catalog';
import type { UsageSnapshot } from '../../core/agent-launch/types';
import type { VaultSessionAgent } from '../../core/ai-vault/types';
import { readUsageSnapshots, remainingPercent } from '../../platform/desktop/agents/usage';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import type { TerminalService } from '../../platform/desktop/terminal/terminal-service';
import { usageContext } from '../../platform/obsidian/agents/usage-context';
import type { NativeHistory } from '../../platform/obsidian/ai-vault/service';
import type { HistoryPage, NativeSession, NativeUsage } from '../../platform/terminal-server/agent-data-client';
import { getLanguage, t as sharedT } from '../../shared/i18n/index';
import { t } from '../../shared/i18n/terminal-accessor';
import { UsageModal } from '../agent-usage/usage-modal';
import { Icon } from '../primitives/Icon';
import type { WorkbenchHost } from './host';

function report(operation: Promise<unknown>): void {
	void operation.catch((error) => {
		new Notice(String(error));
	});
}
export function confirmSessionClose(app: App, action: () => Promise<void>): void {
	const modal = new Modal(app);
	modal.modalEl.addClass('nand-agent-dialog');
	modal.contentEl.createEl('p', { cls: 'nand-agent-dialog-message', text: t('workbench.closeConfirm') });
	new Setting(modal.contentEl)
		.addButton((b) => b.setButtonText(t('common.cancel')).onClick(() => modal.close()))
		.addButton((b) =>
			b
				.setButtonText(t('workbench.close'))
				.setClass('mod-warning')
				.onClick(() => {
					modal.close();
					report(action());
				}),
		);
	modal.open();
}
export function SessionSidebar({
	host,
	service,
	active,
	select,
	create,
	close,
}: {
	host: WorkbenchHost;
	service: TerminalService;
	active: string;
	select: (terminal: PtySession) => void;
	create: () => Promise<void>;
	close: (terminal: PtySession) => Promise<void>;
}) {
	const [, redraw] = useState(0);
	useEffect(() => service.subscribe(() => redraw((n) => n + 1)), [service]);
	const menu = (event: MouseEvent) => {
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(t('workbench.shell'))
				.setIcon('terminal')
				.onClick(() => report(create())),
		);
		for (const agent of AGENT_CATALOG.filter((a) => host.settings.agentSettings.agents[a.id]?.enabled))
			menu.addItem((item) => item.setTitle(agent.title).onClick(() => report(host.launchAgent(agent.id))));
		menu.addSeparator();
		for (const preset of host.settings.presetScripts.filter((p) => !AGENT_CATALOG.some((a) => a.id === p.id)))
			menu.addItem((item) => item.setTitle(preset.name).onClick(() => report(host.runPresetScript(preset))));
		menu.showAtMouseEvent(event);
	};
	return (
		<>
			<div className="nand-agent-rail-head">
				<h3 className="nand-agent-workbench-title">{t('workbench.title')}</h3>
				<button className="mod-cta nand-ui-btn nand-agent-new-btn" onClick={menu}>
					＋ {t('workbench.new')}
				</button>
			</div>
			<div className="nand-agent-nav">
				<button
					className="nand-ui-btn nand-ui-btn-ghost nand-agent-nav-btn"
					onClick={() => report(host.openAutomationCenter())}
				>
					<Icon name="timer" />
					{sharedT('automation.title')}
				</button>
				<button
					className="nand-ui-btn nand-ui-btn-ghost nand-agent-nav-btn"
					onClick={() => host.openNotificationCenter()}
				>
					<Icon name="bell" />
					{sharedT('automation.inbox')}
				</button>
			</div>
			<h4 className="nand-ui-section-label nand-agent-section-label">{t('workbench.openSessions')}</h4>
			<div className="nand-ui-list nand-session-list">
				{service.getAllTerminals().map((terminal) => {
					const name = terminal.getTitle();
					const shortId = `#${terminal.id.replace(/^terminal-/, '').slice(0, 8)}`;
					const status = t(`workbench.status.${terminal.nativeStatus}`);
					return (
						<div className="nand-session-row" key={terminal.id}>
							<button
								className={`nand-ui-list-item${terminal.id === active ? ' is-active' : ''}`}
								data-terminal-id={terminal.id}
								title={`${name}\n${shortId}\n${status}`}
								onClick={() => select(terminal)}
							>
								<span className="nand-ui-list-item-title">{name}</span>
								<span className="nand-session-row-meta">
									<small className="nand-session-row-id">{shortId}</small>
									<i
										aria-hidden="true"
										className={`nand-ui-dot nand-session-status-dot is-${terminal.nativeStatus}`}
									/>
									<small className="nand-session-row-status">{status}</small>
								</span>
							</button>
							<button
								className="nand-ui-icon-btn nand-session-close"
								aria-label={t('workbench.close')}
								title={t('workbench.close')}
								onClick={() => confirmSessionClose(host.app, () => close(terminal))}
							>
								<Icon name="x" />
							</button>
						</div>
					);
				})}
			</div>
		</>
	);
}
export function HistorySidebar({ history, host }: { history: NativeHistory; host: WorkbenchHost }) {
	const app = host.app;
	const [query, setQuery] = useState(''),
		[offset, setOffset] = useState(0),
		[revision, refresh] = useState(0);
	const [page, setPage] = useState<HistoryPage & { offset: number }>(),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	const [selected, setSelected] = useState<NativeSession>(),
		[preview, setPreview] = useState('');
	const [filter, setFilter] = useState('');
	const [exporting, setExporting] = useState(false);
	const exportPending = useRef(false);
	const exportSession = async (session: NativeSession) => {
		if (exportPending.current) return;
		exportPending.current = true;
		setExporting(true);
		try {
			const file = await history.export(session);
			try { await app.workspace.getLeaf('tab').openFile(file); }
			catch (error) {
				throw new Error(t('workbench.exportOpenFailed', { path: file.path, message: error instanceof Error ? error.message : String(error) }));
			}
			new Notice(t('workbench.exported', { path: file.path }));
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		} finally {
			exportPending.current = false;
			setExporting(false);
		}
	};
	useEffect(() => {
		const abort = new AbortController();
		setBusy(true);
		setError('');
		void (async () => {
			try {
				if (!page || (!query && !offset)) {
					const warnings = await history.scan(abort.signal);
					if (!abort.signal.aborted) setError(warnings.join('\n'));
				}
				const next = await history.query(query.trim(), offset, abort.signal, filter || 'active');
				if (!abort.signal.aborted) {
					const lastOffset = Math.max(0, Math.floor((next.total - 1) / 100) * 100);
					if (offset > lastOffset) setOffset(lastOffset);
					else setPage({ ...next, offset });
				}
			} catch (e) {
				if (!abort.signal.aborted) setError(String(e));
			} finally {
				if (!abort.signal.aborted) setBusy(false);
			}
		})();
		return () => abort.abort();
	}, [history, query, offset, revision, filter]);
	useEffect(() => {
		const abort = new AbortController();
		setPreview('');
		if (selected)
			void history
				.read(selected, abort.signal)
				.then((s) => {
					if (!abort.signal.aborted) setPreview(s.text);
				})
				.catch((e) => {
					if (!abort.signal.aborted) setError(String(e));
				});
		return () => abort.abort();
	}, [history, selected]);
	const update = (s: NativeSession, patch: Parameters<NativeHistory['update']>[1]) =>
		report(
			history.update(s.key, patch).then(() => {
				refresh((v) => v + 1);
			}),
		);
	const edit = (s: NativeSession) => {
		const modal = new Modal(app),
			meta = history.meta(s.key);
		modal.modalEl.addClass('nand-agent-dialog');
		let title = meta.title || s.title,
			tags = (meta.tags ?? []).join(', ');
		new Setting(modal.contentEl).setName(t('workbench.rename')).addText((input) =>
			input.setValue(title).onChange((v) => {
				title = v;
			}),
		);
		new Setting(modal.contentEl).setName(t('workbench.tags')).addText((input) =>
			input.setValue(tags).onChange((v) => {
				tags = v;
			}),
		);
		new Setting(modal.contentEl).addButton((b) =>
			b.setButtonText(sharedT('automation.save')).onClick(() => {
				update(s, {
					title: title.trim(),
					tags: tags
						.split(',')
						.map((s) => s.trim())
						.filter(Boolean),
				});
				modal.close();
			}),
		);
		modal.open();
	};
	return (
		<>
			<h4 className="nand-agent-rail-header">
				<span className="nand-agent-rail-header-title">{t('workbench.history')}</span>{' '}
				<button
					className="nand-ui-icon-btn"
					disabled={busy}
					onClick={() => refresh((v) => v + 1)}
					aria-label={t('workbench.refresh')}
					title={t('workbench.refresh')}
				>
					<Icon name="refresh-cw" />
				</button>
			</h4>
			<div className="nand-history-controls">
				<input
					type="search"
					aria-label={t('workbench.search')}
					placeholder={t('workbench.search')}
					value={query}
					onInput={(e) => {
						setQuery(e.currentTarget.value);
						setOffset(0);
					}}
				/>
				<select
					className="dropdown"
					aria-label={t('workbench.filter')}
					value={filter}
					onChange={(e) => {
						setFilter(e.currentTarget.value);
						setOffset(0);
					}}
				>
					{['', 'favorite', 'archived'].map((key) => (
						<option key={key} value={key}>
							{t(`workbench.${key || 'all'}`)}
						</option>
					))}
				</select>
			</div>
			{busy && <p className="nand-history-status">{t('workbench.loading')}</p>}
			{error && (
				<details className="nand-history-issues" open>
					<summary>{t('workbench.scanIssues')}</summary>
					<pre>{error}</pre>
				</details>
			)}
			{page && page.rows.length > 0 && (
				<div className="nand-ui-list nand-history-list">
					{page.rows.map((session) => (
						<div key={session.key} className="nand-history-row">
							<button
								className={`nand-ui-list-item${selected?.key === session.key ? ' is-active' : ''}`}
								onClick={() => setSelected(session)}
							>
								<strong className="nand-ui-list-item-title">
									{history.meta(session.key).favorite ? <span className="nand-history-favorite">★ </span> : ''}
									{history.meta(session.key).title || session.title}
								</strong>
								<small className="nand-ui-list-item-meta">
									{session.agentId} · {new Date(session.modifiedAtMs).toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}
								</small>
								<small className="nand-ui-list-item-meta nand-history-tags">
									{(history.meta(session.key).tags ?? []).join(' · ')}
								</small>
							</button>
						</div>
					))}
				</div>
			)}
			{page && page.total === 0 && !busy && (
				<p className="nand-history-empty">{t(query.trim() || filter ? 'workbench.noMatches' : 'workbench.empty')}</p>
			)}
			{page && page.total > 100 && (
				<div className="nand-history-pagination">
					{/* Range stays first in DOM (queried as the pager's first span); CSS orders it between the buttons. */}
					<span className="nand-history-range">
						{t('workbench.range', { start: page.offset + 1, end: page.offset + page.rows.length, total: page.total })}
					</span>
					<button
						className="nand-ui-icon-btn"
						disabled={busy || page.offset === 0}
						onClick={() => setOffset(Math.max(0, page.offset - 100))}
						aria-label={t('workbench.previous')}
						title={t('workbench.previous')}
					>
						<Icon name="chevron-left" />
					</button>
					<button
						className="nand-ui-icon-btn"
						disabled={busy || page.offset + 100 >= page.total}
						onClick={() => setOffset(page.offset + 100)}
						aria-label={t('workbench.next')}
						title={t('workbench.next')}
					>
						<Icon name="chevron-right" />
					</button>
				</div>
			)}
			{selected && (
				<section className="nand-ui-card nand-history-preview">
					<div className="nand-history-actions">
						<button
							className="mod-cta nand-ui-btn nand-history-resume"
							onClick={() =>
								report(
									host.resumeSession({
										...selected,
										agentId: selected.agentId as VaultSessionAgent,
										env: JSON.parse(selected.accountKey) as Record<string, string>,
									}),
								)
							}
						>
							<Icon name="play" />
							{t('workbench.resume')}
						</button>
						<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => edit(selected)}>
							<Icon name="pencil" />
							{t('workbench.rename')}
						</button>
						<button
							className="nand-ui-btn nand-ui-btn-ghost"
							aria-pressed={!!history.meta(selected.key).favorite}
							onClick={() => update(selected, { favorite: !history.meta(selected.key).favorite })}
						>
							<Icon name="star" />
							{t(history.meta(selected.key).favorite ? 'workbench.unfavorite' : 'workbench.favorite')}
						</button>
						<button
							className="nand-ui-btn nand-ui-btn-ghost"
							aria-pressed={!!history.meta(selected.key).archived}
							onClick={() => update(selected, { archived: !history.meta(selected.key).archived })}
						>
							<Icon name="archive" />
							{t(history.meta(selected.key).archived ? 'workbench.unarchive' : 'workbench.archived')}
						</button>
						<button
							className="nand-ui-btn nand-ui-btn-ghost"
							disabled={exporting}
							onClick={() => void exportSession(selected)}
						>
							<Icon name="file-output" />
							{t('workbench.export')}
						</button>
					</div>
					<UsageTotals usage={selected.usage} />
					<pre className="nand-history-transcript">{preview}</pre>
				</section>
			)}
		</>
	);
}
function UsageTotals({ usage }: { usage?: NativeUsage }) {
	if (!usage?.known) return <span className="nand-agent-usage-totals">{t('workbench.usageUnknown')}</span>;
	return (
		<span className="nand-agent-usage-totals">
			{usage.partial ? `${t('workbench.usagePartial')} · ` : ''}
			{t('workbench.tokens')}: {usage.input.toLocaleString()} / {usage.output.toLocaleString()} ·{' '}
			{t('workbench.cache')}: {usage.cacheRead.toLocaleString()} / {usage.cacheWrite.toLocaleString()}
			{usage.cost !== null ? ` · $${usage.cost.toFixed(4)}` : ` · ${t('workbench.costUnknown')}`}
		</span>
	);
}
export function UsageFooter({ host, history }: { host: WorkbenchHost; history: NativeHistory }) {
	const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]),
		[usage, setUsage] = useState<NativeUsage>();
	useEffect(() => {
		let alive = true,
			busy = false;
		const refresh = async () => {
			if (busy) return;
			busy = true;
			try {
				const [snapshots, page] = await Promise.all([
					readUsageSnapshots(
						AGENT_CATALOG.filter(
							(a) =>
								host.settings.agentSettings.agents[a.id]?.enabled &&
								host.settings.agentSettings.agents[a.id]?.showUsage,
						).map((a) => a.id),
						usageContext(host),
					),
					history.query(),
				]);
				if (alive) {
					setSnapshots(snapshots);
					setUsage(page.usage);
				}
			} catch {
				/* History sidebar exposes scan failures. */
			} finally {
				busy = false;
			}
		};
		void refresh();
		const win = host.app.workspace.containerEl.win;
		const timer = win.setInterval(
			() => {
				void refresh();
			},
			Math.max(60, host.settings.agentSettings.usageRefreshSec) * 1000,
		);
		return () => {
			alive = false;
			win.clearInterval(timer);
		};
	}, [host, history]);
	return (
		<>
			<span className="nand-agent-usage-summary">
				{t('workbench.vaultUsage')} · <UsageTotals usage={usage} />
			</span>
			<button className="nand-agent-usage-pill" onClick={() => new UsageModal(host.app, snapshots).open()}>
				<Icon name="gauge" />
				{snapshots
					.map(
						(s) =>
							`${s.provider}: ${s.windows[0]?.usedPct !== null && s.windows[0] ? remainingPercent(s.windows[0]) + '%' : s.status}`,
					)
					.join(' · ') || t('agents.usageTitle')}
			</button>
		</>
	);
}
