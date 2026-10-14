import type { NativeHelperSqlite } from '../../../api';
import type { PtyHelper } from '../pty/helper';
export function cookieClient(helper: () => Promise<PtyHelper>): NativeHelperSqlite {
	return {
		readCookies: async (path, kind, signal) => {
			if (signal?.aborted) throw new Error('Cookie import cancelled');
			return (await helper()).request('cookies', 'read', { path, kind }, signal);
		},
	};
}
