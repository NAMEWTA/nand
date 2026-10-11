export const NAND_ROOT = '.nand';

/** One portable namespace. Reject aliases that Windows or POSIX could resolve outside it. */
export function nandPath(...parts: string[]): string {
	return validateNandPath([NAND_ROOT, ...parts].join('/'));
}

export function validateNandPath(value: string): string {
	const path = value.replaceAll('\\', '/');
	const parts = path.split('/');
	if (parts[0] !== NAND_ROOT || parts.some(part => !part || part === '.' || part === '..'
		|| [...part].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || /[<>:"|?*]/.test(part) || /[. ]$/.test(part)
		|| /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('nand-storage.invalid-path');
	return path;
}
