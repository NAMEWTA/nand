import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { WorkbenchPages } from '../src/shell/host/workbench-pages';
import type { WorkbenchContribution, WorkbenchPageBinding } from '../src/app/contracts/workbench-host';
import type { WorkbenchFeature, WorkbenchTarget } from '../src/app/contracts/workbench';
import type { NativeSurface, NativeSurfaceContext } from '../src/ui/native-surface';

const deferred = () => {
 let resolve!: () => void;
 const promise = new Promise<void>((done) => { resolve = done; });
 return { promise, resolve };
};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
interface TrackedPage { context: NativeSurfaceContext; signal: AbortSignal; opened: number; closed: number; shown: boolean; selected: string[]; state: Record<string, unknown>; }
function fixture(options: { slow?: Promise<void>; fail?: boolean; resourcePages?: boolean; releaseWhenHidden?: boolean } = {}) {
 const { document, window } = parseHTML('<html><body></body></html>');
 Object.assign(window.HTMLElement.prototype, {
  createDiv(this: HTMLElement, opts: { cls: string }) { const child = this.ownerDocument.createElement('div'); child.className = opts.cls; this.append(child); return child; },
 });
 const root = document.createElement('div'), navigation = document.createElement('div'); document.body.append(root, navigation);
 const children = new Set<unknown>(), instances: TrackedPage[] = [], errors: unknown[] = [], navigated: WorkbenchTarget[] = [];
 const owner = { app: {}, leaf: {}, addChild(child: unknown) { children.add(child); return child; }, removeChild(child: unknown) { children.delete(child); } };
 let enabled = true;
 const contribution = (id: WorkbenchFeature): WorkbenchContribution => ({
  id, navigation: { id, labelKey: 'workbench.' + id, icon: 'home', target: { feature: id } },
  availability: () => ({ enabled, supported: true, ready: true }),
  stateKeys: ['filter'], resourcePages: options.resourcePages, navigationContext: true, releaseWhenHidden: id === 'notifications' || options.releaseWhenHidden,
  create: async (context, target, _state, signal) => {
   const item: TrackedPage = { context, signal, opened: 0, closed: 0, shown: false, selected: [], state: { filter: { search: 'draft', token: 'never serialize' }, cookie: 'never serialize' } };
   instances.push(item);
   if (options.slow && instances.length === 1) await options.slow;
   const surface = {
    onOpen: async () => { item.opened++; if (options.fail) throw Error('mount failure'); },
    onClose: async () => { item.closed++; },
    getState: () => item.state,
    setState: async (state: Record<string, unknown>) => { if (Object.keys(state).length) item.state = state; },
    setVisible: (visible: boolean) => { item.shown = visible; },
   } as unknown as NativeSurface;
   return { surface, getTarget: () => target, navigate: async (next: WorkbenchTarget, navigationSignal: AbortSignal) => { if (navigationSignal.aborted) return; if (next.resourceId === 'missing') throw Error('missing resource'); item.selected.push(next.resourceId ?? next.feature); } } satisfies WorkbenchPageBinding;
  },
 });
 const pages = new WorkbenchPages(owner as never, root, [contribution('dashboard'), contribution('contacts'), contribution('browser'), contribution('notifications')], async (target) => { navigated.push(target); }, (error) => errors.push(error), () => {}, navigation);
 const prepare = async (target: WorkbenchTarget, controller = new AbortController()) => pages.prepare(target, controller.signal);
 return { root, navigation, children, instances, errors, navigated, pages, prepare, disable() { enabled = false; } };
}

test('repeated resources share a presentation and visibility owns both content and object navigation', async () => {
 const f = fixture();
 const home = await f.prepare({ feature: 'dashboard' }); f.pages.show(home);
 const contacts = await f.prepare({ feature: 'contacts' }); f.pages.show(contacts);
 assert.equal(f.instances[0]!.shown, false); assert.equal(home!.element.hidden, true); assert.equal(home!.element.inert, true);
 assert.equal(home!.navigationElement!.hidden, true); assert.equal(home!.navigationElement!.inert, true);
 assert.equal(contacts!.element.hidden, false); assert.equal(contacts!.navigationElement!.inert, false);
 const again = await f.prepare({ feature: 'dashboard' }); assert.equal(again, home); f.pages.show(again);
 assert.equal(f.instances.length, 2); assert.equal(f.instances[0]!.opened, 1);
 assert.equal(f.instances[0]!.closed, 0); assert.equal(f.instances[0]!.state.filter != null, true);
 await f.pages.dispose(); await f.pages.dispose();
 assert.deepEqual(f.instances.map((item) => item.closed), [1, 1]); assert.equal(f.children.size, 0);
 assert.equal(f.root.children.length, 0); assert.equal(f.navigation.children.length, 0);
});

test('cancelling a new async page removes it immediately and late completion is cleaned exactly once', async () => {
 const slow = deferred(), f = fixture({ slow: slow.promise }), controller = new AbortController();
 const pending = f.prepare({ feature: 'browser', resourceId: 'one' }, controller);
 await flush(); controller.abort();
 assert.equal(f.pages.getSurfaces().length, 0); assert.equal(f.instances[0]!.signal.aborted, true);
 slow.resolve(); assert.equal(await pending, undefined); await flush();
 assert.equal(f.instances[0]!.opened, 0); assert.equal(f.instances[0]!.closed, 1); assert.equal(f.children.size, 0);
 assert.equal(f.root.children.length, 0); await f.pages.dispose();
});

