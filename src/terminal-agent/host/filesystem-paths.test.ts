import test from 'node:test';
import assert from 'node:assert/strict';
import { posix, win32 } from 'node:path';
import { absoluteVaultPath, resolvePluginDirectory } from './filesystem-paths.ts';

test('plugin paths retain native roots, Unicode, spaces and literal percent escapes', () => {
  assert.equal(resolvePluginDirectory('/库 A/%20', '.config', undefined, 'nand', posix), '/库 A/%20/.config/plugins/nand');
  assert.equal(resolvePluginDirectory('/', '.obsidian', undefined, 'nand', posix), '/.obsidian/plugins/nand');
  assert.equal(resolvePluginDirectory('/vault', '.obsidian', '/external/plugin', 'nand', posix), '/external/plugin');
  assert.equal(resolvePluginDirectory('C:\\库 A', '.obsidian', undefined, 'nand', win32), 'C:\\库 A\\.obsidian\\plugins\\nand');
  assert.equal(resolvePluginDirectory('\\\\server\\share\\vault', '.config', undefined, 'nand', win32), '\\\\server\\share\\vault\\.config\\plugins\\nand');
  assert.throws(() => absoluteVaultPath('relative/vault', posix), /absolute/);
});
