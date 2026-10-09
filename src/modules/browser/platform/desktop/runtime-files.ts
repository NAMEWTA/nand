type Fs = typeof import('node:fs');
type Paths = typeof import('node:path');
type Net = typeof import('node:net');
const RUN_ID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const RUNTIME_FILES = ['connection.json', 'owner.json', 'nand-browser.cjs', 'USAGE.md'];

export function privateDirectory(fs: Fs, directory: string): void {
	fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
	const stat = fs.lstatSync(directory);
	if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe browser runtime directory');
}

/** Only remove known transient files. Existing agent attachments keep their original paths. */
export function removeBrowserRun(fs: Fs, path: Paths, directory: string, endpoint: string, windows: boolean): void {
	try {
		const stat = fs.lstatSync(directory);
		if (!stat.isDirectory() || stat.isSymbolicLink()) return;
		for (const name of RUNTIME_FILES) {
			try {
				const file = path.join(directory, name);
				if (fs.lstatSync(file).isFile()) fs.unlinkSync(file);
			} catch { /* Missing files are expected during startup and repeated teardown. */ }
		}
	} catch { /* The directory may not have been created. */ }
	if (!windows) {
		try { if (fs.lstatSync(endpoint).isSocket()) fs.unlinkSync(endpoint); } catch { /* Already closed. */ }
	}
	try { fs.rmdirSync(directory); } catch { /* Keep other attachments or unknown user files. */ }
}

function unusedEndpoint(net: Net, endpoint: string): Promise<boolean> {
	return new Promise(resolve => {
		const socket = net.createConnection(endpoint);
		const finish = (unused: boolean) => { socket.destroy(); resolve(unused); };
		socket.once('connect', () => finish(false));
		socket.once('error', (error: { code?: string }) => finish(error.code === 'ENOENT' || error.code === 'ECONNREFUSED'));
		socket.setTimeout(200, () => finish(false)); // An uncertain endpoint is never deleted.
	});
}

/** Crash recovery is scoped to this Vault; no global /tmp sweeps or recursive deletion. */
export async function sweepBrowserRuns(
	fs: Fs, path: Paths, net: Net, process: typeof import('node:process'),
	root: string, temporary: string,
): Promise<void> {
	privateDirectory(fs, root);
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.isSymbolicLink() || !RUN_ID.test(entry.name)) continue;
		const directory = path.join(root, entry.name);
		try {
			const stat = fs.lstatSync(directory);
			if (stat.isSymbolicLink()) continue;
			let deadOwner = false;
			try {
				const ownerPath = path.join(directory, 'owner.json');
				if (!fs.lstatSync(ownerPath).isFile()) continue;
				const owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8')) as { pid?: unknown };
				if (typeof owner.pid === 'number' && Number.isSafeInteger(owner.pid) && owner.pid > 0) {
					try { process.kill(owner.pid, 0); continue; }
					catch (error) {
						if ((error as { code?: string }).code !== 'ESRCH') continue;
						deadOwner = true;
					}
				}
			} catch { /* Older runs have no owner record. Give startup a grace period. */ }
			if (!deadOwner && Date.now() - stat.mtimeMs < 120000) continue;
			const windows = process.platform === 'win32';
			const endpoint = windows ? `\\\\.\\pipe\\nand-browser-${entry.name}` : path.join(temporary, `nand-browser-${entry.name}.sock`);
			if (await unusedEndpoint(net, endpoint)) removeBrowserRun(fs, path, directory, endpoint, windows);
		} catch { /* Races or uncertain ownership must leave the other run untouched. */ }
	}
}
