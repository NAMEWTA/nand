import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { BrowserWorkflowSpec, WorkflowCondition, WorkflowLocator, WorkflowOperation, WorkflowStep, WorkflowVariable } from '../core/workflows/model';
import type { BrowserModule } from '../services';
import { browserError } from '../core/text';

function ElementGuide({ module }: { module: BrowserModule }) {
	const [pageId, setPageId] = useState(''), [elements, setElements] = useState<WorkflowLocator[]>([]);
	const [busy, setBusy] = useState(false), [failure, setFailure] = useState<unknown>(), generation = useRef(0);
	useEffect(() => () => { generation.current++; }, []);
	const inspect = async () => {
		const page = module.control.list().find(row => row.target.pageId === pageId); if (!page || busy) return;
		const current = ++generation.current; setBusy(true); setFailure(undefined); setElements([]);
		try { const observation = await module.control.observe(page.target);
			if (current === generation.current) setElements(observation.refs.filter(ref => !ref.ambiguous).map(({ role, name }) => ({ role, name })));
		} catch (error) { if (current === generation.current) setFailure(error); }
		finally { if (current === generation.current) setBusy(false); }
	};
	return <details class="nand-browser-workflow-condition"><summary>{t('browser.workflow.inspect')}</summary><p>{t('browser.workflow.inspectHelp')}</p>
		<label class="nand-field"><span class="nand-field-label">{t('browser.workflow.choosePage')}</span><select value={pageId} disabled={busy} onChange={event => { setPageId(event.currentTarget.value); setElements([]); setFailure(undefined); }}>
			<option value="">{t('browser.workspace.synthesis.choose')}</option>{module.control.list().map(page => <option key={page.target.pageId} value={page.target.pageId}>{page.title || page.url}</option>)}
		</select></label><Button disabled={!pageId || busy} onClick={() => { void inspect(); }}>{t('browser.workflow.inspect')}</Button>
		{failure && <p role="alert">{browserError(failure)}</p>}
		<dl>{elements.map((element, index) => <div key={index}><dt>{element.role}</dt><dd>{element.name}</dd></div>)}</dl>
	</details>;
}

const blankElement = (): WorkflowLocator => ({ role: 'text input', name: '' });
function LocatorEditor({ value, change }: { value: WorkflowLocator; change: (value: WorkflowLocator) => void }) {
	return <div class="nand-browser-workflow-fields"><TextField label={t('browser.workflow.role')} value={value.role} onInput={role => change({ ...value, role })} />
		<TextField label={t('browser.workflow.elementName')} value={value.name} onInput={name => change({ ...value, name })} /></div>;
}
function ConditionEditor({ value, change }: { value: WorkflowCondition; change: (value: WorkflowCondition) => void }) {
	return <div class="nand-browser-workflow-condition"><label class="nand-field"><span class="nand-field-label">{t('browser.workflow.condition')}</span>
		<select value={value.kind} onChange={event => { const kind = event.currentTarget.value as WorkflowCondition['kind']; change(kind === 'url' ? { kind, equals: '' }
			: kind === 'exists' ? { kind, element: blankElement() } : { kind, element: blankElement(), equals: '' }); }}>
			{['url', 'exists', 'value', 'text'].map(kind => <option key={kind} value={kind}>{t('browser.workflow.condition.' + kind)}</option>)}
		</select></label>
		{value.kind !== 'url' && <LocatorEditor value={value.element} change={element => change({ ...value, element })} />}
		{'equals' in value && <TextField label={t('browser.workflow.equals')} value={value.equals} onInput={equals => change({ ...value, equals })} />}
	</div>;
}
const operation = (kind: WorkflowOperation['operation']): WorkflowOperation => kind === 'observe' ? { operation: kind, args: {} }
	: kind === 'navigate' ? { operation: kind, args: { url: '' } } : kind === 'fill' ? { operation: kind, args: { element: blankElement(), value: '' } }
		: kind === 'keypress' ? { operation: kind, args: { element: blankElement(), key: 'Enter' } } : { operation: kind, args: { element: blankElement() } };
const consequence = (steps: WorkflowStep[]): BrowserWorkflowSpec['consequenceClass'] => steps.some(s => s.operation === 'click' || s.operation === 'keypress') ? 'submission'
	: steps.some(s => s.operation === 'fill' || s.operation === 'navigate') ? 'page-input' : 'read-only';

