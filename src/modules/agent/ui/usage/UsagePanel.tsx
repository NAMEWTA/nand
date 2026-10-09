import type { UsageSnapshot, UsageWindow } from '../../core/launch/types';
import { remainingPercent, usageStatusText } from '../../core/launch/usage-format';
import { getLanguage, t } from '../../../../shared/i18n';
const dateTime = (value: number | string): string => new Date(value).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
const windowLabel = (window: UsageWindow): string => window.name === '每月' ? t('agent.usage.month') : window.name === '5小时' ? t('agent.usage.session') : window.name === '每周' ? t('agent.usage.week') : window.name;
const refreshLabel = (window: UsageWindow): string => {
 const name = t(window.name === '每月' ? 'agent.usage.refreshMonth' : window.name === '5小时' ? 'agent.usage.refreshSession' : window.name === '每周' ? 'agent.usage.refreshWeek' : 'agent.usage.refreshGeneric');
 return window.resetAt ? name + ' ' + dateTime(window.resetAt) : name;
};
/** The native modal and the workbench compose this same quota presentation. */
export function UsagePanel({ snapshots }: { snapshots: readonly UsageSnapshot[] }) {
 return <section className="terminal-usage-panel">
  <h2>{t('agent.usage.title')}</h2><p className="terminal-usage-intro">{t('agent.usage.intro')}</p>
  {snapshots.length === 0 && <p className="terminal-usage-empty">{t('agent.usage.empty')}</p>}
  {snapshots.map((snapshot) => <article className="terminal-usage-card nand-ui-card" key={snapshot.agentId}>
   <h3>{snapshot.account ? snapshot.provider + ' · ' + snapshot.account : snapshot.provider}</h3>
   {snapshot.stale && <p className="terminal-usage-stale">{t('agent.usage.stale')} · {usageStatusText(snapshot)}</p>}
   {!!snapshot.checkedAt && <small className="terminal-usage-checked">{t('agent.usage.checked')} {dateTime(snapshot.checkedAt)}</small>}
   {!snapshot.windows.length && <p className="terminal-usage-status">{usageStatusText(snapshot)}</p>}
   {snapshot.windows.map((window, index) => {
    const known = window.usedPct !== null && Number.isFinite(window.usedPct);
    const pct = known ? Math.max(0, Math.min(100, window.usedPct!)) : 0;
    return <div className="terminal-usage-row" key={window.name + ':' + index}>
     <span className="terminal-usage-name">{windowLabel(window)}</span>
     <div className="terminal-usage-track" role={known ? 'progressbar' : undefined} aria-label={windowLabel(window)} aria-valuemin={known ? 0 : undefined} aria-valuemax={known ? 100 : undefined} aria-valuenow={known ? pct : undefined}>
      <div className={'terminal-usage-fill' + (pct >= 80 ? ' is-high' : pct >= 60 ? ' is-mid' : '')} style={{ width: pct + '%' }} />
     </div>
     <span className="terminal-usage-pct">{known ? t('agent.usage.remaining', { remaining: remainingPercent(window) }) : '-'}</span>
     <span className="terminal-usage-reset">{refreshLabel(window)}</span>
    </div>;
   })}
  </article>)}
 </section>;
}
