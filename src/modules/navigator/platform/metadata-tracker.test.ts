// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { MetadataTracker } from './metadata-tracker';

test('a modified note is not trusted until its metadata is parsed', () => {
	const tracker = new MetadataTracker(() => 0);
	expect(tracker.current('a.md', true)).toBe(true);
	tracker.modified('a.md');
	expect(tracker.current('a.md', true)).toBe(false);
	tracker.parsed('a.md');
	expect(tracker.current('a.md', true)).toBe(true);
	expect(tracker.current('b.md', false)).toBe(false);
});

test('a touch without a metadata event is trusted again after the patience runs out', () => {
	let time = 0;
	const tracker = new MetadataTracker(() => time, 1000);
	tracker.modified('a.md');
	time = 999;
	expect(tracker.current('a.md', true)).toBe(false);
	time = 1000;
	expect(tracker.current('a.md', true)).toBe(true);
});

test('renames carry the state and deletions clear it', () => {
	const tracker = new MetadataTracker(() => 0);
	tracker.modified('a.md');
	tracker.renamed('a.md', 'b.md');
	expect(tracker.current('b.md', true)).toBe(false);
	expect(tracker.current('a.md', true)).toBe(true);
	tracker.forget('b.md');
	expect(tracker.current('b.md', true)).toBe(true);
});
