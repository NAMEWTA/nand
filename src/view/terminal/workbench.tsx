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
import type { WorkbenchHost } from './host';

function report(operation: Promise<unknown>): void {
	void operation.catch((error) => {
		new Notice(String(error));
	});
}
export function confirmSessionClose(app: App, action: () => Promise<void>): void {
	const modal = new Modal(app);
	modal.contentEl.createEl('p', { text: t('workbench.closeConfirm') });
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
			<button className="mod-cta" onClick={menu}>
				＋ {t('workbench.new')}
			</button>
			<button onClick={() => report(host.openAutomationCenter())}>{sharedT('automation.title')}</button>
			<button onClick={() => host.openNotificationCenter()}>{sharedT('automation.inbox')}</button>
			<h4>{t('workbench.openSessions')}</h4>
			{service.getAllTerminals().map((terminal) => (
				<div className="nand-session-row" key={terminal.id}>
					<button className={terminal.id === active ? 'is-active' : ''} onClick={() => select(terminal)}>
						{terminal.getTitle()} <small>{t(`workbench.status.${terminal.nativeStatus}`)}</small>
					</button>
					<button
						aria-label={t('workbench.close')}
						onClick={() => confirmSessionClose(host.app, () => close(terminal))}
					>
						×
					</button>
				</div>
			))}
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
			<h4>
				{t('workbench.history')}{' '}
				<button disabled={busy} onClick={() => refresh((v) => v + 1)} aria-label={t('workbench.refresh')}>
					↻
				</button>
			</h4>
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
			{busy && <p>{t('workbench.loading')}</p>}
			{error && (
				<details open>
					<summary>{t('workbench.scanIssues')}</summary>
					<pre>{error}</pre>
				</details>
			)}
			{page &&
				page.rows.map((session) => (
					<div key={session.key} className="nand-history-row">
						<button
							className={selected?.key === session.key ? 'is-active' : ''}
							onClick={() => setSelected(session)}
						>
							<strong>
								{history.meta(session.key).favorite ? '★ ' : ''}
								{history.meta(session.key).title || session.title}
							</strong>
							<small>
								{session.agentId} · {new Date(session.modifiedAtMs).toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}
							</small>
							<small>{(history.meta(session.key).tags ?? []).join(' · ')}</small>
						</button>
					</div>
				))}
			{page && page.total === 0 && !busy && <p>{t(query.trim() || filter ? 'workbench.noMatches' : 'workbench.empty')}</p>}
			{page && page.total > 100 && (
				<div className="nand-history-pagination">
					<button disabled={busy || page.offset === 0} onClick={() => setOffset(Math.max(0, page.offset - 100))} aria-label={t('workbench.previous')}>
						←
					</button>
					<span>
						{t('workbench.range', { start: page.offset + 1, end: page.offset + page.rows.length, total: page.total })}
					</span>
					<button disabled={busy || page.offset + 100 >= page.total} onClick={() => setOffset(page.offset + 100)} aria-label={t('workbench.next')}>
						→
					</button>
				</div>
			)}
			{selected && (
				<section className="nand-history-preview">
					<div className="nand-history-actions">
						<button
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
							{t('workbench.resume')}
						</button>
						<button onClick={() => edit(selected)}>{t('workbench.rename')}</button>
						<button aria-pressed={!!history.meta(selected.key).favorite} onClick={() => update(selected, { favorite: !history.meta(selected.key).favorite })}>
							{t(history.meta(selected.key).favorite ? 'workbench.unfavorite' : 'workbench.favorite')}
						</button>
						<button aria-pressed={!!history.meta(selected.key).archived} onClick={() => update(selected, { archived: !history.meta(selected.key).archived })}>
							{t(history.meta(selected.key).archived ? 'workbench.unarchive' : 'workbench.archived')}
						</button>
						<button disabled={exporting} onClick={() => void exportSession(selected)}>
							{t('workbench.export')}
						</button>
					</div>
					<UsageTotals usage={selected.usage} />
					<pre>{preview}</pre>
				</section>
			)}
		</>
	);
}
function UsageTotals({ usage }: { usage?: NativeUsage }) {
	if (!usage?.known) return <span>{t('workbench.usageUnknown')}</span>;
	return (
		<span>
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
			<span>
				{t('workbench.vaultUsage')} · <UsageTotals usage={usage} />
			</span>
			<button onClick={() => new UsageModal(host.app, snapshots).open()}>
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
