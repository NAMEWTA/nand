import { bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { localizedAttributes } from '../../../../ui/primitives/localized-dom';
import { Menu, setIcon } from 'obsidian';
import { normalizeWorkspacePath } from '../../core/workspace/workspace-registry';
import { t } from '../../../../shared/i18n/index';
import type { DashboardHost } from '../host';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { showPromptDialog } from '../ui/prompt-dialog';
import { promptNewBoard } from '../NewBoardDialog';

/** Display label for a workspace: its name, else the file path. */
function workspaceLabel(name: string, path: string): string {
	return name.trim() || `${path}.md`;
}

/** Open the "new workspace" dialog and create the workspace on confirm. */
async function promptNewWorkspace(plugin: DashboardHost): Promise<void> {
	const result = await promptNewBoard(plugin.app);
	if (result) await plugin.createWorkspace(result.name, result.layout);
}

/** Long-press / right-click management menu for one workspace button. */
function openWorkspaceMenu(plugin: DashboardHost, file: string, name: string, ev: Event): void {
	const menu = new Menu();
	menu.addItem((item) => {
		bindLocalizedControl(item.setTitle(t('workspace.renameTitle')), "title", 'workspace.renameTitle')
			.setIcon('pencil')
			.onClick(async () => {
				const next = await showPromptDialog(plugin.app, {
					title: t('workspace.renameTitle'),
					placeholder: t('workspace.namePlaceholder'),
					defaultValue: name,
				});
				if (next !== null) await plugin.renameWorkspace(file, next);
			});
	});
	menu.addItem((item) => {
		const canRemove = plugin.settings.workspaceFiles.length > 1;
		bindLocalizedControl(item.setTitle(t('workspace.removeTitle')), "title", 'workspace.removeTitle').setIcon('trash-2').setDisabled(!canRemove);
		if (!canRemove) return;
		item.onClick(async () => {
			const confirmed = await showConfirmDialog(plugin.app, {
				title: t('workspace.removeTitle'),
				message: t('workspace.removeConfirm', { name: name || file, file: `${file}.md` }),
			});
			if (confirmed) await plugin.removeWorkspace(file);
		});
	});
	menu.showAtMouseEvent(ev as MouseEvent);
}

/**
 * Workspace switcher: number pills + add button on the banner, at the
 * top-left corner of the stats view's center column (the CSS mirrors the
 * stats grid to find that edge). Resting semi-visible, full on hover/focus;
 * on mobile there is no hover, so the pills stay visible. Rebuilt on every
 * render so the active highlight always matches the current settings.
 */
export function renderWorkspaceSwitcher(container: HTMLElement, plugin: DashboardHost): void {
	const { workspaceFiles, workspaceNames, dashboardFile } = plugin.settings;
	const active = normalizeWorkspacePath(dashboardFile);

	const switcher = container.createDiv({ cls: 'dashboard-workspace-switcher' });

	workspaceFiles.forEach((file, i) => {
		const name = workspaceNames?.[i]?.trim() ?? '';
		const label = workspaceLabel(name, file);
		const isActive = normalizeWorkspacePath(file) === active;
		const btn = switcher.createEl('button', {
			cls: 'dashboard-workspace-btn' + (isActive ? ' active' : ''),
			text: String(i + 1),
			attr: { 'aria-label': label, title: label },
		});
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			void plugin.switchWorkspace(file);
		});
		btn.addEventListener('contextmenu', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			openWorkspaceMenu(plugin, file, name, ev);
		});
	});

	const addBtn = switcher.createEl('button', {
		cls: 'dashboard-workspace-btn dashboard-workspace-add-btn',
		attr: { ...localizedAttributes('workspace.newTitle', undefined, 'aria-label'), ...localizedAttributes('workspace.newTitle', undefined, 'title') },
	});
	setIcon(addBtn, 'plus');
	addBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void promptNewWorkspace(plugin);
	});
}
