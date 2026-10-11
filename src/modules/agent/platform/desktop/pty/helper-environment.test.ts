import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { expect, test, vi } from 'vitest';
import { encodeControl, HELPER_PROTOCOL } from '../../../core/terminal/frames';
import { PtyHelper } from './helper';

const native = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: native.spawn }));

test('the native helper receives the vault process environment before its first protocol request', async () => {
	const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kill: () => true });
	native.spawn.mockReturnValue(child);
	child.stdin.once('data', () => queueMicrotask(() => child.stdout.write(encodeControl({ type: 'hello', accepted: true, protocol: HELPER_PROTOCOL, pid: 1, version: 'fixture' }))));
	const env = { HOME: 'owned-home', TMP: 'owned-temp', TEMP: 'owned-temp', TMPDIR: 'owned-temp' };
	const helper = await PtyHelper.start('fixture-helper', { output: () => {}, exit: () => {}, closed: () => {} }, globalThis as unknown as Window, env);
	try { expect(native.spawn.mock.calls[0]?.[2].env).toMatchObject(env); }
	finally { helper.dispose(); child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); }
});
