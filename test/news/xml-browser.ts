import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Real XML DOM semantics: linkedom escapes &, < and > in XML getAttribute(). */
export async function opmlInBrowser(expression: string): Promise<unknown> {
	const executable = process.env.CHROME_BIN ?? [
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
	].find(candidate => existsSync(candidate)) ?? 'google-chrome';
	const bundle = await build({ entryPoints: ['src/modules/news/platform/opml.ts'], bundle: true, format: 'iife', globalName: 'NandOpml', write: false });
	const root = mkdtempSync(path.join(tmpdir(), 'nand-news-xml-'));
	try {
		const file = path.join(root, 'page.html');
		writeFileSync(file, '<!doctype html><pre id="out"></pre><script>' + bundle.outputFiles[0]!.text.replace(/<\/script/gi, '<\\/script') + '\ntry { const result = ' + expression + '; document.getElementById("out").textContent = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(result)))); } catch (error) { document.getElementById("out").textContent = "ERROR:" + error.stack; }</script>');
		const response = spawnSync(executable, ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', `--user-data-dir=${path.join(root, 'profile')}`, '--dump-dom', pathToFileURL(file).href], { encoding: 'utf8', timeout: 30_000, windowsHide: true });
		if (response.error) throw response.error;
		const payload = response.stdout.match(/<pre id="out">([^<]*)<\/pre>/)?.[1];
		if (response.status !== 0 || !payload || payload.startsWith('ERROR:')) throw new Error(payload || response.stderr || readFileSync(file, 'utf8'));
		return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as unknown;
	} finally {
		if (path.dirname(path.resolve(root)) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('nand-news-xml-')) throw new Error('Unexpected test fixture path');
		rmSync(root, { recursive: true, force: true });
	}
}
