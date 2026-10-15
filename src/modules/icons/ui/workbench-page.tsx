import { t } from '../../../shared/i18n';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import { ReactSurface } from '../../../ui/react/surface';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type IconicController from '../platform/host/controller';
import { IconicSettings, ICONIC_SETTINGS_PAGES } from './settings/sections';
class IconsSurface extends ReactSurface {
	private section = 'iconic-general';
	constructor(
		context: NativeSurfaceContext,
		private readonly controller: () => IconicController | undefined,
	) {
		super(context);
	}
	getViewType() {
		return 'nand-icons';
	}
	getDisplayText() {
		return t('modules.iconic');
	}
	getIcon() {
		return 'images';
	}
	show(section: string | undefined): Promise<void> {
		this.section = ICONIC_SETTINGS_PAGES.some((id) => id === section) ? section! : 'iconic-general';
		this.rerender();
		return Promise.resolve();
	}
	get current() {
		return this.section;
	}
	protected renderContent() {
		const controller = this.controller();
		return (
			<div className="mx-auto w-full max-w-4xl p-6">
				{controller?.isActive() ? (
					<IconicSettings key={this.section} plugin={controller} section={this.section} />
				) : (
					<p role="status">{t('workbench.notReady')}</p>
				)}
			</div>
		);
	}
}
export const createIconsPage =
	(controller: () => IconicController | undefined): PageCreate =>
	async (context, target) => {
		const surface = new IconsSurface(context, controller);
		await surface.show(target.section);
		return {
			surface,
			getTarget: () => ({ feature: 'icons', section: surface.current }),
			navigate: (next) => surface.show(next.section),
		};
	};
