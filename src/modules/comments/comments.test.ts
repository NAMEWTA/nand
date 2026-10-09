import { verifyCommentStorage } from '../../../scripts/verify-comment-storage';
import { verifyCommentHandoff } from '../../../scripts/verify-comment-handoff';
import { parseHTML } from 'linkedom';
/**
 * Editor comment anchors, sidecar store, and product-boundary checks.
 * Runs with `pnpm test`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { editorInfoField, Scope } from 'obsidian';
import { CommentPopoverCoordinator } from '../../modules/comments/ui/comments/popover-coordinator';
import { locateAnchor, makeAnchor, selectionIsCommentable } from '../../modules/comments/core/anchor';
import { commentsCmExtension } from '../../modules/comments/ui/comments/cm-extension';
import { formatCommentTime, mountCommentsPanel } from '../../modules/comments/ui/comments/panel';
import { CommentStore, type CommentFs } from '../../modules/comments/core/store';
import { El } from '../../../scripts/mini-dom';
import { Menu } from '../../../scripts/obsidian-stub';
import { setLanguage } from '../../shared/i18n/runtime';
import { commentsSettingsPage } from '../../modules/comments/ui/settings-page';
import { Setting } from '../../../scripts/obsidian-stub';
import { test } from 'vitest';

const timers = { set: (callback: () => void, ms: number) => setTimeout(callback, ms), clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

test('editor comments: anchors, sidecar store, panel and editor features', async () => {
	const doc = '---\ntitle: x\n---\n\nHello prefix TARGET suffix tail.\n\n```\ncode TARGET\n```\n\nAfter.';
	
	const targetAt = doc.indexOf('TARGET');
	assert.ok(targetAt > 0, 'fixture contains TARGET');
	const anchor = makeAnchor(doc, targetAt, targetAt + 'TARGET'.length);
	assert.equal(anchor.exact, 'TARGET');
	assert.ok(anchor.prefix.endsWith('prefix '), 'prefix keeps the nearby context');
	assert.ok(anchor.suffix.startsWith(' suffix'), 'suffix keeps the nearby context');
	
	assert.deepEqual(locateAnchor(doc, anchor, targetAt, targetAt + 6), { start: targetAt, end: targetAt + 6 });
	
	const shifted = doc.replace('Hello', 'Hello!!');
	const shiftedAt = shifted.indexOf('TARGET');
	const located = locateAnchor(shifted, anchor, targetAt, targetAt + 6);
	assert.deepEqual(located, { start: shiftedAt, end: shiftedAt + 6 }, 'prefix+exact+suffix wins over a stale offset');
	
	const ambiguous = 'TARGET and later TARGET';
	const second = ambiguous.lastIndexOf('TARGET');
	const nearest = locateAnchor(ambiguous, { exact: 'TARGET', prefix: '', suffix: '' }, second, second + 6);
	assert.equal(nearest?.start, second, 'bare exact picks the hit nearest the old offset');
	assert.equal(locateAnchor('nothing', anchor, 0, 6), null);
	
	const fmEnd = doc.indexOf('Hello');
	assert.equal(selectionIsCommentable(doc, 4, 8), false, 'frontmatter is not commentable');
	assert.equal(selectionIsCommentable(doc, fmEnd, fmEnd + 5), true);
	const codeAt = doc.indexOf('code TARGET');
	assert.equal(selectionIsCommentable(doc, codeAt, codeAt + 4), false, 'code fence is not commentable');
	
	function memoryFs(): CommentFs & { files: Map<string, string> } {
		const files = new Map<string, string>();
		return {
			files,
			async read(p) {
				const value = files.get(p);
				if (value === undefined) throw new Error(`missing ${p}`);
				return value;
			},
			async write(p, data) {
				files.set(p, data);
			},
			async remove(p) {
				files.delete(p);
			},
			async exists(p) {
				return files.has(p);
			},
		};
	}
	
	const note = 'Please keep this note byte-for-byte.';
	
	async function main(): Promise<void> {
		await verifyCommentStorage();
		await verifyCommentHandoff();
		if (typeof window === 'undefined') {
			Object.assign(globalThis, { window: globalThis });
		}
		const fsMem = memoryFs();
	const store = new CommentStore(fsMem, { timers, debounceMs: 1000 });
	const added = await store.add('notes/demo.md', {
		quote: makeAnchor(note, 7, 11),
		start: 7,
		end: 11,
		text: 'first',
	});
	assert.equal(note, 'Please keep this note byte-for-byte.', 'adding a comment does not touch the note');
	assert.ok(added.id.startsWith('c-'));
	await store.flush();
	for (const key of fsMem.files.keys()) {
		assert.ok(key.startsWith('.nand/editor/comments/'), `sidecar path ${key}`);
	}
	const index = JSON.parse(fsMem.files.get('.nand/editor/comments/index.json') ?? '{}') as {
		files: Record<string, { hash: string; open: number; total: number }>;
	};
	const meta = index.files['notes/demo.md'];
	assert.ok(meta, 'index records the note');
	assert.equal(meta.hash.length, 16);
	assert.equal(meta.open, 1);
	assert.equal(meta.total, 1);
	const fileBody = JSON.parse(fsMem.files.get(`.nand/editor/comments/files/${meta.hash}.json`) ?? '{}') as {
		path: string;
		comments: { target: { quote: { exact: string } } }[];
	};
	assert.equal(fileBody.path, 'notes/demo.md');
	assert.equal(fileBody.comments[0]?.target.quote.exact, 'keep');
	
	store.applyChanges('notes/demo.md', { mapPos: (pos) => pos + 1 }, ` ${note}`);
	await store.flush();
	const followed = store.threadsFor('notes/demo.md')[0];
	assert.equal(followed?.target.start, 8);
	assert.equal(followed?.target.quote.exact, 'keep');
	
	await store.reply(added.id, 'second');
	await store.resolve(added.id);
	await store.flush();
	const resolvedIndex = JSON.parse(fsMem.files.get('.nand/editor/comments/index.json') ?? '{}') as {
		files: Record<string, { open: number; total: number }>;
	};
	assert.equal(resolvedIndex.files['notes/demo.md']?.open, 0);
	assert.equal(resolvedIndex.files['notes/demo.md']?.total, 1);
	
	await store.renamePath('notes/demo.md', 'notes/renamed.md');
	assert.equal(store.threadsFor('notes/renamed.md')[0]?.target.path, 'notes/renamed.md');
	assert.equal(store.threadsFor('notes/demo.md').length, 0);
	const renamedIndex = JSON.parse(fsMem.files.get('.nand/editor/comments/index.json') ?? '{}') as {
		files: Record<string, { hash: string }>;
	};
	assert.ok(renamedIndex.files['notes/renamed.md']);
	assert.equal(renamedIndex.files['notes/demo.md'], undefined);
	
	await store.deletePath('notes/renamed.md');
	const afterDelete = JSON.parse(fsMem.files.get('.nand/editor/comments/index.json') ?? '{}') as {
		files: Record<string, unknown>;
	};
	assert.equal(afterDelete.files['notes/renamed.md'], undefined);
	assert.equal([...fsMem.files.keys()].some((key) => key.includes('/files/')), false, 'file sidecar removed');
	
	const orphanStore = new CommentStore(memoryFs(), { timers, debounceMs: 1000 });
	await orphanStore.add('a.md', { quote: makeAnchor('alpha', 0, 5), start: 0, end: 5, text: 'gone' });
	orphanStore.reconcile('a.md', 'zzzz');
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(orphanStore.threadsFor('a.md')[0]?.status, 'orphaned');
	
	if (typeof globalThis.HTMLTextAreaElement === 'undefined') {
		(globalThis as { HTMLTextAreaElement: new () => HTMLTextAreaElement }).HTMLTextAreaElement = class HTMLTextAreaElement {} as never;
	}
	const stamped = '2026-09-26T10:46:18.387Z';
	const stampedDate = new Date(stamped);
	const pad = (value: number) => String(value).padStart(2, '0');
	const localStamp = `${stampedDate.getFullYear()}-${pad(stampedDate.getMonth() + 1)}-${pad(stampedDate.getDate())} ${pad(stampedDate.getHours())}:${pad(stampedDate.getMinutes())}`;
	assert.equal(formatCommentTime(stamped), localStamp);
	if (stampedDate.getTimezoneOffset() !== 0) {
		assert.notEqual(formatCommentTime(stamped), stamped.slice(0, 16).replace('T', ' '));
	}
	assert.equal(formatCommentTime('not-a-time'), 'not-a-time');
	
	const panelNote = 'Please keep this note byte-for-byte.';
	const panelFs = memoryFs();
	const panelStore = new CommentStore(panelFs, { timers, debounceMs: 1000 });
	const panelThread = await panelStore.add('notes/demo.md', {
		quote: makeAnchor(panelNote, 7, 11),
		start: 7,
		end: 11,
		text: 'visible',
	});
	await panelStore.flush();
	let currentStore: CommentStore | null = panelStore;
	const panelDom = parseHTML('<html><body></body></html>');
	Object.assign(globalThis, { document: panelDom.document });
	Object.assign(panelDom.HTMLElement.prototype, {
		empty(this: HTMLElement) { this.replaceChildren(); },
		addClass(this: HTMLElement, name: string) { this.classList.add(name); },
	});
	const host = panelDom.document.createElement('div');
	panelDom.document.body.appendChild(host);
	const unmountPanel = mountCommentsPanel(host as unknown as HTMLElement, {
		app: {} as never,
		file: { path: 'notes/demo.md', extension: 'md' } as never,
		store: panelStore,
	});
	await panelStore.loadFile('notes/demo.md');
	const card = host.querySelector('.nand-editor-comment');
	const list = host.querySelector('.nand-editor-comments-list');
	assert.ok(card, 'comment card is rendered');
	assert.equal(card?.parentElement, list);
	assert.equal(card?.textContent?.includes('keep'), true);
	assert.equal(panelNote, 'Please keep this note byte-for-byte.', 'rendering a card does not touch the note');
	assert.equal(card?.querySelector('.nand-editor-comment-quote')?.tagName, 'BUTTON', 'quote supports keyboard activation');
	await panelStore.resolve(panelThread.id);
	assert.equal(host.querySelector('.nand-editor-comment-status')?.textContent, '已解决');
	setLanguage('en');
	await panelStore.reply(panelThread.id, 'English reply');
	assert.equal(host.querySelector('.nand-editor-comment-status')?.textContent, 'Resolved');
	await panelStore.reopen(panelThread.id);
	assert.equal(host.querySelector('.nand-editor-comment-status'), null);
	host.querySelector<HTMLButtonElement>('.nand-editor-comment-more')?.click();
	assert.equal(Menu.last?.items[0]?.title, 'Delete');
	Menu.last?.items[0]?.click();
	await panelStore.flush();
	assert.equal(panelStore.threadsFor('notes/demo.md').length, 0, 'more menu retains deletion');
	setLanguage('zh');
	await panelStore.add('notes/demo.md', { quote: makeAnchor(panelNote, 7, 11), start: 7, end: 11, text: 'visible' });
	await panelStore.flush();
	
	
	unmountPanel();
	assert.equal(host.childNodes.length, 0, 'Preact root is unmounted on panel disposal');
	
	const frames: FrameRequestCallback[] = [];
	const editorBody = new El('body');
	const editorDocument = Object.assign(new El('#document'), {
		body: editorBody,
		documentElement: new El('html'),
		nodeType: 9,
		defaultView: globalThis,
		activeElement: null as El | null,
		hasFocus() {
			return false;
		},
		createElement(tag: string) {
			const el = new El(tag);
			Object.assign(el, {
				ownerDocument: editorDocument,
				nodeType: 1,
				clientHeight: 16,
				clientWidth: 80,
				scrollTop: 0,
				scrollLeft: 0,
				scrollHeight: 16,
				scrollWidth: 80,
			});
			el.getBoundingClientRect = () => ({ top: 0, right: 80, bottom: 16, left: 0, width: 80, height: 16 });
			const textContent = Object.getOwnPropertyDescriptor(El.prototype, 'textContent')!;
			Object.defineProperty(el, 'textContent', {
				get() { return textContent.get!.call(el); },
				set(value: string) {
					textContent.set!.call(el, '');
					if (value) el.appendChild(editorDocument.createTextNode(value));
				},
			});
	
			return el;
		},
		createElementNS(_ns: string, tag: string) {
			return this.createElement(tag);
		},
		createTextNode(text: string) {
			const el = new El('#text');
			el.textContent = text;
			Object.assign(el, { ownerDocument: editorDocument, nodeType: 3, nodeValue: text });
			return el;
		},
		addEventListener() {},
		removeEventListener() {},
		getSelection() {
			return null;
		},
		elementFromPoint() {
			return null;
		},
		createRange() {
			return {
				setStart() {},
				setEnd() {},
				getBoundingClientRect() {
					return { top: 40, left: 12, right: 20, bottom: 56, width: 8, height: 16 };
				},
				getClientRects() {
					return [{ top: 40, left: 12, right: 20, bottom: 56, width: 8, height: 16 }];
				},
			};
		},
	});
	Object.assign(editorBody, { ownerDocument: editorDocument, nodeType: 1 });
	const win = globalThis as typeof globalThis & {
		requestAnimationFrame: (cb: FrameRequestCallback) => number;
		cancelAnimationFrame: (id: number) => void;
		getComputedStyle: (elt: unknown) => CSSStyleDeclaration;
		getSelection: () => null;
		MutationObserver: unknown;
	};
	(globalThis as { document: unknown }).document = editorDocument;
	win.addEventListener = () => {};
	win.removeEventListener = () => {};
	win.requestAnimationFrame = (cb) => {
		frames.push(cb);
		return frames.length;
	};
	win.cancelAnimationFrame = () => {};
	win.getComputedStyle = () => new Proxy({} as CSSStyleDeclaration, {
		get(_target, prop) {
			if (prop === 'getPropertyValue') return () => '16px';
			if (prop === 'whiteSpace') return 'pre';
			if (prop === 'direction') return 'ltr';
			if (prop === 'display') return 'block';
			if (prop === 'position') return 'static';
			return '16px';
		},
	});
	win.getSelection = () => null;
	(globalThis as { MutationObserver: unknown }).MutationObserver = class {
		observe(): void {}
		disconnect(): void {}
		takeRecords(): unknown[] {
			return [];
		}
	};
	const flushFrames = () => {
		for (let i = 0; i < 6 && frames.length > 0; i += 1) {
			const batch = frames.splice(0);
			for (const cb of batch) cb(0);
		}
	};
	const workspaceEvents = new Map<string, Set<(leaf?: unknown) => void>>();
	const noteLeaf = { view: { containerEl: editorBody }, getContainer: () => workspaceRoot };
	const terminalLeaf = { view: { containerEl: new El('div') } };
	terminalLeaf.view.containerEl.ownerDocument = editorDocument;
	const workspaceRoot = {};
	const workspace = {
		activeLeaf: noteLeaf as typeof noteLeaf | typeof terminalLeaf,
		iterateAllLeaves(cb: (leaf: typeof noteLeaf) => void) { cb(noteLeaf); },
		getMostRecentLeaf: () => noteLeaf,
		on(name: string, cb: (leaf?: unknown) => void) {
			const callbacks = workspaceEvents.get(name) ?? new Set();
			workspaceEvents.set(name, callbacks);
			callbacks.add(cb);
			return { name, cb };
		},
		offref(event: { name: string; cb: (leaf?: unknown) => void }) { workspaceEvents.get(event.name)?.delete(event.cb); },
	};
	const emitWorkspace = (name: string) => { for (const cb of workspaceEvents.get(name) ?? []) cb(name === 'active-leaf-change' ? workspace.activeLeaf : undefined); };
	const keyScopes: Scope[] = [];
	const commentSettings = { highlightEnabled: true, popoverEnabled: true };
	const commentPlugin = {
		store: () => currentStore,
		settings: () => commentSettings,
		app: { workspace, scope: new Scope(), keymap: {
			pushScope: (scope: Scope) => keyScopes.push(scope),
			popScope: (scope: Scope) => { const i = keyScopes.indexOf(scope); if (i >= 0) keyScopes.splice(i, 1); },
		} },
	};
	const coordinator = new CommentPopoverCoordinator(commentPlugin.app as never);
	coordinator.enable();
	Object.assign(win, { innerWidth: 1000, innerHeight: 800 });
	let paneHeight = 600;
	const paneRect = () => ({ top: 0, right: 800, bottom: paneHeight, left: 0, width: 800, height: paneHeight });
	const editor = new EditorView({
		parent: editorBody as unknown as HTMLElement,
		state: EditorState.create({
			doc: panelNote,
			extensions: [
				editorInfoField.init(() => ({ file: { path: 'notes/demo.md' } }) as never),
				commentsCmExtension(commentPlugin as never, coordinator),
			],
		}),
	});
	editor.dom.getBoundingClientRect = paneRect as never;
	editor.scrollDOM.getBoundingClientRect = paneRect as never;
	flushFrames();
	editor.dispatch({ selection: { anchor: 7, head: 11 } });
	flushFrames();
	assert.ok(editorBody.querySelector('.nand-editor-comment-hl'), 'selecting text keeps the comment highlight');
	assert.ok(editorBody.querySelector('.nand-editor-comment-popover'), 'selecting text shows the comment button');
	
	const popup = editorBody.querySelector('.nand-editor-comment-popover')!;
	assert.ok(popup && !(popup as unknown as HTMLElement).hidden);
	const openButton = popup.children[0]!;
	openButton.click();
	const draft = popup.children[1]!;
	draft.value = 'draft across tabs';
	draft.dispatchEvent({ type: 'input' });
	flushFrames();
	assert.equal(keyScopes.length, 1);
	const beforeHiddenSubmit = panelStore.threadsFor('notes/demo.md').length;
	workspace.activeLeaf = terminalLeaf;
	emitWorkspace('active-leaf-change');
	assert.equal((popup as unknown as HTMLElement).hidden, true, 'hide synchronously without a CM transaction');
	assert.equal(keyScopes.length, 0, 'hidden composer releases keyboard scope');
	popup.children[3]!.children[1]!.click();
	await Promise.resolve();
	assert.equal(panelStore.threadsFor('notes/demo.md').length, beforeHiddenSubmit, 'stale hidden click cannot save');
	flushFrames();
	assert.equal((popup as unknown as HTMLElement).hidden, true);
	workspace.activeLeaf = noteLeaf;
	emitWorkspace('active-leaf-change');
	flushFrames();
	assert.equal((popup as unknown as HTMLElement).hidden, false);
	assert.equal(draft.value, 'draft across tabs');
	popup.children[3]!.children[1]!.click();
	workspace.activeLeaf = terminalLeaf;
	emitWorkspace('active-leaf-change');
	flushFrames();
	await Promise.resolve();
	await Promise.resolve();
	await panelStore.flush();
	assert.equal(panelStore.threadsFor('notes/demo.md').length, beforeHiddenSubmit, 'switching leaves before submission measurement prevents the write');
	workspace.activeLeaf = noteLeaf;
	emitWorkspace('active-leaf-change');
	flushFrames();
	assert.equal(draft.value, 'draft across tabs');
	paneHeight = 30;
	emitWorkspace('layout-change');
	flushFrames();
	assert.equal((popup as unknown as HTMLElement).hidden, true, 'rendered selection outside resized pane is hidden');
	paneHeight = 600;
	emitWorkspace('layout-change');
	flushFrames();
	assert.equal((popup as unknown as HTMLElement).hidden, false);
	editor.dispatch({ selection: { anchor: 12, head: 16 } });
	flushFrames();
	assert.equal(popup.isConnected, false, 'selection replacement discards the old draft context');
	currentStore = null;
	coordinator.disable();
	assert.equal(editorBody.querySelector('.nand-editor-comment-popover'), null);
	assert.equal([...workspaceEvents.values()].every((callbacks) => callbacks.size === 0), true);
	currentStore = panelStore;
	coordinator.enable();
	await Promise.resolve();
	flushFrames();
	assert.ok(editorBody.querySelector('.nand-editor-comment-popover'), 'module restart restores the existing CM extension');
	
	const coldBody = new El('div');
	Object.assign(coldBody, { ownerDocument: editorDocument, nodeType: 1 });
	const coldStore = new CommentStore(panelFs, { timers, debounceMs: 1000 });
	currentStore = coldStore;
	const coldEditor = new EditorView({
		parent: coldBody as unknown as HTMLElement,
		state: EditorState.create({
			doc: panelNote,
			extensions: [
				editorInfoField.init(() => ({ file: { path: 'notes/demo.md' } }) as never),
				commentsCmExtension(commentPlugin as never, coordinator),
			],
		}),
	});
	assert.equal(coldBody.querySelector('.nand-editor-comment-hl'), null, 'highlight waits until the sidecar is loaded');
	await coldStore.loadFile('notes/demo.md');
	flushFrames();
	assert.ok(coldBody.querySelector('.nand-editor-comment-hl'), 'loading the sidecar paints the highlight without reopening the note');
	coldEditor.destroy();
	editor.destroy();
	coordinator.disable();
	
	// Dependency boundaries are enforced by test:architecture, including TSX and lazy imports.
	const root = process.cwd();
	const viewSource = fs.readFileSync(path.join(root, 'src/modules/home/ui/view/view-type.ts'), 'utf8');
	assert.match(viewSource, /DASHBOARD_PAGE_TYPE = 'nand-dashboard-view'/);
	const editorSource = fs.readFileSync(path.join(root, 'src/app/workbench/comments-leaf.ts'), 'utf8');
	assert.match(editorSource, /COMMENTS_VIEW_TYPE = 'nand-comments-view'/);
	
	const commentCss = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
	for (const language of ['zh', 'en'] as const) {
		setLanguage(language);
		const before = Setting.created.length;
		commentsSettingsPage({ get: () => commentSettings, update: async () => {}, subscribe: () => () => {} } as never)(new El('div') as never, { refresh() {}, keep() {} });
		assert.equal(Setting.created.slice(before).some((setting) => setting.dropdowns.length > 0), false, 'Settings cannot select a hidden placeholder');
	}
	setLanguage('zh');
	const popoverAt = commentCss.indexOf('.nand-editor-comment-popover {');
	assert.equal(popoverAt >= 0, true);
	const popoverRule = commentCss.slice(popoverAt, commentCss.indexOf('}', popoverAt));
	assert.equal(popoverRule.includes('var(--layer-popover, 30)'), true);
	assert.equal(popoverRule.includes('z-index: 1000'), false);
	
	console.log('verify-editor-comments: ok');
	}
	
	
	await main();
}, 60_000);
