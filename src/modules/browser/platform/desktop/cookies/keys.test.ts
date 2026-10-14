import { beforeEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { queryKeyring } from './keys';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it.each(['mac', 'linux', 'application'] as const)(
	'passes %s query values only through stdin to a fixed bridge',
	async (kind) => {
		const child = Object.assign(new EventEmitter(), {
			stdout: new EventEmitter(),
			stderr: { resume: vi.fn() },
			stdin: Object.assign(new EventEmitter(), { end: vi.fn() }),
			kill: vi.fn(),
		});
		vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
		const values =
			kind === 'application'
				? ['chrome $(touch injected)']
				: ['Chrome Safe Storage', 'account "quoted"; $(touch injected)'];
		const promise = queryKeyring(kind, values);
		const [program, args, options] = vi.mocked(spawn).mock.calls[0]!;
		expect(program).toBe('/bin/sh');
		expect(args?.[0]).toBe('-c');
		for (const value of values) expect(JSON.stringify(args)).not.toContain(value);
		expect(args?.[1]).toContain('IFS= read -r');
		expect(options).toMatchObject({ windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
		expect(child.stdin.end).toHaveBeenCalledWith(values.join('\n') + '\n');
		child.stdout.emit('data', Buffer.from('secret\n'));
		child.emit('close', 0);
		await expect(promise).resolves.toBe('secret');
	},
);
it('rejects line-breaking metadata before starting a process', async () => {
	await expect(queryKeyring('linux', ['service\nextra', 'account'])).rejects.toThrow('Invalid keyring metadata');
	await expect(queryKeyring('mac', ['service'])).rejects.toThrow('Invalid keyring metadata');
	expect(spawn).not.toHaveBeenCalled();
});
