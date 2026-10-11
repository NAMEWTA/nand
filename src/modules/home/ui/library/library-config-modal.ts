import { bindLocalizedElement } from '../../../../ui/primitives/localized-dom';
import { App, Modal, setIcon } from 'obsidian';
import { templateChoices } from '../../core/board/board-experience';
import type { LibraryConfig, PropertyFilterOperator } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import { ExcludeFoldersEditor } from '../ui/exclude-folders-editor';
import { applyModalTheme } from '../appearance/modal-theme';
import { TemplateListEditor } from './TemplateListEditor';
import { extractFrontmatterProperties } from './library-file-result';
import { VisiblePropertiesEditor } from './visible-properties-editor';

/** Pseudo-properties whose filter branches have fixed semantics (path does
    substring matching, created/modified use date ranges) — no operator UI. */
const PSEUDO_PROPERTIES = new Set(['path', 'created', 'modified']);
const OPERATORS: PropertyFilterOperator[] = ['equals', 'contains', 'notEquals'];

export class LibraryConfigModal extends Modal {
	private config: LibraryConfig;
	private availableProps: Map<string, Set<string>>;
	private onSave: (config: LibraryConfig) => void;
	private templates?: TemplateListEditor;

	constructor(app: App, config: LibraryConfig, onSave: (config: LibraryConfig) => void) {
		super(app);
		this.config = { ...config, filters: config.filters.map((f) => ({ ...f, values: [...f.values] })) };
		this.onSave = onSave;
		this.availableProps = extractFrontmatterProperties(app);
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal');
		containerEl.addClass('modal--dashboard');
		containerEl.parentElement?.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);
		containerEl.setCssProps({
			background: 'transparent',
			backgroundColor: 'transparent',
			border: 'none',
			boxShadow: 'none',
		});

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });

		// Header
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('library.configTitle') }), 'library.configTitle');

		// Body
		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		// Filters
		const filtersSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(filtersSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.property') }), 'library.property');

		const filtersContainer = filtersSection.createDiv({ cls: 'dashboard-library-config-filters' });

		const renderFilters = (): void => {
			filtersContainer.empty();

			for (let i = 0; i < this.config.filters.length; i++) {
				const filter = this.config.filters[i]!;
				const row = filtersContainer.createDiv({ cls: 'dashboard-library-filter-row' });
				const header = row.createDiv({ cls: 'dashboard-library-filter-header' });

				// Property selector (left of the search box in the header row)
				const propSelect = header.createEl('select', { cls: 'dashboard-library-filter-property' });
				// 'tags' is intentionally listed: evaluateFilter has a dedicated
				// tags branch (frontmatter + inline tags) and the property
				// extractor collects tag values, so it filters like any property.
				const propKeys = [...this.availableProps.keys()].sort();
				bindLocalizedElement(propSelect.createEl('option', { text: t('library.selectProperty'), attr: { value: '' } }), 'library.selectProperty');
				for (const key of propKeys) {
					const opt = propSelect.createEl('option', { text: key, attr: { value: key } });
					if (key === filter.property) opt.selected = true;
				}

				propSelect.addEventListener('change', () => {
					filter.property = propSelect.value;
					filter.values = [];
					renderFilters();
				});

				// Operator (between the property selector and the value search
				// box): how checked values compare. Hidden for the
				// pseudo-properties (path/created/modified) whose filter
				// branches have fixed semantics of their own.
				const operator = filter.operator ?? 'equals';
				if (filter.property && !PSEUDO_PROPERTIES.has(filter.property)) {
					const opSelect = header.createEl('select', { cls: 'dashboard-library-filter-operator' });
					opSelect.title = t('library.filterOperator');
					for (const op of OPERATORS) {
						const opt = bindLocalizedElement(opSelect.createEl('option', {
							text: t(`library.op${op.charAt(0).toUpperCase()}${op.slice(1)}`),
							attr: { value: op },
						}), `library.op${op.charAt(0).toUpperCase()}${op.slice(1)}`);
						if (op === operator) opt.selected = true;
					}
					opSelect.addEventListener('change', () => {
						filter.operator = opSelect.value as PropertyFilterOperator;
						renderFilters();
					});
				}

				// Value search box (right of the operator dropdown). In contains
				// mode the placeholder invites free text — Enter adds it as a
				// custom chip, since a substring usually isn't an existing value.
				let searchInput: HTMLInputElement | null = null;
				if (filter.property) {
					searchInput = bindLocalizedElement(header.createEl('input', {
						cls: 'dashboard-library-value-search',
						attr: {
							type: 'text',
							placeholder:
								operator === 'contains' ? t('library.searchValuesContains') : t('library.searchValues'),
						},
					}), operator === 'contains' ? ('library.searchValuesContains') : ('library.searchValues'), (operator === 'contains') ? (undefined) : (undefined), "placeholder");
				}

				// Remove button (far right of the header row)
				const removeBtn = bindLocalizedElement(header.createEl('button', {
					cls: 'dashboard-library-filter-remove',
					attr: { 'aria-label': t('library.removeFilter') },
				}), 'library.removeFilter', undefined, "aria-label");
				setIcon(removeBtn, 'x');
				removeBtn.addEventListener('click', () => {
					this.config.filters = this.config.filters.filter((_, idx) => idx !== i);
					renderFilters();
				});

				// Value chips (below the header)
				if (filter.property && searchInput) {
					const availableValues = this.availableProps.get(filter.property);
					const sorted = availableValues ? [...availableValues].sort() : [];
					const valuesList = row.createDiv({ cls: 'dashboard-library-value-list' });

					const renderValues = (): void => {
						valuesList.empty();
						// Custom values (free text added in contains mode) render
						// alongside existing values so they stay visible and removable.
						const existing = new Set(sorted);
						const all = [...filter.values.filter((v) => !existing.has(v)), ...sorted];
						if (all.length === 0) {
							bindLocalizedElement(valuesList.createDiv({
								cls: 'dashboard-library-filter-empty',
								text: t('library.noValues'),
							}), 'library.noValues');
							return;
						}
						if (!searchInput) return;
						const query = searchInput.value.trim().toLowerCase();
						const visible = query ? all.filter((v) => v.toLowerCase().includes(query)) : all;
						if (visible.length === 0) {
							bindLocalizedElement(valuesList.createDiv({
								cls: 'dashboard-library-filter-empty',
								text: t('library.noMatchingValues'),
							}), 'library.noMatchingValues');
							return;
						}
						for (const val of visible) {
							const chip = valuesList.createDiv({
								cls: 'dashboard-library-filter-chip' + (filter.values.includes(val) ? ' active' : ''),
								text: val,
							});
							chip.addEventListener('click', () => {
								const idx = filter.values.indexOf(val);
								if (idx >= 0) {
									filter.values = filter.values.filter((v) => v !== val);
								} else {
									filter.values = [...filter.values, val];
								}
								renderValues();
							});
						}
					};

					searchInput.addEventListener('input', renderValues);
					// Contains mode: Enter adds the typed text as a custom value —
					// substrings usually aren't existing values, so the vault's
					// chip list alone can't express them.
					if (operator === 'contains') {
						searchInput.addEventListener('keydown', (ev) => {
							if (ev.key !== 'Enter') return;
							ev.preventDefault();
							const typed = searchInput.value.trim();
							if (!typed || filter.values.includes(typed)) return;
							filter.values = [...filter.values, typed];
							searchInput.value = '';
							renderValues();
						});
					}
					renderValues();
				}
			}
		};

		renderFilters();

		// Add filter button
		const addFilterBtn = bindLocalizedElement(filtersSection.createEl('button', {
			cls: 'dashboard-library-add-filter-btn',
			text: t('library.addFilter'),
		}), 'library.addFilter');
		addFilterBtn.addEventListener('click', () => {
			this.config.filters = [...this.config.filters, { property: '', values: [] }];
			renderFilters();
		});

		// Kanban group by
		const kanbanSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(kanbanSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.kanbanGroupBy') }), 'library.kanbanGroupBy');
		bindLocalizedElement(kanbanSection.createDiv({ cls: 'dashboard-library-config-hint', text: t('library.kanbanGroupByHint') }), 'library.kanbanGroupByHint');
		const groupSelect = kanbanSection.createEl('select', { cls: 'dashboard-library-filter-property' });
		const effectiveGroup = this.config.kanbanGroupBy ?? 'tags';
		bindLocalizedElement(groupSelect.createEl('option', { text: t('library.noGroup'), attr: { value: '' } }), 'library.noGroup');
		for (const key of [...this.availableProps.keys()].sort()) {
			const opt = groupSelect.createEl('option', { text: key, attr: { value: key } });
			if (key === effectiveGroup) opt.selected = true;
		}
		groupSelect.addEventListener('change', () => {
			this.config.kanbanGroupBy = groupSelect.value || undefined;
		});

		// Kanban card covers: same 封面/cover extraction as the gallery view.
		const coversRow = kanbanSection.createDiv({ cls: 'dashboard-library-config-inline-row' });
		const coversBox = coversRow.createEl('input', {
			cls: 'dashboard-library-config-checkbox',
			attr: { type: 'checkbox' },
		});
		coversBox.checked = this.config.kanbanShowCovers === true;
		coversBox.addEventListener('change', () => {
			this.config.kanbanShowCovers = coversBox.checked ? true : undefined;
		});
		bindLocalizedElement(coversRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('library.kanbanShowCovers') }), 'library.kanbanShowCovers');

		// Excluded folders: files inside them never reach the section's data.
		const excludeSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(excludeSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('exclude.folders') }), 'exclude.folders');
		bindLocalizedElement(excludeSection.createDiv({ cls: 'dashboard-library-config-hint', text: t('exclude.foldersHint') }), 'exclude.foldersHint');
		const excludeEditor = new ExcludeFoldersEditor(this.app, excludeSection, this.config.excludeFolders ?? []);

		// Card properties (grid view)
		const propsSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(propsSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.cardProperties') }), 'library.cardProperties');

		const propsRow = propsSection.createDiv({ cls: 'dashboard-library-config-inline-row' });
		const showPropsBox = propsRow.createEl('input', {
			cls: 'dashboard-library-config-checkbox',
			attr: { type: 'checkbox' },
		});
		showPropsBox.checked = this.config.showProperties !== false;
		showPropsBox.addEventListener('change', () => {
			this.config.showProperties = showPropsBox.checked ? undefined : false;
		});
		bindLocalizedElement(propsRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('library.showProperties') }), 'library.showProperties');

		const limitRow = propsSection.createDiv({ cls: 'dashboard-library-config-inline-row' });
		bindLocalizedElement(limitRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('library.propertyLimit') }), 'library.propertyLimit');
		const limitInput = limitRow.createEl('input', {
			cls: 'dashboard-library-config-number',
			attr: { type: 'number', min: '0', max: '20', step: '1' },
		});
		limitInput.value = String(this.config.propertyLimit ?? 6);
		limitInput.addEventListener('change', () => {
			const n = Math.max(0, Math.min(20, Math.floor(Number(limitInput.value) || 6)));
			limitInput.value = String(n);
			this.config.propertyLimit = n;
		});

		// Pinned properties: picked keys show first (all of them); only cards
		// hitting none fall back to the automatic slice above.
		const pinnedEditor = new VisiblePropertiesEditor(this.app, propsSection, this.config.visibleProperties ?? []);

		// Footer
		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());

		// New-note template: body of this note seeds notes created by the
		// toolbar "+" (frontmatter merged from the section's filter props).
		const tplSection = body.createDiv({ cls: 'dashboard-library-config-section' });
		bindLocalizedElement(tplSection.createDiv({ cls: 'dashboard-library-config-section-title', text: t('library.newNoteTemplate') }), 'library.newNoteTemplate');
		this.templates = new TemplateListEditor(this.app, tplSection.createDiv(), templateChoices(this.config.templatePath, this.config.templatePaths));

		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
				text: t('common.save'),
			}), 'common.save')
			.addEventListener('click', () => {
				const folders = excludeEditor.value;
				const picked = pinnedEditor.value;
				const templates = this.templates!.value;
				this.onSave({
					...this.config,
					excludeFolders: folders.length > 0 ? folders : undefined,
					visibleProperties: picked.length > 0 ? picked : undefined,
					templatePaths: templates,
					templatePath: templates[0],
				});
				this.close();
			});
	}

	onClose(): void {
		this.templates?.dispose();
		this.contentEl.empty();
	}
}
