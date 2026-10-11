import { requestUrl } from 'obsidian';
import type { NewsSource } from '../core/model';

export interface NewsFetchResult { status: number; text: string; etag?: string; lastModified?: string; }
export interface NewsFetcher { fetch(source: NewsSource, headers?: Record<string, string>, signal?: AbortSignal): Promise<NewsFetchResult>; }
const header = (headers: Record<string, string> | undefined, name: string): string | undefined => {
	if (!headers) return undefined;
	const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
	return key ? headers[key] : undefined;
};
export const requestNews: NewsFetcher = {
	async fetch(source, headers, signal) {
		if (signal?.aborted) throw new DOMException('News collection stopped', 'AbortError');
		let timer: number | undefined;
		let abort: (() => void) | undefined;
		try {
			const cancelled = new Promise<never>((_resolve, reject) => {
				abort = () => reject(new DOMException('News collection stopped', 'AbortError'));
				signal?.addEventListener('abort', abort, { once: true });
				timer = window.setTimeout(() => reject(new Error('news.timeout')), 60_000);
			});
			const response = await Promise.race([requestUrl({ url: source.url, throw: false, headers: { accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/html;q=0.8', ...headers } }), cancelled]);
			if (response.arrayBuffer.byteLength > 8 * 1024 * 1024) throw new Error('news.tooLarge');
			return { status: response.status, text: response.text, etag: header(response.headers, 'etag'), lastModified: header(response.headers, 'last-modified') };
		} finally {
			if (timer !== undefined) window.clearTimeout(timer);
			if (abort) signal?.removeEventListener('abort', abort);
		}
	},
};
