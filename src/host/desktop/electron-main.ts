interface Remote {
	require(name: string): unknown;
	getCurrentWebContents(): { id: number };
	getCurrentWindow(): { focus(): void };
	app: { getPath(name: string): string };
}
export function desktopRemote(win: Window): Remote {
	return win.require('@electron/remote') as Remote;
}
/** Execute bundled policy only. All vault paths and guest data are passed as arguments, never source. */
export function bundledMain<T>(win: Window, source: string): T {
	const vm = desktopRemote(win).require('node:vm') as { runInThisContext(source: string): T };
	return vm.runInThisContext(`(()=>{const require=process.getBuiltinModule('module').createRequire(process.execPath);const exports={};${source}\nreturn exports;})()`);
}
