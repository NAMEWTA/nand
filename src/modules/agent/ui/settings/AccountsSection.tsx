// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/AgentsPane.tsx
import { useStore } from 'zustand';
import { useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '../../../../ui/components/dialog';
import { useT } from '../../../../ui/react/hooks';
import { AGENT_CATALOG } from '../../core/launch/catalog';
import type { AgentId } from '../../core/launch/types';
import type { AgentController } from '../../services/controller';
import { useAgentSettings } from './settings-context';
export function AccountsSection({ controller }: { controller: AgentController }) {
	const usage = useStore(controller.usageStore.store);
	const t = useT(),
		settings = useAgentSettings(controller.settings),
		[editing, setEditing] = useState<{ id: AgentId; original?: string }>(),
		[name, setName] = useState(''),
		[error, setError] = useState(''),
		[pending, setPending] = useState(false);
	return (
		<SettingsSection title={t('agent.manage.accounts')}>
			{AGENT_CATALOG.map((a) => (
				<section key={a.id} className="space-y-2 rounded-lg border border-border/50 p-3">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-medium">{a.title}</h4>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setName('');
								setError('');
								setEditing({ id: a.id });
							}}
						>
							{t('agent.manage.addAccount')}
						</Button>
					</div>
					{[...new Set(['', settings.agents.agents[a.id].accountId, ...(settings.accounts[a.id] ?? [])])].map(
						(id) => (
							<div key={id} className="flex flex-wrap items-center gap-2 text-xs">
								<span className="min-w-0 flex-1 truncate">
									{settings.accountLabels[a.id]?.[id] || id || t('agent.manage.defaultAccount')}
								</span>
								{settings.agents.agents[a.id].accountId === id && (
									<span className="text-muted-foreground">
										{usage.providers.find((p) => p.id === a.id)?.statusLabel}
										{usage.providers
											.find((p) => p.id === a.id)
											?.windows.map((w) => ` · ${w.label} ${Math.round(w.usedPercent)}%`)
											.join('')}
									</span>
								)}
								<Button
									size="xs"
									variant={settings.agents.agents[a.id].accountId === id ? 'secondary' : 'ghost'}
									onClick={() => {
										void controller
											.selectAccount(a.id, id)
											.catch((e) => controller.workspace.report(e));
									}}
								>
									{t(
										settings.agents.agents[a.id].accountId === id
											? 'agent.manage.current'
											: 'agent.manage.setCurrent',
									)}
								</Button>
								{id && (
									<>
										<Button
											size="xs"
											variant="ghost"
											onClick={() => {
												setName(settings.accountLabels[a.id]?.[id] || id);
												setError('');
												setEditing({ id: a.id, original: id });
											}}
										>
											{t('agent.rename')}
										</Button>
										<Button
											size="xs"
											variant="ghost"
											className="text-destructive"
											onClick={() => {
												void controller
													.removeAccount(a.id, id)
													.catch((e) => controller.workspace.report(e));
											}}
										>
											{t('agent.manage.remove')}
										</Button>
									</>
								)}
							</div>
						),
					)}
				</section>
			))}
			{editing && (
				<Dialog
					open
					onOpenChange={(open) => {
						if (!open && !pending) setEditing(undefined);
					}}
				>
					<DialogContent>
						<DialogTitle>{t(editing.original ? 'agent.rename' : 'agent.manage.addAccount')}</DialogTitle>
						<DialogDescription>{t('agent.manage.accountHint')}</DialogDescription>
						<Input
							autoFocus
							value={name}
							aria-label={t('agent.manage.accountName')}
							onChange={(e) => setName(e.target.value)}
						/>
						{error && (
							<p role="alert" className="text-xs text-destructive">
								{error}
							</p>
						)}
						<DialogFooter>
							<Button
								disabled={pending || !name.trim()}
								onClick={() => {
									setPending(true);
									void (
										editing.original
											? controller.settings.update((d) => {
													(d.accountLabels[editing.id] ??= {})[editing.original!] =
														name.trim();
												})
											: controller.addAccount(editing.id, name.trim())
									)
										.then(() => setEditing(undefined))
										.catch((e) => setError(String(e)))
										.finally(() => setPending(false));
								}}
							>
								{t('common.save')}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</SettingsSection>
	);
}
