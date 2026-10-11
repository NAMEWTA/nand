import { useState } from 'preact/hooks';
import type { SkillShortcut } from '../../core/board/types/model';
import { skillError, skillPrompt } from '../../services/skill-shortcuts';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { IconButton } from '../../../../ui/primitives/IconButton';
import { Icon } from '../../../../ui/primitives/Icon';
import { TextField } from '../../../../ui/primitives/TextField';
import { SkillTarget, useSkillAgents } from './SkillTarget';
import { SkillNameField } from './SkillNameField';
import { homeServices } from '../../services/instances';

export function SkillWidget({ skills, save, run, configureOnly = false }: {
	skills: readonly SkillShortcut[]; save(this: void, skills: SkillShortcut[]): Promise<void>; run(this: void, skill: SkillShortcut): Promise<unknown>;
	configureOnly?: boolean;
}) {
	const { agents } = useSkillAgents();
	const choices = agents.length ? agents : homeServices.skills?.()?.targets() ?? [];
	const [draft, setDraft] = useState<SkillShortcut | null>(null);
	const [editing, setEditing] = useState(configureOnly);
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState('');
	const patch = (change: Partial<SkillShortcut>) => setDraft(value => value ? { ...value, ...change } : null);
	const persist = async (next: SkillShortcut[]) => {
		setPending('save'); setError('');
		try { await save(next); setDraft(null); }
		catch { setError(t('home.skills.saveFailed')); }
		finally { setPending(null); }
	};
	const submit = () => {
		if (!draft) return;
		try { skillPrompt(draft, {}); }
		catch (error) { setError(skillError(error)); return; }
		const index = skills.findIndex(skill => skill.id === draft.id);
		const next = [...skills]; if (index < 0) next.push(draft); else next[index] = draft;
		void persist(next);
	};
	return <section class="dashboard-sidebar-widget nand-skills-widget nand-ui-stack">
		<div class="nand-ui-toolbar"><strong>{t('home.widget.skills')}</strong><span class="nand-ui-spacer" />{!configureOnly && <IconButton icon="settings" label={t('home.skills.configure')} pressed={editing} onClick={() => { setEditing(!editing); setDraft(null); setError(''); }} />}</div>
		{agents.length === 0 && <p role="status">{t('quickActions.skillUnavailable')}</p>}
		{skills.length === 0 && !draft && <p>{t('home.skills.empty')}</p>}
		{skills.map(skill => <div class="nand-skills-row" key={skill.id} data-skill-id={skill.id}>
			{configureOnly ? <span>{skill.label}</span> : <Button disabled={pending !== null || !agents.some(agent => agent.id === skill.agentId && agent.enabled)} onClick={() => {
				if (pending) return; setPending(skill.id);
				void run(skill).finally(() => setPending(null));
			}}><Icon name={skill.icon || 'sparkles'} />{skill.label}</Button>}
			{editing && <><IconButton icon="pencil" label={t('home.skills.edit', { name: skill.label })} disabled={pending !== null} onClick={() => { setDraft(structuredClone(skill)); setError(''); }} />
				<IconButton icon="trash-2" label={t('home.skills.remove', { name: skill.label })} disabled={pending !== null} onClick={() => { void persist(skills.filter(row => row.id !== skill.id)); }} /></>}
		</div>)}
		{(editing || !skills.length) && !draft && <Button disabled={pending !== null} onClick={() => { setDraft({ id: crypto.randomUUID(), label: '', agentId: agents[0]?.id ?? 'codex', skillName: '', promptTemplate: '', directSend: false, destination: { kind: 'fresh', cwd: '' } }); setError(''); }}>{t('home.skills.add')}</Button>}
		{draft && <div class="nand-ui-stack nand-skills-editor">
			<TextField label={t('home.skills.label')} value={draft.label} onInput={label => patch({ label })} />
			<TextField label={t('home.skills.icon')} value={draft.icon ?? ''} onInput={icon => patch({ icon })} />
			<label class="nand-field"><span class="nand-field-label">{t('home.skills.agent')}</span><select value={draft.agentId} onChange={event => patch({ agentId: event.currentTarget.value })}>
				{!choices.some(agent => agent.id === draft.agentId) && <option value={draft.agentId}>{draft.agentId}</option>}
				{choices.map(agent => <option key={agent.id} value={agent.id}>{agent.title}</option>)}
			</select></label>
			<SkillNameField agentId={draft.agentId} value={draft.skillName} change={skillName => patch({ skillName })} />
			<TextField label={t('home.skills.template')} hint={t('home.skills.variables')} multiline value={draft.promptTemplate} onInput={promptTemplate => patch({ promptTemplate })} />
			<TextField label={t('home.skills.inputPlaceholder')} value={draft.inputPlaceholder ?? ''} onInput={inputPlaceholder => patch({ inputPlaceholder })} />
			<SkillTarget agentId={draft.agentId} value={draft.destination} change={destination => patch({ destination })} />
			<label class="nand-skills-check"><input type="checkbox" checked={draft.directSend} onChange={event => patch({ directSend: event.currentTarget.checked })} />{t('home.skills.directSend')}</label>
			<p class="nand-field-hint">{t('home.skills.directSendHint')}</p>
			<div class="nand-ui-toolbar"><Button disabled={pending !== null} onClick={() => { setDraft(null); setError(''); }}>{t('common.cancel')}</Button><Button variant="primary" disabled={pending !== null || !draft.label.trim() || (!draft.skillName.trim() && !draft.promptTemplate.trim()) || (draft.destination.kind === 'existing' && !draft.destination.sessionId)} onClick={submit}>{t('common.save')}</Button></div>
		</div>}
		{error && <p role="alert">{error}</p>}
	</section>;
}
