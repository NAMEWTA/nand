import { TFile } from 'obsidian';
import type { LocalizedCommand } from '../../platform/obsidian/localized-command';
import type { EditorDomain } from './domain';

export interface EditorHost {
	onload(): void;
	onunload(): void;
	getActiveFile(): TFile | null;
	notifyFileChange(file: TFile | null): void;
	notifySettingsChanged(): void;
	notifyLayoutChanged(): void;
	onLayoutChanged(cb: () => void): () => void;
	onActiveFile(cb: (file: TFile | null) => void): () => void;
	domains(): readonly EditorDomain[];
}
export interface EditorPluginHost {
	app: import('obsidian').App;
	settings: {
		modules: { editor: boolean };
		editorWorkbench: import('../../shared/editor-workbench').EditorWorkbenchSettings;
	};
	editorHost?: EditorHost;
	addCommand(command: LocalizedCommand): import('obsidian').Command;
	saveSettings(): Promise<void>;
	openHome(): void;
}
