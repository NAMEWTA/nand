/**
 * Git conflict blocks in a text file. Adapted from obsidian-git (src/editor/conflicts, MIT, Copyright (c) 2020
 * Vinzent03, Denis Olehov): `<<<<<<<`, an optional `|||||||` base section (diff3), `=======` and `>>>>>>>`.
 */
export interface ConflictBlock {
	/** Offsets into the text: the block runs from the start of the `<<<<<<<` line to the end of the `>>>>>>>` line. */
	from: number;
	to: number;
	ours: string;
	base?: string;
	theirs: string;
	oursLabel: string;
	theirsLabel: string;
}

export type ConflictChoice = 'ours' | 'theirs' | 'both' | 'base';

const marker = (line: string, char: string) => line.startsWith(char.repeat(7)) && (line.length === 7 || line[7] === ' ');

/** Every complete conflict block, in order. Unclosed or malformed blocks are ignored. */
export function parseConflictBlocks(text: string): ConflictBlock[] {
	const blocks: ConflictBlock[] = [];
	const lines: Array<{ text: string; from: number; to: number }> = [];
	let at = 0;
	while (at <= text.length) {
		const end = text.indexOf('\n', at);
		const stop = end < 0 ? text.length : end;
		lines.push({ text: text.slice(at, stop).replace(/\r$/, ''), from: at, to: end < 0 ? stop : end + 1 });
		if (end < 0) break;
		at = end + 1;
	}
	for (let i = 0; i < lines.length; i++) {
		if (!marker(lines[i]!.text, '<')) continue;
		const start = i;
		let base = -1;
		let middle = -1;
		let close = -1;
		for (let j = i + 1; j < lines.length; j++) {
			const line = lines[j]!.text;
			if (marker(line, '<')) break;
			if (middle < 0 && base < 0 && marker(line, '|')) base = j;
			else if (middle < 0 && marker(line, '=')) middle = j;
			else if (middle >= 0 && marker(line, '>')) {
				close = j;
				break;
			}
		}
		if (middle < 0 || close < 0) continue;
		const join = (from: number, to: number) => lines.slice(from, to).map((line) => text.slice(line.from, line.to)).join('');
		blocks.push({
			from: lines[start]!.from,
			to: lines[close]!.to,
			ours: join(start + 1, base >= 0 ? base : middle),
			base: base >= 0 ? join(base + 1, middle) : undefined,
			theirs: join(middle + 1, close),
			oursLabel: lines[start]!.text.slice(8),
			theirsLabel: lines[close]!.text.slice(8),
		});
		i = close;
	}
	return blocks;
}

/** The text that replaces a block for a choice. */
export function resolveBlock(block: ConflictBlock, choice: ConflictChoice): string {
	if (choice === 'ours') return block.ours;
	if (choice === 'theirs') return block.theirs;
	if (choice === 'base') return block.base ?? '';
	const ours = block.ours && !block.ours.endsWith('\n') ? `${block.ours}\n` : block.ours;
	return ours + block.theirs;
}

/** Whether text still contains a conflict block. */
export function hasConflictBlocks(text: string): boolean {
	return parseConflictBlocks(text).length > 0;
}
