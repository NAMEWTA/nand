import { bindLocalizedElement } from '../../primitives/localized-dom';
import type { AutomationUiPort } from '../../../shared/automation/types';
import { App, Modal, setIcon } from 'obsidian';
import { h } from 'preact';
import type { QuickAction } from '../../../core/dashboard/types/index';
import type { AppWithCommands } from '../../../platform/obsidian/obsidian-internal';
import { iconForExtension } from '../../../shared/file-types';
import { t } from '../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';
import { mountDashboardPanel } from '../renderer/render-context';
import { QuickActionsPanel } from './QuickActionsPanel';

// Curated set of common Lucide icons offered in the quick-action icon picker.
const COMMON_ICONS: readonly string[] = [
	'file-text',
	'folder',
	'folder-open',
	'notebook-pen',
	'star',
	'bookmark',
	'heart',
	'flag',
	'award',
	'trophy',
	'list',
	'list-checks',
	'circle-check',
	'square-check',
	'calendar',
	'calendar-days',
	'clock',
	'alarm-clock',
	'timer',
	'pencil',
	'pen-line',
	'edit',
	'search',
	'home',
	'settings',
	'sliders-horizontal',
	'link',
	'external-link',
	'paperclip',
	'terminal',
	'command',
	'play',
	'mail',
	'message-square',
	'bell',
	'bell-ring',
	'user',
	'users',
	'contact',
	'image',
	'camera',
	'music',
	'headphones',
	'film',
	'plus',
	'download',
	'upload',
	'save',
	'send',
	'inbox',
	'zap',
	'flame',
	'target',
	'trending-up',
	'rocket',
	'sparkles',
	'book',
	'book-open',
	'library',
	'map-pin',
	'compass',
	'globe',
	'lock',
	'key',
	'shield',
	'tag',
	'hash',
	'label',
	'code',
	'database',
	'git-branch',
	'sun',
	'moon',
	'cloud',
	'coffee',
	'dumbbell',
	'utensils',
	'eye',
	'filter',
	'layers',
	'trash-2',
	'palette',
	'brush',
	'pin',
	'megaphone',
	'phone',
];

/** Palette-managed widget colors: `bg` paints the widget background, `btn`
 *  the action buttons inside it. Undefined = theme default. */
export interface QuickButtonsColors {
	bg?: string;
	btn?: string;
	onChange: (kind: 'bg' | 'btn', color: string | null) => void;
}

export function renderQuickActions(
	container: HTMLElement,
	actions: QuickAction[],
	onExecute: (action: QuickAction) => void,
	_onRemove: (index: number) => void,
	onAdd: () => void,
	order?: string[],
	onReorder?: (order: string[]) => void,
	onRemoveByKey?: (key: string) => void,
	hiddenPresets?: string[],
	onEdit?: (action: QuickAction) => void,
	colors?: QuickButtonsColors,
	automation?: AutomationUiPort,
): void {
	const root = container.createDiv({ cls: 'dashboard-section dashboard-quick-actions' });
	if (colors?.bg) root.style.background = colors.bg;
	if (colors?.btn) {
		root.style.setProperty('--qa-btn-bg', colors.btn);
		root.style.setProperty('--qa-btn-hover', `color-mix(in srgb, ${colors.btn} 88%, rgba(0, 0, 0, 0.45))`);
	}
	mountDashboardPanel(
		root,
		h(QuickActionsPanel, {
			actions,
			automation,
			execute: onExecute,
			remove: _onRemove,
			add: onAdd,
			order,
			reorder: onReorder,
			removeKey: onRemoveByKey,
			hidden: hiddenPresets,
			edit: onEdit,
		}),
	);
}
export class AddActionModal extends Modal {
	private onSelect: (action: QuickAction) => void;
	private activeTab: 'file' | 'command' | 'action' = 'file';
	private pendingAction: QuickAction | null = null;
	private lastQuery = '';
	private isEditMode = false;

