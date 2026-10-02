import { bindLocalizedElement } from '../../primitives/localized-dom';
import { App, Modal } from 'obsidian';
import type { LibraryConfig } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { ExcludeFoldersEditor } from '../../primitives/exclude-folders-editor';
import { MultiFolderSelectModal } from '../../primitives/folder-select-modal';
import { applyModalTheme } from '../appearance/modal-theme';
import { PathPickerModal } from '../ui/path-picker-modal';
import { extractFrontmatterProperties, getAllTags, renderTagsSelector } from './library-file-result';
import { VisiblePropertiesEditor } from './visible-properties-editor';

export interface FolderConfigResult {
	folders: string[];
	/** Folders whose files are hidden from the section (path-prefix match). */
	excludeFolders: string[];
	tags: string[];
	/** Kanban grouping key: frontmatter property name. */
	groupBy: string | undefined;
	/** Kanban grouping mode: property (groupBy) or top-level subfolders. */
	groupMode: 'property' | 'folder';
	/** Kanban view: show card cover images (gallery-style extraction). */
	kanbanShowCovers: boolean;
	showProperties: boolean;
	propertyLimit: number;
	/** Hand-picked card properties (order preserved); undefined = automatic. */
	visibleProperties: string[] | undefined;
	/** Template note applied to new notes created from this section. */
	templatePath: string | undefined;
}

/**
 * Merge a {@link FolderConfigResult} into the section's {@link LibraryConfig}.
 * Every field the modal manages comes from `result` (undefined clears it);
 * `base` — the section's current config, or undefined for a first-time save —
 * only contributes fields the modal does not touch (viewMode, sortBy, …).
 *
 * Extracted from view.ts's save callback so the merge — notably that
 * templatePath must survive a save — is unit-testable: the inline version
 * silently dropped the template the user had just picked.
 */
export function folderResultToLibraryConfig(
	base: LibraryConfig | undefined,
	result: FolderConfigResult,
): LibraryConfig {
	const safeBase: LibraryConfig = base ?? {
		filters: [],
		viewMode: 'grid',
		sortBy: 'modified',
		sortDesc: true,
	};
	const filtersWithoutTags = safeBase.filters.filter((f) => f.property !== 'tags');
	const filters =
		result.tags.length > 0
			? [...filtersWithoutTags, { property: 'tags', values: result.tags }]
			: filtersWithoutTags;
	return {
		...safeBase,
		folders: result.folders,
		excludeFolders: result.excludeFolders.length > 0 ? result.excludeFolders : undefined,
		filters,
		kanbanGroupBy: result.groupBy,
		groupMode: result.groupMode === 'folder' ? 'folder' : undefined,
		kanbanShowCovers: result.kanbanShowCovers ? true : undefined,
		showProperties: result.showProperties ? undefined : false,
		propertyLimit: result.propertyLimit,
		visibleProperties: result.visibleProperties,
		templatePath: result.templatePath,
	};
}

/**
 * Configuration modal for a folder section: the folder path plus an optional
 * tag filter, kanban "group by" selector (by property or by subfolder), and
 * card property display settings.
 */
export class FolderConfigModal extends Modal {
	private folders: string[];
	private readonly initialExcludeFolders: string[];
	private selectedTags: string[];
	private groupBy: string;
	private groupMode: 'property' | 'folder';
	private kanbanShowCovers: boolean;
	private showProperties: boolean;
	private propertyLimit: number;
	private visibleProperties: string[];
	private templatePath: string;
	private readonly onSave: (result: FolderConfigResult) => void;

