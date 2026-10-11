/** Rewrite actual Markdown destinations, leaving fenced and inline code untouched. */
export function rewriteContentLinks(text: string, destination: (link: string) => string | undefined): string {
	let fence = '';
	return text.split(/(\r?\n)/).map(line => {
		const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
		if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ''; return line; }
		if (fence) return line;
		const definition = /^(\s{0,3}\[[^\]]+\]:\s*)(<[^>]+>|\S+)(.*)$/.exec(line);
		if (definition) {
			const raw = definition[2]!, next = destination(raw.startsWith('<') ? raw.slice(1, -1) : raw);
			return next === undefined ? line : definition[1]! + '<' + next + '>' + definition[3]!;
		}
		return line.split(/(`+[^`]*`+)/g).map(part => part.startsWith('`') ? part : part.replace(/\[\[([^\]]+)\]\]|(\]\()(<[^>]+>|[^\s)]+)([^)]*\))/g, (match: string, wiki: string | undefined, prefix: string | undefined, url: string | undefined, suffix: string | undefined) => {
			if (wiki !== undefined) {
				const separator = wiki.indexOf('|'), link = separator < 0 ? wiki : wiki.slice(0, separator), label = separator < 0 ? '' : wiki.slice(separator);
				const next = destination(link); return next === undefined ? match : `[[${next}${label}]]`;
			}
			const link = url!.startsWith('<') ? url!.slice(1, -1) : url!;
			const next = destination(link); return next === undefined ? match : prefix! + '<' + next + '>' + suffix!;
		})).join('');
	}).join('');
}
