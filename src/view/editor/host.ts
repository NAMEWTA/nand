import { TFile } from 'obsidian';
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
	addCommand(command: import('obsidian').Command): import('obsidian').Command;
	saveSettings(): Promise<void>;
	openHome(): void;
}
