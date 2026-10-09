/** Material attached to an agent session's input (notes, archive records, browser captures). */
export interface ContextMaterial {
	id: string;
	kind: 'web' | 'element' | 'screenshot' | 'note' | 'archive';
	title: string;
	text: string;
	files?: string[];
	source?: string;
}
