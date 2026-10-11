import { useState } from 'preact/hooks';
import type { PipelineConfig as Config, PipelineStage } from '../../core/pipeline/model';
import { pipelineConfigError } from '../../core/pipeline/rules';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { TextField } from '../../../../ui/primitives/TextField';
import { SkillWidget } from '../skills/SkillWidget';

const lines = (value: string) => [...new Set(value.split('\n').map(line => line.trim()).filter(Boolean))];

/** Workflow configuration lives in its section; cancellation never writes the board. */
export function PipelineConfig({ initial, save, close }: { initial: Config; save: (config: Config) => Promise<void>; close: () => void }) {
	const [draft, setDraft] = useState(() => structuredClone(initial)), [pending, setPending] = useState(false), [error, setError] = useState('');
	const patch = (change: Partial<Config>) => setDraft(value => ({ ...value, ...change }));
	const stage = (id: string, change: Partial<PipelineStage>) => patch({ stages: draft.stages.map(stage => stage.id === id ? { ...stage, ...change } : stage) });
	const submit = async () => {
		const invalid = pipelineConfigError(draft);
		if (invalid) { setError(t(`home.pipeline.configError.${invalid}`)); return; }
		setPending(true); setError('');
		try { await save(draft); close(); } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
		finally { setPending(false); }
	};
	return <section class="nand-ui-stack nand-pipeline-config">
		<h4>{t('home.pipeline.configure')}</h4>
		<TextField label={t('home.pipeline.root')} value={draft.rootFolder} onInput={rootFolder => patch({ rootFolder })} />
		<TextField label={t('home.pipeline.field')} value={draft.statusField} onInput={statusField => patch({ statusField })} />
		{draft.stages.map(item => <fieldset key={item.id} class="nand-ui-stack"><legend>{item.label || t('home.pipeline.stage')}</legend>
			<TextField label={t('home.pipeline.stageLabel')} value={item.label} onInput={label => stage(item.id, { label })} />
			<TextField label={t('home.pipeline.stageValue')} value={item.value} onInput={value => stage(item.id, { value })} />
			<TextField label={t('home.pipeline.stageFolder')} value={item.folder ?? ''} onInput={folder => stage(item.id, { folder: folder || undefined })} />
			<Button onClick={() => patch({ stages: draft.stages.filter(stage => stage.id !== item.id) })}>{t('home.pipeline.removeStage')}</Button>
		</fieldset>)}
		<Button onClick={() => patch({ stages: [...draft.stages, { id: crypto.randomUUID(), label: '', value: '' }] })}>{t('home.pipeline.addStage')}</Button>
		<TextField label={t('home.pipeline.excludes')} hint={t('home.pipeline.linesHint')} multiline value={draft.excludeFolders.join('\n')} onInput={value => patch({ excludeFolders: lines(value) })} />
		<TextField label={t('home.pipeline.archiveFolder')} value={draft.archiveFolder ?? ''} onInput={archiveFolder => patch({ archiveFolder: archiveFolder || undefined })} />
		<TextField label={t('home.pipeline.templates')} hint={t('home.pipeline.linesHint')} multiline value={draft.templatePaths.join('\n')} onInput={value => patch({ templatePaths: lines(value) })} />
		<TextField label={t('home.pipeline.filterFields')} hint={t('home.pipeline.linesHint')} multiline value={draft.filterFields.join('\n')} onInput={value => patch({ filterFields: lines(value) })} />
		<p>{t('home.pipeline.skillsDraftHint')}</p>
		<SkillWidget configureOnly skills={draft.skills} run={async () => undefined} save={async next => patch({ skills: next.map(skill => ({ ...skill, scope: draft.skills.find(item => item.id === skill.id)?.scope ?? 'card', stages: draft.skills.find(item => item.id === skill.id)?.stages ?? [] })) })} />
		{draft.skills.map(skill => <fieldset key={skill.id} class="nand-ui-stack"><legend>{skill.label}</legend>
			<label class="nand-field"><span>{t('home.pipeline.skillScope')}</span><select value={skill.scope} onChange={event => patch({ skills: draft.skills.map(item => item.id === skill.id ? { ...item, scope: event.currentTarget.value === 'stage' ? 'stage' : 'card' } : item) })}>
				<option value="card">{t('home.pipeline.cardScope')}</option><option value="stage">{t('home.pipeline.stageScope')}</option>
			</select></label>
			<TextField label={t('home.pipeline.skillStages')} hint={t('home.pipeline.skillStagesHint')} multiline value={skill.stages.join('\n')} onInput={value => patch({ skills: draft.skills.map(item => item.id === skill.id ? { ...item, stages: lines(value) } : item) })} />
		</fieldset>)}
		{error && <p role="alert">{error}</p>}
		<div class="nand-ui-toolbar"><Button disabled={pending} onClick={close}>{t('common.cancel')}</Button><Button variant="primary" disabled={pending} onClick={() => { void submit(); }}>{t('common.save')}</Button></div>
	</section>;
}
