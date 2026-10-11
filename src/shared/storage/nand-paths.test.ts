import { expect, test } from 'vitest';
import { nandPath, validateNandPath } from './nand-paths';

test('all NAND locations resolve under the vault-relative root and retain Unicode names', () => {
	expect(nandPath('content', '档案/团队+甲.md')).toBe('.nand/content/档案/团队+甲.md');
	expect(validateNandPath('.nand\\browser\\device\\profile')).toBe('.nand/browser/device/profile');
	expect(nandPath()).toBe('.nand');
});
test.each(['../outside', '/tmp/outside', 'C:/outside', 'C:outside', '\\\\server\\share', 'config/../../outside', 'config/CON.json', 'config/a:stream', 'config/a.', 'config/a ', 'config/./a', 'config//a', 'config/\0a'])('rejects escaping or aliased location %j', path => {
	expect(() => nandPath(path)).toThrow('invalid-path');
});
