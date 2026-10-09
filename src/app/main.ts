import { Component, Notice, Platform, Plugin, type Command } from 'obsidian';
import { productGates, visibleProducts, type SettingsProduct } from './settings/nav';
import { composeWorkbench } from './workbench/compose-workbench';
import type { WorkbenchTarget } from './contracts/workbench';
import type { CommandAccess, EditorAccess, ModuleId, ModuleInstance, ModuleManifest, ModuleState, ServiceAccess, ShellAccess } from './contracts/module';
import type { Extension } from '@codemirror/state';
import type { MarkdownPostProcessor } from 'obsidian';
import { switchModule } from './settings/module-switch';
import { MANIFESTS } from './manifests';
import { ModuleRegistry } from './modules/registry';
import { loadSettingsRuntime, type SettingsRuntime } from './settings/runtime';
import { languageUpdater, settingsWriter } from './settings/language';
import { NandSettingTab } from './settings/entry-tab';
import { IntroModal } from './intro-modal';
import { registerShellCommands } from './commands';
import { ThemeRuntime } from '../theme/runtime';
import { THEME_PRESETS } from '../theme/settings';
import { refreshLeafTitle, retitleDeferredLeaves, type LeafTitlePair } from '../host/obsidian/workspace-title';
import { registerLocalizedCommand, type LocalizedCommand } from '../host/obsidian/localized-command';
import { setDiagnosticRoots } from '../shared/diagnostics/redact';
import { getLanguage, onLanguageChanged, setLanguage, t, tFor } from '../shared/i18n/index';
import { refreshLocalizedDom } from '../ui/primitives/localized-dom';
import { AUTOMATIONS, type AutomationsService } from '../modules/automations/api';
import { COMMENTS_VIEW_TYPE, CommentsLeaf } from './workbench/comments-leaf';
import { collectReferences } from '../host/obsidian/references';
import { registerCopyCommands } from './copy-commands';
import { BROWSER_OPEN, type BrowserOpenRequest } from '../modules/browser/api';

/**
 * Composition root. Module code is created by the module registry from `MANIFESTS`; this class keeps the
 * settings runtime, native registrations and the host members panels call.
 */
export default class DashboardPlugin extends Plugin {
	override addCommand(command: LocalizedCommand): Command {
		return registerLocalizedCommand(this, command, (native) => super.addCommand(native));
	}

	private runtime!: SettingsRuntime;
	private registry!: ModuleRegistry;
	private workbench?: ReturnType<typeof composeWorkbench>;
	private settingsTab!: NandSettingTab;
	private readonly settingsWrites = settingsWriter();
	/** Editor extensions and reading post-processors added by active modules (see `EditorAccess`). */
	private readonly editorExtensions: Extension[] = [];
	private readonly postProcessors = new Set<MarkdownPostProcessor>();