test('A to B to A while B mounts cannot resurrect B or create another A', async () => {
 const slow = deferred(), f = fixture({ slow: slow.promise }), controller = new AbortController();
 const pending = f.prepare({ feature: 'browser', resourceId: 'one' }, controller); await flush(); controller.abort();
 const current = await f.prepare({ feature: 'contacts' }); f.pages.show(current);
 slow.resolve(); await pending; await flush();
 assert.equal(f.pages.getCurrent(), current!.binding); assert.equal(f.pages.getSurfaces().length, 1);
 assert.equal(f.instances[0]!.closed, 1); assert.equal(f.instances[1]!.closed, 0); await f.pages.dispose();
});

test('module disable during create prevents late onOpen, and dispose remains idempotent', async () => {
 const slow = deferred(), f = fixture({ slow: slow.promise });
 const pending = f.prepare({ feature: 'contacts' }); await flush(); f.disable();
 const closed = f.pages.refreshAvailability(); slow.resolve(); await closed;
 assert.equal(await pending, undefined); assert.equal(f.instances[0]!.opened, 0); assert.equal(f.instances[0]!.closed, 1);
 await f.pages.dispose(); assert.equal(f.instances[0]!.closed, 1);
});

test('mount rejection releases component ownership and allows a clean retry', async () => {
 const f = fixture({ fail: true }); await assert.rejects(f.prepare({ feature: 'contacts' }), /mount failure/);
 assert.equal(f.instances[0]!.closed, 1); assert.equal(f.children.size, 0); assert.equal(f.root.children.length, 0);
 assert.equal(f.pages.list().length, 0); await f.pages.dispose();
});

test('a missing target on an existing editor preserves its presentation and draft', async () => {
 const f = fixture(), controller = new AbortController();
 const editor = await f.prepare({ feature: 'contacts' }); f.pages.show(editor);
 await assert.rejects(f.prepare({ feature: 'contacts', resourceId: 'missing' }, controller), /missing resource/);
 assert.equal(f.pages.getCurrent(), editor!.binding); assert.equal(f.instances[0]!.closed, 0);
 assert.deepEqual(f.instances[0]!.state.filter, { search: 'draft', token: 'never serialize' });
 assert.deepEqual(f.pages.getState()[0]!.state, { filter: { search: 'draft' } }); await f.pages.dispose();
});

test('hidden browser guests are not silently evicted by a visibility-only cache rule', async () => {
 const f = fixture({ resourcePages: true });
 for (let i = 0; i < 6; i++) f.pages.show(await f.prepare({ feature: 'browser', resourceId: String(i) }));
 assert.equal(f.instances.length, 6); assert.equal(f.instances.reduce((sum, item) => sum + item.closed, 0), 0);
 await f.pages.close(JSON.stringify(['browser', '0']));
 assert.equal(f.instances[0]!.closed, 1); assert.equal(f.pages.getSurfaces().length, 5); await f.pages.dispose();
});

test('lightweight notification projections release on hide without stopping other pages', async () => {
 const f = fixture(); f.pages.show(await f.prepare({ feature: 'notifications' }));
 f.pages.show(await f.prepare({ feature: 'dashboard' })); await flush();
 assert.equal(f.instances[0]!.closed, 1); assert.equal(f.instances[1]!.closed, 0);
 assert.equal(f.pages.getSurfaces().length, 1); await f.pages.dispose();
});

test('restoration never coerces an unknown feature into a phantom dashboard page', async () => {
 const f = fixture({ resourcePages: true });
 f.pages.restore([{ target: { feature: 'not-a-feature' }, state: { filter: 'unexpected' } }, { target: { feature: 'browser' }, state: { filter: 'missing id' } }, { target: { feature: 'contacts', resourceId: 'person' }, state: { filter: { search: 'safe', authorization: 'secret', action() {} } } }]);
 assert.deepEqual(f.pages.getState(), [{ target: { feature: 'contacts', resourceId: 'person' }, state: { filter: { search: 'safe' } } }]); await f.pages.dispose();
});

test('closing the active tab shows its neighbour; closing another page returns to the most recent one', async () => {
 const f = fixture({ resourcePages: true });
 const home = await f.prepare({ feature: 'dashboard', resourceId: 'home' }); f.pages.show(home);
 const one = await f.prepare({ feature: 'browser', resourceId: 'one' }); f.pages.show(one);
 const two = await f.prepare({ feature: 'browser', resourceId: 'two' }); f.pages.show(two);
 f.pages.show(home); f.pages.show(two);
 await f.pages.closeResource('browser', 'two');
 assert.deepEqual(f.navigated.at(-1), { feature: 'browser', resourceId: 'one' });
 f.pages.show(one); const contacts = await f.prepare({ feature: 'contacts', resourceId: 'c' }); f.pages.show(contacts);
 await f.pages.closeResource('contacts', 'c');
 assert.deepEqual(f.navigated.at(-1), { feature: 'browser', resourceId: 'one' });
 await f.pages.dispose();
});
