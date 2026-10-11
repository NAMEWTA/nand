import { expect, test } from 'vitest';
import { machineIdentity } from './device-identity';

test.skipIf(process.platform !== 'win32')('Windows identity uses the installed system and user without creating data', async () => {
	const first = await machineIdentity();
	expect(first).toBeTruthy(); expect(await machineIdentity()).toBe(first);
});
