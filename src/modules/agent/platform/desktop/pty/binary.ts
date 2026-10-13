import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { setTimeout as scheduleTimeout, clearTimeout as cancelTimeout } from 'node:timers';
import { requestUrl, type RequestUrlResponse } from 'obsidian';
import * as path from 'node:path';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { secureOwnedDirectory } from '../../../../../host/desktop/owned-permissions';
import type { ProtectedReceipt } from '../../../../../host/desktop/protected-receipt';

/** Release that publishes the native helper next to the plugin files. */
export const RELEASE_BASE = 'https://github.com/NAMEWTA/nand/releases/download';
const DIGEST_LIMIT = 4096;
const REQUEST_TIMEOUT = 60_000;
const STAMP = 'nand-pty.json';
const installations = new Map<string, Promise<string>>();

export type BinaryErrorCode = 'unsupported' | 'offlineMissing' | 'http' | 'network' | 'redirects' | 'timeout' | 'tooLarge' | 'checksumMissing' | 'checksumMismatch' | 'inUse';

export class BinaryError extends Error {
	constructor(readonly code: BinaryErrorCode, message: string, readonly detail?: { status?: number; url?: string; version?: string }) {
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

/** Use the host network stack, including its proxy handling. Never expose redirected URLs. */
export async function downloadHelperBytes(url: string, limit: number, timeout = REQUEST_TIMEOUT): Promise<Buffer> {
	const original = new URL(url);
	original.username = '';
	original.password = '';
	original.search = '';
	original.hash = '';
	const safeUrl = original.toString();
	const failure = (code: BinaryErrorCode, message: string, status?: number) =>
		new BinaryError(code, message + ': ' + safeUrl, { url: safeUrl, status });
	let timer: ReturnType<typeof scheduleTimeout> | undefined;
	try {
		const response = await Promise.race([
			requestUrl({ url, headers: { 'User-Agent': 'NAND' }, throw: false }),
			new Promise<RequestUrlResponse>((_resolve, reject) => {
				timer = scheduleTimeout(() => reject(failure('timeout', 'Timed out downloading the terminal helper')), timeout);
			}),
		]);
		if (response.status !== 200) throw failure('http', 'HTTP ' + response.status, response.status);
		if (response.arrayBuffer.byteLength > limit) throw failure('tooLarge', 'The terminal helper download is too large');
		return Buffer.from(response.arrayBuffer);
	} catch (error) {
		if (error instanceof BinaryError) throw error;
		const message = error instanceof Error ? error.message : '';
		if (message.includes('ERR_TIMED_OUT')) throw failure('timeout', 'Timed out downloading the terminal helper');
		if (message.includes('ERR_TOO_MANY_REDIRECTS')) throw failure('redirects', 'Too many redirects downloading the terminal helper');
		throw failure('network', 'Network error downloading the terminal helper');
	} finally { if (timer) cancelTimeout(timer); }
}

interface Stamp {
	context: string;
	version: string;
	sha256: string;
	source: 'release' | 'development';
}

function readStamp(dir: string, receipt?: ProtectedReceipt): Stamp | null {
	try {
		const envelope = JSON.parse(fs.readFileSync(path.join(dir, STAMP), 'utf8')) as { proof?: unknown };
		if (!receipt || typeof envelope.proof !== 'string') return null;
		const value = JSON.parse(receipt.open(envelope.proof)) as Partial<Stamp>;
		return typeof value.context === 'string' && typeof value.version === 'string' && typeof value.sha256 === 'string' && (value.source === 'release' || value.source === 'development') ? { context: value.context, version: value.version, sha256: value.sha256, source: value.source } : null;
	} catch {
		return null;
	}
}

export interface InstallOptions {
	receipt?: ProtectedReceipt;
	/** Opened vault and its initialized local device identity. */
	vault: string;
	device: string;
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
 * matches the digest published for this plugin version. Offline use requires a verified receipt;
 * each version has its own path so an upgrade never replaces a running older executable.
 */
export async function ensureHelper(options: InstallOptions): Promise<string> {
	const root = await absoluteNandPath(options.vault, `.nand/helpers/${options.device}`);
	const key = JSON.stringify([root, options.version, options.platform ?? process.platform, options.arch ?? process.arch]);
	const operation = (installations.get(key) ?? Promise.resolve()).catch(() => {}).then(() => installHelper(options));
	installations.set(key, operation);
	try { return await operation; } finally { if (installations.get(key) === operation) installations.delete(key); }
}

async function installHelper(options: InstallOptions): Promise<string> {
	const local = process.env.NAND_PTY_BINARY;
	const platform = options.platform ?? process.platform, arch = options.arch ?? process.arch;
	const name = assetName(platform, arch);
	if (!name) throw new BinaryError('unsupported', 'No terminal helper is published for this platform');
	if (!/^\d+\.\d+\.\d+(?:-[a-z\d.-]+)?$/i.test(options.version)) throw new BinaryError('unsupported', 'Invalid terminal helper version');
	await secureOwnedDirectory(options.vault, `.nand/helpers/${options.device}`);
	const relative = `.nand/helpers/${options.device}/${platform}-${arch}/${options.version}`;
	const dir = await absoluteNandPath(options.vault, relative), file = await absoluteNandPath(options.vault, relative + '/' + name);
	await absoluteNandPath(options.vault, relative + '/' + STAMP);
	const localBytes = local ? fs.readFileSync(local) : undefined, source = localBytes ? 'development' : 'release';
	const localDigest = localBytes ? createHash('sha256').update(localBytes).digest('hex') : undefined;
	const exists = fs.existsSync(file);
	const context = JSON.stringify([dir, name]);
	const stamp = readStamp(dir, options.receipt);
	const verified = exists && stamp?.context === context && stamp.version === options.version && stamp.source === source && sha256(file) === stamp.sha256 && (!localDigest || stamp.sha256 === localDigest);
	const ready = () => {
		if (process.platform !== 'win32') fs.chmodSync(file, 0o700);
		return file;
	};
	if (options.offline) {
		if (!verified) throw new BinaryError('offlineMissing', 'Offline mode requires a verified terminal helper for this version');
		return ready();
	}
	if (verified) return ready();

	const fetch = async (url: string, limit: number) => {
		try { return await (options.fetch ?? downloadHelperBytes)(url, limit); }
		catch (error) {
			if (error instanceof BinaryError) {
				throw new BinaryError(error.code, error.message, { ...error.detail, url, version: options.version });
			}
			throw new BinaryError('network', `Network error downloading ${url}`, { url, version: options.version });
		}
	};
	const base = `${RELEASE_BASE}/${encodeURIComponent(options.version)}/${name}`;
	options.progress?.('downloading');
	const digest = localDigest ?? parseDigest((await fetch(`${base}.sha256`, DIGEST_LIMIT)).toString('utf8'));
	if (!digest) throw new BinaryError('checksumMissing', 'The published terminal helper checksum is missing or invalid');
	await nativeVaultStorage(options.vault).mkdir(relative);
	await absoluteNandPath(options.vault, relative + '/' + name);
	const remember = async () => {
		await absoluteNandPath(options.vault, relative + '/' + STAMP);
		const proof = options.receipt?.seal(JSON.stringify({ context, version: options.version, sha256: digest, source }));
		fs.writeFileSync(path.join(dir, STAMP), JSON.stringify({ proof: proof ?? null }), { mode: 0o600 });
	};
	// A matching file placed by hand (same release) is accepted without downloading again.
	if (exists && sha256(file) === digest) {
		await remember();
		return ready();
	}
	const retained = await absoluteNandPath(options.vault, `.nand/helpers/${options.device}/legacy-plugin/files/${name}`);
	const retainedBytes = !localBytes && fs.existsSync(retained) && fs.lstatSync(retained).isFile() && fs.statSync(retained).size <= 256 * 1024 * 1024 ? fs.readFileSync(retained) : undefined;
	// Legacy stamps are not execution proofs. Reuse the retained bytes only after the official digest matches.
	const bytes = localBytes ?? (retainedBytes && createHash('sha256').update(retainedBytes).digest('hex') === digest ? retainedBytes : await fetch(base, 256 * 1024 * 1024));
	options.progress?.('verifying');
	if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new BinaryError('checksumMismatch', 'The downloaded terminal helper does not match its checksum; the previous file was kept');
	await absoluteNandPath(options.vault, relative + '/' + name);
	const temporary = `${file}.download-${crypto.randomUUID()}`;
	fs.writeFileSync(temporary, bytes, { mode: 0o700, flag: 'wx' });
	try {
		fs.renameSync(temporary, file);
	} catch (error) {
		fs.rmSync(temporary, { force: true });
		throw new BinaryError('inUse', `The terminal helper could not be replaced: ${error instanceof Error ? error.message : String(error)}`);
	}
	await remember();
	return ready();
}
