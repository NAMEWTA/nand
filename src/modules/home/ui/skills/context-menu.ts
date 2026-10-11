import { Notice, TFile } from 'obsidian';
import { showMenu } from '../../../../ui/primitives/menu';
import { t } from '../../../../shared/i18n';
import { buildSkillContext, type SkillContext } from '../../core/skills/context';
import { dispatchSkillShortcut } from '../../services/skill-shortcuts';
import { homeServices } from '../../services/instances';
import type { DashboardSurface } from '../view/dashboard-surface';
import { ownDialog } from '../ui/dialog-scope';
import { previewSkill } from './AgentPromptPanel';

/** Preserve only a selection inside the triggering card, including its inline editor. */
export function cardSkillInput(root: HTMLElement): string {
	const active = root.ownerDocument.activeElement;
	if (active?.instanceOf(HTMLTextAreaElement) && root.contains(active)) {
		return active.value.slice(active.selectionStart, active.selectionEnd);
	}
	const selection = root.ownerDocument.getSelection();
	return selection?.anchorNode && selection.focusNode && root.contains(selection.anchorNode) && root.contains(selection.focusNode) ? selection.toString() : '';
}

function boardPath(surface: DashboardSurface): string {
	const path = surface.plugin.settings.dashboardFile;
	return path.endsWith('.md') ? path : `${path}.md`;
}

/** Context is resolved when a menu choice runs, after any intervening file move. */
function skillMenu(surface: DashboardSurface, anchor: HTMLElement, id: string, context: () => SkillContext | undefined): void {
	const path = boardPath(surface);
	const skills = surface.data?.skills ?? [];
	const agents = homeServices.agents?.() ?? [];
	const menu = showMenu(anchor, [
		...(!agents.length || !skills.length ? [{ title: t(!agents.length ? 'quickActions.skillUnavailable' : 'home.skills.configureHint'), disabled: true, run: () => {} }] : []),
		...skills.map(skill => ({ title: skill.label, icon: skill.icon || 'sparkles', disabled: !agents.some(agent => agent.id === skill.agentId && agent.enabled), run: async () => {
			if (!surface.isOpen || boardPath(surface) !== path) return;
			const current = surface.data?.skills?.find(item => item.id === skill.id);
			const captured = context();
			if (!current || !captured) { new Notice(t('home.skills.contextMissing')); return; }
			const key = `context:${id}:${skill.id}`;
			if (surface.agentDeliveries.has(key)) return;
			const abort = new AbortController(); surface.agentDeliveries.set(key, abort);
			try {
				await dispatchSkillShortcut(current, captured, {
					dispatch: homeServices.acquireDispatch ?? (async () => undefined), signal: abort.signal,
					preview: (skill, ctx, draft) => previewSkill(surface.app, skill, ctx, draft, abort.signal, surface),
					notify: message => { if (!abort.signal.aborted) new Notice(message); },
				});
			} finally { if (surface.agentDeliveries.get(key) === abort) surface.agentDeliveries.delete(key); }
		} })),
		{ title: t('home.widget.manage'), icon: 'layout-dashboard', section: true, run: () => surface.createCallbacks().onBoardWidgets?.() },
	]);
	// Menu already owns keyboard navigation and Escape; register only its page lifetime.
	const release = ownDialog(surface.app, () => menu.hide(), surface, false);
	menu.onHide(release);
}

export function quickNoteSkillMenu(surface: DashboardSurface, anchor: HTMLElement, input: string): void {
	skillMenu(surface, anchor, 'quicknote', () => {
		const settings = surface.plugin.settings;
		const target = settings.quickCaptureTarget.trim();
		const file = target ? surface.app.vault.getAbstractFileByPath(target.endsWith('.md') ? target : `${target}.md`) : null;
		return buildSkillContext({ source: { kind: 'dashboard', path: boardPath(surface), id: 'quicknote' }, input,
			path: file instanceof TFile ? file.path : '', title: file instanceof TFile ? file.basename : t('quickNote.capture'),
			folder: settings.quickCaptureFolder, files: file instanceof TFile ? [file.path] : [] });
	});
}

export function cardSkillMenu(surface: DashboardSurface, anchor: HTMLElement, cardId: string, input: string): void {
	skillMenu(surface, anchor, `card:${cardId}`, () => {
		const card = surface.data?.columns.flatMap(column => column.cards).find(card => card.id === cardId);
		if (!card) return;
		const path = boardPath(surface);
		const link = card.wikiLink?.split('|')[0]?.split('#')[0]?.trim();
		const file = link ? surface.app.metadataCache.getFirstLinkpathDest(link, path) : null;
		if (link && !file) return;
		return buildSkillContext({ source: { kind: 'dashboard', path, id: card.id }, input,
			path: file?.path ?? path, title: file?.basename ?? card.title, files: file ? [file.path] : [] });
	});
}
