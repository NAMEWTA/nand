// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pm-model.ts
import { pipelineTasks } from '../pipeline/rules';
import type { PipelineTask } from '../pipeline/model';
const MILESTONE_HEADING_RE = /^(里程碑|milestones?)$/i;
const TODO_HEADING_RE = /^(待办|todos?|任务)$/i;
export interface PmBodySections {
	milestones: PipelineTask[];
	todos: PipelineTask[];
}

/** Split a note's checkbox tasks into the two standard sections. Line-keyed
 *  (PipelineTask.line) so toggles can use pipeline-model's toggleTaskLine. */
export function parseProjectBody(content: string): PmBodySections {
	const milestones: PipelineTask[] = [];
	const todos: PipelineTask[] = [];
	const lines = content.split('\n');
	let current: 'milestone' | 'todo' | null = null;
	for (let i = 0; i < lines.length; i++) {
		const headingMatch = lines[i]!.match(/^##\s+(.*)$/);
		if (headingMatch) {
			const title = headingMatch[1]!.trim();
			if (MILESTONE_HEADING_RE.test(title)) current = 'milestone';
			else if (TODO_HEADING_RE.test(title)) current = 'todo';
			else current = null;
			continue;
		}
		if (!current) continue;
		const parsed = pipelineTasks(lines[i]!);
		if (parsed[0]) {
			const task = { ...parsed[0], line: i };
			(current === 'milestone' ? milestones : todos).push(task);
		}
	}
	return { milestones, todos };
}

/** Insert `- [ ] text` at the end of a section (creating the section at the
 *  document end when missing). Text goes in verbatim — todos may carry
 *  [due:: …] markers for calendar visibility. Returns the new content. */
export function insertProjectTask(content: string, section: 'milestone' | 'todo', text: string): string {
	const headingTitle = section === 'milestone' ? '## 里程碑' : '## 待办';
	const headingRe = section === 'milestone' ? MILESTONE_HEADING_RE : TODO_HEADING_RE;
	const clean = text.trim();
	if (!clean) return content;
	const lines = content.split('\n');
	let insertAt = -1;
	let inSection = false;
	for (let i = 0; i < lines.length; i++) {
		const headingMatch = lines[i]!.match(/^##\s+(.*)$/);
		if (headingMatch) {
			if (inSection) {
				insertAt = i;
				break;
			}
			inSection = headingRe.test(headingMatch[1]!.trim());
		} else if (inSection && /^(\s*)- \[( |x|X)\] /.test(lines[i]!)) {
			insertAt = i + 1;
		}
	}
	if (!inSection && insertAt === -1) {
		const next = [...lines];
		while (next.length > 0 && next[next.length - 1]!.trim() === '') next.pop();
		if (next.length > 0) next.push('');
		next.push(headingTitle, `- [ ] ${clean}`);
		return next.join('\n');
	}
	if (insertAt === -1) insertAt = lines.length;
	const next = [...lines.slice(0, insertAt), `- [ ] ${clean}`, ...lines.slice(insertAt)];
	return next.join('\n');
}

/** Remove one task line (0-based). Returns the content unchanged when the
 *  line is no longer a task. */
export function removeProjectTask(content: string, line: number): string {
	const lines = content.split('\n');
	const target = lines[line];
	if (!target || !/^(\s*)- \[( |x|X)\] /.test(target)) return content;
	const next = lines.filter((_, index) => index !== line);
	return next.join('\n');
}

/** The standard two-section body written on project creation. */
export function projectBodyTemplate(milestones: readonly string[]): string {
	const parts = ['## 里程碑'];
	for (const name of milestones) {
		const clean = name.trim();
		if (clean) parts.push(`- [ ] ${clean}`);
	}
	parts.push('', '## 待办');
	return parts.join('\n');
}
