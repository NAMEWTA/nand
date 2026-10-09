import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';

/** Release that publishes the native helper next to the plugin files. */
export const RELEASE_BASE = 'https://github.com/NAMEWTA/nand/releases/download';
const MAX_REDIRECTS = 5;
const DIGEST_LIMIT = 4096;
const REQUEST_TIMEOUT = 60_000;
const STAMP = 'nand-pty.json';

export type BinaryErrorCode = 'unsupported' | 'offlineMissing' | 'http' | 'redirects' | 'timeout' | 'tooLarge' | 'checksumMissing' | 'checksumMismatch' | 'inUse';

export class BinaryError extends Error {
	constructor(readonly code: BinaryErrorCode, message: string) {
		super(message);
	}
}

/** `nand-pty-<platform>-<arch>[.exe]`, or null where no helper is published. */
export function assetName(platform: string, arch: string): string | null {
	if (platform === 'win32') return arch === 'x64' ? 'nand-pty-win32-x64.exe' : null;
	if ((platform === 'darwin' || platform === 'linux') && (arch === 'x64' || arch === 'arm64')) return `nand-pty-${platform}-${arch}`;
	return null;
}

/** The first token of a `.sha256` file must be a 64-digit hex digest. */
export function parseDigest(text: string): string | null {
	const token = text.trim().split(/\s+/)[0] ?? '';
	return /^[a-f0-9]{64}$/i.test(token) ? token.toLowerCase() : null;
}

function sha256(file: string): string {
	return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function get(url: string, limit: number, redirects = 0): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const request = https.get(url, { headers: { 'User-Agent': 'NAND' } }, (response) => {
			const status = response.statusCode ?? 0;
			if (status >= 300 && status < 400 && response.headers.location) {
				response.resume();
				if (redirects >= MAX_REDIRECTS) return reject(new BinaryError('redirects', 'Too many redirects while downloading the terminal helper'));
				return resolve(get(new URL(response.headers.location, url).toString(), limit, redirects + 1));
			}
			if (status !== 200) {
				response.resume();
				return reject(new BinaryError('http', `HTTP ${status} for ${url}`));
			}
			const chunks: Buffer[] = [];
			let size = 0;
			response.on('data', (chunk: Buffer) => {
				size += chunk.length;
				if (size > limit) {
					request.destroy();
					reject(new BinaryError('tooLarge', `Response from ${url} is too large`));
					return;
				}
				chunks.push(chunk);
			});
			response.on('end', () => resolve(Buffer.concat(chunks)));
			response.on('error', reject);
		});
		request.setTimeout(REQUEST_TIMEOUT, () => {
			request.destroy();
			reject(new BinaryError('timeout', `Timed out downloading ${url}`));
		});
		request.on('error', reject);
	});
}

interface Stamp {
	version: string;
	sha256: string;
}

function readStamp(dir: string): Stamp | null {
	try {
		const value = JSON.parse(fs.readFileSync(path.join(dir, STAMP), 'utf8')) as Partial<Stamp>;
		return typeof value.version === 'string' && typeof value.sha256 === 'string' ? { version: value.version, sha256: value.sha256 } : null;
	} catch {
		return null;
	}
}

export interface InstallOptions {
	/** Absolute plugin folder. */
	pluginDir: string;
	/** Plugin version; the helper comes from the release with the same tag. */
	version: string;
	offline: boolean;
	platform?: string;
	arch?: string;
	/** Download function (tests replace it). */
	fetch?: (url: string, limit: number) => Promise<Buffer>;
	progress?: (state: 'downloading' | 'verifying') => void;
}

/**
 * Path of a usable helper binary, downloading and verifying it when needed. A file is trusted when it
 * matches the digest published for this plugin version (or, offline, when it exists; the protocol
 * handshake still has to accept it).
 */
export async function ensureHelper(options: InstallOptions): Promise<string> {
	// Development and acceptance runs point at a locally built helper; the handshake still checks it.
	const local = process.env.NAND_PTY_BINARY;
	if (local && fs.existsSync(local)) return local;
	const name = assetName(options.platform ?? process.platform, options.arch ?? process.arch);
	if (!name) throw new BinaryError('unsupported', 'No terminal helper is published for this platform');
	const dir = path.join(options.pluginDir, 'binaries');
	const file = path.join(dir, name);
	const exists = fs.existsSync(file);
	if (options.offline) {
		if (!exists) throw new BinaryError('offlineMissing', 'Offline mode is on and no terminal helper is installed');
		return file;
	}
	const stamp = readStamp(dir);
	if (exists && stamp?.version === options.version && sha256(file) === stamp.sha256) return file;

	const fetch = options.fetch ?? get;
	const base = `${RELEASE_BASE}/${encodeURIComponent(options.version)}/${name}`;
	const digest = parseDigest((await fetch(`${base}.sha256`, DIGEST_LIMIT)).toString('utf8'));
	if (!digest) throw new BinaryError('checksumMissing', 'The published terminal helper checksum is missing or invalid');
	fs.mkdirSync(dir, { recursive: true });
	const remember = () => fs.writeFileSync(path.join(dir, STAMP), JSON.stringify({ version: options.version, sha256: digest }));
	// A matching file placed by hand (same release) is accepted without downloading again.
	if (exists && sha256(file) === digest) {
		remember();
		return file;
	}
	options.progress?.('downloading');
	const bytes = await fetch(base, 256 * 1024 * 1024);
	options.progress?.('verifying');
	if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new BinaryError('checksumMismatch', 'The downloaded terminal helper does not match its checksum; the previous file was kept');
	const temporary = `${file}.download`;
	fs.writeFileSync(temporary, bytes, { mode: 0o755 });
	try {
		fs.renameSync(temporary, file);
	} catch (error) {
		fs.rmSync(temporary, { force: true });
		throw new BinaryError('inUse', `The terminal helper could not be replaced: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
	remember();
	return file;
}
