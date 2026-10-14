import type { ImportCookie } from '../../../core/cookies';
import { validateCookie } from './validate';
export function parseCookieFile(text: string): { cookies: ImportCookie[]; skipped: number } {
	const raw = text.trim().startsWith('[')
		? (JSON.parse(text) as unknown)
		: text.split(/\r?\n/).flatMap((line) => {
				if (!line.trim() || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) return [];
				const httpOnly = line.startsWith('#HttpOnly_');
				const fields = line.replace(/^#HttpOnly_/, '').split('\t');
				if (fields.length !== 7) return [null];
				return [
					{
						domain: fields[0],
						hostOnly: fields[1] !== 'TRUE',
						path: fields[2],
						secure: fields[3] === 'TRUE',
						expirationDate: Number(fields[4]),
						name: fields[5],
						value: fields[6],
						httpOnly,
					},
				];
			});
	if (!Array.isArray(raw)) throw new Error('Expected a Cookie JSON array');
	if (raw.length > 50000) throw new Error('Too many Cookies');
	const cookies = raw.map(validateCookie).filter((c): c is ImportCookie => !!c);
	return { cookies, skipped: raw.length - cookies.length };
}
