// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/AgentCatalogRow.tsx, AgentLaunchDefaultsEditor.tsx
import { useState } from 'react';
import { Check, ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { SegmentedControl } from '../../../../ui/components/nand/SettingsFormControls';
import { useT } from '../../../../ui/react/hooks';
import { cn } from '../../../../ui/lib/utils';
import type { AgentCatalogEntry } from '../../core/launch/catalog';
import type { AgentController } from '../../services/controller';
import { useAgentSettings } from './settings-context';
export function AgentCatalogRow({
	agent,
	controller,
	detected,
}: {
	agent: AgentCatalogEntry;
	controller: AgentController;
	detected: boolean;
}) {
	const t = useT(),
		settings = useAgentSettings(controller.settings),
		override = settings.overrides[agent.id] ?? {};
	const [open, setOpen] = useState(false),
		[envError, setEnvError] = useState('');
	const enabled = settings.enabled[agent.id],
		isDefault = controller.agents.list()[0]?.id === agent.id;
	const args = override.args ?? (settings.permissionMode === 'yolo' ? agent.yoloFlags.join(' ') : '');
	const run = (action: Promise<unknown>) => {
		void action.catch((e) => controller.workspace.report(e));
	};
	return (
		<div className={cn('py-3', !detected && 'opacity-70')} data-agent-catalog={agent.id}>
			<div className="flex flex-wrap items-start gap-3">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50">
					<AgentIcon agent={agent.id} size={16} />
				</div>
				<div className="min-w-0 flex-1 sm:min-w-[12rem]">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium leading-none">{agent.title}</span>
						{!enabled && (
							<span className="text-xs text-muted-foreground">{t('agent.manage.disabled')}</span>
						)}
					</div>
					<div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
						{override.command ? (
							<>
								<span className="text-muted-foreground/60 line-through">{agent.detectCommand}</span>
								<span className="ml-1.5 text-foreground/80">{override.command}</span>
							</>
						) : (
							agent.detectCommand
						)}
						<span className="ml-1.5 text-foreground/70">{args}</span>
					</div>
				</div>
				<div className="ml-auto grid shrink-0 grid-cols-[max-content_6.5rem_1.75rem_1.75rem] items-center gap-1.5">
					<SegmentedControl
						value={enabled ? 'enabled' : 'disabled'}
						onChange={(v) => run(controller.agents.setEnabled(agent.id, v === 'enabled'))}
						ariaLabel={agent.title}
						size="sm"
						options={[
							{ value: 'enabled', label: t('agent.manage.enabled') },
							{ value: 'disabled', label: t('agent.manage.disabled') },
						]}
					/>
					<div className="flex justify-start">
						{detected && enabled && (
							<Button
								variant={isDefault ? 'secondary' : 'ghost'}
								size="xs"
								className="h-7 w-full justify-center gap-1 text-xs"
								onClick={() => run(controller.agents.setDefault(agent.id))}
							>
								{isDefault && <Check className="size-3" />}
								{t(isDefault ? 'agent.manage.default' : 'agent.manage.setDefault')}
							</Button>
						)}
					</div>
					<a
						href={agent.installDocsUrl}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={t('agent.manage.docs')}
						className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
					>
						<ExternalLink className="size-3.5" />
					</a>
					<Button
						variant="ghost"
						size="icon-sm"
						className="size-7 text-muted-foreground"
						aria-label={t('agent.manage.override')}
						aria-expanded={open}
						onClick={() => setOpen(!open)}
					>
						<ChevronDown className={cn('size-3.5', open && 'rotate-180')} />
					</Button>
				</div>
			</div>
			{open && (
				<div className="mt-3 space-y-2 pl-10">
					<label className="flex flex-col gap-1 text-xs text-muted-foreground">
						{t('agent.manage.command')}
						<Input
							key={override.command}
							defaultValue={override.command || ''}
							placeholder={agent.detectCommand}
							className="h-7 flex-1 font-mono text-xs"
							onBlur={(e) => run(controller.agents.saveOverride(agent.id, { command: e.target.value }))}
						/>
					</label>
					<label className="flex flex-col gap-1 text-xs text-muted-foreground">
						{t('agent.manage.args')}
						<div className="flex items-center gap-2">
							<Input
								key={args}
								aria-label={t('agent.manage.args')}
								defaultValue={args}
								className="h-7 flex-1 font-mono text-xs"
								onBlur={(e) => {
									// Inherited permission flags are display defaults, not an explicit override.
									if (e.target.value !== args)
										run(controller.agents.saveOverride(agent.id, { args: e.target.value }));
								}}
							/>
							<Button
								variant="ghost"
								size="xs"
								aria-label={t('agent.manage.reset')}
								onClick={() => run(controller.agents.saveOverride(agent.id, { args: undefined }))}
							>
								{t('agent.manage.reset')}
							</Button>
						</div>
					</label>
					<label className="flex flex-col gap-1 text-xs text-muted-foreground">
						{t('agent.manage.env')}
						<Textarea
							defaultValue={Object.entries(override.env ?? {})
								.map(([k, v]) => `${k}=${v}`)
								.join('\n')}
							className="font-mono text-xs"
							aria-invalid={!!envError}
							onBlur={(e) => {
								const lines = e.target.value.split('\n').filter((line) => line.trim());
								if (lines.some((line) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(line))) {
									setEnvError(t('agent.manage.envInvalid'));
									return;
								}
								setEnvError('');
								run(
									controller.agents.saveOverride(agent.id, {
										env: Object.fromEntries(
											lines.map((line) => {
												const at = line.indexOf('=');
												return [line.slice(0, at), line.slice(at + 1)];
											}),
										),
									}),
								);
							}}
						/>
					</label>
					{envError && (
						<p role="alert" className="text-xs text-destructive">
							{envError}
						</p>
					)}
					<p className="mt-2 text-[11px] text-muted-foreground">{t('agent.manage.overrideHint')}</p>
				</div>
			)}
		</div>
	);
}
