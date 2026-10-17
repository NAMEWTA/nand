import { EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import type { CommentsEnv } from '../env';
import { buildDecorations } from './decorations';
import { commentGutter } from './gutter';
import { HoverTracker } from './hover';
import { pathOf, refreshComments } from './markers';
import { openComposer } from './selection';

export function commentsCmExtension(env: CommentsEnv) {
	return [EditorView.editorAttributes.of(view => {
		const settings = env.service.settings();
		return { class: 'nand-comments-editor', ...(!settings.followAccent && settings.color && view.dom.ownerDocument.defaultView?.CSS.supports('color', settings.color) ? { style: `--nd-comment-color: ${settings.color}` } : {}) };
	}), commentGutter(env), ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private readonly hover: HoverTracker;
		private readonly off: () => void;
		private dead = false;
		private applying = false;
		private frame: number | null = null;
		constructor(private readonly view: EditorView) {
			env.editors.add(view); env.overlay(view.dom.ownerDocument);
			this.decorations = buildDecorations(view, env); this.hover = new HoverTracker(view, env);
			this.off = env.service.store.subscribe(() => { if (this.applying || this.dead) return; queueMicrotask(() => { if (!this.dead && env.alive()) view.dispatch({ effects: refreshComments.of(env.service.store.revision) }); }); });
			this.load();
		}
		private load() {
			const path = pathOf(this.view.state); if (!path) return;
			void env.service.load(path).then(() => {
				if (this.dead || !env.alive() || pathOf(this.view.state) !== path) return;
				env.service.store.reconcile(path, this.view.state.doc.toString());
				this.view.dispatch({ effects: refreshComments.of(env.service.store.revision) });
			}, () => undefined);
		}
		update(update: ViewUpdate) {
			if (this.dead || !env.alive()) return;
			if (pathOf(update.state) !== pathOf(update.startState)) this.load();
			if (update.docChanged) { this.applying = true; env.service.store.applyChanges(pathOf(update.state), update.changes, update.state.doc.toString(), update.startState.doc.toString()); this.applying = false; }
			const refreshed = update.transactions.some(tr => tr.effects.some(effect => effect.is(refreshComments)));
			if (update.docChanged || update.viewportChanged || refreshed) this.decorations = buildDecorations(update.view, env);
			if (update.selectionSet || update.docChanged || update.focusChanged || refreshed) this.selection();
		}
		private selection() {
			const win = this.view.dom.ownerDocument.defaultView!;
			if (this.frame !== null) win.cancelAnimationFrame(this.frame);
			this.frame = win.requestAnimationFrame(() => {
				this.frame = null; if (this.dead || !env.alive()) return;
				const channel = env.overlay(this.view.dom.ownerDocument), { request, draft } = channel.state.getState();
				if (request && request.mode !== 'selection' && (request.pinned || draft)) return;
				// Focus moving into the popover (the button, then the composer) is not the user leaving the selection.
				if (request?.mode === 'selection' && this.view.dom.ownerDocument.activeElement?.closest('[data-comments-overlay]')) return;
				const selection = this.view.state.selection.main;
				if (!selection.empty && this.view.hasFocus && env.service.settings().popoverEnabled) openComposer(this.view, env, selection.from, selection.to, true);
				else if (request?.mode === 'selection') channel.close(false);
			});
		}
		destroy() {
			this.dead = true; this.off(); this.hover.destroy(); env.editors.delete(this.view);
			if (this.frame !== null) this.view.dom.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
			if (env.alive()) env.overlay(this.view.dom.ownerDocument).close(false);
		}
	}, { decorations: plugin => plugin.decorations })];
}
