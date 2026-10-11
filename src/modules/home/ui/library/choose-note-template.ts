import { SuggestModal, type App } from 'obsidian';
import type { LibraryConfig } from '../../core/board/types/model';
import { templateChoices } from '../../core/board/board-experience';
import { ownDialog } from '../ui/dialog-scope';
import { t } from '../../../../shared/i18n';

/** Cancellation has its own result; it can never select the first template or create a blank note. */
export function chooseNoteTemplate(
	app: App,
	config: LibraryConfig | undefined,
	owner: unknown,
): Promise<string | null> {
	const paths = templateChoices(config?.templatePath, config?.templatePaths);
	if (paths.length < 2) return Promise.resolve(paths[0] ?? '');
	return new Promise((resolve) => {
		let picked: string | null = null,
			release = () => {};
		const modal = new (class extends SuggestModal<string> {
			getSuggestions(query: string): string[] {
				return paths.filter((path) => path.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
			}
			renderSuggestion(path: string, element: HTMLElement): void {
				element.setText(path);
			}
			onChooseSuggestion(path: string): void {
				picked = path;
			}
			onClose(): void {
				super.onClose();
				release();
				queueMicrotask(() => resolve(picked));
			}
		})(app);
		modal.setPlaceholder(t('home.templates.choose'));
		modal.open();
		release = ownDialog(app, () => modal.close(), owner, false);
	});
}
