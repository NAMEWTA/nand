import type { CollectionDocument, DocumentCollectionCodec } from '../../../../shared/storage/document-collection';
import { BrowserError } from '../model';
import type { AnswerCapture, ImportedAnswer, SelectedExcerpt, WorkspaceData, WorkspaceExchange } from './model';
import { validateSelection } from './guidance';
import { emptyWorkspace, WORKSPACE_PROVIDERS } from './model';
import { validateImportedExchange, validateImportedTask, validateImportedTurn } from './imported';
import { validatePanelLayout } from './panel-layout';
import { validateSynthesis } from './synthesis';
import type { SynthesisInput } from './synthesis-model';

const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const text = (value: unknown): value is string => typeof value === 'string';
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const invalid = (): never => { throw new BrowserError('browser_workspace_storage'); };
function bindingMetadata(value: WorkspaceData['tasks'][number]['targets'][number]): boolean {
	if (value.conversationId !== undefined && !id(value.conversationId)) return false;
	if (value.adapterVersion !== undefined && (typeof value.adapterVersion !== 'string' || !/^nand-user-[\w-]{1,100}-v\d+$/.test(value.adapterVersion))) return false;
	if (value.verifiedAt !== undefined && !time(value.verifiedAt)) return false;
	if (value.officialUrl !== undefined) {
		if (!text(value.officialUrl)) return false;
		try { const url = new URL(value.officialUrl); if (url.protocol !== 'https:' || url.username || url.password) return false; }
		catch { return false; }
	}
	return true;
}
const captureSection = (index: number, count: number): string => index === count - 1 ? 'answer' : `answer-${String(index).replace(/\d/g, digit => String.fromCharCode(97 + Number(digit)))}`;
const sourceSection = (kind: 'question' | 'answer', index: number): string => `source-${kind}-${String(index).replace(/\d/g, digit => String.fromCharCode(97 + Number(digit)))}`;
const selectionSection = (index: number): string => 'selection-' + String(index).replace(/\d/g, digit => String.fromCharCode(97 + Number(digit)));

