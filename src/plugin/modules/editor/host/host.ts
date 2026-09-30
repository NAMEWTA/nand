import { TFile } from 'obsidian';
import { CommentStore, registerCommentStore } from '../../../../core/comments/store';
import { vaultCommentFs } from '../../../../platform/obsidian/comments/vault-fs';
import { createCommentsDomain } from '../../../../view/editor/comments/domain';
import { registerCopyCommands } from '../../../../view/editor/copy/index';
import type { EditorDomain } from '../../../../view/editor/domain';
import { EditorHost } from '../../../../view/editor/host';
import type DashboardPlugin from '../../../main';
import { trackActiveMarkdown } from './active-file';

/**
 * Editor extensions are registered here, on plugin load, so closing the
 * side panel does not remove highlights or the selection popover.
 */
export function createEditorHost(plugin: DashboardPlugin): EditorHost {
	const store = new CommentStore(vaultCommentFs(plugin.app));
	const domains: EditorDomain[] = [createCommentsDomain(plugin)];
	const listeners = new Set<(file: TFile | null) => void>();
	const layoutListeners = new Set<() => void>();
	let active: TFile | null = null;
	let loaded = false;
	let booted = false;

	const notify = (file: TFile | null) => {
		active = file;
		for (const domain of domains) domain.onActiveFileChange?.(file);
		for (const cb of listeners) cb(file);
	};

	return {
		onload() {
			if (loaded) return;
			loaded = true;
			registerCommentStore(store);
			for (const domain of domains) domain.onEnable?.();
			if (!booted) {
				booted = true;
				const extensions = domains.flatMap((domain) => domain.getEditorExtensions?.() ?? []);
				if (extensions.length > 0) plugin.registerEditorExtension(extensions);
				for (const domain of domains) {
					const processor = domain.getReadingPostProcessor?.();
					if (processor) plugin.registerMarkdownPostProcessor(processor);
					domain.registerCommands?.(plugin);
				}
				registerCopyCommands(plugin);
				active = trackActiveMarkdown(plugin, notify);
				plugin.registerEvent(
					plugin.app.vault.on('rename', (file, oldPath) => {
						if (!(file instanceof TFile) || file.extension !== 'md') return;
						void store.renamePath(oldPath, file.path);
						if (active?.path === oldPath) notify(file);
					}),
				);
				plugin.registerEvent(
					plugin.app.vault.on('delete', (file) => {
						if (!(file instanceof TFile) || file.extension !== 'md') return;
						void store.deletePath(file.path);
						if (active?.path === file.path) notify(null);
					}),
				);
			} else {
				active = plugin.app.workspace.getActiveFile();
				if (active && active.extension !== 'md') active = null;
				notify(active);
			}
		},
		onunload() {
			for (const domain of domains) domain.onDisable?.();
			void store.flush();
			store.dispose();
			registerCommentStore(null);
			listeners.clear();
			layoutListeners.clear();
			loaded = false;
		},
		getActiveFile() {
			return active;
		},
		notifyFileChange(file) {
			notify(file);
		},
		notifySettingsChanged() {
			store.notify();
			for (const domain of domains) domain.onSettingsChanged?.();
		},
		notifyLayoutChanged() {
			for (const cb of layoutListeners) cb();
		},
		onLayoutChanged(cb) {
			layoutListeners.add(cb);
			return () => layoutListeners.delete(cb);
		},
		onActiveFile(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		domains() {
			return domains;
		},
	};
}
