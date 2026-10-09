import { requestUrl } from 'obsidian';
import type { NewsSource } from '../core/model';

export interface NewsFetchResult { status: number; text: string; etag?: string; lastModified?: string; }
export interface NewsFetcher { fetch(source: NewsSource, headers?: Record<string, string>): Promise<NewsFetchResult>; }
const header = (headers: Record<string, string> | undefined, name: string): string | undefined => {
	if (!headers) return undefined;
	const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
	return key ? headers[key] : undefined;
};
export const requestNews: NewsFetcher = {
	async fetch(source, headers) {
		const response = await requestUrl({ url: source.url, headers: { accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/html;q=0.8', ...headers } });
		return { status: response.status, text: response.text, etag: header(response.headers, 'etag'), lastModified: header(response.headers, 'last-modified') };
	},
};