/** Validate relations too: a syntactically valid document must not become another task's answer. */
export function validateWorkspace(value: unknown): WorkspaceData {
	const data = value as WorkspaceData;
	if (!data || data.version !== 1 || ![data.tasks, data.turns, data.exchanges, data.templates, data.syntheses].every(Array.isArray)) invalid();
	const ids = [...data.tasks, ...data.turns, ...data.exchanges, ...data.templates, ...data.syntheses].map(row => row?.id);
	if (!ids.every(id) || !unique(ids)) invalid();
	const entityIds = new Set(ids), tasks = new Map(data.tasks.map(task => [task.id, task])), turns = new Map(data.turns.map(turn => [turn.id, turn]));
	const templateIds = new Set(data.templates.map(template => template.id)), sequences = new Set<string>(), targetExchanges = new Set<string>();
	const importedSources = { tasks: new Set<string>(), turns: new Set<string>(), exchanges: new Set<string>() };
	for (const task of data.tasks) {
		if (!text(task.title) || !text(task.draft) || typeof task.pinned !== 'boolean' || !time(task.createdAt) || !time(task.updatedAt)
			|| !Array.isArray(task.targets) || !Array.isArray(task.selectedTargetIds) || !Array.isArray(task.visibleTargetIds)) invalid();
		const targets = task.targets.map(row => row?.id);
		if (task.promptTemplateIds !== undefined && (!Array.isArray(task.promptTemplateIds) || !unique(task.promptTemplateIds)
			|| !task.promptTemplateIds.every(id => templateIds.has(id)))) invalid();
		if (!targets.every(id) || !unique(targets)) invalid();
		for (const list of [task.selectedTargetIds, task.visibleTargetIds]) if (!unique(list) || !list.every(item => targets.includes(item))) invalid();
		for (const target of task.targets) {
			if (!target || !WORKSPACE_PROVIDERS.includes(target.provider) || !id(target.profileId) || !text(target.accountLabel) || !bindingMetadata(target)
				|| !['unverified', 'ready', 'login-required', 'disconnected', 'needs-attention'].includes(target.status)
				|| (target.page && (!id(target.page.pageId) || !id(target.page.profileId) || !id(target.page.generation) || target.page.profileId !== target.profileId))) invalid();
		}
		validateImportedTask(task);
		validatePanelLayout(task);
		if (task.imported) { if (importedSources.tasks.has(task.imported.sourceId)) invalid(); importedSources.tasks.add(task.imported.sourceId); }
	}
	for (const turn of data.turns) {
		if (!tasks.has(turn.taskId) || !Number.isInteger(turn.sequence) || turn.sequence < 1
			|| !text(turn.question) || !text(turn.finalPrompt) || !time(turn.createdAt) || !Array.isArray(turn.templates) || !Array.isArray(turn.targets)) invalid();
		const sequence = turn.taskId + ':' + turn.sequence;
		if (sequences.has(sequence)) invalid(); sequences.add(sequence);
		for (const template of turn.templates) if (!template || !id(template.id) || !Number.isInteger(template.revision) || template.revision < 1 || !text(template.title) || !text(template.body)) invalid();
		if ((!turn.targets.length && !turn.imported) || !unique(turn.targets.map(target => target?.id))) invalid();
		for (const target of turn.targets) if (!target || !id(target.id) || !WORKSPACE_PROVIDERS.includes(target.provider) || !id(target.profileId) || !text(target.accountLabel) || !bindingMetadata(target)
			|| (!target.page && !turn.imported) || (target.page && (target.page.profileId !== target.profileId || !id(target.page.pageId) || !id(target.page.generation)))) invalid();
		validateImportedTurn(turn);
		if (turn.imported) { if (importedSources.turns.has(turn.imported.sourceId)) invalid(); importedSources.turns.add(turn.imported.sourceId); }
		if (turn.imported && tasks.get(turn.taskId)?.imported?.sourceId !== turn.imported.record.sessionId) invalid();
	}
	const captures = new Set<string>();
	for (const exchange of data.exchanges) {
		const turn = turns.get(exchange.turnId);
		if (!turn?.targets.some(target => target.id === exchange.targetId) || !Array.isArray(exchange.captures) || !Array.isArray(exchange.attempts)
			|| !['idle', 'staging', 'staged', 'submitting', 'submitted', 'not-sent', 'unknown', 'paused'].includes(exchange.submitState)
			|| !['idle', 'waiting', 'collecting', 'complete', 'incomplete', 'failed'].includes(exchange.acquisitionState)
			|| !['pending', 'saved', 'failed'].includes(exchange.saveState)) invalid();
		const targetExchange = exchange.turnId + ':' + exchange.targetId;
		if (targetExchanges.has(targetExchange)) invalid(); targetExchanges.add(targetExchange);
		validateImportedExchange(exchange, turn!);
		if (exchange.imported) { if (importedSources.exchanges.has(exchange.imported.sourceId)) invalid(); importedSources.exchanges.add(exchange.imported.sourceId); }
		if (exchange.receipt && (!id(exchange.receipt.attemptId) || !id(exchange.receipt.conversationId) || !id(exchange.receipt.messageId)
			|| (exchange.receipt.parentId !== undefined && !id(exchange.receipt.parentId)))) invalid();
		let revision = 0;
		for (const capture of exchange.captures) {
			if (!capture || !id(capture.id) || captures.has(capture.id) || capture.exchangeId !== exchange.id || !Number.isInteger(capture.revision) || capture.revision <= revision
				|| !['provider-api', 'native-copy', 'scoped-dom'].includes(capture.source) || !text(capture.adapterVersion)
				|| !id(capture.conversationId) || !id(capture.messageId) || !text(capture.markdown) || typeof capture.complete !== 'boolean'
				|| !Array.isArray(capture.reasons) || !capture.reasons.every(text) || !Array.isArray(capture.terminalEvidence) || !capture.terminalEvidence.every(text)
				|| !time(capture.capturedAt)) invalid();
			if ((capture.parentId !== undefined && !id(capture.parentId)) || (capture.branchId !== undefined && !id(capture.branchId))
				|| (capture.complete && (!capture.markdown.trim() || !capture.terminalEvidence.length || capture.reasons.length))) invalid();
			captures.add(capture.id); revision = capture.revision;
		}
		if (exchange.currentCaptureId !== exchange.captures.at(-1)?.id) invalid();
		if (exchange.selections !== undefined && !Array.isArray(exchange.selections)) invalid();
		for (const selection of exchange.selections ?? []) {
			if (!selection || !id(selection.id) || captures.has(selection.id) || selection.exchangeId !== exchange.id || selection.revision !== 1
				|| selection.source !== 'user-selection' || selection.complete !== false || !text(selection.markdown) || !selection.markdown.trim() || selection.markdown.length > 2000
				|| !time(selection.capturedAt) || !Array.isArray(selection.reasons) || selection.reasons.length !== 1 || selection.reasons[0] !== 'user-selection') invalid();
			const target = turn!.targets.find(target => target.id === exchange.targetId)!;
			validateSelection(selection.selection, target.provider, target.profileId); captures.add(selection.id);
		}
	}
	if ([...captures].some(captureId => entityIds.has(captureId))) invalid();
	for (const template of data.templates) if (!text(template.title) || !text(template.body) || !Number.isInteger(template.revision) || template.revision < 1
		|| !Number.isSafeInteger(template.order) || template.order < 0 || !time(template.createdAt) || !time(template.updatedAt)) invalid();
	if (new Set(data.templates.map(template => template.order)).size !== data.templates.length) invalid();
	for (const synthesis of data.syntheses) validateSynthesis(synthesis);
	return data;
}

