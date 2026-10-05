import { bindLocalizedControl } from '../primitives/localized-dom';
import { FuzzySuggestModal, MarkdownView, type App, type TFile } from 'obsidian';
import type { ContextMaterial } from '../../core/agent-launch/session-api';
import { t } from '../../shared/i18n/terminal-accessor';

export function pickContextMaterial(app: App): Promise<ContextMaterial | null> {
	return new Promise((resolve, reject) => {
		class Picker extends FuzzySuggestModal<TFile> {
			private chosen = false;
			getItems() {
				return app.vault.getMarkdownFiles();
			}
			getItemText(file: TFile) {
				return file.path;
			}
			onChooseItem(file: TFile) {
				this.chosen = true;
				void (async () => {
					const editor = app.workspace
						.getLeavesOfType('markdown')
						.map((leaf) => leaf.view)
						.find(
							(view): view is MarkdownView =>
								view instanceof MarkdownView &&
								view.file?.path === file.path &&
								view.getMode() === 'source',
						);
					const text = editor ? editor.editor.getValue() : await app.vault.read(file);
					const type: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.['nand-type'];
					resolve({
						id: file.path,
						title: file.basename,
						source: file.path,
						text,
						kind: type === 'person' || type === 'company' ? 'archive' : 'note',
					});
				})().catch(reject);
			}
			onClose() {
				super.onClose();
				queueMicrotask(() => {
					if (!this.chosen) resolve(null);
				});
			}
		}
		const picker = new Picker(app);
		picker.setPlaceholder(t('context.add'));
		bindLocalizedControl(picker, 'placeholder', 'terminalAgent.context.add');
		picker.emptyStateText = t('context.noMatchingNotes');
		picker.open();
	});
}
