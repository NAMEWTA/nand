// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/terminal-quick-commands/TerminalQuickCommandDialog.tsx
import { useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../../../../ui/components/dialog';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Button } from '../../../../ui/components/button';
import { SegmentedControl } from '../../../../ui/components/nand/SettingsFormControls';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../../ui/components/select';
import { useT } from '../../../../ui/react/hooks';
import { AGENT_CATALOG } from '../../core/launch/catalog';
import type { QuickCommand } from '../../core/terminal/settings';
import type { AgentController } from '../../services/controller';
export function newQuickCommand(): QuickCommand {
	return {
		id: crypto.randomUUID(),
		name: '',
		type: 'terminal',
		content: '',
		agentId: 'claude-code',
		cwd: '',
		scope: 'vault',
	};
}
export function QuickCommandEditor({
	command,
	controller,
	close,
}: {
	command: QuickCommand;
	controller: AgentController;
	close: () => void;
}) {
	const t = useT(),
		[draft, setDraft] = useState(command),
		[pending, setPending] = useState(false),
		[error, setError] = useState('');
	const save = async () => {
		setPending(true);
		try {
			await controller.settings.update((d) => {
				const next = { ...draft, name: draft.name.trim() };
				d.quickCommands = d.quickCommands.some((c) => c.id === next.id)
					? d.quickCommands.map((c) => (c.id === next.id ? next : c))
					: [...d.quickCommands, next];
			});
			close();
		} catch (e) {
			setError(String(e));
		} finally {
			setPending(false);
		}
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) close();
			}}
		>
			<DialogContent className="flex max-h-[min(90vh,52rem)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
				<DialogHeader className="px-6 pt-6 pb-0">
					<DialogTitle className="text-sm">{t('agent.quick.edit')}</DialogTitle>
					<DialogDescription className="text-xs">{t('agent.quick.hint')}</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
					<div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
						<label className="space-y-2 text-sm">
							{t('agent.quick.name')}
							<Input
								autoFocus
								value={draft.name}
								onChange={(e) => setDraft({ ...draft, name: e.target.value })}
							/>
						</label>
						<SegmentedControl
							value={draft.type}
							onChange={(type) => setDraft({ ...draft, type })}
							ariaLabel={t('agent.quick.type')}
							options={[
								{ value: 'terminal', label: t('agent.quick.terminal') },
								{ value: 'agent', label: t('agent.quick.agent') },
							]}
						/>
					</div>
					{draft.type === 'agent' && (
						<Select
							value={draft.agentId}
							onValueChange={(agentId) =>
								setDraft({ ...draft, agentId: agentId as QuickCommand['agentId'] })
							}
						>
							<SelectTrigger aria-label={t('agent.quick.agent')}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{AGENT_CATALOG.map((a) => (
									<SelectItem key={a.id} value={a.id}>
										{a.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					<label className="space-y-2 text-sm">
						{t(draft.type === 'agent' ? 'agent.quick.prompt' : 'agent.quick.content')}
						<Textarea
							value={draft.content}
							className="min-h-40 font-mono text-sm"
							onChange={(e) => setDraft({ ...draft, content: e.target.value })}
						/>
					</label>
					<label className="space-y-2 text-sm">
						{t('agent.quick.cwd')}
						<Input
							value={draft.cwd}
							placeholder={controller.vaultPath()}
							onChange={(e) => setDraft({ ...draft, cwd: e.target.value })}
						/>
					</label>
					<SegmentedControl
						value={draft.scope}
						onChange={(scope) => setDraft({ ...draft, scope })}
						ariaLabel={t('agent.quick.scope')}
						options={[
							{ value: 'global', label: t('agent.quick.global') },
							{ value: 'vault', label: t('agent.quick.vault') },
						]}
					/>
					<p className="text-xs text-muted-foreground">{t('agent.quick.scopeHint')}</p>
					{error && (
						<p role="alert" className="text-xs text-destructive">
							{error}
						</p>
					)}
				</div>
				<DialogFooter className="border-t px-6 py-4">
					<Button variant="ghost" onClick={close} disabled={pending}>
						{t('common.cancel')}
					</Button>
					<Button
						onClick={() => {
							void save();
						}}
						disabled={pending || !draft.name.trim() || !draft.content.trim()}
					>
						{t('common.save')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
