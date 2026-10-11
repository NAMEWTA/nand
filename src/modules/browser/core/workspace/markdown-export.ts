import { BrowserError } from '../model';
import { officialConversationUrl, officialWorkspaceOrigin } from '../providers/official-url';
import { taskTurns } from './history';
import type { AnswerCapture, WorkspaceData, WorkspaceProvider } from './model';

export interface MarkdownScope { taskIds: string[]; targetIds: string[]; rounds: 'all' | 'latest' }
export interface MarkdownLabels {
	question: string; prompt: string; complete: string; incomplete: string; imported: string; noAnswer: string; noRounds: string;
	round(sequence: number): string; provider(provider: WorkspaceProvider): string; source(source: AnswerCapture['source']): string;
}
const heading = (text: string): string => text.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}[\]()<>#+.!|~-]/g, '\\$&');

/** Explicit projection only: no journal, account partition, arbitrary URL query, token or raw network data. */
export function workspaceMarkdown(data: WorkspaceData, scope: MarkdownScope, labels: MarkdownLabels): string {
	if (!scope.taskIds.length || !scope.targetIds.length || new Set(scope.taskIds).size !== scope.taskIds.length
		|| new Set(scope.targetIds).size !== scope.targetIds.length || !['all', 'latest'].includes(scope.rounds)) throw new BrowserError('browser_workspace_export_scope');
	const tasks = scope.taskIds.map(id => data.tasks.find(task => task.id === id));
	if (tasks.some(task => !task)) throw new BrowserError('browser_workspace_export_scope');
	const known = new Set(tasks.flatMap(task => [...task!.targets, ...taskTurns(data, task!.id).flatMap(turn => turn.targets)].map(target => target.id)));
	if (scope.targetIds.some(id => !known.has(id))) throw new BrowserError('browser_workspace_export_scope');
	const selected = new Set(scope.targetIds), blocks: string[] = [];
	for (const task of tasks) {
		blocks.push('# ' + heading(task!.title));
		const ordered = taskTurns(data, task!.id), turns = scope.rounds === 'latest' ? ordered.slice(-1) : ordered;
		let included = false;
		for (const turn of turns) {
			const targets = turn.targets.filter(target => selected.has(target.id)); if (!targets.length) continue;
			included = true; blocks.push('## ' + heading(labels.round(turn.sequence)), '### ' + labels.question, turn.question);
			if (turn.finalPrompt !== turn.question) blocks.push('### ' + labels.prompt, turn.finalPrompt);
			for (const target of targets) {
				blocks.push('### ' + heading(labels.provider(target.provider)));
				const exchange = data.exchanges.find(row => row.turnId === turn.id && row.targetId === target.id);
				const capture = exchange?.captures.find(row => row.id === exchange.currentCaptureId);
				if (exchange?.imported) {
					blocks.push(labels.imported + ' · ' + labels.incomplete, exchange.imported.markdown || exchange.imported.text || labels.noAnswer); continue;
				}
				if (!capture) { blocks.push(labels.noAnswer); continue; }
				blocks.push(labels.source(capture.source) + ' · ' + (capture.complete ? labels.complete : labels.incomplete) + ' · ' + new Date(capture.capturedAt).toISOString());
				const origin = target.officialUrl && officialWorkspaceOrigin(target.provider, target.officialUrl);
				const url = officialConversationUrl(target.provider, capture.conversationId) ?? (origin ? origin + '/' : officialConversationUrl(target.provider));
				if (url) blocks.push('<' + url + '>');
				blocks.push(capture.markdown);
			}
		}
		if (!included) blocks.push(labels.noRounds);
	}
	return blocks.join('\n\n') + '\n';
}
