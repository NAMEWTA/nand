import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import { ReactSurface } from '../../../ui/react/surface';
import { t } from '../../../shared/i18n';
import type { AutomationEditRequest } from '../core/api';
import type { AutomationViewHost } from './panel-contract';
import { AutomationsPage, initialPageState, type AutomationPageState } from './AutomationsPage';

export class AutomationPresentation extends ReactSurface {
	private target: WorkbenchTarget;
	private state: AutomationPageState;
	private request?: AutomationEditRequest;
	private restoreKey = 0;
	constructor(
		context: NativeSurfaceContext,
		private host: AutomationViewHost,
		target: WorkbenchTarget,
		state: Record<string, unknown>,
	) {
		super(context);
		this.target = target;
		this.state = initialPageState(state);
	}
	getViewType() {
		return 'nand-automations';
	}
	getDisplayText() {
		return t('automation.title');
	}
	getIcon() {
		return 'workflow';
	}
	getTarget() {
		return this.target;
	}
	override getState(): Record<string, unknown> {
		return { ...this.state };
	}
	restore(state: Record<string, unknown>) {
		this.state = initialPageState(state);
		this.restoreKey++;
		this.rerender();
	}
	navigate(target: WorkbenchTarget) {
		this.target = {
			feature: 'automations',
			section: target.section === 'runs' ? 'runs' : 'tasks',
			resourceId: target.resourceId,
		};
		if (target.focusId === 'edit') this.request = this.host.takeEdit?.() ?? {};
		this.rerender();
		this.context.changed?.();
	}
	protected renderContent() {
		return (
			<AutomationsPage
				key={this.restoreKey}
				host={this.host}
				target={this.target}
				request={this.request}
				initialState={this.state}
				onState={(state) => {
					this.state = state;
					this.context.changed?.();
				}}
				onNavigate={(target) => this.navigate(target)}
				onEditConsumed={() => {
					this.request = undefined;
				}}
				onPageMenu={(event) => this.context.openPageMenu?.(event)}
				onNavigation={() => this.context.togglePanel?.()}
			/>
		);
	}
}
