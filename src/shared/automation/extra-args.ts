// Allowlist adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/shared/automation-extra-agent-args.ts
import { AutomationError } from './errors';

/** One quoting grammar on every platform. Returned tokens are argv, never Shell input. */
export function validatedExtraArgs(agentId: string, text: string): string[] {
	const reject = (argument: string): never => {
		throw new AutomationError('extraArgsRejected', { argument });
	};
	if (new TextEncoder().encode(text).length > 4096) reject(text.slice(0, 80));
	if (
		[...text].some((char) => {
			const code = char.codePointAt(0)!;
			return code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029;
		})
	)
		reject(text);
	const tokens: string[] = [];
	let token = '',
		quote = '',
		started = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i]!;
		if (quote) {
			if (char === quote) quote = '';
			else if (char === '\\' && quote === '"' && ['"', '\\'].includes(text[i + 1] ?? '')) token += text[++i];
			else token += char;
		} else if (char === "'" || char === '"') {
			quote = char;
			started = true;
		} else if (/\s/.test(char)) {
			if (started) {
				tokens.push(token);
				token = '';
				started = false;
			}
		} else if (char === '\\' && text[i + 1] !== undefined) {
			token += text[++i];
			started = true;
		} else {
			token += char;
			started = true;
		}
	}
	if (quote) reject(text);
	if (started) tokens.push(token);
	const result: string[] = [],
		seen = new Set<string>();
	for (let i = 0; i < tokens.length; i++) {
		const raw = tokens[i]!,
			equals = raw.indexOf('=');
		const name = equals < 0 ? raw : raw.slice(0, equals);
		if (
			!['--model', '-m', '--effort', '--reasoning-effort'].includes(name) &&
			!(name === '--add-dir' && agentId === 'claude-code')
		)
			reject(name);
		const value = equals < 0 ? tokens[++i] : raw.slice(equals + 1);
		if (!value || value.startsWith('-') || /[;|&<>`$]/.test(value)) reject(raw);
		const kind = name === '--model' || name === '-m' ? 'model' : name === '--add-dir' ? 'directory' : 'effort';
		if (kind !== 'directory' && seen.has(kind)) reject(name);
		seen.add(kind);
		result.push(name, value!);
	}
	return result;
}
