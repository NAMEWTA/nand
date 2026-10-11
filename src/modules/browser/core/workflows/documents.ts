import type { DocumentCollectionCodec } from '../../../../shared/storage/document-collection';
import { BrowserError } from '../model';
import { SCOPED_BROWSER_OPERATIONS } from '../scoped-grant';
import { emptyWorkflows, type BrowserWorkflowSpec, type WorkflowData, type WorkflowExecution } from './model';
import { validateWorkflow, validateWorkflowPublicInputs, workflowScopeMatches } from './validate';
import { snapshotJson } from '../workspace/snapshot';

const invalid = (): never => { throw new BrowserError('browser_workflow_storage'); };
const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const text = (value: unknown): value is string => typeof value === 'string';
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const unique = (values: string[]) => new Set(values).size === values.length;
const section = (index: number): string => 'event-' + String(index).replace(/\d/g, digit => String.fromCharCode(97 + Number(digit)));
export function validateWorkflows(value: unknown): WorkflowData {
	const data = value as WorkflowData;
	if (!data || data.version !== 1 || !Array.isArray(data.workflows) || !Array.isArray(data.executions)
		|| !unique(data.workflows.map(row => row?.id)) || !unique(data.executions.map(row => row?.runId))) invalid();
	data.workflows.forEach(validateWorkflow);
	for (const run of data.executions) {
		if (!run || !id(run.runId)) invalid(); validateWorkflow(run.spec); validateWorkflowPublicInputs(run.spec, run.publicInputs);
		if (!Array.isArray(run.secretNames) || !unique(run.secretNames)
			|| run.secretNames.slice().sort().join('\0') !== run.spec.variables.filter(v => v.type === 'secret').map(v => v.name).sort().join('\0')
			|| !['pending', 'running', 'confirming', 'paused', 'succeeded', 'failed', 'cancelled', 'interrupted'].includes(run.phase)
			|| !time(run.createdAt) || !time(run.updatedAt) || !text(run.result) || (run.errorCode !== undefined && !text(run.errorCode))
			|| !Array.isArray(run.bindings) || run.bindings.length !== run.spec.targetScope.length
			|| !unique(run.bindings.map(b => b?.scopeId)) || !unique(run.bindings.map(b => b?.target?.pageId))
			|| !Array.isArray(run.steps) || run.steps.length !== run.spec.steps.length || !Array.isArray(run.events) || run.events.length > 200) invalid();
		for (const binding of run.bindings) {
			const scope = run.spec.targetScope.find(s => s.id === binding?.scopeId);
			if (!scope || !binding.target || ![binding.target.pageId, binding.target.profileId, binding.target.generation].every(id)
				|| ![binding.title, binding.accountLabel, binding.url].every(text) || !workflowScopeMatches(scope, binding.target.profileId, binding.url)) invalid();
		}
		for (const [index, step] of run.steps.entries()) {
			if (!step || step.id !== run.spec.steps[index]?.id || !['pending', 'precondition', 'acting', 'postcondition', 'succeeded', 'failed', 'unknown'].includes(step.state)
				|| (step.errorCode !== undefined && !text(step.errorCode)) || (step.startedAt !== undefined && !time(step.startedAt)) || (step.finishedAt !== undefined && !time(step.finishedAt))) invalid();
			for (const kind of ['precondition', 'postcondition'] as const) {
				if (!Array.isArray(step[kind]) || step[kind].length > run.spec.steps[index]![kind].length) invalid();
				for (const [position, evidence] of step[kind].entries()) {
					if (!evidence || snapshotJson(evidence.condition) !== snapshotJson(run.spec.steps[index]![kind][position]) || typeof evidence.matched !== 'boolean'
						|| (evidence.observed !== undefined && (!text(evidence.observed) || !!run.secretNames.length))) invalid();
				}
			}
		}
		if (!unique(run.events.map(event => event?.id))) invalid();
		for (const event of run.events) {
			if (!event || !id(event.id) || !event.target || !run.bindings.some(binding => binding.target.pageId === event.target.pageId
				&& binding.target.profileId === event.target.profileId && binding.target.generation === event.target.generation)
				|| !SCOPED_BROWSER_OPERATIONS.includes(event.operation) || !time(event.startedAt)
				|| (event.finishedAt !== undefined && !time(event.finishedAt)) || !['running', 'confirming', 'returned', 'denied', 'failed', 'unknown'].includes(event.state)
				|| (event.errorCode !== undefined && !text(event.errorCode)) || (event.evidence !== undefined && (!text(event.evidence) || !!run.secretNames.length))) invalid();
		}
		if (run.secretNames.length && run.result) invalid();
	}
	return data;
}
export function workflowDocuments(root: string): DocumentCollectionCodec<WorkflowData> {
	return { root, ownedTypes: ['browser-workflow', 'browser-workflow-run'], managedProperties: ['nand-workflow', 'nand-workflow-run'], empty: emptyWorkflows,
		encode: value => {
			const data = validateWorkflows(value);
			return [...data.workflows.map(spec => ({ id: spec.id, path: `${root}/流程/${spec.id}.md`,
				properties: { 'nand-type': 'browser-workflow', 'nand-id': spec.id, 'nand-workflow': spec } })),
			...data.executions.map(run => {
				const { events, result, ...metadata } = run, sections: Record<string, string> = { result };
				const records = events.map((event, index) => {
					const { evidence, ...record } = event; if (evidence !== undefined) sections[section(index)] = evidence;
					return { ...record, ...(evidence !== undefined ? { evidenceSection: section(index) } : {}) };
				});
				return { id: run.runId, path: `${root}/流程/运行/${run.runId}.md`, properties: { 'nand-type': 'browser-workflow-run', 'nand-id': run.runId,
					'nand-workflow-run': { ...metadata, events: records } }, sections };
			})];
		},
		decode: documents => validateWorkflows({ version: 1,
			workflows: documents.filter(row => row.properties['nand-type'] === 'browser-workflow').map(row => {
				const spec = row.properties['nand-workflow'] as BrowserWorkflowSpec; if (spec?.id !== row.id) invalid(); return spec;
			}), executions: documents.filter(row => row.properties['nand-type'] === 'browser-workflow-run').map(row => {
				const metadata = row.properties['nand-workflow-run'] as WorkflowExecution;
				if (metadata?.runId !== row.id || !Array.isArray(metadata.events)) invalid();
				return { ...metadata, result: row.sections?.result ?? '', events: metadata.events.map((event, index) => {
					const { evidenceSection, ...record } = event as typeof event & { evidenceSection?: string };
					if (evidenceSection !== undefined && (evidenceSection !== section(index) || row.sections?.[evidenceSection] === undefined)) invalid();
					return { ...record, ...(evidenceSection !== undefined ? { evidence: row.sections![evidenceSection] } : {}) };
				}) };
			}) }),
	};
}
