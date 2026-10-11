import type { DocumentCollectionCodec } from '../../../../shared/storage/document-collection';
import { BrowserError } from '../model';
import { SCOPED_BROWSER_OPERATIONS } from '../scoped-grant';
import { snapshotJson } from '../workspace/snapshot';
import { emptyAssistant, type AssistantData, type AssistantTask } from './model';

const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const text = (value: unknown): value is string => typeof value === 'string';
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const optional = (value: unknown): boolean => value === undefined || text(value);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const invalid = (): never => { throw new BrowserError('browser_assistant_storage'); };
const section = (index: number): string => 'step-' + String(index).replace(/\d/g, digit => String.fromCharCode(97 + Number(digit)));
export function assistantMaterial(task: AssistantTask): string {
	return snapshotJson({ id: task.id, title: task.title, goal: task.goal, prompt: task.prompt, pages: task.pages, operations: task.operations,
		maxOperations: task.maxOperations, timeoutMs: task.timeoutMs, destination: task.destination, createdAt: task.createdAt, previousTaskId: task.previousTaskId })!;
}
export function validateAssistant(value: unknown): AssistantData {
	const data = value as AssistantData;
	if (!data || data.version !== 1 || !Array.isArray(data.tasks) || !data.tasks.every(task => task && id(task.id)) || !unique(data.tasks.map(task => task.id))) invalid();
	for (const task of data.tasks) {
		if (![task.title, task.goal, task.prompt, task.text].every(text) || !time(task.createdAt) || !time(task.updatedAt)
			|| !Array.isArray(task.pages) || !task.pages.length || task.pages.length > 16
			|| !Array.isArray(task.operations) || !task.operations.length || !unique(task.operations) || !task.operations.every(operation => SCOPED_BROWSER_OPERATIONS.includes(operation))
			|| !Number.isSafeInteger(task.maxOperations) || task.maxOperations < 1 || task.maxOperations > 200
			|| !Number.isSafeInteger(task.timeoutMs) || task.timeoutMs < 1000 || task.timeoutMs > 1_800_000
			|| !['pending', 'running', 'needs-attention', 'confirming', 'paused', 'succeeded', 'pasted', 'failed', 'cancelled', 'interrupted', 'timeout'].includes(task.status)
			|| !Array.isArray(task.steps) || task.steps.length > task.maxOperations
			|| ![task.terminalId, task.errorCode].every(optional) || (task.previousTaskId !== undefined && (!id(task.previousTaskId) || task.previousTaskId === task.id))) invalid();
		const targets = new Map<string, { profileId: string; generation: string }>();
		if (task.usage && (![task.usage.input, task.usage.output, task.usage.cacheRead, task.usage.cacheWrite].every(time)
			|| (task.usage.cost !== null && !time(task.usage.cost)) || typeof task.usage.known !== 'boolean'
			|| (task.usage.partial !== undefined && typeof task.usage.partial !== 'boolean'))) invalid();
		for (const page of task.pages) {
			if (!page || !page.target || ![page.target.pageId, page.target.profileId, page.target.generation].every(id)
				|| ![page.title, page.url, page.accountLabel].every(text) || targets.has(page.target.pageId)) invalid();
			targets.set(page.target.pageId, page.target);
		}
		const destination = task.destination;
		if (!destination || !text(destination.agentId) || !destination.agentId.trim()
			|| !['automatic', 'existing'].includes(destination.kind)
			|| (destination.kind === 'existing' && (!text(destination.sessionId) || !destination.sessionId || !text(destination.sessionTitle)))) invalid();
		if (!unique(task.steps.map(step => step?.id))) invalid();
		for (const step of task.steps) {
			if (!step || !id(step.id) || !step.target || targets.get(step.target.pageId)?.profileId !== step.target.profileId
				|| targets.get(step.target.pageId)?.generation !== step.target.generation || !task.operations.includes(step.operation)
				|| !time(step.startedAt) || (step.finishedAt !== undefined && (!time(step.finishedAt) || step.finishedAt < step.startedAt))
				|| !['running', 'confirming', 'returned', 'denied', 'failed', 'unknown'].includes(step.state)
				|| ![step.errorCode, step.evidence].every(optional)) invalid();
		}
	}
	return data;
}

/** User goals, prompts, step observations and final output stay in visible Markdown, never in tokens or runtime JSON. */
export function assistantDocuments(root: string): DocumentCollectionCodec<AssistantData> {
	return { root, ownedTypes: ['browser-assistant'], managedProperties: ['nand-assistant'], empty: emptyAssistant,
		encode: value => validateAssistant(value).tasks.map(task => {
			const { goal, prompt, text, steps, ...metadata } = task;
			const sections: Record<string, string> = { goal, prompt, result: text };
			const records = steps.map((step, index) => {
				const { evidence, ...metadata } = step;
				if (evidence !== undefined) sections[section(index)] = evidence;
				return { ...metadata, ...(evidence !== undefined ? { evidenceSection: section(index) } : {}) };
			});
			return { id: task.id, path: `${root}/网页助手/${task.id}.md`, properties: { 'nand-type': 'browser-assistant', 'nand-id': task.id,
				'nand-assistant': { ...metadata, steps: records } }, sections };
		}),
		decode: documents => validateAssistant({ version: 1, tasks: documents.filter(document => document.properties['nand-type'] === 'browser-assistant').map(document => {
			const metadata = document.properties['nand-assistant'] as AssistantTask | undefined;
			if (!metadata || metadata.id !== document.id || !Array.isArray(metadata.steps)) invalid();
			const sections = document.sections ?? {};
			return { ...metadata, goal: sections.goal ?? '', prompt: sections.prompt ?? '', text: sections.result ?? '',
				steps: metadata!.steps.map((step, index) => {
					const { evidenceSection, ...record } = step as typeof step & { evidenceSection?: string };
					if (evidenceSection !== undefined && (evidenceSection !== section(index) || !(evidenceSection in sections))) invalid();
					return { ...record, ...(evidenceSection !== undefined ? { evidence: sections[evidenceSection] } : {}) };
				}) };
		}) }),
	};
}