export function WorkflowEditor({ module, initial, busy, save, close }: { module: BrowserModule; initial: BrowserWorkflowSpec; busy: boolean; save: (spec: BrowserWorkflowSpec) => void; close: () => void }) {
	const [draft, setDraft] = useState(initial), [pageId, setPageId] = useState('');
	const pages = module.control.list();
	const step = (index: number, value: WorkflowStep) => setDraft(current => ({ ...current, steps: current.steps.map((old, at) => at === index ? value : old) }));
	const variable = (index: number, value: WorkflowVariable) => setDraft(current => ({ ...current, variables: current.variables.map((old, at) => at === index ? value : old) }));
	return <section class="nand-browser-workspace-preview nand-browser-workflow-editor"><fieldset disabled={busy}>
		<legend>{t('browser.workflow.edit')}</legend><TextField label={t('browser.workflow.name')} value={draft.title} onInput={title => setDraft({ ...draft, title })} />
		<TextField label={t('browser.workflow.description')} value={draft.description} multiline rows={2} onInput={description => setDraft({ ...draft, description })} />
		<h3>{t('browser.workflow.scope')}</h3><p>{t('browser.workflow.scopeHelp')}</p>
		{draft.targetScope.map((scope, index) => <div key={scope.id} class="nand-browser-workflow-condition"><strong>{scope.id}</strong><p>{scope.origin} · {module.profiles().find(p => p.id === scope.profileId)?.label || t('browser.profile.default')}</p>
			<TextField label={t('browser.workflow.path')} value={scope.pathPrefix} onInput={pathPrefix => setDraft({ ...draft, targetScope: draft.targetScope.map((s, at) => at === index ? { ...s, pathPrefix } : s) })} />
			<Button disabled={draft.steps.some(s => s.target === scope.id)} onClick={() => setDraft({ ...draft, targetScope: draft.targetScope.filter(s => s.id !== scope.id) })}>{t('browser.workflow.remove')}</Button>
		</div>)}
		<label class="nand-field"><span class="nand-field-label">{t('browser.workflow.choosePage')}</span><select value={pageId} onChange={event => setPageId(event.currentTarget.value)}>
			<option value="">{t('browser.workspace.synthesis.choose')}</option>{pages.filter(page => /^https?:/.test(page.url)).map(page => <option key={page.target.pageId} value={page.target.pageId}>{page.title || page.url} · {page.target.profileId}</option>)}
		</select></label>
		<Button disabled={!pageId || draft.targetScope.length >= 8} onClick={() => { const page = pages.find(p => p.target.pageId === pageId); if (!page) return; const url = new URL(page.url);
			setDraft({ ...draft, targetScope: [...draft.targetScope, { id: `page-${crypto.randomUUID().slice(0, 8)}`, profileId: page.target.profileId, origin: url.origin, pathPrefix: url.pathname }] }); setPageId('');
		}}>{t('browser.workflow.addScope')}</Button>
		<h3>{t('browser.workflow.variables')}</h3><p>{t('browser.workflow.variablesHelp')}</p>
		{draft.variables.map((value, index) => <div key={index} class="nand-browser-workflow-condition">
			<TextField label={t('browser.workflow.variableName')} value={value.name} onInput={name => variable(index, { ...value, name })} />
			<label class="nand-field"><span class="nand-field-label">{t('browser.workflow.variableType')}</span><select value={value.type} onChange={event => { const next = { ...value, type: event.currentTarget.value as WorkflowVariable['type'] }; delete next.default; variable(index, next); }}>
				{['text', 'number', 'boolean', 'secret'].map(type => <option key={type} value={type}>{t('browser.workflow.type.' + type)}</option>)}
			</select></label>
			<label class="nand-browser-workspace-check"><input type="checkbox" checked={value.required} onChange={event => variable(index, { ...value, required: event.currentTarget.checked })} />{t('browser.workflow.required')}</label>
			{value.type === 'boolean' && <label class="nand-field"><span class="nand-field-label">{t('browser.workflow.default')}</span><select value={value.default === undefined ? '' : String(value.default)} onChange={event => {
				const next = { ...value }; if (event.currentTarget.value === '') delete next.default; else next.default = event.currentTarget.value === 'true'; variable(index, next);
			}}><option value="">{t('browser.workflow.unset')}</option><option value="true">{t('browser.workflow.true')}</option><option value="false">{t('browser.workflow.false')}</option></select></label>}
			{(value.type === 'text' || value.type === 'number') && <TextField label={t('browser.workflow.default')} type={value.type === 'number' ? 'number' : 'text'} value={value.default === undefined ? '' : String(value.default)} onInput={input => {
				const next = { ...value }; if (input === '') delete next.default; else next.default = value.type === 'number' ? Number(input) : input; variable(index, next);
			}} />}
			<Button onClick={() => setDraft({ ...draft, variables: draft.variables.filter((_, at) => at !== index) })}>{t('browser.workflow.remove')}</Button>
		</div>)}
		<Button disabled={draft.variables.length >= 16} onClick={() => setDraft({ ...draft, variables: [...draft.variables, { name: `value${draft.variables.length + 1}`, type: 'text', required: true }] })}>{t('browser.workflow.addVariable')}</Button>
		<h3>{t('browser.workflow.steps')}</h3><p>{t('browser.workflow.stepsHelp')}</p>
		<ElementGuide module={module} />
		{draft.steps.map((value, index) => <details key={value.id} open class="nand-browser-workflow-condition"><summary>{index + 1}. {t('browser.workflow.operation.' + value.operation)}</summary>
			<label class="nand-field"><span class="nand-field-label">{t('browser.workflow.target')}</span><select value={value.target} onChange={event => step(index, { ...value, target: event.currentTarget.value })}>
				{draft.targetScope.map(s => <option key={s.id} value={s.id}>{s.id} · {s.origin}{s.pathPrefix}</option>)}
			</select></label>
			<label class="nand-field"><span class="nand-field-label">{t('browser.workflow.operation')}</span><select value={value.operation} onChange={event => {
				const next = { ...value, ...operation(event.currentTarget.value as WorkflowOperation['operation']) };
				if (next.operation === 'fill') { next.precondition = [{ kind: 'value', element: next.args.element, equals: '' }]; next.postcondition = [{ kind: 'value', element: next.args.element, equals: next.args.value }]; }
				step(index, next);
			}}>{['observe', 'read', 'fill', 'click', 'keypress', 'navigate'].map(kind => <option key={kind} value={kind}>{t('browser.workflow.operation.' + kind)}</option>)}</select></label>
			{'element' in value.args && <LocatorEditor value={value.args.element} change={element => {
				const next = { ...value, args: { ...value.args, element } } as WorkflowStep;
				if (value.operation === 'fill') for (const kind of ['precondition', 'postcondition'] as const) next[kind] = value[kind].map(c => c.kind === 'value' && c.element.role === value.args.element.role && c.element.name === value.args.element.name ? { ...c, element } : c);
				step(index, next);
			}} />}
			{value.operation === 'fill' && <TextField label={t('browser.workflow.fillValue')} value={value.args.value} onInput={input => step(index, { ...value, args: { ...value.args, value: input },
				postcondition: value.postcondition.map(c => c.kind === 'value' && c.equals === value.args.value ? { ...c, equals: input } : c) })} />}
			{value.operation === 'navigate' && <TextField label={t('browser.workflow.url')} value={value.args.url} onInput={url => step(index, { ...value, args: { url } })} />}
			{value.operation === 'keypress' && <TextField label={t('browser.workflow.key')} value={value.args.key} onInput={key => step(index, { ...value, args: { ...value.args, key } })} />}
			{(['precondition', 'postcondition'] as const).map(kind => <fieldset key={kind}><legend>{t('browser.workflow.' + kind)}</legend>
				{value[kind].map((condition, at) => <div key={at}><ConditionEditor value={condition} change={next => step(index, { ...value, [kind]: value[kind].map((old, i) => i === at ? next : old) })} />
					<Button disabled={value[kind].length === 1} onClick={() => step(index, { ...value, [kind]: value[kind].filter((_, i) => i !== at) })}>{t('browser.workflow.remove')}</Button></div>)}
				<Button disabled={value[kind].length >= 8} onClick={() => step(index, { ...value, [kind]: [...value[kind], { kind: 'exists', element: blankElement() }] })}>{t('browser.workflow.addCondition')}</Button>
			</fieldset>)}
			<div class="nand-browser-workspace-actions"><Button disabled={index === 0} onClick={() => { const steps = [...draft.steps]; [steps[index - 1], steps[index]] = [steps[index]!, steps[index - 1]!]; setDraft({ ...draft, steps }); }}>{t('browser.workflow.moveUp')}</Button>
				<Button onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })}>{t('browser.workflow.remove')}</Button></div>
		</details>)}
		<Button disabled={!draft.targetScope.length || draft.steps.length >= 30} onClick={() => { const area = draft.targetScope[0]!; const condition: WorkflowCondition = { kind: 'url', equals: area.origin + area.pathPrefix };
			setDraft({ ...draft, steps: [...draft.steps, { id: `step-${crypto.randomUUID().slice(0, 8)}`, target: area.id, operation: 'observe', args: {}, precondition: [condition], postcondition: [condition] }] });
		}}>{t('browser.workflow.addStep')}</Button>
		<div class="nand-browser-workspace-actions"><Button onClick={close}>{t('browser.workflow.closeEditor')}</Button>
			<Button variant="primary" disabled={!draft.title.trim() || !draft.steps.length} onClick={() => save({ ...draft, consequenceClass: consequence(draft.steps) })}>{t('browser.workflow.save')}</Button></div>
	</fieldset></section>;
}
