// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationEditorSettingsSidebar.tsx, AutomationExtraAgentArgsField.tsx, AutomationMissedRunGraceField.tsx
import { Input } from '../../../../ui/components/input';
import { Checkbox } from '../../../../ui/components/checkbox';
import { Label } from '../../../../ui/components/label';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { useT } from '../../../../ui/react/hooks';
import { actionDescriptors } from '../../core/actions/executor';
import { switchAutomationAction } from '../../core/switch-action';
import type { AutomationAction } from '../../../../shared/automation/types';
import type { AutomationViewHost } from '../panel-contract';
import { Choice, Field, SearchChoice } from '../parts';
import { availableAgents } from './draft';
import { SchedulePicker, type DraftProps } from './SchedulePicker';
import { SessionField } from './SessionField';
import { PrecheckField } from './PrecheckField';
import { validatedExtraArgs } from '../../../../shared/automation/extra-args';
export function SettingsSidebar({ draft, onChange, host }: DraftProps & { host: AutomationViewHost }) {
	const t = useT(),
		action = draft.action;
	const agents = availableAgents(host.service.agent()?.listAgents() ?? []);
	const scoped = action.kind === 'agent' || action.kind === 'script';
	let extraError = '';
	if (action.kind === 'agent') {
		try {
			validatedExtraArgs(action.agentId, action.extraArgs ?? '');
		} catch (error) {
			extraError = error instanceof Error ? error.message : String(error);
		}
	}
	return (
		<aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-border/50 bg-muted/20 p-5 scrollbar-sleek max-[760px]:w-full max-[760px]:overflow-visible max-[760px]:border-t max-[760px]:border-l-0">
			<div className="flex flex-col gap-4">
				<Field label={t('automation.action')}>
					{(id) => (
						<Choice
							id={id}
							label={t('automation.action')}
							value={action.kind}
							disabled={!!draft.source}
							options={actionDescriptors.map((item) => ({ value: item.kind, label: t(item.name) }))}
							onChange={(value) =>
								onChange((d) => {
									d.action = switchAutomationAction(d.action, value as AutomationAction['kind'], {
										agentId: agents[0]?.id ?? '',
										cwd: host.cwd ?? '',
									});
									if (!actionDescriptors.find((item) => item.kind === value)?.scheduled)
										d.schedule = { kind: 'manual' };
								})
							}
						/>
					)}
				</Field>
				{action.kind === 'agent' && (
					<>
						<Field
							label={t('automation.agent')}
							help={agents.length ? undefined : t('automation.noAvailableAgents')}
						>
							{(id) => (
								<SearchChoice
									id={id}
									label={t('automation.agent')}
									value={action.agentId}
									options={agents.map((agent) => ({
										value: agent.id,
										label: agent.title,
										icon: <AgentIcon agent={agent.id} />,
									}))}
									onChange={(value) =>
										onChange((d) => {
											if (d.action.kind === 'agent') {
												d.action.agentId = value;
												d.action.session = undefined;
											}
										})
									}
								/>
							)}
						</Field>
						<Field
							label={t('automation.extraArgs')}
							help={t('automation.extraArgsHelp')}
							error={extraError}
						>
							{(id) => (
								<Input
									id={id}
									className="font-mono text-xs"
									value={action.extraArgs ?? ''}
									aria-invalid={!!extraError}
									aria-describedby={extraError ? `${id}-error` : undefined}
									disabled={action.sessionMode === 'reuse'}
									placeholder={t('automation.extraArgsPlaceholder')}
									onChange={(e) =>
										onChange((d) => {
											if (d.action.kind === 'agent') d.action.extraArgs = e.target.value;
										})
									}
								/>
							)}
						</Field>
					</>
				)}
				{scoped && (
					<Field label={t('automation.cwd')}>
						{(id) => (
							<SearchChoice
								id={id}
								label={t('automation.cwd')}
								value={action.cwd}
								options={host
									.paths()
									.filter((item) => item.kind === 'folder')
									.map((item) => ({
										value: item.path === '/' ? (host.cwd ?? '') : `${host.cwd}/${item.path}`,
										label: item.path,
									}))}
								onChange={(value) =>
									onChange((d) => {
										if ('cwd' in d.action) d.action.cwd = value;
										if (d.action.kind === 'agent') d.action.session = undefined;
									})
								}
							/>
						)}
					</Field>
				)}
				{action.kind === 'script' && (
					<Field label={t('automation.shell')}>
						{(id) => (
							<Choice
								id={id}
								label={t('automation.shell')}
								value={action.shell}
								options={[
									{ value: 'bash', label: 'Bash' },
									{ value: 'powershell', label: 'PowerShell' },
								]}
								onChange={(value) =>
									onChange((d) => {
										if (d.action.kind === 'script') d.action.shell = value as 'bash' | 'powershell';
									})
								}
							/>
						)}
					</Field>
				)}
				{action.kind === 'agent' && <SessionField draft={draft} onChange={onChange} service={host.service} />}
				<div className="border-t border-border/50 pt-4">
					{draft.source?.kind === 'widget' ? (
						<p className="text-xs text-muted-foreground">{t('automation.widgetSchedule')}</p>
					) : actionDescriptors.find((item) => item.kind === action.kind)?.scheduled ? (
						<SchedulePicker draft={draft} onChange={onChange} />
					) : (
						<p className="text-xs text-muted-foreground">{t('automation.manualOnly')}</p>
					)}
				</div>
				<Field label={t('automation.grace')}>
					{(id) => (
						<Choice
							id={id}
							label={t('automation.grace')}
							value={String(draft.graceMinutes)}
							options={[...new Set([0, 15, 60, 720, 1440, draft.graceMinutes])].map((value) => ({
								value: String(value),
								label:
									value === 0
										? t('automation.noGrace')
										: value < 60
											? t('automation.minutes', { count: value })
											: t('automation.hours', { count: value / 60 }),
							}))}
							onChange={(value) =>
								onChange((d) => {
									d.graceMinutes = Number(value);
								})
							}
						/>
					)}
				</Field>
				<div className="border-t border-border/50 pt-4">
					<PrecheckField draft={draft} onChange={onChange} />
				</div>
				<Field label={t('automation.notifyOn')}>
					{(id) => (
						<Choice
							id={id}
							label={t('automation.notifyOn')}
							value={draft.notifyOn}
							options={['always', 'failure', 'never'].map((value) => ({
								value,
								label: t(`automation.${value}`),
							}))}
							onChange={(value) =>
								onChange((d) => {
									d.notifyOn = value as typeof d.notifyOn;
								})
							}
						/>
					)}
				</Field>
				<Field label={t('automation.channels')}>
					{(id) => (
						<div className="flex flex-wrap items-center gap-4">
							{(['in-app', 'system'] as const).map((channel) => (
								<div key={channel} className="flex items-center gap-2">
									<Checkbox
										id={`${id}-${channel}`}
										checked={draft.channels.includes(channel)}
										onCheckedChange={(checked) =>
											onChange((d) => {
												d.channels = checked
													? [...new Set([...d.channels, channel])]
													: d.channels.filter((item) => item !== channel);
											})
										}
									/>
									<Label htmlFor={`${id}-${channel}`}>{t(`automation.${channel}`)}</Label>
								</div>
							))}
						</div>
					)}
				</Field>
			</div>
		</aside>
	);
}
