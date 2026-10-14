import type { PageCreate, WorkbenchPageBinding } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import { ReactSurface } from '../../../ui/react/surface';
import { t } from '../../../shared/i18n';
import { dashboardSaveMessage } from '../core/board/save-state';
import { normalizeWorkspacePath } from '../core/workspace/workspace-registry';
import { BOARD_SURFACE_TYPE, type BoardSurfaceApi } from '../api';
import type { HomeHost } from '../services/home-host';
import { BoardStore } from '../services/board-store';
import { DashboardPage } from './DashboardPage';
export const boardPage =
	(host: HomeHost): PageCreate =>
	async (context, target, state) =>
		createDashboardPage(host, context, target, state);
export function createDashboardPage(
	host: HomeHost,
	context: NativeSurfaceContext,
	target: WorkbenchTarget,
	state: Record<string, unknown>,
	onSaveState?: () => void,
): WorkbenchPageBinding {
	const store = new BoardStore(
		host,
		normalizeWorkspacePath(
			target.resourceId ??
				(typeof state.dashboardFile === 'string' ? state.dashboardFile : host.settings.dashboardFile),
		),
		() => context.contentEl.ownerDocument.defaultView ?? undefined,
	);
	class DashboardSurface extends ReactSurface implements BoardSurfaceApi {
		readonly sync = store.sync;
		readonly plugin = {
			get settings() {
				return { dashboardFile: store.state.getState().path };
			},
			switchWorkspace: (path: string) => store.switch(path),
		};
		getViewType(): string {
			return BOARD_SURFACE_TYPE;
		}
		getDisplayText(): string {
			return t('workbench.home');
		}
		getIcon(): string {
			return 'home';
		}
		protected renderContent() {
			return <DashboardPage store={store} context={context} />;
		}
		override async onOpen(): Promise<void> {
			await super.onOpen();
			await store.init();
		}
		override async onClose(): Promise<void> {
			await super.onClose();
			await store.dispose();
		}
		refresh(): Promise<void> {
			store.state.setState({ settings: { ...host.settings } });
			store.refreshFiles();
			return Promise.resolve();
		}
		reloadFromDisk(): Promise<void> {
			return store.sync.reloadFromDisk();
		}
		applyWorkspaceSwitch(): Promise<void> {
			const current = store.state.getState().path;
			return host.settings.workspaceFiles.includes(current)
				? this.refresh()
				: store.switch(host.settings.dashboardFile);
		}
		addSection(): Promise<void> {
			store.setDialog('section');
			return Promise.resolve();
		}
		toggleBannerMode(): Promise<void> {
			return Promise.resolve();
		}
		saveMessage(): string {
			return dashboardSaveMessage(store.state.getState().save);
		}
	}
	const surface = new DashboardSurface(context);
	if (onSaveState) surface.register(store.state.subscribe(onSaveState));
	return {
		surface,
		getState: () => ({ dashboardFile: store.state.getState().path }),
		getTarget: () => ({ feature: 'dashboard', resourceId: store.state.getState().path }),
		navigate: async (next, signal) => {
			if (!signal.aborted && next.resourceId) {
				await store.switch(normalizeWorkspacePath(next.resourceId));
				context.changed?.();
			}
		},
	};
}
