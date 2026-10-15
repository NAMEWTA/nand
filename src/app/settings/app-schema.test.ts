import { expect, test } from 'vitest';
import { appSchema } from './app-schema';
test('status bar preferences survive serialization with arbitrary contribution ids and safe defaults', () => {
 const schema = appSchema('en'); const value = schema.defaults();
 expect(value.statusBar).toEqual({ visible: true, segments: {}, usageMode: 'verbose', usageDisplay: 'used', mirrorToObsidian: false });
 value.statusBar = { visible: false, segments: { usage: false, 'future-module': true }, usageMode: 'compact', usageDisplay: 'remaining', mirrorToObsidian: true };
 expect(schema.normalize(JSON.parse(JSON.stringify(schema.pick(value, 'vault')))).statusBar).toEqual(value.statusBar);
 expect(schema.normalize({ statusBar: { segments: { invalid: 'no', usage: false }, usageMode: 'bad' } }).statusBar).toEqual({ visible: true, segments: { usage: false }, usageMode: 'verbose', usageDisplay: 'used', mirrorToObsidian: false });
 expect(schema.pick(value, 'vault')).not.toHaveProperty('devGallery');
});
