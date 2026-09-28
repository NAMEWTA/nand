import type { Extension } from '@codemirror/state';
import type { MarkdownPostProcessor } from 'obsidian';
import type { EditorDomain } from '../domain';
import type { EditorPluginHost } from '../host';
import { commentsCmExtension } from './cm-extension';
import { registerCommentCommands } from './commands';
import { mountCommentsPanel } from './panel';
import { CommentPopoverCoordinator } from './popover-coordinator';
import { commentsReadingProcessor, refreshReadingViews } from './reading';

export function createCommentsDomain(plugin: EditorPluginHost): EditorDomain {
	const popovers = new CommentPopoverCoordinator(plugin.app);
	const extension = commentsCmExtension(plugin, popovers);
	const processor = commentsReadingProcessor(plugin);
	return {
		id: 'comments',
		titleKey: 'editor.comments.title',
		icon: 'message-square',
		mountPanel(el, ctx) {
			return mountCommentsPanel(el, ctx);
		},
		getEditorExtensions(): Extension[] {
			return [extension];
		},
		getReadingPostProcessor(): MarkdownPostProcessor {
			return processor;
		},
		onSettingsChanged() {
			popovers.refresh();
			refreshReadingViews(plugin);
		},
		onEnable() {
			popovers.enable();
		},
		onDisable() {
			popovers.disable();
		},
		registerCommands() {
			registerCommentCommands(plugin);
		},
	};
}
