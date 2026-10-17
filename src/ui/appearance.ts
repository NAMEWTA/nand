export type NandFont = 'geist' | 'host';
export type NandPalette = 'host' | 'orca';
export interface NandAppearance { font: NandFont; palette: NandPalette }

/** Body attributes the NAND colour and font tokens (`ui/styles/tokens.css`) are selected by. */
export const PALETTE_ATTRIBUTE = 'data-nand-palette';
export const FONT_ATTRIBUTE = 'data-nand-font';

export function applyAppearance(doc: Document, appearance: NandAppearance): void {
	doc.body.setAttribute(PALETTE_ATTRIBUTE, appearance.palette);
	doc.body.setAttribute(FONT_ATTRIBUTE, appearance.font);
}

export function clearAppearance(doc: Document): void {
	doc.body.removeAttribute(PALETTE_ATTRIBUTE);
	doc.body.removeAttribute(FONT_ATTRIBUTE);
}
