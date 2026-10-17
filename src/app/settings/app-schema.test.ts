import { expect, test } from 'vitest';
import { appSchema } from './app-schema';
test('status bar preferences survive serialization with arbitrary contribution ids and safe defaults', () => {
 const schema = appSchema('en'); const value = schema.defaults();
 expect(value.statusBar).toEqual({ segments: {}, usageMode: 'verbose', usageDisplay: 'used' });
 value.statusBar = { segments: { usage: false, 'future-module': true }, usageMode: 'compact', usageDisplay: 'remaining' };
 expect(schema.normalize(JSON.parse(JSON.stringify(schema.pick(value, 'vault')))).statusBar).toEqual(value.statusBar);
 expect(schema.normalize({ statusBar: { segments: { invalid: 'no', usage: false }, usageMode: 'bad' } }).statusBar).toEqual({ segments: { usage: false }, usageMode: 'verbose', usageDisplay: 'used' });
 // Fields of the retired in-workbench status bar are dropped, not migrated.
 expect(schema.normalize({ statusBar: { visible: false, mirrorToObsidian: true, usageMode: 'compact' } }).statusBar).toEqual({ segments: {}, usageMode: 'compact', usageDisplay: 'used' });
 expect(schema.pick(value, 'vault')).not.toHaveProperty('devGallery');
});
