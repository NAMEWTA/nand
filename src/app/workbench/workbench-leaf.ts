import { ItemView, type Menu, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { t } from '../../shared/i18n';
import type { SavedPage, WorkbenchFeature, WorkbenchTarget } from '../contracts/workbench';
import type { WorkbenchHost, WorkbenchLeafView, WorkbenchSurface } from '../contracts/workbench-host';
import type { NativeSurface } from '../../ui/native-surface';

export const WORKBENCH_VIEW_TYPE = 'nand-workbench-view';

/**
 * The single NAND workbench leaf. Registered at plugin load so saved leaves restore; the shell (rail, side
 * panel, pages) loads when the first leaf opens. Until then, and after it is disposed, the leaf keeps its
 * saved state.
 */
export class WorkbenchView extends ItemView implements WorkbenchLeafView {
	private surface?: WorkbenchSurface;
	private loading?: Promise<WorkbenchSurface | undefined>;
	private saved: Record<string, unknown> = {};
	lastActivatedAt = 0;

	constructor(leaf: WorkspaceLeaf, private readonly host: WorkbenchHost) {
		super(leaf);
	}
	getViewType(): string {
		return WORKBENCH_VIEW_TYPE;
	}
	getDisplayText(): string {
		return this.surface?.displayText() ?? t('workbench.title');
	}
	getIcon(): string {
		return this.surface?.icon() ?? 'panels-top-left';
	}

	get focusMode(): boolean {
		return this.surface?.focusMode ?? this.saved.focus === true;
	}
	async ensureActivePage(): Promise<void> {
		await (await this.loading)?.ensureActivePage();
	}
	async navigate(target: WorkbenchTarget, initial?: Record<string, unknown>): Promise<void> {
		await (await this.loading)?.navigate(target, initial);
	}
	getSavedPages(feature?: WorkbenchFeature): SavedPage[] {
		return this.surface?.getSavedPages(feature) ?? [];
	}
	async activateResource(feature: WorkbenchFeature, id: string): Promise<boolean> {
		return (await (await this.loading)?.activateResource(feature, id)) ?? false;
	}
	async closeResource(feature: WorkbenchFeature, id: string): Promise<void> {
		await (await this.loading)?.closeResource(feature, id);
	}
	getNativeSurfaces(): readonly NativeSurface[] {
		return this.surface?.getNativeSurfaces() ?? [];
	}
	getState(): Record<string, unknown> {
		return this.surface?.getState() ?? this.saved;
	}
	async setState(raw: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		this.saved = raw;
		await (await this.loading)?.setState(raw);
		await super.setState(raw, result);
	}
	async onOpen(): Promise<void> {
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf === this.leaf) this.lastActivatedAt = Date.now();
		}));
		this.loading = import('../../shell/host/workbench-surface').then(
			({ createWorkbenchSurface }) => (this.surface = createWorkbenchSurface(this, this.host, this.saved)),
			(error: unknown) => {
				this.host.report(error);
				return undefined;
			},
		);
		await this.loading;
	}
	async prepareModuleChanges(disabled: ReadonlySet<WorkbenchFeature>): Promise<void> {
		await this.surface?.prepareModuleChanges(disabled);
	}
	async disposeSurface(): Promise<void> {
		const surface = await this.loading;
		this.loading = undefined;
		this.surface = undefined;
		if (!surface) return;
		this.saved = surface.getState();
		await surface.dispose();
	}
	onClose(): Promise<void> {
		return this.disposeSurface();
	}
	onResize(): void {
		this.surface?.onResize();
	}
	onPaneMenu(menu: Menu, source: string): void {
		this.surface?.onPaneMenu(menu, source);
	}
}
