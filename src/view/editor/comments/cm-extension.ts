import { EditorState, StateEffect, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import { getCommentStore } from '../../../core/comments/store';
import type { EditorPluginHost } from '../host';
import type { CommentPopoverCoordinator } from './popover-coordinator';
import { SelectionPopover } from './selection-popover';

const bump = StateEffect.define<number>();

function pathOf(state: EditorState): string | null {
	const info = state.field(editorInfoField, false);
	const path = info?.file?.path ?? null;
	return path && path.endsWith('.md') ? path : null;
}

function buildDecorations(view: EditorView, plugin: EditorPluginHost): DecorationSet {
	if (!plugin.settings.modules.editor || !plugin.settings.editorWorkbench.highlightEnabled) return Decoration.none;
	const path = pathOf(view.state);
	const store = getCommentStore();
	if (!path || !store) return Decoration.none;
	const ranges: { from: number; to: number; id: string }[] = [];
	const docLen = view.state.doc.length;
	for (const thread of store.threadsFor(path)) {
		if (thread.status === 'orphaned') continue;
		const from = thread.target.start;
		const to = thread.target.end;
		if (from < 0 || to <= from || to > docLen) continue;
		if (view.state.doc.sliceString(from, to) !== thread.target.quote.exact) continue;
		ranges.push({ from, to, id: thread.id });
	}
	ranges.sort((a, b) => a.from - b.from || a.to - b.to);
	const marks = [];
	let cursor = 0;
	for (const range of ranges) {
		if (range.from < cursor) continue;
		marks.push(
			Decoration.mark({
				class: 'nand-editor-comment-hl',
				attributes: { 'data-comment-id': range.id },
			}).range(range.from, range.to),
		);
		cursor = range.to;
	}
	return Decoration.set(marks, true);
}

/** CodeMirror 6 highlights + selection popover. Registered by the host, not the side panel. */
export function commentsCmExtension(plugin: EditorPluginHost, coordinator: CommentPopoverCoordinator): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private readonly popover: SelectionPopover;
			private readonly unregister: () => void;
			private dead = false;
			private applying = false;
			private off: () => void = () => undefined;
			private readonly onClick: (event: MouseEvent) => void;

			constructor(private readonly view: EditorView) {
				this.decorations = buildDecorations(view, plugin);
				this.popover = new SelectionPopover(view, plugin, coordinator);
				this.unregister = coordinator.register({
					dom: view.dom,
					setEnabled: (enabled) => {
						this.popover.setEnabled(enabled);
						this.bindStore(enabled);
						queueMicrotask(() => {
							if (!this.dead) view.dispatch({ effects: bump.of(0) });
						});
					},
					refresh: () => this.popover.refresh(),
				});
				this.onClick = (event) => {
					const target = event.target as HTMLElement | null;
					if (!target?.instanceOf(HTMLElement)) return;
					const mark = target.closest('.nand-editor-comment-hl');
					if (!mark?.instanceOf(HTMLElement)) return;
					const id = mark.dataset['commentId'];
					if (id) getCommentStore()?.focus(id);
				};
				view.dom.addEventListener('click', this.onClick);
				this.popover.refresh();
			}

			update(update: ViewUpdate): void {
				const store = getCommentStore();
				const path = pathOf(update.state) ?? pathOf(update.startState);
				if (update.docChanged && store && path) {
					this.applying = true;
					store.applyChanges(path, update.changes, update.state.doc.toString());
					this.applying = false;
				}
				const refreshed = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(bump)));
				if (update.docChanged || refreshed || update.viewportChanged) {
					this.decorations = buildDecorations(update.view, plugin);
				}
				if (
					update.docChanged ||
					update.selectionSet ||
					update.viewportChanged ||
					update.geometryChanged ||
					update.focusChanged ||
					refreshed
				) {
					this.popover.update(update);
				}
			}

			destroy(): void {
				this.dead = true;
				this.off();
				this.view.dom.removeEventListener('click', this.onClick);
				this.unregister();
				this.popover.destroy();
			}

			private bindStore(enabled: boolean): void {
				this.off();
				const store = enabled ? getCommentStore() : null;
				this.off = store
					? store.subscribe(() => {
							if (this.applying || this.dead) return;
							queueMicrotask(() => {
								if (!this.dead) this.view.dispatch({ effects: bump.of(store.revision) });
							});
						})
					: () => undefined;
				const path = pathOf(this.view.state);
				if (path && store) {
					void store
						.loadFile(path)
						.then(() => {
							if (
								this.dead ||
								!plugin.settings.modules.editor ||
								getCommentStore() !== store ||
								pathOf(this.view.state) !== path
							)
								return;
							store.reconcile(path, this.view.state.doc.toString());
							this.view.dispatch({ effects: bump.of(store.revision) });
						})
						.catch(() => undefined);
				}
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}