	async onload(): Promise<void> {
		await this.loadSettings();
		new ThemeRuntime(this.runtime.theme).attach(this);
		const adapter = this.app.vault.adapter as { getBasePath?: () => string };
		setDiagnosticRoots({ vault: typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : undefined });
		this.register(onLanguageChanged(() => {
			this.rewriteDeferredLeafTitles();
			const documents = new Set<Document>([document]);
			this.app.workspace.iterateAllLeaves((leaf) => { documents.add(leaf.view.containerEl.ownerDocument); });
			if (this.settingsTab?.containerEl) documents.add(this.settingsTab.containerEl.ownerDocument);
			for (const owner of documents) refreshLocalizedDom(owner.body);
		}));
		// registerView can restore leaves after onLayoutReady, especially for hosts that load asynchronously.
		this.registerEvent(this.app.workspace.on('layout-change', () => this.rewriteDeferredLeafTitles()));
		this.registerView(COMMENTS_VIEW_TYPE, (leaf) => new CommentsLeaf(leaf, this));

		this.registry = new ModuleRegistry(MANIFESTS, {
			env: { desktop: Platform.isDesktopApp, mobile: Platform.isMobile, phone: Platform.isPhone },
			enabled: (id) => this.runtime.ns.app.get().modules[id],
			createContext: (manifest, services, contributions) => {
				const lifetime = this.addChild(new Component());
				const shell: ShellAccess = {
					open: (target, ownerWindow, state) => this.openWorkbench(target, ownerWindow, state),
					refresh: () => this.workbench?.refresh(),
					openFocus: (target, state, ownerWindow) => this.workbench?.openFocus(target, state, ownerWindow) ?? Promise.reject(new Error(t('workbench.notReady'))),
					savedPages: (feature) => this.workbench?.savedPages(feature) ?? [],
					activateResource: (feature, id) => this.workbench?.activateResource(feature, id) ?? Promise.resolve(false),
				};
				const commands: CommandAccess = {
					add: (command) => {
						const registered = registerLocalizedCommand({ manifest: this.manifest, register: (cleanup) => lifetime.register(cleanup) }, command, (native) => super.addCommand(native));
						lifetime.register(() => this.removeCommand(command.id));
						return registered;
					},
				};
				const editor: EditorAccess = {
					addExtension: (extension) => {
						this.editorExtensions.push(extension);
						this.app.workspace.updateOptions();
						lifetime.register(() => {
							this.editorExtensions.remove(extension);
							this.app.workspace.updateOptions();
						});
					},
					addPostProcessor: (processor) => {
						this.postProcessors.add(processor);
						lifetime.register(() => this.postProcessors.delete(processor));
					},
				};
				return { id: manifest.id, app: this.app, manifest: this.manifest, env: { desktop: Platform.isDesktopApp, mobile: Platform.isMobile, phone: Platform.isPhone }, lifetime, settings: this.runtime.store, services, contributions, shell, commands, editor };
			},
			releaseContext: (context) => this.removeChild(context.lifetime),
			report: (id, phase, error) => {
				console.error(`[NAND ${id}] ${phase} failed`, error);
				if (phase === 'activate') new Notice(t('modules.failed', { module: t(MANIFESTS.find((manifest) => manifest.id === id)?.titleKey ?? id) }));
			},
		});
		// One mutable extension array and one post-processor for all modules, so turning a module off removes its editor features.
		this.registerEditorExtension(this.editorExtensions);
		this.registerMarkdownPostProcessor((element, context) => {
			for (const processor of [...this.postProcessors]) void processor(element, context);
		});
		await this.applyModuleFlags();

		registerShellCommands(this);
		registerCopyCommands(this);
		this.settingsTab = new NandSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		this.workbench = composeWorkbench(this);
		this.register(this.runtime.store.onPersisted(() => this.workbench?.refresh()));
		this.app.workspace.onLayoutReady(() => {
			this.rewriteDeferredLeafTitles();
			void this.registry.apply(['startup', 'layout-ready']);
		});
	}

	/** The user just turned NAND on: open the workbench and introduce it once. */
	override onUserEnable(): void {
		this.app.workspace.onLayoutReady(() => {
			void this.openWorkbench({ feature: 'dashboard' })
				.then(() => this.maybeShowIntro())
				.catch((error: unknown) => console.error('[NAND workbench]', error));
		});
	}

	onunload(): void {
		this.workbench?.dispose();
		this.registry?.disposeNow();
		void this.runtime?.store.dispose().catch((error: unknown) => console.error('[NAND settings]', error));
	}

	// ---- Settings ---------------------------------------------------------------------------------------

	async loadSettings(): Promise<void> {
		this.runtime = await loadSettingsRuntime(this.app);
		setLanguage(this.runtime.ns.app.get().language);
	}

	/** App settings (language, module switches, status bar, onboarding). */
	get appSettings() {
		return this.runtime.ns.app;
	}

	/** A settings namespace bound by the app or an active module (diagnostics and acceptance checks). */
	settingsNamespace(name: string) {
		return this.runtime.store.handleOf<Record<string, unknown>>(name);
	}

	readonly changeLanguage = languageUpdater(async (language) => {
		await this.runtime.ns.app.update((draft) => { draft.language = language; }, { persist: 'immediate' });
	}, setLanguage, this.settingsWrites);

	// ---- Modules ----------------------------------------------------------------------------------------

	moduleInstance(id: ModuleId): ModuleInstance | undefined {
		return this.registry?.instance(id);
	}

	/** Activate a module on demand (a page or command needs it); undefined when it is off, unsupported or failed. */
	async activateModule(id: ModuleId): Promise<ModuleInstance | undefined> {
		return (await this.registry?.activate(id)) ? this.registry.instance(id) : undefined;
	}

	moduleState(id: ModuleId): ModuleState {
		return this.registry?.state(id) ?? 'off';
	}

	/** Automations as boards and archives use them (quick actions, editing); absent while the module is off. */
	get automationHost(): AutomationsService | undefined {
		return this.registry?.services.peek(AUTOMATIONS);
	}

	/** Services provided by active modules (see `ModuleRegistry.services`). */
	get services(): ServiceAccess {
		return this.registry.services;
	}

