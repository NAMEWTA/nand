/** Page text must not break bracketed paste or introduce terminal control sequences. */
export function browserAgentMaterial(text: string, files: string[]): string {
	const clean = [...text.slice(0, 20000)]
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code === 10 || code === 9 || (code >= 32 && code !== 127 && (code < 128 || code > 159));
		})
		.join('');
	return `${clean}\n\n${files.join('\n')}`;
}