/** Stable filenames; DocumentRepository preserves frontmatter and text outside these owned sections. */
export function workspaceDocuments(root: string): DocumentCollectionCodec<WorkspaceData> {
	const doc = (kind: string, id: string, path: string, metadata: Record<string, unknown>, sections: Record<string, string> = {}): CollectionDocument =>
		({ id, path: `${root}/${path}`, properties: { 'nand-type': kind, 'nand-id': id, 'nand-workspace': metadata }, sections });
	return {
		root, ownedTypes: ['browser-task', 'browser-turn', 'browser-exchange', 'browser-prompt', 'browser-synthesis'], managedProperties: ['nand-workspace'], empty: emptyWorkspace,
		deletionPriority: document => ['browser-exchange', 'browser-turn', 'browser-task', 'browser-prompt', 'browser-synthesis'].indexOf(String(document.properties['nand-type'])),
		encode: value => {
			const data = validateWorkspace(value), documents: CollectionDocument[] = [], turns = new Map(data.turns.map(turn => [turn.id, turn]));
			for (const task of data.tasks) {
				const { draft, ...metadata } = task;
				documents.push(doc('browser-task', task.id, `${task.id}/任务.md`, metadata, { draft }));
			}
			for (const turn of data.turns) {
				const { question, finalPrompt, ...metadata } = turn;
				documents.push(doc('browser-turn', turn.id, `${turn.taskId}/轮次/${turn.id}.md`, metadata, { question, prompt: finalPrompt }));
			}
			for (const exchange of data.exchanges) {
				const taskId = turns.get(exchange.turnId)!.taskId;
				const { captures, selections, attempts: _runtimeAttempts, imported, ...metadata } = exchange;
				// One atomic document owns the current answer and its meaningful revisions.
				// A failed save cannot leave a pointer to a missing revision file.
				const captureMetadata = captures.map(({ markdown: _markdown, ...capture }) => capture);
				const sections = Object.fromEntries(captures.map((capture, index) => [captureSection(index, captures.length), capture.markdown]));
				const selectionMetadata = selections?.map(({ markdown, ...selection }, index) => { sections[selectionSection(index)] = markdown; return selection; });
				let importedMetadata;
				if (imported) {
					const { text, markdown, ...source } = imported;
					importedMetadata = { ...source, textPresent: text !== undefined, markdownPresent: markdown !== undefined };
					if (text !== undefined) sections['imported-text'] = text;
					if (markdown !== undefined) sections['imported-markdown'] = markdown;
				}
				documents.push(doc('browser-exchange', exchange.id, `${taskId}/回答/${exchange.id}.md`, { ...metadata, captures: captureMetadata,
					...(selectionMetadata ? { selections: selectionMetadata } : {}), ...(importedMetadata ? { imported: importedMetadata } : {}) }, sections));
			}
			for (const template of data.templates) {
				const { body, ...metadata } = template;
				documents.push(doc('browser-prompt', template.id, `提示词/${template.id}.md`, metadata, { prompt: body }));
			}
			for (const synthesis of data.syntheses) {
				const { instruction, prompt, text, inputs, ...metadata } = synthesis;
				const sections: Record<string, string> = { instruction, prompt, result: text };
				const sources = inputs.map(({ question, text, ...source }, index) => {
					sections[sourceSection('question', index)] = question; sections[sourceSection('answer', index)] = text; return source;
				});
				documents.push(doc('browser-synthesis', synthesis.id, `综合/${synthesis.id}.md`, { ...metadata, inputs: sources }, sections));
			}
			return documents;
		},
		decode: documents => {
			const data = emptyWorkspace(), ids = new Set<string>();
			for (const document of documents) {
				const kind = document.properties['nand-type'];
				if (!['browser-task', 'browser-turn', 'browser-exchange', 'browser-prompt', 'browser-synthesis'].includes(String(kind))) continue;
				if (!id(document.id) || ids.has(document.id)) invalid();
				ids.add(document.id);
				const raw = document.properties['nand-workspace'];
				if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid();
				const metadata = raw as Record<string, unknown>, sections = document.sections ?? {};
				if (metadata.id !== document.id) invalid();
				if (kind === 'browser-task') data.tasks.push({ ...metadata, draft: sections.draft ?? '' } as WorkspaceData['tasks'][number]);
				if (kind === 'browser-turn') data.turns.push({ ...metadata, question: sections.question ?? '', finalPrompt: sections.prompt ?? '' } as WorkspaceData['turns'][number]);
				if (kind === 'browser-exchange') {
					if (!Array.isArray(metadata.captures)) invalid();
					const raw = metadata.captures as Array<Omit<AnswerCapture, 'markdown'>>;
					if (metadata.selections !== undefined && !Array.isArray(metadata.selections)) invalid();
					const selections = (metadata.selections as Array<Omit<SelectedExcerpt, 'markdown'>> | undefined)?.map((selection, index) => ({ ...selection, markdown: sections[selectionSection(index)] ?? '' }));
					let imported: ImportedAnswer | undefined;
					if (metadata.imported !== undefined) {
						if (!metadata.imported || typeof metadata.imported !== 'object' || Array.isArray(metadata.imported)) invalid();
						const { textPresent, markdownPresent, ...source } = metadata.imported as Omit<ImportedAnswer, 'text' | 'markdown'> & { textPresent: boolean; markdownPresent: boolean };
						if (typeof textPresent !== 'boolean' || typeof markdownPresent !== 'boolean') invalid();
						imported = { ...source, ...(textPresent ? { text: sections['imported-text'] ?? '' } : {}), ...(markdownPresent ? { markdown: sections['imported-markdown'] ?? '' } : {}) };
					}
					data.exchanges.push({ ...metadata as Omit<WorkspaceExchange, 'attempts' | 'captures'>, ...(imported ? { imported } : {}), ...(selections ? { selections } : {}), attempts: [], captures: raw.map((capture, index) => ({ ...capture, markdown: sections[captureSection(index, raw.length)] ?? '' })) });
				}
				if (kind === 'browser-prompt') data.templates.push({ ...metadata, body: sections.prompt ?? '' } as WorkspaceData['templates'][number]);
				if (kind === 'browser-synthesis') {
					if (!Array.isArray(metadata.inputs)) invalid();
					const inputs = (metadata.inputs as Array<Omit<SynthesisInput, 'question' | 'text'>>).map((input, index) => ({ ...input,
						question: sections[sourceSection('question', index)] ?? '', text: sections[sourceSection('answer', index)] ?? '' }));
					data.syntheses.push({ ...metadata, instruction: sections.instruction ?? '', prompt: sections.prompt ?? '', text: sections.result ?? '', inputs } as WorkspaceData['syntheses'][number]);
				}
			}
			return validateWorkspace(data);
		},
	};
}
