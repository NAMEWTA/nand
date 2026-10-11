import { bindLocalizedElement } from '../../../../ui/primitives/localized-dom';
import { Modal, setIcon } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';

export interface SectionTypeOption {
	value: string;
	icon: string;
	labelKey: string;
}

/**
 * Section types offered when adding a new section. Rendered as a wrapping grid
 * of icon+label cards so the picker is usable on narrow/mobile screens (the
 * previous inline name+9-buttons+confirm row ran out of space on mobile).
 */
export const SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
	{ value: 'projects', icon: 'layout-grid', labelKey: 'renderer.typeNotes' },
	{ value: 'todo', icon: 'check-square', labelKey: 'renderer.typeTodo' },
	{ value: 'memo', icon: 'sticky-note', labelKey: 'renderer.typeMemo' },
	{ value: 'sticky', icon: 'layers', labelKey: 'renderer.typeSticky' },
	{ value: 'notes', icon: 'file-text', labelKey: 'renderer.typeNotesPlain' },
	{ value: 'dataview', icon: 'table-2', labelKey: 'renderer.typeDataview' },
	{ value: 'library', icon: 'database', labelKey: 'renderer.typeLibrary' },
	{ value: 'folder', icon: 'folder', labelKey: 'renderer.typeFolder' },
	{ value: 'pipeline', icon: 'workflow', labelKey: 'home.pipeline.title' },
	{ value: 'images', icon: 'image', labelKey: 'renderer.typeImages' },
	{ value: 'videos', icon: 'video', labelKey: 'renderer.typeVideos' },
	{ value: 'calendar', icon: 'calendar-days', labelKey: 'renderer.typeCalendar' },
	{ value: 'web', icon: 'globe', labelKey: 'renderer.typeWeb' },
	{ value: 'weread', icon: 'book-open', labelKey: 'renderer.typeWeread' },
];

export class AddSectionModal extends Modal {
	private selectedType: string;
	private readonly onAdd: (name: string, sectionType: string) => void;
	private nameInput: HTMLInputElement | null = null;
	private focusTimer?: number;

	constructor(
		app: import('obsidian').App,
		onAdd: (name: string, sectionType: string) => void,
		initialType = 'projects',
	) {
		super(app);
		this.onAdd = onAdd;
		this.selectedType = initialType;
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
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('section.addTitle') }), 'section.addTitle');

		const body = container.createDiv({ cls: 'dashboard-modal-body' });

		bindLocalizedElement(body.createDiv({ cls: 'dashboard-library-config-section-title', text: t('section.chooseType') }), 'section.chooseType');
		const grid = body.createDiv({ cls: 'dashboard-add-section-grid' });
		this.renderTypeGrid(grid);

		const nameRow = body.createDiv({ cls: 'dashboard-library-config-inline-row dashboard-add-section-name-row' });
		bindLocalizedElement(nameRow.createDiv({ cls: 'dashboard-library-config-inline-label', text: t('section.nameLabel') }), 'section.nameLabel');
		this.nameInput = bindLocalizedElement(nameRow.createEl('input', {
			cls: 'dashboard-task-input dashboard-section-name-input',
			attr: { type: 'text', placeholder: t('section.namePlaceholder') },
		}), 'section.namePlaceholder', undefined, "placeholder");
		this.nameInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.tryConfirm();
			}
		});

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
		const confirmBtn = bindLocalizedElement(footer.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			text: t('common.save'),
		}), 'common.save');
		confirmBtn.addEventListener('click', () => this.tryConfirm());

		this.focusTimer = contentEl.win.setTimeout(() => this.nameInput?.focus(), 0);
	}

	private renderTypeGrid(grid: HTMLElement): void {
		grid.empty();
		for (const opt of SECTION_TYPE_OPTIONS) {
			const card = grid.createEl('button', {
				cls: 'dashboard-add-section-card' + (opt.value === this.selectedType ? ' active' : ''),
				attr: { 'data-type': opt.value, type: 'button', 'aria-pressed': String(opt.value === this.selectedType) },
			});
			const iconEl = card.createDiv({ cls: 'dashboard-add-section-card-icon' });
			setIcon(iconEl, opt.icon);
			bindLocalizedElement(card.createDiv({ cls: 'dashboard-add-section-card-name', text: t(opt.labelKey) }), opt.labelKey);
			card.addEventListener('click', () => {
				this.selectedType = opt.value;
				for (const choice of grid.querySelectorAll<HTMLElement>('[data-type]')) {
					const selected = choice.dataset.type === this.selectedType;
					choice.toggleClass('active', selected);
					choice.setAttribute('aria-pressed', String(selected));
				}
			});
		}
	}

	/** Localized label of the currently selected type, used as the default section name. */
	private defaultName(): string {
		const opt = SECTION_TYPE_OPTIONS.find((o) => o.value === this.selectedType);
		return opt ? t(opt.labelKey) : this.selectedType;
	}

	private tryConfirm(): void {
		const name = this.nameInput?.value.trim() || this.defaultName();
		this.onAdd(name, this.selectedType);
		this.close();
	}

	onClose(): void {
		if (this.focusTimer !== undefined) this.contentEl.win.clearTimeout(this.focusTimer);
		this.nameInput = null;
		this.contentEl.empty();
	}
}
