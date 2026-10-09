import type { Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { t } from '../../../shared/i18n/index';
import { parseConflictBlocks, resolveBlock, type ConflictBlock, type ConflictChoice } from '../core/conflict-blocks';

/** Buttons on a `<<<<<<<` line: keep the upper side, the lower side, both, or (diff3) the base. */
class ConflictActions extends WidgetType {
	constructor(private readonly block: ConflictBlock) {
		super();
	}
	eq(other: ConflictActions): boolean {
		return other.block.from === this.block.from && other.block.to === this.block.to && other.block.base === this.block.base;
	}
	toDOM(view: EditorView): HTMLElement {
		const bar = createSpan({ cls: 'nand-sync-conflict-actions' });
		const choices: Array<[ConflictChoice, string]> = [
			['ours', t('sync.conflict.keepUpper', { label: this.block.oursLabel || 'HEAD' })],
			['theirs', t('sync.conflict.keepLower', { label: this.block.theirsLabel || '' })],
			['both', t('sync.conflict.keepBoth')],
		];
		if (this.block.base !== undefined) choices.push(['base', t('sync.conflict.keepBase')]);
		for (const [choice, label] of choices) {
			const button = bar.createEl('button', { text: label, cls: 'nand-sync-conflict-button', attr: { type: 'button' } });
			button.addEventListener('mousedown', (event) => event.preventDefault());
			button.addEventListener('click', (event) => {
				event.preventDefault();
				// Positions may have moved since the widget was drawn; resolve the block that starts here now.
				const current = parseConflictBlocks(view.state.doc.toString()).find((block) => block.from === this.block.from);
				if (current) view.dispatch({ changes: { from: current.from, to: current.to, insert: resolveBlock(current, choice) } });
			});
		}
		return bar;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

function decorate(view: EditorView): DecorationSet {
	const text = view.state.doc.toString();
	if (!text.includes('<<<<<<<')) return Decoration.none;
	const ranges = parseConflictBlocks(text).map((block) => {
		const line = view.state.doc.lineAt(block.from);
		return Decoration.widget({ widget: new ConflictActions(block), side: 1 }).range(line.to);
	});
	return Decoration.set(ranges, true);
}

/** Conflict helpers in the editor; files without conflict markers are not decorated. */
export function conflictExtension(): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = decorate(view);
			}
			update(update: ViewUpdate): void {
				if (update.docChanged) this.decorations = decorate(update.view);
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}
