import { Buffer } from 'node:buffer';

/** A copied command must retain the managed account, even in a host-global shell. */
export function formatResumeCommand(
	request: { cwd: string; file: string; args: readonly string[]; env: Record<string, string> },
	windows: boolean,
): string {
	if (windows) {
		const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
		const script = [
			`Set-Location -LiteralPath ${quote(request.cwd)}`,
			...Object.entries(request.env).map(([key, value]) => `$env:${key}=${quote(value)}`),
			`& ${[request.file, ...request.args].map(quote).join(' ')}`,
		].join('; ');
		// An isolated child PowerShell preserves values and does not alter the caller's environment.
		return `powershell.exe -NoProfile -EncodedCommand ${Buffer.from(script, 'utf16le').toString('base64')}`;
	}
	const quote = (value: string) => "'" + value.replace(/'/g, "'\"'\"'") + "'";
	return `cd -- ${quote(request.cwd)} && env ${[
		...Object.entries(request.env).map(([key, value]) => `${key}=${value}`),
		request.file,
		...request.args,
	]
		.map(quote)
		.join(' ')}`;
}
