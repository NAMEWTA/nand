import { t } from '../../../shared/i18n';
import { useRef, useState } from 'preact/hooks';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserPageState } from '../core/model';
import type { WorkspaceTask } from '../core/workspace/model';
import { panelLayout } from '../core/workspace/panel-layout';
import { browserError } from '../core/text';
import type { Workspace } from '../services/workspace';
import type { BrowserHost } from '../services/page-host';
import { BrowserPanel } from './BrowserPanel';

export function WorkspacePanels({ task, workspace, host, panes }: {
	task: WorkspaceTask; workspace: Workspace; host: BrowserHost;
	panes: ReadonlyMap<string, { state: BrowserPageState }>;
}) {
	const [failure, setFailure] = useState<unknown>(), [disabled, setDisabled] = useState(false), locked = useRef(false);
	const run = (action: () => Promise<unknown>) => {
		if (locked.current) return;
		locked.current = true; setDisabled(true); setFailure(undefined);
		void action().catch(setFailure).finally(() => { locked.current = false; setDisabled(false); });
	};
	const layout = panelLayout(task), visible = layout.order.filter(id => panes.has(id) && task.visibleTargetIds.includes(id));
	const focused = visible.includes(layout.focused ?? '') ? layout.focused : visible[0];
	const maximized = visible.includes(layout.maximized ?? '') ? layout.maximized : undefined;
	const name = (id: string) => { const target = task.targets.find(row => row.id === id)!;
		return t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel }); };
	if (!panes.size) return null;
	return <section class="nand-browser-panel-deck">
		{failure && <p role="alert">{browserError(failure)}</p>}
		{visible.length > 1 && <div class="nand-browser-workspace-actions nand-browser-pane-focus" aria-label={t('browser.workspace.panelFocus')}>
			{visible.map(id => <button key={id} type="button" class="nand-btn" disabled={disabled} aria-pressed={focused === id} onClick={() => run(() => workspace.updatePanelLayout(task.id, { kind: 'focus', targetId: id }))}>{name(id)}</button>)}
		</div>}
		<div class="nand-browser-workspace-panes">
			{/* Keep guest DOM in binding order. CSS order moves only its visual position, preserving Electron guest identity. */}
			{task.targets.map(target => {
				const pane = panes.get(target.id); if (!pane) return null;
				const index = layout.order.indexOf(target.id), hidden = !visible.includes(target.id) || !!maximized && maximized !== target.id;
				return <section key={target.id} class="nand-browser-panel-slot" hidden={hidden} inert={hidden}
					data-focused={focused === target.id} data-maximized={maximized === target.id} style={{ order: index, flexGrow: layout.widths[target.id] ?? 1 }}>
					<div class="nand-browser-workspace-actions nand-browser-pane-heading">
						<h4>{name(target.id)}</h4>
						<Button disabled={disabled || index === 0} onClick={() => run(() => workspace.updatePanelLayout(task.id, { kind: 'move', targetId: target.id, direction: -1 }))}>{t('browser.workspace.panelEarlier')}</Button>
						<Button disabled={disabled || index === layout.order.length - 1} onClick={() => run(() => workspace.updatePanelLayout(task.id, { kind: 'move', targetId: target.id, direction: 1 }))}>{t('browser.workspace.panelLater')}</Button>
						<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.panelWidth')}</span>
							<input type="range" min={0.5} max={3} step={0.5} value={layout.widths[target.id] ?? 1}
								onChange={event => { const width = Number(event.currentTarget.value); setFailure(undefined);
									void workspace.updatePanelLayout(task.id, { kind: 'width', targetId: target.id, width }).catch(setFailure); }} />
						</label>
						<Button disabled={disabled} onClick={() => run(() => workspace.updatePanelLayout(task.id, { kind: maximized === target.id ? 'restore' : 'maximize', targetId: target.id }))}>
							{t(maximized === target.id ? 'browser.workspace.panelRestore' : 'browser.workspace.panelMaximize')}</Button>
					</div>
					<div class="nand-browser-workspace-pane" data-target-id={target.id} hidden={hidden} inert={hidden}>
						<BrowserPanel host={host} initial={pane.state} fixedProfile changed={state => { pane.state = state; }} />
					</div>
				</section>;
			})}
		</div>
	</section>;
}
