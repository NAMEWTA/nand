import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { NewsView } from '../core/model';
import { defaultNewsWidgets, type NewsWidgetConfig } from '../core/home-widgets';
import { newsHomeWidgets } from './home-widgets';

test('one provider bundle exposes independent instances and notifies only configuration/view changes', () => {
	const widgets: NewsWidgetConfig[] = [...defaultNewsWidgets(), { id: 'a', mode: 'view', name: '', count: 1, staleMinutes: 15, showSummary: false, viewId: 'first' }, { id: 'b', mode: 'view', name: '', count: 3, staleMinutes: 60, showSummary: true, viewId: 'second' }];
	const views: NewsView[] = [{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }];
	const listeners = new Set<() => void>();
	const bundle = newsHomeWidgets({ widgets: () => widgets, views: () => views, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } }, () => {}, async () => null);
	assert.deepEqual(bundle.kinds.map(kind => kind.key), ['news-featured', 'news-hot', 'news-view']);
	assert.deepEqual(bundle.kinds[2]!.instances(), [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }]);
	let changes = 0;
	const off = bundle.subscribeInstances!(() => changes++), emit = () => { for (const listener of listeners) listener(); };
	emit(); assert.equal(changes, 0);
	widgets[2]!.count = 2; emit(); assert.equal(changes, 1); assert.equal(widgets[3]!.count, 3);
	views[0]!.name = 'Renamed'; emit(); assert.equal(changes, 2); assert.equal(bundle.kinds[2]!.instances()[0]!.label, 'Renamed');
	views.splice(0, 1); emit(); assert.equal(bundle.kinds[2]!.instances().length, 2);
	off(); assert.equal(listeners.size, 0);
});
