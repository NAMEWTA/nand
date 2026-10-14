// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-note-config-modal.ts
import { Trash2 } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
import { Switch } from '../../../../ui/components/switch';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { SkillShortcut } from '../../core/board/types/model';
import { IconButton, Choice } from '../board/controls';
import { DashboardIconPicker } from './DashboardIconPicker';
import { DraftList } from './DraftList';
export function SkillList({
	store,
	skills,
	onChange,
}: {
	store: BoardStore;
	skills: SkillShortcut[];
	onChange(this: void, skills: SkillShortcut[]): void;
}) {
	const t = useT(),
		agents = store.widgets.agents?.() ?? [];
	const update = (id: string, value: Partial<SkillShortcut>) =>
		onChange(skills.map((skill) => (skill.id === id ? { ...skill, ...value } : skill)));
	return (
		<section className="grid gap-2">
			<h3 className="text-sm font-semibold">{t('home.dashboard.skills')}</h3>
			<DraftList items={skills} onChange={onChange}>
				{(skill) => (
					<div className="grid gap-2 rounded-md border p-2">
						<div className="flex gap-2">
							<DashboardIconPicker
								value={skill.icon || 'sparkles'}
								onChange={(icon) => update(skill.id, { icon })}
							/>
							<Input
								value={skill.label}
								aria-label={t('home.dashboard.name')}
								onChange={(e) => update(skill.id, { label: e.target.value })}
							/>
							<IconButton
								label={t('common.delete')}
								onClick={() => onChange(skills.filter((v) => v.id !== skill.id))}
							>
								<Trash2 />
							</IconButton>
						</div>
						<Choice
							label={t('home.dashboard.agent')}
							value={skill.agentId || '_none'}
							onChange={(value) => update(skill.id, { agentId: value === '_none' ? '' : value })}
							options={[
								{ value: '_none', label: t('home.dashboard.agent') },
								...agents.map((agent) => ({ value: agent.id, label: agent.title })),
							]}
						/>
						<Input
							aria-label={t('home.dashboard.skill')}
							placeholder={t('home.dashboard.skill')}
							value={skill.skillName}
							onChange={(e) => update(skill.id, { skillName: e.target.value })}
						/>
						<Textarea
							aria-label={t('home.dashboard.prompt')}
							value={skill.promptTemplate}
							onChange={(e) => update(skill.id, { promptTemplate: e.target.value })}
						/>
						<Input
							aria-label={t('home.dashboard.cwd')}
							placeholder={t('home.dashboard.cwd')}
							value={skill.destination.kind === 'fresh' ? skill.destination.cwd : ''}
							onChange={(e) => update(skill.id, { destination: { kind: 'fresh', cwd: e.target.value } })}
						/>
						<Label className="flex gap-2">
							<Switch
								checked={skill.directSend}
								onCheckedChange={(directSend) => update(skill.id, { directSend })}
							/>
							{t('home.dashboard.directSend')}
						</Label>
					</div>
				)}
			</DraftList>
			<Button
				variant="outline"
				size="sm"
				onClick={() =>
					onChange([
						...skills,
						{
							id: crypto.randomUUID(),
							label: '',
							icon: 'sparkles',
							agentId: '',
							skillName: '',
							promptTemplate: '{{input}}',
							directSend: false,
							destination: { kind: 'fresh', cwd: '' },
						},
					])
				}
			>
				{t('common.add')}
			</Button>
		</section>
	);
}
