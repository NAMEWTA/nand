import { bindLocalizedElement } from '../../../../ui/primitives/localized-dom';
import { App, Modal, setIcon } from 'obsidian';
import type { DashboardCard } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';
import { cardDocumentPaths, editCardDocuments } from '../../core/board/card-links';
import { formatFocalPoint } from '../../core/board/focal-point';
import { resolveVaultImage } from '../banner/banner';
import { mountFocalEditor } from '../images/focal-editor';

type CardEdit = Pick<DashboardCard, 'title' | 'docs' | 'coverImage' | 'coverPos'>;

export class CardEditModal extends Modal {
	private card: DashboardCard;
	private onSave: (updates: CardEdit) => void;
	private linkedPaths: string[];
	private coverImageValue: string;
	private coverPos: string | undefined;
	private focalEditor?: ReturnType<typeof mountFocalEditor>;
	private pendingPaths: Set<string> = new Set();

	constructor(
		app: App,
		card: DashboardCard,
		onSave: (updates: CardEdit) => void,
	) {
		super(app);
		this.card = card;
		this.onSave = onSave;

		this.linkedPaths = cardDocumentPaths(card.docs);

		this.coverImageValue = card.coverImage || '';
		this.coverPos = card.coverPos;
	}

	onOpen(): void {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		contentEl.addClass('dashboard-library-config-modal', 'nand-focal-modal');
		this.modalEl.addClass('modal--dashboard');
		containerEl.addClass('modal-bg--dashboard');
		applyModalTheme(containerEl);

		const container = contentEl.createDiv({ cls: 'dashboard-modal dashboard-modal--compact' });
		const header = container.createDiv({ cls: 'dashboard-modal-header' });
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('cardEdit.title') }), 'cardEdit.title');

		const body = container.createDiv({ cls: 'dashboard-modal-body' });
		const form = body.createDiv({ cls: 'dashboard-modal-form' });

		const titleField = form.createDiv();
		bindLocalizedElement(titleField.createEl('label', { text: t('cardEdit.titleLabel') }), 'cardEdit.titleLabel');
		const titleInput = titleField.createEl('input', {
			cls: 'dashboard-modal-input',
			attr: { type: 'text', 'aria-label': t('cardEdit.titleLabel') },
		});
		titleInput.value = this.card.title;

		const coverField = form.createDiv();
		bindLocalizedElement(coverField.createEl('label', { text: t('cardEdit.coverImage') }), 'cardEdit.coverImage');
		const coverInput = bindLocalizedElement(coverField.createEl('input', {
			cls: 'dashboard-modal-input',
			attr: { type: 'text', placeholder: t('cardEdit.coverImagePlaceholder'), 'aria-label': t('cardEdit.coverImage') },
		}), 'cardEdit.coverImagePlaceholder', undefined, "placeholder");
		coverInput.value = this.coverImageValue;
		this.focalEditor = mountFocalEditor(coverField.createDiv(), {
			source: resolveVaultImage(this.app, this.coverImageValue), value: this.coverPos, ratio: 3,
			change: point => { this.coverPos = formatFocalPoint(point); },
		}, this.app);
		coverInput.addEventListener('input', () => this.focalEditor?.update(resolveVaultImage(this.app, coverInput.value.trim()), this.coverPos));

		const docsField = form.createDiv();
		bindLocalizedElement(docsField.createEl('label', { text: t('cardEdit.linkedDocs') }), 'cardEdit.linkedDocs');

		const docsList = docsField.createDiv({ cls: 'dashboard-modal-docs-list' });

		const renderDocs = () => {
			docsList.empty();
			if (this.linkedPaths.length === 0) {
				bindLocalizedElement(docsList.createDiv({ cls: 'dashboard-modal-docs-empty', text: t('cardEdit.noDocs') }), 'cardEdit.noDocs');
				return;
			}
			this.linkedPaths.forEach((docPath, idx) => {
				const file = this.app.vault.getFileByPath(docPath);
				const docItem = docsList.createDiv({ cls: 'dashboard-modal-doc-item' });
				docItem.createSpan({
					text: file?.basename ?? docPath.split('/').pop() ?? docPath,
					cls: 'dashboard-modal-doc-name',
				});

				const removeBtn = docItem.createEl('button', {
					cls: 'dashboard-modal-doc-remove',
					attr: { 'aria-label': t('common.remove', { name: docPath }) },
				});
				setIcon(removeBtn, 'x');
				removeBtn.addEventListener('click', () => {
					this.linkedPaths = this.linkedPaths.filter((_, i) => i !== idx);
					renderDocs();
					(docsList.querySelector<HTMLButtonElement>('button') ?? searchInput).focus();
				});
			});
		};

		renderDocs();

		// Search with multi-select
		const searchField = form.createDiv();
		bindLocalizedElement(searchField.createEl('label', { text: t('cardEdit.searchDocs') }), 'cardEdit.searchDocs');
		const searchInput = bindLocalizedElement(searchField.createEl('input', {
			cls: 'dashboard-modal-input',
			attr: { type: 'text', placeholder: t('quickLinks.typeToSearch'), 'aria-label': t('cardEdit.searchDocs') },
		}), 'quickLinks.typeToSearch', undefined, "placeholder");

		const searchResults = searchField.createDiv({ cls: 'dashboard-modal-search-results' });

		const renderSearchResults = () => {
			searchResults.empty();
			const q = searchInput.value.toLowerCase().trim();
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
				.filter((f) => !this.linkedPaths.includes(f.path))
				.slice(0, 50);

			if (files.length === 0) {
				bindLocalizedElement(searchResults.createDiv({ cls: 'dashboard-modal-search-hint', text: t('quickLinks.noDocsFound') }), 'quickLinks.noDocsFound');
				return;
			}

			for (const file of files) {
				const selected = this.pendingPaths.has(file.path);
				const item = searchResults.createEl('button', {
					cls: 'dashboard-modal-search-item' + (selected ? ' is-selected' : ''),
					attr: { type: 'button', 'aria-pressed': String(selected) },
				});

				const check = item.createSpan({ cls: 'dashboard-modal-search-check' });
				if (selected) {
					setIcon(check, 'check');
				}

				const info = item.createSpan({ cls: 'dashboard-modal-search-info' });
				info.createSpan({ text: file.basename, cls: 'dashboard-modal-search-name' });
				info.createSpan({ text: file.path, cls: 'dashboard-modal-search-path' });

				item.addEventListener('click', () => {
					if (this.pendingPaths.has(file.path)) {
						this.pendingPaths.delete(file.path);
					} else {
						this.pendingPaths.add(file.path);
					}
					item.toggleClass('is-selected', this.pendingPaths.has(file.path));
					item.setAttribute('aria-pressed', String(this.pendingPaths.has(file.path)));
					check.empty();
					if (this.pendingPaths.has(file.path)) setIcon(check, 'check');
					updateAddBtn();
				});
			}
		};

		searchInput.addEventListener('input', () => {
			renderSearchResults();
		});

		searchInput.addEventListener('focus', () => {
			if (searchInput.value.trim()) {
				renderSearchResults();
			}
		});

		// Batch add button
		const addBtn = bindLocalizedElement(form.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--confirm dashboard-modal-batch-add',
			text: t('cardEdit.addSelected'),
		}), 'cardEdit.addSelected');
		addBtn.setCssProps({ display: 'none' });

		const updateAddBtn = () => {
			const count = this.pendingPaths.size;
			if (count > 0) {
				addBtn.setCssProps({ display: '' });
				addBtn.textContent = t('cardEdit.addSelectedCount', { count: String(count) });
			} else {
				addBtn.setCssProps({ display: 'none' });
			}
		};

		addBtn.addEventListener('click', () => {
			if (this.pendingPaths.size === 0) return;
			this.linkedPaths = [...this.linkedPaths, ...this.pendingPaths];
			this.pendingPaths.clear();
			searchInput.value = '';
			searchResults.empty();
			renderDocs();
			updateAddBtn();
		});

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', {
				cls: 'dashboard-modal-btn dashboard-modal-btn--cancel',
				text: t('common.cancel'),
			}), 'common.cancel')
			.addEventListener('click', () => this.close());
		const saveBtn = bindLocalizedElement(footer.createEl('button', {
			cls: 'dashboard-modal-btn dashboard-modal-btn--confirm',
			text: t('common.save'),
		}), 'common.save');
		saveBtn.addEventListener('click', () => {
			this.onSave({
				title: titleInput.value.trim() || this.card.title,
				docs: editCardDocuments(this.card.docs, this.linkedPaths),
				coverImage: coverInput.value.trim(),
				coverPos: this.coverPos,
			});
			this.close();
		});

		titleInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				saveBtn.click();
			}
		});
	}

	onClose(): void {
		this.focalEditor?.dispose();
		this.focalEditor = undefined;
		const { contentEl } = this;
		contentEl.empty();
	}
}
