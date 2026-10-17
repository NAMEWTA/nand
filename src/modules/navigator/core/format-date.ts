// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Date text for a list row. `pattern` uses YYYY, MM, DD, HH and mm; with no pattern a note changed today
 * shows its time and any other note a short locale date.
 */
export function formatNoteDate(time: number, now: number, pattern: string, locale?: string): string {
	const date = new Date(time);
	if (pattern) {
		return pattern.replace(/YYYY|MM|DD|HH|mm/g, (token) => {
			switch (token) {
				case 'YYYY': return String(date.getFullYear());
				case 'MM': return pad(date.getMonth() + 1);
				case 'DD': return pad(date.getDate());
				case 'HH': return pad(date.getHours());
				default: return pad(date.getMinutes());
			}
		});
	}
	const today = new Date(now);
	const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
	if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return date.toLocaleDateString(locale, { year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric', month: 'short', day: 'numeric' });
}
