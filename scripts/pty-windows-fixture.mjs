import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const prefix = 'nand-pty-windows-';
const samePath = (left, right) => path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase();

export async function createWindowsFixture(base) {
  // Windows TEMP may use an 8.3 alias. Record canonical paths on both sides,
  // together with the identity of the directory created by this invocation.
  const parent = await fs.realpath(base);
  const directory = await fs.mkdtemp(path.join(parent, prefix));
  const canonical = await fs.realpath(directory);
  const identity = await fs.lstat(directory, { bigint: true });
  assert.ok(identity.isDirectory() && !identity.isSymbolicLink(), 'Fixture is a regular owned directory');
  assert.ok(samePath(path.dirname(canonical), parent), 'Fixture is directly inside its owned parent');
  return { directory, canonical, parent, dev: identity.dev, ino: identity.ino };
}

export async function removeWindowsFixture(owned) {
  const identity = await fs.lstat(owned.directory, { bigint: true });
  assert.ok(!identity.isSymbolicLink(), 'Refuse to clean a reparse fixture');
  assert.ok(identity.isDirectory(), 'Fixture is still a directory');
  assert.equal(identity.dev, owned.dev, 'Fixture volume identity changed');
  assert.equal(identity.ino, owned.ino, 'Fixture directory identity changed');
  const parent = await fs.realpath(owned.parent);
  const canonical = await fs.realpath(owned.directory);
  assert.ok(samePath(parent, owned.parent), 'Fixture parent resolution changed');
  assert.ok(samePath(canonical, owned.canonical), 'Fixture directory resolution changed');
  assert.ok(samePath(path.dirname(canonical), parent), 'Fixture escaped its owned parent');
  assert.ok(path.basename(canonical).startsWith(prefix), 'Fixture name is owned by this test');
  // Delete only the verified absolute target. No raw short-path comparison or
  // recursive operation against a reparse point is needed.
  await fs.rm(canonical, { recursive: true });
}
