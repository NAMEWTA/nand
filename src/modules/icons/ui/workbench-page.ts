import { t } from '../../../shared/i18n';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type IconicController from '../platform/host/controller';

const PAGE_IDS = ['iconic-general', 'iconic-sidebars', 'iconic-editor', 'iconic-menus', 'iconic-picker', 'iconic-advanced'];

/** Icon rules and placement (Iconic). One section is shown at a time; the panel switches sections. */
class IconsSurface extends NativeSurface {
	private section = 'iconic-general';

	constructor(context: NativeSurfaceContext, private readonly controller: () => IconicController | undefined) {
		super(context);
	}
	getViewType(): string {
		return 'nand-icons';
	}
	getDisplayText(): string {
		return t('modules.iconic');
	}
	getIcon(): string {
		return 'images';
	}
	async onOpen(): Promise<void> {
		this.contentEl.addClass('nand-settings-page-host');
		await this.render();
	}
	async show(section: string | undefined): Promise<void> {
		this.section = PAGE_IDS.includes(section ?? '') ? section! : 'iconic-general';
		this.applySection();
		await Promise.resolve();
	}
	get current(): string {
		return this.section;
	}
	private async render(): Promise<void> {
		this.contentEl.empty();
		const page = this.contentEl.createDiv({ cls: 'nand-settings-page' });
		const body = page.createDiv({ cls: 'nand-settings-page-body' });
		const controller = this.controller();
		if (!controller?.isActive()) {
			body.createEl('p', { text: t('workbench.notReady') });
			return;
		}
		const { IconicSettingsSections } = await import('./settings/sections');
		new IconicSettingsSections(controller).renderFallback(body);
		this.applySection();
	}
	private applySection(): void {
		for (const element of Array.from(this.contentEl.querySelectorAll<HTMLElement>('[data-settings-page]'))) {
			element.hidden = element.dataset.settingsPage !== this.section;
		}
	}
}

export const createIconsPage = (controller: () => IconicController | undefined): PageCreate => async (context, target) => {
	const surface = new IconsSurface(context, controller);
	await surface.show(target.section);
	return {
		surface,
		getTarget: () => ({ feature: 'icons', section: surface.current }),
		navigate: (next) => surface.show(next.section),
	};
};
