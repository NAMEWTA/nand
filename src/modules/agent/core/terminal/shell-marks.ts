/**
 * Shell-integration sequences (public conventions): OSC 133 prompt marks (FinalTerm), OSC 633 (the
 * VS Code variant, including `P;Cwd=`) and OSC 7 working-directory reports.
 */

export type ShellMark =
	| { kind: 'prompt-start' }
	| { kind: 'command-start' }
	| { kind: 'command-executed' }
	| { kind: 'command-finished'; exitCode?: number }
	| { kind: 'cwd'; cwd: string };

function mark(letter: string, rest: string[]): ShellMark | undefined {
	switch (letter) {
		case 'A':
			return { kind: 'prompt-start' };
		case 'B':
			return { kind: 'command-start' };
		case 'C':
			return { kind: 'command-executed' };
		case 'D': {
			const code = rest[0] !== undefined && /^-?\d+$/.test(rest[0]) ? Number(rest[0]) : undefined;
			return code === undefined ? { kind: 'command-finished' } : { kind: 'command-finished', exitCode: code };
		}
	}
	return undefined;
}

/** Payload of OSC 133 (without the `133;` prefix). */
export function parseOsc133(data: string): ShellMark | undefined {
	const [letter = '', ...rest] = data.split(';');
	return mark(letter, rest);
}

/** Payload of OSC 633 (without the `633;` prefix). */
export function parseOsc633(data: string): ShellMark | undefined {
	const [letter = '', ...rest] = data.split(';');
	if (letter === 'P') {
		const property = rest.join(';');
		if (property.startsWith('Cwd=')) return { kind: 'cwd', cwd: unescape633(property.slice(4)) };
		return undefined;
	}
	return mark(letter, rest);
}

/** OSC 633 escapes `\` as `\\` and other bytes as `\xAB`. */
function unescape633(value: string): string {
	return value.replace(/\\(\\|x([0-9a-fA-F]{2}))/g, (_, escaped: string, hex?: string) => (hex ? String.fromCharCode(parseInt(hex, 16)) : escaped));
}

/** Payload of OSC 7: `file://host/path` with a percent-encoded path. */
export function parseOsc7(data: string, platform: string): ShellMark | undefined {
	const match = /^file:\/\/([^/]*)(\/.*)?$/.exec(data.trim());
	if (!match) return undefined;
	let path: string;
	try {
		path = decodeURIComponent(match[2] ?? '/');
	} catch {
		return undefined;
	}
	// file:///C:/Users/x on Windows.
	if (platform === 'win32' && /^\/[A-Za-z]:/.test(path)) path = path.slice(1).replace(/\//g, '\\');
	return { kind: 'cwd', cwd: path };
}

export interface CommandRecord {
	/** Buffer line of the prompt. */
	promptLine: number;
	exitCode?: number;
}

/** Prompt lines and command results of one session, for prompt navigation. */
export class PromptHistory {
	private records: CommandRecord[] = [];
	private readonly limit: number;

	constructor(limit = 2000) {
		this.limit = limit;
	}
	prompt(line: number): void {
		const last = this.records[this.records.length - 1];
		if (last && last.promptLine === line) return;
		this.records.push({ promptLine: line });
		if (this.records.length > this.limit) this.records.shift();
	}
	finished(exitCode: number | undefined): void {
		const last = this.records[this.records.length - 1];
		if (last && last.exitCode === undefined) last.exitCode = exitCode;
	}
	/** Lines move up as scrollback is trimmed; drop records that left the buffer. */
	shift(lines: number): void {
		if (!lines) return;
		this.records = this.records.map((record) => ({ ...record, promptLine: record.promptLine - lines })).filter((record) => record.promptLine >= 0);
	}
	clear(): void {
		this.records = [];
	}
	get lines(): readonly number[] {
		return this.records.map((record) => record.promptLine);
	}
	previous(from: number): number | undefined {
		for (let i = this.records.length - 1; i >= 0; i--) if (this.records[i]!.promptLine < from) return this.records[i]!.promptLine;
		return undefined;
	}
	next(from: number): number | undefined {
		return this.records.find((record) => record.promptLine > from)?.promptLine;
	}
	lastFailed(): number | undefined {
		for (let i = this.records.length - 1; i >= 0; i--) {
			const code = this.records[i]!.exitCode;
			if (code !== undefined && code !== 0) return this.records[i]!.promptLine;
		}
		return undefined;
	}
}
