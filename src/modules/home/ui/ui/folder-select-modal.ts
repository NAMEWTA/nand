import { bindLocalizedElement } from '../../../../ui/primitives/localized-dom';
import { App, Modal, TFolder } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';

/**
 * Multi-select folder picker: a filterable checkbox list of every vault folder,
 * for managing a whole folder set in one place (e.g. the calendar's excluded
 * folders, or the library/media/folder-section source folders). The modal stays
 * open, lets the user tick several folders, and returns the complete selection
 * on confirm.
 *
 * With `parentCoversChildren` (exclusion-style consumers, which match by path
 * prefix), checking a parent folder already covers its subfolders - descendants
 * of a checked folder are dimmed and locked with a hint instead of offering a
 * redundant checkbox. Source/inclusion consumers (folder OR unions) pass false
 * so parents and children can be ticked independently.
 */
export class MultiFolderSelectModal extends Modal {
	private readonly initialSelected: string[];
	private readonly onConfirmFolders: (folders: string[]) => void;
	private readonly parentCoversChildren: boolean;

	constructor(
		app: App,
		selected: string[],
		onConfirm: (folders: string[]) => void,
		opts?: { parentCoversChildren?: boolean },
	) {
		super(app);
		this.initialSelected = [...selected];
		this.onConfirmFolders = onConfirm;
		this.parentCoversChildren = opts?.parentCoversChildren ?? false;
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
		bindLocalizedElement(header.createDiv({ cls: 'dashboard-modal-title', text: t('folder.selectFolders') }), 'folder.selectFolders');

		const body = container.createDiv({ cls: 'dashboard-modal-body' });
		if (this.parentCoversChildren) {
			bindLocalizedElement(body.createDiv({ cls: 'dashboard-library-config-hint', text: t('folder.parentExcludesHint') }), 'folder.parentExcludesHint');
		}

		// Selection state, keyed by lowercased path (matching is case-insensitive
		// downstream). displayFor keeps the original casing to persist, preferring
		// the vault's canonical path once a row is checked.
		const selectedLower = new Set(this.initialSelected.map((f) => f.toLowerCase()));
		const displayFor = new Map<string, string>(this.initialSelected.map((f) => [f.toLowerCase(), f] as const));

		const allFolders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path !== '/')
			.map((f) => f.path)
			.sort();

		/** A folder is covered when some *other* selected folder is an ancestor
		 *  of it - checking it would change nothing. Only meaningful in exclusion
		 *  mode (path-prefix matching); source consumers keep every row active. */
		const isCoveredBy = (path: string): boolean => {
			if (!this.parentCoversChildren) return false;
			const lower = path.toLowerCase();
			for (const s of selectedLower) {
				if (s !== lower && lower.startsWith(s + '/')) return true;
			}
			return false;
		};

		const searchRow = body.createDiv({ cls: 'dashboard-media-folder-input-row' });
		const searchInput = bindLocalizedElement(searchRow.createEl('input', {
			cls: 'dashboard-media-filter-folder',
			attr: { type: 'text', placeholder: t('folder.searchPlaceholder') },
		}), 'folder.searchPlaceholder', undefined, "placeholder");

		const listHost = body.createDiv({ cls: 'dashboard-folder-multi-list' });
		const countEl = body.createDiv({ cls: 'dashboard-folder-multi-count' });

		const renderCount = (): void => {
			countEl.textContent = t('folder.selectedCount', { count: selectedLower.size });
		};

		const renderList = (): void => {
			listHost.empty();
			const query = searchInput.value.trim().toLowerCase();
			const visible = query ? allFolders.filter((p) => p.toLowerCase().includes(query)) : allFolders;
			if (visible.length === 0) {
				bindLocalizedElement(listHost.createDiv({ cls: 'dashboard-library-filter-empty', text: t('folder.noMatches') }), 'folder.noMatches');
				return;
			}
			for (const path of visible) {
				const lower = path.toLowerCase();
				const checked = selectedLower.has(lower);
				const covered = isCoveredBy(path);

				const row = listHost.createDiv({
					cls: 'dashboard-folder-multi-row' + (checked ? ' is-checked' : '') + (covered ? ' is-covered' : ''),
				});
				const box = row.createEl('input', {
					attr: { type: 'checkbox' },
				});
				box.checked = checked;
				box.disabled = covered;
				row.createSpan({ cls: 'dashboard-folder-multi-row-name', text: path });
				if (covered) {
					bindLocalizedElement(row.createSpan({ cls: 'dashboard-folder-multi-covered-note', text: t('folder.coveredByParent') }), 'folder.coveredByParent');
				}

				const toggle = (): void => {
					if (covered) return;
					if (selectedLower.has(lower)) {
						selectedLower.delete(lower);
					} else {
						selectedLower.add(lower);
						displayFor.set(lower, path);
					}
					renderList();
					renderCount();
				};
				// The checkbox is presentation-only (pointer-events: none in CSS):
				// the row owns the click so box and row can't double-toggle.
				row.addEventListener('click', () => toggle());
			}
		};
		searchInput.addEventListener('input', () => renderList());
		renderList();
		renderCount();

		const footer = container.createDiv({ cls: 'dashboard-modal-footer' });
		bindLocalizedElement(footer
			.createEl('button', { cls: 'dashboard-modal-btn dashboard-modal-btn--cancel', text: t('common.cancel') }), 'common.cancel')
			.addEventListener('click', () => this.close());
		bindLocalizedElement(footer
			.createEl('button', { cls: 'dashboard-modal-btn dashboard-modal-btn--confirm', text: t('common.save') }), 'common.save')
			.addEventListener('click', () => {
				// Map back to display casing; entries without a row (typed by hand,
				// or folders deleted from the vault) fall back to their stored form.
				const folders = [...selectedLower].map((l) => displayFor.get(l) ?? l);
				this.onConfirmFolders(folders);
				this.close();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
