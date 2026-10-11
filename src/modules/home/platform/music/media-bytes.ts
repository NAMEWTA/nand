import { requestUrl } from 'obsidian';

/** Host-rendered media uses native request bytes, so Chromium's default session never caches it. */
export async function musicMediaBlob(url: string, fallbackType: string): Promise<Blob> {
	const target = new URL(url);
	if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid media URL');
	const response = await requestUrl({ url: target.href });
	return new Blob([response.arrayBuffer], { type: response.headers?.['content-type'] ?? fallbackType });
}
