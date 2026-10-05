import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';
import { AutomationRunList } from './AutomationRunList';
import type { AutomationPanelActions, AutomationViewHost } from './panel-contract';
export interface RunHistoryState { search: string; status: string; offset: number; selected: string; }
export function AutomationRunsPanel({ host, state, changed, actions }: {
 host: AutomationViewHost; state: RunHistoryState; changed: () => void; actions: AutomationPanelActions;
}) {
 const query = state.search.toLocaleLowerCase();
 const rows = [...host.service.state.runs].reverse().filter((run) => (!state.status || run.status === state.status) &&
  [run.id, run.definition?.name, host.service.definitions.find((definition) => definition.id === run.automationId)?.name, run.message].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
 const offset = Math.min(state.offset, Math.max(0, Math.floor((rows.length - 1) / 50) * 50));
 const change = () => { state.offset = 0; changed(); };
 return <section className="nand-automation-run-history nand-ui-scroll">
  <div className="nand-ui-toolbar">
   <h3>{t('workbench.runs')}</h3><span className="nand-ui-spacer" />
   <button type="button" className="nand-ui-btn nand-ui-btn-ghost" onClick={() => actions.clearHistory()}><Icon name="trash-2" />{t('automation.clearHistory')}</button>
  </div>
  <div className="nand-automation-filters">
   <label className="nand-ui-field"><span>{t('automation.search')}</span><input type="search" value={state.search} onInput={(event) => { state.search = event.currentTarget.value; change(); }} /></label>
   <label className="nand-ui-field"><span>{t('workbench.runStatus')}</span><select value={state.status} onChange={(event) => { state.status = event.currentTarget.value; change(); }}>
    {['', 'pending', 'running', 'unknown', 'succeeded', 'failed', 'cancelled', 'interrupted', 'skipped'].map((status) => <option key={status} value={status}>{t('automation.' + (status || 'all'))}</option>)}
   </select></label>
  </div>
  {!rows.length && <p>{t('workbench.noRuns')}</p>}
  <AutomationRunList runs={rows.slice(offset, offset + 50)} service={host.service} actions={actions} selected={state.selected} />
  {rows.length > 50 && <div className="nand-ui-toolbar">
   <button type="button" className="nand-ui-btn" disabled={offset === 0} onClick={() => { state.offset = Math.max(0, offset - 50); changed(); }}>{t('workbench.previous')}</button>
   <span>{offset + 1}–{Math.min(offset + 50, rows.length)} / {rows.length}</span>
   <button type="button" className="nand-ui-btn" disabled={offset + 50 >= rows.length} onClick={() => { state.offset = offset + 50; changed(); }}>{t('workbench.next')}</button>
  </div>}
 </section>;
}
