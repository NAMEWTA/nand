import { BrowserError } from '../model';
import type { WorkspaceData, WorkspaceExchange, WorkspaceTask, WorkspaceTurn } from './model';

export interface TaskDocuments { task: WorkspaceTask; turns: WorkspaceTurn[]; exchanges: WorkspaceExchange[] }

/** Document enumeration order is unrelated to conversation order. */
export function taskTurns(data: WorkspaceData, taskId: string): WorkspaceTurn[] {
	return data.turns.filter(turn => turn.taskId === taskId).toSorted((a, b) => a.sequence - b.sequence);
}

export function searchTasks(data: WorkspaceData, query: string): WorkspaceTask[] {
	const term = query.trim().toLocaleLowerCase();
	const matches = (value: string): boolean => value.toLocaleLowerCase().includes(term);
	return data.tasks.filter(task => {
		if (!term || matches(task.title) || matches(task.draft)) return true;
		const turns = taskTurns(data, task.id), ids = new Set(turns.map(turn => turn.id));
		return turns.some(turn => matches(turn.question) || matches(turn.finalPrompt))
			|| data.exchanges.some(exchange => ids.has(exchange.turnId) && ([...exchange.captures, ...(exchange.selections ?? [])].some(capture => matches(capture.markdown))
				|| matches(exchange.imported?.text ?? '') || matches(exchange.imported?.markdown ?? '')));
	}).toSorted((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

/** Exact local deletion scope, including removed targets' historical answers but excluding the shared template library. */
export function taskDocuments(data: WorkspaceData, taskId: string): TaskDocuments {
	const task = data.tasks.find(row => row.id === taskId);
	if (!task) throw new BrowserError('browser_workspace_task_missing');
	const turns = taskTurns(data, taskId), ids = new Set(turns.map(turn => turn.id));
	return structuredClone({ task, turns,
		exchanges: data.exchanges.filter(exchange => ids.has(exchange.turnId)).toSorted((a, b) => a.id.localeCompare(b.id)).map(exchange => ({ ...exchange, attempts: [] })) });
}