	/** The persisted on/off switch of a module. */
	moduleEnabled(id: ModuleId): boolean {
		return this.runtime.ns.app.get().modules[id];
	}

	/** Turn a module on or off (see `switchModule`). */
	setModuleEnabled(id: ModuleId, enabled: boolean): Promise<void> {
		return switchModule(this.runtime.ns.app, id, enabled, () => this.applyModuleFlags());
	}

	/** Every module NAND ships, in enable order. */
	moduleManifests(): readonly ModuleManifest[] {
		return this.registry.manifests();
	}

	/** Apply the persisted module flags. A module that fails is reported and does not stop the others. */
	async applyModuleFlags(): Promise<void> {
		await this.workbench?.prepareModuleChanges(this.runtime.ns.app.get().modules);
		await this.registry.apply(this.app.workspace.layoutReady ? ['startup', 'layout-ready'] : ['startup']);
		this.workbench?.refresh();
	}

	workbenchRefresh(): void {
		this.workbench?.refresh();
	}

	readAbsoluteReference(): string | null {
		return collectReferences(this.app, 'absolute');
	}

	// ---- Navigation -------------------------------------------------------------------------------------

	openWorkbench(target?: WorkbenchTarget, ownerWindow?: Window, state?: Record<string, unknown>): Promise<void> {
		return this.workbench?.open(target, ownerWindow, state) ?? Promise.reject(new Error(t('workbench.notReady')));
	}

	/** Open a product's settings in the workbench settings page. */
	openSettings(product: SettingsProduct = 'home'): void {
		const available = visibleProducts(productGates((id) => this.moduleEnabled(id))).includes(product) ? product : 'home';
		void this.openWorkbenchSettings(available === 'home' ? 'general' : available).catch((error: unknown) => console.error('[NAND settings]', error));
	}

	/** Open NAND settings inside the workbench (General, or a product's page). */
	openWorkbenchSettings(category = 'general'): Promise<void> {
		return this.openWorkbench({ feature: 'settings', section: category });
	}

	openContacts(): Promise<void> {
		return this.openWorkbench({ feature: 'contacts' });
	}

	/** Open a page in NAND's browser (or the system browser on phones); failures are shown as a notice. */
	async openBrowser(request: BrowserOpenRequest): Promise<void> {
		const browser = await this.services.acquire(BROWSER_OPEN);
		if (!browser) {
			new Notice(t('modules.disabledNotice'));
			return;
		}
		await browser.value.show(request);
	}

	async openEditorView(): Promise<void> {
		if (!this.moduleEnabled('comments')) {
			new Notice(t('modules.disabledNotice'));
			this.openSettings();
			return;
		}
		const open = this.app.workspace.getLeavesOfType(COMMENTS_VIEW_TYPE)[0];
		if (open) {
			await this.app.workspace.revealLeaf(open);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: COMMENTS_VIEW_TYPE, active: true });
		void this.app.workspace.revealLeaf(leaf);
	}

	/** Settings handle of the global theme (Settings → Appearance). */
	get theme() {
		return this.runtime.theme;
	}

	/** Switch to the next global theme preset. */
	cycleThemePreset(): Promise<void> {
		return this.runtime.theme.update((draft) => {
			draft.preset = THEME_PRESETS[(THEME_PRESETS.indexOf(draft.preset) + 1) % THEME_PRESETS.length] ?? 'system';
		});
	}

	// ---- Leaf titles and onboarding ---------------------------------------------------------------------

	private rewriteDeferredLeafTitles(): void {
		const language = getLanguage();
		const pair = (key: string): LeafTitlePair => ({ en: tFor('en', key), zh: tFor('zh', key) });
		const byType: Record<string, readonly LeafTitlePair[]> = {
			[COMMENTS_VIEW_TYPE]: [pair('editor.viewTitle')],
		};
		for (const [type, pairs] of Object.entries(byType)) {
			const title = pairs[0]![language];
			retitleDeferredLeaves(this.app.workspace.getLeavesOfType(type), pairs, language, (leaf) => {
				refreshLeafTitle(this.app, leaf);
			}, { type, title });
		}
	}

	private maybeShowIntro(): void {
		if (this.runtime.ns.app.get().introSeen) return;
		new IntroModal(this.app, () => {
			void this.markIntroSeen();
		}).open();
	}

	private async markIntroSeen(): Promise<void> {
		if (this.runtime.ns.app.get().introSeen) return;
		await this.runtime.ns.app.update((draft) => { draft.introSeen = true; });
	}
}