	constructor(
		app: App,
		currentFolders: string[],
		currentExcludeFolders: string[] | undefined,
		currentTags: string[],
		currentGroupBy: string | undefined,
		currentShowProperties: boolean | undefined,
		currentPropertyLimit: number | undefined,
		onSave: (result: FolderConfigResult) => void,
		currentGroupMode?: 'property' | 'folder',
		currentVisibleProperties?: string[],
		currentKanbanShowCovers?: boolean,
		templatePath?: string,
	) {
		super(app);
		this.folders = [...currentFolders];
		this.initialExcludeFolders = [...(currentExcludeFolders ?? [])];
		this.selectedTags = [...currentTags];
		this.groupBy = currentGroupBy ?? '';
		this.groupMode = currentGroupMode ?? 'property';
		this.kanbanShowCovers = currentKanbanShowCovers === true;
		this.showProperties = currentShowProperties !== false;
		this.propertyLimit = currentPropertyLimit ?? 6;
		this.visibleProperties = [...(currentVisibleProperties ?? [])];
		this.templatePath = (templatePath ?? '').trim();
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		containerEl.addClass('modal--dashboard');
		containerEl.parentElement?.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });

		// Header
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('folder.configure') }), 'folder.configure');

		// Body
		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		// Folder paths
		const pathSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(pathSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('folder.path') }), 'folder.path');

		const chipsHost = pathSection.createDiv({ cls: 'dashboard-alltasks-exclude-chips' });
		const addRow = pathSection.createDiv({ cls: 'dashboard-media-folder-input-row' });
		const pathInput = bindLocalizedElement(addRow.createEl('input', {
			cls: 'dashboard-media-filter-folder',
			attr: { type: 'text', placeholder: t('folder.pathPlaceholder') },
		}), 'folder.pathPlaceholder', undefined, "placeholder");
		const browseBtn = bindLocalizedElement(addRow.createEl('button', {
			cls: 'dashboard-media-folder-browse',
			text: t('folder.browse'),
		}), 'folder.browse');
		browseBtn.addEventListener('click', () => {
			// Multi-select: pick every source folder at once. Sources are OR unions,
			// so parents/children stay independently tickable.
			new MultiFolderSelectModal(this.app, this.folders, (folders) => {
				this.folders = folders;
				renderFolderChips();
			}).open();
		});
		const addBtn = bindLocalizedElement(addRow.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			text: t('common.add'),
		}), 'common.add');

		const renderFolderChips = (): void => {
			chipsHost.empty();
			if (this.folders.length === 0) {
				bindLocalizedElement(chipsHost.createDiv({ cls: 'dashboard-library-filter-empty', text: t('folder.noFolders') }), 'folder.noFolders');
				return;
			}
			for (const folder of this.folders) {
				const chip = chipsHost.createDiv({ cls: 'dashboard-alltasks-exclude-chip' });
				chip.createSpan({ text: folder });
				const x = chip.createSpan({ cls: 'dashboard-alltasks-exclude-chip-x', text: '×' });
				x.addEventListener('click', () => {
					this.folders = this.folders.filter((f) => f !== folder);
					renderFolderChips();
				});
			}
		};
		const addFolder = (): void => {
			const folder = pathInput.value.trim().replace(/^\/+|\/+$/g, '');
			pathInput.value = '';
			if (!folder) return;
			if (this.folders.some((f) => f.toLowerCase() === folder.toLowerCase())) return;
			this.folders = [...this.folders, folder];
			renderFolderChips();
		};
		addBtn.addEventListener('click', addFolder);
		pathInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				addFolder();
			}
		});
		renderFolderChips();

		// Excluded folders: files inside them are hidden even when they live
		// under a scanned source folder above.
		const excludeSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(excludeSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('exclude.folders') }), 'exclude.folders');
		bindLocalizedElement(excludeSection.createDiv({ cls: 'dashboard-library-config-hint', text: t('exclude.foldersHint') }), 'exclude.foldersHint');
		const excludeEditor = new ExcludeFoldersEditor(this.app, excludeSection, this.initialExcludeFolders);

		// Tags filter, with a search box to narrow the chip list when the vault
		// has too many tags to scan by eye.
		const tagsSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(tagsSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.tagsFilter') }), 'library.tagsFilter');
		const tagSearchRow = tagsSection.createDiv({
			cls: 'dashboard-media-folder-input-row dashboard-library-tag-search-row',
		});
		const tagSearchInput = bindLocalizedElement(tagSearchRow.createEl('input', {
			cls: 'dashboard-media-filter-folder dashboard-library-tag-search',
			attr: { type: 'text', placeholder: t('library.searchTags') },
		}), 'library.searchTags', undefined, "placeholder");
		const tagsContainer = tagsSection.createDiv({ cls: 'dashboard-library-filter-values' });
		const allTags = getAllTags(this.app);
		const renderTags = (): void => {
			const query = tagSearchInput.value.trim().toLowerCase();
			const visible = query ? allTags.filter((tag) => tag.toLowerCase().includes(query)) : allTags;
			// renderTagsSelector's own empty state means "vault has no tags";
			// a search that filters everything out needs a distinct message.
			if (visible.length === 0 && allTags.length > 0) {
				tagsContainer.empty();
				bindLocalizedElement(tagsContainer.createDiv({ cls: 'dashboard-library-filter-empty', text: t('library.noMatchingTags') }), 'library.noMatchingTags');
				return;
			}
			renderTagsSelector(tagsContainer, visible, this.selectedTags, (tag) => {
				this.selectedTags = this.selectedTags.includes(tag)
					? this.selectedTags.filter((tg) => tg !== tag)
					: [...this.selectedTags, tag];
				renderTags();
			});
		};
		tagSearchInput.addEventListener('input', () => renderTags());
		renderTags();

		// Kanban group-by: property vs subfolder mode. The property picker only
		// applies in property mode, so it hides when subfolder grouping is on.
		const groupSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(groupSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.kanbanGroupBy') }), 'library.kanbanGroupBy');
		const modeToggle = groupSection.createDiv({
			cls: 'dashboard-library-view-toggle dashboard-library-config-view-toggle',
		});
		const propertyBtn = bindLocalizedElement(modeToggle.createDiv({
			cls: 'dashboard-library-view-btn' + (this.groupMode === 'property' ? ' active' : ''),
			attr: { 'aria-label': t('library.groupByProperty') },
		}), 'library.groupByProperty', undefined, "aria-label");
		bindLocalizedElement(propertyBtn.createSpan({ text: t('library.groupByProperty') }), 'library.groupByProperty');
		const folderBtn = bindLocalizedElement(modeToggle.createDiv({
			cls: 'dashboard-library-view-btn' + (this.groupMode === 'folder' ? ' active' : ''),
			attr: { 'aria-label': t('library.groupByFolder') },
		}), 'library.groupByFolder', undefined, "aria-label");
		bindLocalizedElement(folderBtn.createSpan({ text: t('library.groupByFolder') }), 'library.groupByFolder');

		const propertyControls = groupSection.createDiv({ cls: 'dashboard-library-config-groupby-controls' });
		bindLocalizedElement(propertyControls.createDiv({ cls: 'dashboard-library-config-hint', text: t('library.kanbanGroupByHint') }), 'library.kanbanGroupByHint');
		const groupSelect = propertyControls.createEl('select', { cls: 'dashboard-library-filter-property' });
		bindLocalizedElement(groupSelect.createEl('option', { text: t('library.noGroup'), attr: { value: '' } }), 'library.noGroup');
		const propKeys = [...extractFrontmatterProperties(this.app).keys()].sort();
		for (const key of propKeys) {
			const opt = groupSelect.createEl('option', { text: key, attr: { value: key } });
			if (key === this.groupBy) opt.selected = true;
		}
		groupSelect.addEventListener('change', () => {
			this.groupBy = groupSelect.value;
		});

		const folderHint = bindLocalizedElement(groupSection.createDiv({
			cls: 'dashboard-library-config-hint',
			text: t('library.groupByFolderHint'),
		}), 'library.groupByFolderHint');
		const applyMode = (): void => {
			propertyBtn.toggleClass('active', this.groupMode === 'property');
			folderBtn.toggleClass('active', this.groupMode === 'folder');
			propertyControls.toggleClass('is-hidden', this.groupMode !== 'property');
			folderHint.toggleClass('is-hidden', this.groupMode !== 'folder');
		};
		propertyBtn.addEventListener('click', () => {
			this.groupMode = 'property';
			applyMode();
		});
		folderBtn.addEventListener('click', () => {
			this.groupMode = 'folder';
			applyMode();
		});
		applyMode();

		// Kanban card covers: same 封面/cover extraction as the gallery view.
		const coversRow = groupSection.createDiv({ cls: 'dashboard-library-config-inline-row' });
		const coversBox = coversRow.createEl('input', {
			cls: 'dashboard-library-config-checkbox',
			attr: { type: 'checkbox' },
		});
		coversBox.checked = this.kanbanShowCovers;
		coversBox.addEventListener('change', () => {
			this.kanbanShowCovers = coversBox.checked;
		});
		bindLocalizedElement(coversRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('library.kanbanShowCovers') }), 'library.kanbanShowCovers');

		// Card properties (grid view)
		const propsSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(propsSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.cardProperties') }), 'library.cardProperties');

		const propsRow = propsSection.createDiv({ cls: 'dashboard-library-config-inline-row' });
		const showPropsBox = propsRow.createEl('input', {
			cls: 'dashboard-library-config-checkbox',
			attr: { type: 'checkbox' },
		});
		showPropsBox.checked = this.showProperties;
		showPropsBox.addEventListener('change', () => {
			this.showProperties = showPropsBox.checked;
		});
		bindLocalizedElement(propsRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('library.showProperties') }), 'library.showProperties');

		const limitRow = propsSection.createDiv({ cls: 'dashboard-library-config-inline-row' });
		bindLocalizedElement(limitRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('library.propertyLimit') }), 'library.propertyLimit');
		const limitInput = limitRow.createEl('input', {
			cls: 'dashboard-library-config-number',
			attr: { type: 'number', min: '0', max: '20', step: '1' },
		});
		limitInput.value = String(this.propertyLimit);
		limitInput.addEventListener('change', () => {
			this.propertyLimit = Math.max(0, Math.min(20, Math.floor(Number(limitInput.value) || 6)));
		});

		// Pinned properties: picked keys show first (all of them); only cards
		// hitting none fall back to the automatic slice above.
		const pinnedEditor = new VisiblePropertiesEditor(this.app, propsSection, this.visibleProperties);

		// Footer
		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		// New-note template: body of this note seeds notes created by the
		// toolbar "+" (frontmatter merged from the section's filter props).
		const tplSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(tplSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.newNoteTemplate') }), 'library.newNoteTemplate');
		bindLocalizedElement(tplSection.createDiv({ cls: 'dashboard-library-config-hint', text: t('library.newNoteTemplateHint') }), 'library.newNoteTemplateHint');
		const tplRow = tplSection.createDiv({ cls: 'dashboard-media-folder-input-row' });
		const tplInput = tplRow.createEl('input', {
			cls: 'dashboard-media-filter-folder',
			attr: { type: 'text', placeholder: 'Templates/note.md' },
		});
		tplInput.value = this.templatePath;
		bindLocalizedElement(tplRow
			.createEl('button', {
				cls: 'dashboard-media-folder-browse',
				text: t('folder.browse'),
			}), 'folder.browse')
			.addEventListener('click', () => {
				new PathPickerModal(this.app, 'file', (path) => {
					tplInput.value = path;
					this.templatePath = path;
				}).open();
			});
		tplInput.addEventListener('change', () => {
			this.templatePath = tplInput.value.trim();
		});

		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());

		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
				text: t('common.save'),
			}), 'common.save')
			.addEventListener('click', () => {
				const picked = pinnedEditor.value;
				this.onSave({
					folders: this.folders,
					excludeFolders: excludeEditor.value,
					tags: this.selectedTags,
					groupBy: this.groupBy || undefined,
					groupMode: this.groupMode,
					kanbanShowCovers: this.kanbanShowCovers,
					showProperties: this.showProperties,
					propertyLimit: this.propertyLimit,
					visibleProperties: picked.length > 0 ? picked : undefined,
					templatePath: this.templatePath || undefined,
				});
				this.close();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
