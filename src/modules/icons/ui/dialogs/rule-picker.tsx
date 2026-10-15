// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useState } from 'react';
import { Ellipsis, Settings2 } from 'lucide-react';
import type IconicController from '../../platform/host/controller';
import type { RuleItem } from '../../platform/managers/rule-manager';
import { t } from '../../../../shared/i18n';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Switch } from '../../../../ui/components/switch';
import { Choice } from '../../../../ui/components/nand/Choice';
import { ActionButton } from '../../../../ui/components/nand/ActionButton';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../../../../ui/components/dropdown-menu';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '../../../../ui/components/context-menu';
import { IconPreview } from '../IconPreview';
import { ReorderList } from '../ReorderList';
import IconPicker from './icon-picker';
import RuleEditor from './rule-editor';
import { openIconicDialog } from './react-dialog';
export function RulePickerContent({ plugin }: { plugin: IconicController }) {
	const t = useT(),
		[page, setPage] = useState(plugin.settings.dialogState.rulePage),
		[focusId, setFocusId] = useState(''),
		[, render] = useState(0);
	const manager = plugin.ruleManager!,
		rules = manager.getRules(page);
	const refresh = (changed: boolean) => {
		if (changed) plugin.refreshManagers(page);
		render((v) => v + 1);
	};
	const save = (rule: RuleItem) => refresh(manager.saveRule(page, rule));
	const add = (at?: number) => {
		const rule = manager.newRule(page);
		if (at !== undefined) manager.moveRule(page, rule, at);
		setFocusId(rule.id);
		render((v) => v + 1);
	};
	const rows = rules.map((rule, index) => {
		const actions = [
			{ key: 'addRule', run: () => add(index) },
			{
				key: 'duplicateRule',
				run: () => {
					manager.duplicateRule(page, rule);
					render((v) => v + 1);
				},
			},
			{ key: 'moveRuleToTop', disabled: index === 0, run: () => refresh(manager.moveRule(page, rule, 0)) },
			{
				key: 'moveRuleToBottom',
				disabled: index === rules.length - 1,
				run: () => refresh(manager.moveRule(page, rule, rules.length)),
			},
			{ key: 'removeRule', run: () => refresh(manager.deleteRule(page, rule.id)) },
		];
		return {
			id: rule.id,
			content: (
				<ContextMenu>
					<ContextMenuTrigger asChild>
						<div className="flex flex-wrap items-center gap-2">
							<ActionButton
								label={t('iconic.iconPicker.changeIcon')}
								onClick={() =>
									IconPicker.openSingle(plugin, rule, (icon, color) => save({ ...rule, icon, color }))
								}
							>
								<IconPreview icon={rule.icon ?? manager.getPageIcon(page)} color={rule.color} />
							</ActionButton>
							<Input
								key={rule.name}
								className="min-w-36 flex-1"
								aria-label={t('iconic.ruleEditor.enterName')}
								defaultValue={rule.name}
								placeholder={t('iconic.rulePicker.untitledRule')}
								autoFocus={rule.id === focusId}
								onBlur={(e) => {
									setFocusId('');
									const name = e.target.value.trim();
									if (name) save({ ...rule, name });
									else e.target.value = rule.name;
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter') e.currentTarget.blur();
								}}
							/>
							<ActionButton
								label={t('iconic.rulePicker.editRule')}
								onClick={() =>
									RuleEditor.open(plugin, page, rule, (next) =>
										refresh(
											next ? manager.saveRule(page, next) : manager.deleteRule(page, rule.id),
										),
									)
								}
							>
								<Settings2 />
							</ActionButton>
							<Switch
								aria-label={rule.name}
								checked={rule.enabled}
								onCheckedChange={(enabled) => save({ ...rule, enabled })}
							/>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" aria-label={t('iconic.rulePicker.editRule')}>
										<Ellipsis />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									{actions.map((action) => (
										<DropdownMenuItem
											key={action.key}
											disabled={action.disabled}
											onSelect={action.run}
										>
											{t('iconic.rulePicker.' + action.key)}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						{actions.map((action) => (
							<ContextMenuItem key={action.key} disabled={action.disabled} onSelect={action.run}>
								{t('iconic.rulePicker.' + action.key)}
							</ContextMenuItem>
						))}
					</ContextMenuContent>
				</ContextMenu>
			),
		};
	});
	return (
		<div className="space-y-4">
			<Choice
				label={t('iconic.rulePicker.selectPage')}
				value={page}
				options={[
					['file', t('iconic.rulePicker.fileRules')],
					['folder', t('iconic.rulePicker.folderRules')],
				]}
				onChange={(v) => {
					const next = v === 'folder' ? 'folder' : 'file';
					plugin.updateDialogState({ rulePage: next });
					setPage(next);
				}}
			/>
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-semibold">{t('iconic.rulePicker.rules')}</h3>
				<Button onClick={() => add()}>{t('iconic.rulePicker.addRule')}</Button>
			</div>
			<ReorderList
				key={page}
				rows={rows}
				move={(from, to) => {
					const rule = rules[from];
					if (rule) refresh(manager.moveRule(page, rule, to));
				}}
			/>
		</div>
	);
}
export default class RulePicker {
	static open(plugin: IconicController) {
		if (plugin.ruleManager)
			openIconicDialog(plugin, t('iconic.settings.rulebook.name'), () => <RulePickerContent plugin={plugin} />);
	}
}
