// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { PageCreate } from '../../../app/contracts/workbench-host';
import { NativeSurface } from '../../../ui/native-surface';
import { t } from '../../../shared/i18n';
import type { NavigatorPanel } from '../api';

/** The navigator as a workbench page (the rail entry's "open in a tab"); it shares the sidebar's state. */
class NavigatorPageSurface extends NativeSurface {
	private cleanup: (() => void) | undefined;
	constructor(context: ConstructorParameters<typeof NativeSurface>[0], private readonly panel: NavigatorPanel) { super(context); }
	getViewType(): string { return 'nand-navigator-page'; }
	getDisplayText(): string { return t('modules.navigator'); }
	getIcon(): string { return 'notebook-tabs'; }
	override onOpen(): Promise<void> {
		this.cleanup = this.panel.mount(this.contentEl);
		return Promise.resolve();
	}
	override onClose(): Promise<void> {
		this.cleanup?.();
		this.cleanup = undefined;
		return Promise.resolve();
	}
}

export const createNotesPage = (panel: NavigatorPanel): PageCreate => (context, target) => Promise.resolve({
	surface: new NavigatorPageSurface(context, panel),
	getTarget: () => target,
	navigate: () => Promise.resolve(),
});
