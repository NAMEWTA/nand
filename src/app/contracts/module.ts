import type { App, Command, Component, MarkdownPostProcessor, PluginManifest } from 'obsidian';
import type { Extension } from '@codemirror/state';
import type { SettingsStore } from '../../shared/settings/store';
import type { PageCreate } from './workbench-host';
import type { SavedPage, WorkbenchFeature, WorkbenchTarget } from './workbench';

/** Feature modules shipped in NAND. */
export type ModuleId = 'home' | 'agent' | 'browser' | 'archives' | 'automations' | 'notifications' | 'icons' | 'comments' | 'sync' | 'news';
export const MODULE_IDS: readonly ModuleId[] = ['home', 'agent', 'browser', 'archives', 'automations', 'notifications', 'icons', 'comments', 'sync', 'news'];

/**
 * When a module is created:
 * - `startup`: during plugin load (onload waits, but a failure only marks this module failed)
 * - `layout-ready`: after the workspace layout is ready
 * - `on-demand`: the first time a page, command or service needs it
 */
export type Activation = 'startup' | 'layout-ready' | 'on-demand';

export type Messages = { readonly en: Readonly<Record<string, string>>; readonly zh: Readonly<Record<string, string>> };

export interface ServiceKey<T> {
	readonly owner: ModuleId;
	readonly id: string;
	/** Type marker only. */
	readonly __type?: T;
}
export const serviceKey = <T>(owner: ModuleId, id: string): ServiceKey<T> => ({ owner, id });

export interface ContributionPoint<T> {
	readonly owner: ModuleId;
	readonly id: string;
	readonly __type?: T;
}
export const contributionPoint = <T>(owner: ModuleId, id: string): ContributionPoint<T> => ({ owner, id });

/** Eager, data-only description of a module. Its code is reached only through `load()`. */
export interface ModuleManifest {
	readonly id: ModuleId;
	/** Enable order; modules are disabled in reverse order. */
	readonly order: number;
	readonly icon: string;
	readonly titleKey: string;
	readonly descriptionKey: string;
	readonly platforms: { readonly desktop: boolean; readonly mobile: boolean };
	readonly defaultEnabled: boolean;
	readonly activation: Activation;
	/** Services this module provides (other modules acquire them through the registry). */
	readonly provides?: readonly ServiceKey<unknown>[];
	/** Contribution points this module contributes to. */
	readonly contributes?: readonly ContributionPoint<unknown>[];
	readonly load: () => Promise<{ default: ModuleFactory }>;
}

export interface Lease<T> {
	readonly value: T;
	/** Aborted when the providing module is disabled or unloaded. */
	readonly revoked: AbortSignal;
}

export interface ServiceAccess {
	/** The service if its owner is active; never activates anything. */
	peek<T>(key: ServiceKey<T>): T | undefined;
	/** Activate the owner if it is enabled and supported, then lease the service. */
	acquire<T>(key: ServiceKey<T>, signal?: AbortSignal): Promise<Lease<T> | undefined>;
	watch<T>(key: ServiceKey<T>, listener: (value: T | undefined) => void): () => void;
}

export interface ContributionAccess {
	collect<T>(point: ContributionPoint<T>, options?: { activate?: boolean }): Promise<ReadonlyArray<{ module: ModuleId; value: T }>>;
	watch(point: ContributionPoint<unknown>, listener: () => void): () => void;
}

export interface ModuleEnvironment {
	readonly desktop: boolean;
	readonly mobile: boolean;
	readonly phone: boolean;
}

/** The workbench, as modules see it. */
export interface ShellAccess {
	/** Show a page in the workbench of `ownerWindow` (the main window by default). */
	open(target: WorkbenchTarget, ownerWindow?: Window, state?: Record<string, unknown>): Promise<void>;
	/** Redraw workbench chrome (rail badges, statuses, panels) after module-owned state changed. */
	refresh(): void;
	/** Open the page by itself in a new tab (a focus-mode workbench leaf) with its state. */
	openFocus(target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow?: Window): Promise<void>;
	/** Pages of a feature kept by every workbench leaf (live or saved), e.g. open browser tabs. */
	savedPages(feature: WorkbenchFeature): SavedPage[];
	/** Show a kept resource page in whichever workbench holds it; false when none does. */
	activateResource(feature: WorkbenchFeature, resourceId: string): Promise<boolean>;
}

/** Palette commands that exist only while the module is active. */
export interface CommandAccess {
	/** Add a command; it is removed when the module is disposed. With `nameKey` the name follows the language. */
	add(command: Command & { nameKey?: string }): Command;
}

/** Editor integrations that exist only while the module is active. */
export interface EditorAccess {
	/** A CodeMirror 6 extension; removed from every editor when the module is disposed. */
	addExtension(extension: Extension): void;
	/** A Markdown post-processor for reading view; removed when the module is disposed. */
	addPostProcessor(processor: MarkdownPostProcessor): void;
}

/** What a module receives when it is created. */
export interface ModuleContext {
	readonly id: ModuleId;
	readonly app: App;
	/** NAND's plugin manifest (name, version, folder). */
	readonly manifest: PluginManifest;
	readonly env: ModuleEnvironment;
	/** Unloaded when the module is disposed. */
	readonly lifetime: Component;
	readonly settings: SettingsStore;
	readonly services: ServiceAccess;
	readonly contributions: ContributionAccess;
	readonly shell: ShellAccess;
	readonly commands: CommandAccess;
	readonly editor: EditorAccess;
}

/** What a module's settings page gets from the workbench settings page showing it. */
export interface SettingsPageHost {
	/** Redraw the whole page (after a change that adds or removes rows). */
	refresh(): void;
	/** Keep a subscription for as long as the page is shown. */
	keep(off: () => void): void;
}
export type SettingsPageRenderer = (container: HTMLElement, host: SettingsPageHost) => void;

export interface ModuleInstance {
	activate?(signal: AbortSignal): Promise<void> | void;
	dispose(reason: 'disabled' | 'unload'): Promise<void> | void;
	readonly services?: ReadonlyArray<readonly [ServiceKey<unknown>, unknown]>;
	readonly contributions?: ReadonlyArray<readonly [ContributionPoint<unknown>, unknown]>;
	/** Workbench pages by id; each loader imports its page code on first use. */
	readonly pages?: Readonly<Record<string, () => Promise<PageCreate>>>;
	/** The module's page in workbench settings; loaded on first use. */
	readonly settingsPage?: () => Promise<SettingsPageRenderer>;
}

export type ModuleFactory = (context: ModuleContext) => ModuleInstance | Promise<ModuleInstance>;

export type ModuleState = 'off' | 'unsupported' | 'idle' | 'loading' | 'active' | 'disposing' | 'failed';
