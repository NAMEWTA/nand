import path from 'node:path';
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
import { loginShellEnvironment, loginShellPath, parseLoginShellEnvironment, recoveredLoginEnvironment, resetLoginShellEnvironmentForTests } from './shell-path';
import { systemAccountPaths } from '../agents/system-homes';
import { terminalEnvironment } from '../pty/runtime-environment';

afterEach(() => { resetLoginShellEnvironmentForTests(); vi.unstubAllEnvs(); });

const probe = (body: string) => `printf '\\0__NAND_LOGIN_SHELL_ENV_START__\\0${body}\\0__NAND_LOGIN_SHELL_ENV_END__\\0'`;

test('the login-shell dump is parsed between its markers and ignores rc banners', () => {
	const output = Buffer.from(`banner\0__NAND_LOGIN_SHELL_ENV_START__\0PATH=/a:/b\0CODEX_HOME=/rc/codex\0EMPTY=\0__NAND_LOGIN_SHELL_ENV_END__\0tail`);
	expect(parseLoginShellEnvironment(output)).toEqual({ PATH: '/a:/b', CODEX_HOME: '/rc/codex', EMPTY: '' });
	expect(parseLoginShellEnvironment(Buffer.from('no markers'))).toBeNull();
});

test.skipIf(process.platform === 'win32')('a desktop-icon launch recovers PATH and rc-exported provider homes from the login shell, without overriding explicit ones', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'nand-login-shell-'));
	try {
		const shell = path.join(directory, 'fake-shell');
		await writeFile(shell, `#!/bin/sh\n${probe('PATH=/rc/bin:/usr/bin\\0CODEX_HOME=/rc/codex\\0CLAUDE_CONFIG_DIR=/rc/claude\\0UNRELATED=x')}\n`);
		await chmod(shell, 0o755);
		vi.stubEnv('SHELL', shell); vi.stubEnv('PATH', '/usr/bin'); vi.stubEnv('CODEX_HOME', ''); vi.stubEnv('CLAUDE_CONFIG_DIR', '/explicit/claude');
		const recovered = await loginShellEnvironment(5000, true);
		expect(recovered).toEqual({ PATH: '/rc/bin:/usr/bin', CODEX_HOME: '/rc/codex' });
		expect(recoveredLoginEnvironment()).toEqual(recovered);
		expect(await loginShellPath()).toBe('/rc/bin:/usr/bin');
		// Ordinary shells and the helper inherit the real environment plus only what the login shell added.
		expect(await terminalEnvironment()).toEqual(recovered);
		// Real provider homes honour the recovered export, and an explicit one wins.
		const paths = systemAccountPaths({ CLAUDE_CONFIG_DIR: '/explicit/claude' }, '/home/user');
		expect(paths.CODEX_HOME).toBe('/rc/codex');
		expect(paths.CLAUDE_CONFIG_DIR).toBe('/explicit/claude');
	} finally { await rm(directory, { recursive: true, force: true }); }
});

test.skipIf(process.platform === 'win32')('a login shell that fails or hangs leaves the environment untouched', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'nand-login-shell-fail-'));
	try {
		const shell = path.join(directory, 'hang-shell');
		await writeFile(shell, '#!/bin/sh\nsleep 5\n');
		await chmod(shell, 0o755);
		vi.stubEnv('SHELL', shell);
		const started = Date.now();
		expect(await loginShellEnvironment(300, true)).toEqual({});
		expect(Date.now() - started).toBeLessThan(4000);
	} finally { await rm(directory, { recursive: true, force: true }); }
}, 15000);

test.skipIf(process.platform === 'win32')('the helper and ordinary shells never receive a moved HOME or cleared credential', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'nand-login-shell-plain-'));
	try {
		const shell = path.join(directory, 'same-shell');
		await writeFile(shell, `#!/bin/sh\n${probe(`PATH=${process.env.PATH ?? ''}`)}\n`);
		await chmod(shell, 0o755);
		vi.stubEnv('SHELL', shell);
		expect(await terminalEnvironment()).toEqual({});
	} finally { await rm(directory, { recursive: true, force: true }); }
});
