import { bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { App, FuzzyMatch, FuzzySuggestModal, getIconIds, setIcon } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { iconPickerRows } from '../../core/board/icon-catalog';

/**
 * Host icon picker. `getIconIds` is Obsidian's list, so it stays available when the icons module is off.
 * At most 400 rows are offered; preferred names stay first.
 */
export class IconPickerModal extends FuzzySuggestModal<string> {
	private readonly onPick: (icon: string) => void;

	constructor(app: App, onPick: (icon: string) => void) {
		super(app);
		this.onPick = onPick;
		this.setPlaceholder(t('quickNote.iconPickerPlaceholder'));
		bindLocalizedControl(this, 'placeholder', 'quickNote.iconPickerPlaceholder');
		this.emptyStateText = t('quickNote.iconPickerEmpty');
	}

	getItems(): string[] {
		const query = this.inputEl?.value ?? '';
		return iconPickerRows(getIconIds(), query);
	}

	getItemText(item: string): string {
		return item;
	}

	renderSuggestion(result: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass('dashboard-icon-picker-item');
		setIcon(el.createSpan({ cls: 'dashboard-icon-picker-glyph' }), result.item);
		el.createSpan({ cls: 'dashboard-icon-picker-name', text: result.item });
	}

	onChooseItem(item: string): void {
		if (item) this.onPick(item);
	}
}