	constructor(app: App, onSelect: (action: QuickAction) => void, initialAction?: QuickAction, private savedActions: QuickAction[] = []) {
		super(app);
		this.onSelect = onSelect;
		this.pendingAction = initialAction ?? null;
		this.isEditMode = !!initialAction;
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		containerEl.addClass('modal--dashboard');
		containerEl.parentElement?.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('quickActions.addAction') }), 'quickActions.addAction');
		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		if (this.pendingAction) {
			this.renderConfirmView(body, container);
		} else {
			this.renderSearchView(body, container);
		}
	}

	private renderSearchView(body: HTMLElement, container: HTMLElement): void {
		const tabBar = body.createDiv({ cls: 'dashboard-action-tabs' });
		const fileTab = bindLocalizedElement(tabBar.createEl('button', {
			cls: 'dashboard-action-tab' + (this.activeTab === 'file' ? ' active' : ''),
			text: t('quickActions.fileTab'),
		}), 'quickActions.fileTab');
		const cmdTab = bindLocalizedElement(tabBar.createEl('button', {
			cls: 'dashboard-action-tab' + (this.activeTab === 'command' ? ' active' : ''),
			text: t('quickActions.commandTab'),
		}), 'quickActions.commandTab');

		const switchTab = (tab: 'file' | 'command' | 'action') => {
			this.activeTab = tab;
			this.lastQuery = '';
			this.render();
		};
		fileTab.addEventListener('click', () => switchTab('file'));
		cmdTab.addEventListener('click', () => switchTab('command'));
		bindLocalizedElement(tabBar.createEl('button', { cls: 'dashboard-action-tab' + (this.activeTab === 'action' ? ' active' : ''), text: t('automation.savedActions') }), 'automation.savedActions').addEventListener('click', () => switchTab('action'));

		const searchWrap = body.createDiv({ cls: 'dashboard-docsearch' });
		const input = bindLocalizedElement(searchWrap.createEl('input', {
			cls: 'dashboard-modal-input dashboard-docsearch-input',
			attr: {
				type: 'text',
				placeholder: t('quickActions.searchPlaceholder'),
				autofocus: 'true',
				value: this.lastQuery,
			},
		}), 'quickActions.searchPlaceholder', undefined, "placeholder");
		const resultsList = searchWrap.createDiv({ cls: 'dashboard-docsearch-results' });

		const renderResults = (query: string) => {
			resultsList.empty();
			const q = query.toLowerCase().trim();
			if (this.activeTab === 'action') {
				for (const action of this.savedActions.filter(action => action.name.toLowerCase().includes(q))) {
					resultsList.createEl('button', { text: action.name, cls: 'dashboard-docsearch-result' }).addEventListener('click', () => { this.pendingAction = action; this.render(); });
				}
			} else if (this.activeTab === 'file') {
				this.renderFileResults(resultsList, q);
			} else {
				this.renderCommandResults(resultsList, q);
			}
		};

		input.addEventListener('input', () => {
			this.lastQuery = input.value;
			renderResults(input.value);
		});
		renderResults(input.value);
		input.focus();

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
	}

	private renderConfirmView(body: HTMLElement, container: HTMLElement): void {
		const action = this.pendingAction!;
		const defaultName = action.name;
		const defaultIcon = action.icon;

		// Preview of the selected file/command
		const preview = body.createDiv({ cls: 'dashboard-qa-confirm-preview' });
		const previewIcon = preview.createDiv({ cls: 'dashboard-docsearch-icon dashboard-qa-confirm-preview-icon' });
		setIcon(previewIcon, defaultIcon);
		const previewInfo = preview.createDiv({ cls: 'dashboard-docsearch-info' });
		previewInfo.createDiv({ cls: 'dashboard-docsearch-name', text: defaultName });
		previewInfo.createDiv({ cls: 'dashboard-docsearch-path', text: action.target });

		// Name field
		const nameField = body.createDiv({ cls: 'dashboard-qa-confirm-field' });
		bindLocalizedElement(nameField.createEl('label', { text: t('quickActions.displayName'), cls: 'dashboard-qa-confirm-label' }), 'quickActions.displayName');
		const nameInput = nameField.createEl('input', {
			cls: 'dashboard-modal-input',
			attr: { type: 'text', value: defaultName },
		});

		// Icon picker: clickable grid of common icons
		const iconField = body.createDiv({ cls: 'dashboard-qa-confirm-field' });
		bindLocalizedElement(iconField.createEl('label', { text: t('quickActions.icon'), cls: 'dashboard-qa-confirm-label' }), 'quickActions.icon');
		let selectedIcon = defaultIcon;
		const grid = iconField.createDiv({ cls: 'dashboard-qa-icon-grid' });
		const allIcons = COMMON_ICONS.includes(defaultIcon) ? COMMON_ICONS : [defaultIcon, ...COMMON_ICONS];
		const renderGrid = () => {
			grid.empty();
			for (const iconName of allIcons) {
				const opt = grid.createDiv({
					cls:
						'dashboard-qa-icon-option' +
						(iconName === selectedIcon ? ' dashboard-qa-icon-option--selected' : ''),
					attr: { title: iconName, 'aria-label': iconName, role: 'button' },
				});
				setIcon(opt, iconName);
				opt.addEventListener('click', () => {
					selectedIcon = iconName;
					setIcon(previewIcon, selectedIcon);
					grid.querySelectorAll('.dashboard-qa-icon-option').forEach((el) =>
						el.removeClass('dashboard-qa-icon-option--selected'),
					);
					opt.addClass('dashboard-qa-icon-option--selected');
				});
			}
		};
		renderGrid();

		nameInput.focus();
		nameInput.select();

		const finish = () => {
			const finalName = nameInput.value.trim() || defaultName;
			this.onSelect({ ...action, name: finalName, icon: selectedIcon });
			this.close();
		};

		nameInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				finish();
			}
		});

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		const backBtn = bindLocalizedElement(footer.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
			text: this.isEditMode ? t('common.cancel') : t('quickActions.back'),
		}), this.isEditMode ? ('common.cancel') : ('quickActions.back'), (this.isEditMode) ? (undefined) : (undefined));
		backBtn.addEventListener('click', () => {
			if (this.isEditMode) {
				this.close();
			} else {
				this.pendingAction = null;
				this.render();
			}
		});
		const confirmBtn = bindLocalizedElement(footer.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			text: this.isEditMode ? t('quickActions.saveAction') : t('quickActions.confirmAdd'),
		}), this.isEditMode ? ('quickActions.saveAction') : ('quickActions.confirmAdd'), (this.isEditMode) ? (undefined) : (undefined));
		confirmBtn.addEventListener('click', finish);
	}

	private renderFileResults(container: HTMLElement, q: string): void {
		if (!q) {
			bindLocalizedElement(container.createDiv({ cls: 'dashboard-docsearch-hint', text: t('quickActions.typeToSearchFile') }), 'quickActions.typeToSearchFile');
			return;
		}

		const files = this.app.vault
			.getFiles()
			.filter((f) => !f.path.startsWith('.'))
			.filter(
				(f) =>
					f.extension === 'md' ||
					f.extension === 'pdf' ||
					f.extension === 'canvas' ||
					f.extension === 'base' ||
					/\.(png|jpg|jpeg|gif|svg|webp|bmp|mp3|mp4|m4a|m4b|mov|mkv|avi)$/i.test(f.path),
			)
			.filter((f) => f.path.toLowerCase().includes(q) || f.basename.toLowerCase().includes(q))
			.slice(0, 20);

		if (files.length === 0) {
			bindLocalizedElement(container.createDiv({ cls: 'dashboard-docsearch-hint', text: t('quickActions.noResults') }), 'quickActions.noResults');
			return;
		}

		for (const file of files) {
			const item = container.createDiv({ cls: 'dashboard-docsearch-item' });
			const iconSpan = item.createSpan({ cls: 'dashboard-docsearch-icon' });
			setIcon(iconSpan, iconForExtension(file.extension));
			const info = item.createDiv({ cls: 'dashboard-docsearch-info' });
			info.createDiv({ cls: 'dashboard-docsearch-name', text: file.basename });
			info.createDiv({ cls: 'dashboard-docsearch-path', text: file.path });

			item.addEventListener('click', () => {
				this.pendingAction = {
					name: file.basename,
					icon: iconForExtension(file.extension),
					type: 'file',
					target: file.path,
				};
				this.render();
			});
		}
	}

	private renderCommandResults(container: HTMLElement, q: string): void {
		const commands = (this.app as AppWithCommands).commands.commands;

		if (!commands) {
			bindLocalizedElement(container.createDiv({ cls: 'dashboard-docsearch-hint', text: t('quickActions.noResults') }), 'quickActions.noResults');
			return;
		}

		const entries = Object.entries(commands)
			.map(([id, cmd]) => ({ id, name: cmd.name ?? id }))
			.filter((entry) => {
				if (!q) return true;
				return entry.name.toLowerCase().includes(q) || entry.id.toLowerCase().includes(q);
			})
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, 30);

		if (!q) {
			bindLocalizedElement(container.createDiv({ cls: 'dashboard-docsearch-hint', text: t('quickActions.typeToSearchCmd') }), 'quickActions.typeToSearchCmd');
			return;
		}

		if (entries.length === 0) {
			bindLocalizedElement(container.createDiv({ cls: 'dashboard-docsearch-hint', text: t('quickActions.noResults') }), 'quickActions.noResults');
			return;
		}

		for (const entry of entries) {
			const item = container.createDiv({ cls: 'dashboard-docsearch-item' });
			item.createSpan({ cls: 'dashboard-docsearch-icon', text: '⚙️' });
			const info = item.createDiv({ cls: 'dashboard-docsearch-info' });
			info.createDiv({ cls: 'dashboard-docsearch-name', text: entry.name });
			info.createDiv({ cls: 'dashboard-docsearch-path', text: entry.id });

			item.addEventListener('click', () => {
				this.pendingAction = { name: entry.name, icon: 'terminal', type: 'command', target: entry.id };
				this.render();
			});
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Kept for project search modal reuse
export class DocSearchModal extends Modal {
	private onSelect: (link: { name: string; path: string }) => void;

	constructor(app: App, onSelect: (link: { name: string; path: string }) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		containerEl.addClass('modal--dashboard');
		containerEl.parentElement?.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('quickActions.fileTab') }), 'quickActions.fileTab');
		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		const searchWrap = body.createDiv({ cls: 'dashboard-docsearch' });
		const input = bindLocalizedElement(searchWrap.createEl('input', {
			cls: 'dashboard-modal-input dashboard-docsearch-input',
			attr: { type: 'text', placeholder: t('quickActions.searchPlaceholder'), autofocus: 'true' },
		}), 'quickActions.searchPlaceholder', undefined, "placeholder");
		const resultsList = searchWrap.createDiv({ cls: 'dashboard-docsearch-results' });

		const renderResults = (query: string) => {
			resultsList.empty();
			const q = query.toLowerCase().trim();
			if (!q) return;

			const files = this.app.vault
				.getFiles()
				.filter((f) => !f.path.startsWith('.'))
				.filter(
					(f) =>
						f.extension === 'md' ||
						f.extension === 'pdf' ||
						f.extension === 'canvas' ||
						f.extension === 'base' ||
						/\.(png|jpg|jpeg|gif|svg|webp|bmp|mp3|mp4|m4a|m4b|mov|mkv|avi)$/i.test(f.path),
				)
				.filter((f) => f.path.toLowerCase().includes(q) || f.basename.toLowerCase().includes(q))
				.slice(0, 20);

			for (const file of files) {
				const item = resultsList.createDiv({ cls: 'dashboard-docsearch-item' });
				const iconSpan = item.createSpan({ cls: 'dashboard-docsearch-icon' });
				setIcon(iconSpan, iconForExtension(file.extension));
				const info = item.createDiv({ cls: 'dashboard-docsearch-info' });
				info.createDiv({ cls: 'dashboard-docsearch-name', text: file.basename });
				info.createDiv({ cls: 'dashboard-docsearch-path', text: file.path });
				item.addEventListener('click', () => {
					this.onSelect({ name: file.basename, path: file.path });
					this.close();
				});
			}
		};

		input.addEventListener('input', () => renderResults(input.value));
		input.focus();

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
