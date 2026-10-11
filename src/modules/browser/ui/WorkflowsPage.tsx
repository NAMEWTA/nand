import { Platform } from 'obsidian';
import { useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserWorkflowSpec, WorkflowReview, WorkflowValue } from '../core/workflows/model';
import { workflowScopeMatches } from '../core/workflows/validate';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import type { BrowserWorkflows } from '../services/workflows';
import { WorkflowEditor } from './WorkflowEditor';
import { WorkflowRun } from './WorkflowRun';

export function WorkflowsPage({ module, workflows, resourceId }: { module: BrowserModule; workflows: BrowserWorkflows; resourceId?: string }) {
	const [selected, setSelected] = useState(''), [inputs, setInputs] = useState<Record<string, string>>({}), [targets, setTargets] = useState<Record<string, string>>({});
	const [editor, setEditor] = useState<{ draft: BrowserWorkflowSpec; original?: BrowserWorkflowSpec }>(), [preview, setPreview] = useState<WorkflowReview>();
	const [failure, setFailure] = useState<unknown>(), [busy, setBusy] = useState(false), locked = useRef(false);
	const definitions = workflows.definitions(), definition = definitions.find(row => row.id === selected), pages = module.control.list();
	const records = workflows.records().filter(run => !resourceId || run.runId === resourceId || run.spec.id === resourceId);
	const work = (action: () => Promise<unknown>) => { if (locked.current) return; locked.current = true; setBusy(true); setFailure(undefined);
		void action().catch(setFailure).finally(() => { locked.current = false; setBusy(false); }); };
	const change = (action: () => void) => { setPreview(undefined); action(); };
	const choose = (id: string) => change(() => { setSelected(id); setInputs({}); setTargets({}); });
	return <div class="nand-browser-workspace nand-browser-workflows"><h2>{t('browser.workflow.title')}</h2><p>{t('browser.workflow.intro')}</p>
		{failure && <p role="alert">{browserError(failure)}</p>}
		{!Platform.isDesktopApp && <p role="status">{t('browser.browser_workspace_desktop')}</p>}
		{Platform.isDesktopApp && <>
			<Button disabled={busy || !!editor} onClick={() => { const now = Date.now(); setEditor({ draft: { id: crypto.randomUUID(), version: 1, title: '', description: '', variables: [], targetScope: [], steps: [], consequenceClass: 'read-only', createdAt: now, updatedAt: now } }); }}>
				{t('browser.workflow.new')}</Button>
			{editor && <WorkflowEditor key={editor.draft.id} module={module} initial={editor.draft} busy={busy} close={() => setEditor(undefined)} save={spec => work(async () => {
				const saved = await workflows.save(spec, editor.original); setEditor(undefined); choose(saved.id);
			})} />}
			<label class="nand-field"><span class="nand-field-label">{t('browser.workflow.saved')}</span><select value={selected} disabled={busy || !!editor} onChange={event => choose(event.currentTarget.value)}>
				<option value="">{t('browser.workspace.synthesis.choose')}</option>{definitions.map(spec => <option key={spec.id} value={spec.id}>{spec.title} · {t('browser.workflow.version', { version: spec.version })}</option>)}
			</select></label>
			{definition && !editor && <section class="nand-browser-workspace-preview"><h3>{definition.title}</h3><p>{definition.description}</p>
				<p>{t(definition.verification ? 'browser.workflow.verified' : 'browser.workflow.unverified')}</p>
				<Button disabled={busy} onClick={() => { setPreview(undefined); setEditor({ draft: structuredClone(definition), original: structuredClone(definition) }); }}>{t('browser.workflow.edit')}</Button>
				<fieldset disabled={busy}><legend>{t('browser.workflow.inputs')}</legend>
					{definition.variables.map(variable => <label class="nand-field" key={variable.name}><span class="nand-field-label">{variable.name} · {t('browser.workflow.type.' + variable.type)}{variable.required ? ` · ${t('browser.workflow.required')}` : ''}</span>
						{variable.type === 'boolean' ? <select value={inputs[variable.name] ?? (variable.default === undefined ? '' : String(variable.default))} onChange={event => change(() => setInputs({ ...inputs, [variable.name]: event.currentTarget.value }))}>
							<option value="">{t('browser.workflow.unset')}</option><option value="true">{t('browser.workflow.true')}</option><option value="false">{t('browser.workflow.false')}</option>
						</select> : <input type={variable.type === 'secret' ? 'password' : variable.type === 'number' ? 'number' : 'text'} autoComplete="off" value={inputs[variable.name] ?? (variable.default === undefined ? '' : String(variable.default))}
							onInput={event => change(() => setInputs({ ...inputs, [variable.name]: event.currentTarget.value }))} />}
					</label>)}
				</fieldset>
				<fieldset disabled={busy}><legend>{t('browser.workflow.targets')}</legend>{definition.targetScope.map(scope => <label class="nand-field" key={scope.id}>
					<span class="nand-field-label">{scope.id} · {scope.origin}{scope.pathPrefix}</span><select value={targets[scope.id] ?? ''} onChange={event => change(() => setTargets({ ...targets, [scope.id]: event.currentTarget.value }))}>
						<option value="">{t('browser.workflow.choosePage')}</option>{pages.filter(page => workflowScopeMatches(scope, page.target.profileId, page.url)).map(page => <option key={page.target.pageId} value={page.target.pageId}>{page.title || page.url} · {page.url}</option>)}
					</select></label>)}</fieldset>
				<Button disabled={busy || definition.targetScope.some(scope => !targets[scope.id])} onClick={() => work(async () => {
					const values: Record<string, WorkflowValue> = {};
					for (const variable of definition.variables) { const value = inputs[variable.name]; if (value === undefined || (value === '' && variable.type !== 'text' && variable.type !== 'secret')) continue;
						values[variable.name] = variable.type === 'number' ? Number(value) : variable.type === 'boolean' ? value === 'true' : value; }
					setPreview(await workflows.review(definition.id, values, definition.targetScope.map(scope => ({ id: scope.id, profileId: scope.profileId, pageId: targets[scope.id]! }))));
				})}>{t('browser.workflow.review')}</Button>
				{preview && <section data-workflow-review={preview.id}><h4>{t('browser.workflow.review')}</h4><p>{t('browser.workflow.reviewHelp')}</p>
					<ul>{preview.bindings.map(binding => <li key={binding.scopeId}>{binding.title} · {binding.accountLabel} · {binding.url}</li>)}</ul>
					<dl>{Object.entries(preview.action.variables).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}
						{preview.secretNames.map(name => <div key={name}><dt>{name}</dt><dd>{t('browser.workflow.runtimeOnly')}</dd></div>)}</dl>
					<ol>{preview.spec.steps.map(step => <li key={step.id}>{t('browser.workflow.operation.' + step.operation)} · {step.target}</li>)}</ol>
					<Button variant="primary" disabled={busy} onClick={() => work(async () => { const id = preview.id; setPreview(undefined); setInputs({}); await workflows.invoke(id); })}>{t('browser.workflow.start')}</Button>
				</section>}
			</section>}
		</>}
		<section><h3>{t('browser.workflow.history')}</h3>{!records.length && <p>{t('browser.workflow.empty')}</p>}
			{records.map(record => <WorkflowRun key={record.runId} module={module} workflows={workflows} record={record} work={work} />)}</section>
	</div>;
}
