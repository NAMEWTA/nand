import { relativeAttachmentPath } from './path-policy';

function encodeSegment(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Standard relative Markdown only. Wiki links belong to the native link adapter. */
export function attachmentMarkdownLink(
	notePath: string,
	attachmentPath: string,
	options: { readonly embed: boolean; readonly label?: string },
): string {
	const destination = relativeAttachmentPath(notePath, attachmentPath).split('/').map(encodeSegment).join('/');
	const label = (options.label ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ')
		.replace(/[\\`*_[\]{}<>]/g, '\\$&');
	return `${options.embed ? '!' : ''}[${label}](${destination})`;
}
