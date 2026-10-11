export * from './obsidian-stub';
export let responses: unknown[] = [];
export let calls: { url: string; headers?: Record<string, string> }[] = [];
export let audioCalls: string[] = [];
export let coverCalls: string[] = [];
export function resetNetwork(next: unknown[]): void {
	responses = [...next];
	calls = [];
	audioCalls = [];
	coverCalls = [];
}
export async function requestUrl(options: {
	url: string;
	headers?: Record<string, string>;
}): Promise<{ json?: unknown; arrayBuffer?: ArrayBuffer; headers?: Record<string, string> }> {
	if (options.url.startsWith('https://m.music.126.net/')) { audioCalls.push(options.url); return { arrayBuffer: new Uint8Array(new TextEncoder().encode('audio-fixture')).buffer }; }
	if (options.url.startsWith('https://p.music.126.net/')) { coverCalls.push(options.url); return { arrayBuffer: new Uint8Array(new TextEncoder().encode('cover-fixture')).buffer, headers: { 'content-type': 'image/png' } }; }
	calls = [...calls, options];
	if (!responses.length) throw new Error('Unexpected request');
	return { json: responses.shift() };
}
