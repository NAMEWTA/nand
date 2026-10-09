import type { ContextMaterial } from './session-api';

export function cleanContextText(text: string): string {
	return [...text]
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code === 10 || code === 9 || (code >= 32 && code !== 127 && (code < 128 || code > 159));
		})
		.join('');
}
export function formatContextMaterials(materials: readonly ContextMaterial[]): string {
	return cleanContextText(
		materials
			.map((material) =>
				[material.title, material.source, material.text, ...(material.files ?? [])].filter(Boolean).join('\n'),
			)
			.join('\n\n'),
	).slice(0, 64000);
}
