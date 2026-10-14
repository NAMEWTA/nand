import { t } from '../../shared/i18n';
import { ReactSurface } from '../../ui/react/surface';
import type { NativeSurfaceContext } from '../../ui/native-surface';
import type { WorkbenchContribution } from '../contracts/workbench-host';
import type DashboardPlugin from '../main';
import { settingsCategories } from './settings-categories';
import { SettingsPage } from '../settings/react/SettingsPage';
class SettingsSurface extends ReactSurface {
	private category = 'general';
	constructor(
		context: NativeSurfaceContext,
		private readonly plugin: DashboardPlugin,
	) {
		super(context);
	}
	getViewType() {
		return 'nand-settings';
	}
	getDisplayText() {
		return t('workbench.settings');
	}
	getIcon() {
		return 'settings';
	}
	override onOpen(): Promise<void> {
		this.register(
			this.plugin.onModuleChanged(() => {
				if (!settingsCategories(this.plugin).some((c) => c.id === this.category)) {
					this.show('general');
					this.context.changed?.();
				} else this.rerender();
			}),
		);
		return super.onOpen();
	}
	show(category?: string) {
		this.category = settingsCategories(this.plugin).some((c) => c.id === category) ? category! : 'general';
		this.rerender();
	}
	get current() {
		return this.category;
	}
	protected renderContent() {
		return (
			<SettingsPage
				plugin={this.plugin}
				category={this.category}
				navigate={(target) => {
					this.show(target.section);
					this.context.changed?.();
				}}
			/>
		);
	}
}
export const createSettingsPage =
	(plugin: DashboardPlugin): WorkbenchContribution['create'] =>
	async (context, target) => {
		const surface = new SettingsSurface(context, plugin);
		surface.show(target.section);
		return {
			surface,
			getTarget: () => ({ feature: 'settings', section: surface.current }),
			navigate: async (next) => surface.show(next.section),
		};
	};
