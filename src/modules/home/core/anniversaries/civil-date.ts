/** Local civil day, without converting it through UTC. */
export function civilDate(date: Date): string {
	return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validCivilDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day || month > 12) return false;
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

/** Editing the calendar day must retain an existing time and offset byte for byte. */
export function replaceCivilDate(start: string, day: string): string {
	const at = start.indexOf('T');
	return day + (at < 0 ? '' : start.slice(at));
}
