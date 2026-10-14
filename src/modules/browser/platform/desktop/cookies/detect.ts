// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/browser/browser-cookie-detection-types.ts
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { DetectedBrowser } from '../../../core/cookies';
interface ChromiumBrowserDef {
	family: string;
	label: string;
	keychainService: string;
	keychainAccount: string;
	macRoot?: string;
	winRoot?: string;
	linuxRoot?: string;
}
export const CHROMIUM_BROWSERS: ChromiumBrowserDef[] = [
	{
		family: 'chrome',
		label: 'Google Chrome',
		keychainService: 'Chrome Safe Storage',
		keychainAccount: 'Chrome',
		macRoot: 'Google/Chrome',
		winRoot: 'Google/Chrome/User Data',
		linuxRoot: 'google-chrome',
	},
	{
		family: 'edge',
		label: 'Microsoft Edge',
		keychainService: 'Microsoft Edge Safe Storage',
		keychainAccount: 'Microsoft Edge',
		macRoot: 'Microsoft Edge',
		winRoot: 'Microsoft/Edge/User Data',
		linuxRoot: 'microsoft-edge',
	},
	{
		family: 'arc',
		label: 'Arc',
		keychainService: 'Arc Safe Storage',
		keychainAccount: 'Arc',
		macRoot: 'Arc/User Data',
	},
	{
		family: 'brave',
		label: 'Brave',
		keychainService: 'Brave Safe Storage',
		keychainAccount: 'Brave',
		macRoot: 'BraveSoftware/Brave-Browser',
		winRoot: 'BraveSoftware/Brave-Browser/User Data',
		linuxRoot: 'BraveSoftware/Brave-Browser',
	},
	{
		family: 'comet',
		label: 'Comet',
		keychainService: 'Comet Safe Storage',
		keychainAccount: 'Comet',
		macRoot: 'Comet',
		winRoot: 'Perplexity/Comet/User Data',
		// linuxRoot intentionally omitted — Comet does not ship a Linux build as of 2026-05-15
	},
	{
		family: 'helium',
		// Why: Helium breaks the '<Browser> Safe Storage' convention — its Keychain service is literally 'Helium Storage Key'.
		label: 'Helium',
		keychainService: 'Helium Storage Key',
		keychainAccount: 'Helium',
		macRoot: 'net.imput.helium',
		// winRoot/linuxRoot intentionally omitted — only the macOS install is verified
	},
	{
		family: 'chromium',
		label: 'Chromium',
		keychainService: 'Chromium Safe Storage',
		keychainAccount: 'Chromium',
		macRoot: 'Chromium',
		winRoot: 'Chromium/User Data',
		linuxRoot: 'chromium',
	},
];

export function browserRootPath(def: ChromiumBrowserDef): string | undefined {
	if (process.platform === 'darwin')
		return def.macRoot ? join(homedir(), 'Library', 'Application Support', def.macRoot) : undefined;
	if (process.platform === 'win32')
		return def.winRoot && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, def.winRoot) : undefined;
	return def.linuxRoot ? join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), def.linuxRoot) : undefined;
}
async function exists(path: string): Promise<boolean> {
	try {
		return (await fs.stat(path)).isFile();
	} catch {
		return false;
	}
}
export async function detectBrowsers(): Promise<DetectedBrowser[]> {
	const found: DetectedBrowser[] = [];
	for (const def of CHROMIUM_BROWSERS) {
		const root = browserRootPath(def);
		if (!root) continue;
		try {
			const entries = await fs.readdir(root, { withFileTypes: true });
			let labels: Record<string, { name?: string }> = {};
			try {
				labels =
					(
						JSON.parse(await fs.readFile(join(root, 'Local State'), 'utf8')) as {
							profile?: { info_cache?: typeof labels };
						}
					).profile?.info_cache ?? {};
			} catch {
				/* Optional labels. */
			}
			const profiles: DetectedBrowser['profiles'] = [];
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const directory = join(root, entry.name);
				for (const path of [join(directory, 'Network', 'Cookies'), join(directory, 'Cookies')]) {
					if (await exists(path)) {
						profiles.push({ name: labels[entry.name]?.name || entry.name, directory, cookiesPath: path });
						break;
					}
				}
			}
			if (profiles.length) found.push({ ...def, root, kind: 'chromium', profiles });
		} catch {
			/* Browser not installed or not readable. */
		}
	}
	const root =
		process.platform === 'darwin'
			? join(homedir(), 'Library', 'Application Support', 'Firefox')
			: process.platform === 'win32'
				? process.env.APPDATA
					? join(process.env.APPDATA, 'Mozilla', 'Firefox')
					: ''
				: join(homedir(), '.mozilla', 'firefox');
	if (root)
		try {
			const ini = await fs.readFile(join(root, 'profiles.ini'), 'utf8');
			const profiles: DetectedBrowser['profiles'] = [];
			for (const section of ini.split(/\r?\n(?=\[)/)) {
				if (!/^\[Profile/.test(section)) continue;
				const values = Object.fromEntries(
					section.split(/\r?\n/).flatMap((line) => {
						const i = line.indexOf('=');
						return i > 0 ? [[line.slice(0, i), line.slice(i + 1)]] : [];
					}),
				);
				if (!values.Path) continue;
				const directory = values.IsRelative === '0' ? resolve(values.Path) : resolve(root, values.Path),
					cookiesPath = join(directory, 'cookies.sqlite');
				if (await exists(cookiesPath))
					profiles.push({ name: values.Name || values.Path, directory, cookiesPath });
			}
			if (profiles.length) found.push({ family: 'firefox', label: 'Firefox', root, kind: 'firefox', profiles });
		} catch {
			/* Firefox not installed. */
		}
	return found;
}
