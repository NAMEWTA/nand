import type { AutomationRun } from '../../../shared/automation/types';
import { isActiveRun } from '../../../shared/automation/types';
import { automationMessage } from '../../../shared/automation/errors';
import { getLanguage, t } from '../../../shared/i18n';
import type { AutomationsApi } from '../core/api';
import { Icon } from '../../../ui/primitives/Icon';
import { STATUS_TONE, statusBadge } from './status-presentation';
import type { AutomationPanelActions } from './panel-contract';
/** Shared run details preserve output, stop semantics, accounting and exact session actions. */
export function AutomationRunList({ runs, service, actions, selected }: {
 runs: readonly AutomationRun[]; service: AutomationsApi; actions: AutomationPanelActions; selected?: string;
}) {
 return (<ol className="nand-automation-timeline">
							{runs.map((run) => (
								<li className={`nand-automation-run is-${STATUS_TONE[run.status] ?? 'neutral'}${run.id === selected ? ' is-selected' : ''}`} key={run.id} data-nand-run-id={run.id} tabIndex={-1}>
									<span className="nand-automation-run-marker" aria-hidden="true" />
									<div className="nand-automation-run-card">
										<div className="nand-automation-run-head">
											<span className="nand-automation-run-time">
												{new Date(run.startedAt).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}
											</span>
											<span className={statusBadge(run.status)}>{t(`automation.${run.status}`)}</span>
											<span className="nand-ui-spacer" />
											{run.terminalId && (
												<button
													className="nand-ui-btn nand-ui-btn-ghost"
													onClick={() => actions.run(async () => service.agent()?.open(run.terminalId!))}
												>
													<Icon name="terminal" />
													{t('automation.open')}
												</button>
											)}
											{isActiveRun(run) && (
												<button
													className="nand-ui-btn nand-ui-btn-ghost nand-automation-btn-danger"
													onClick={() => actions.run(() => service.stop(run))}
												>
													<Icon name="square" />
													{t('automation.stop')}
												</button>
											)}
										</div>
										{(run.errorCode || run.message) && (
											<p className="nand-automation-run-message">{automationMessage(run)}</p>
										)}
										{run.usage?.known && (
											<p className="nand-automation-run-usage">
												{t('automation.tokens')}{t('automation.colon')}{run.usage.input} / {run.usage.output}
												{run.usage.cost !== null ? ` · $${run.usage.cost.toFixed(4)}` : ''}
											</p>
										)}
										{run.output && (
											<details className="nand-automation-output">
												<summary>
													<Icon className="nand-automation-output-chevron" name="chevron-right" />
													{t('automation.output')}
												</summary>
												<pre>{run.output}</pre>
											</details>
										)}
									</div>
								</li>
							))}
						</ol>);
}
