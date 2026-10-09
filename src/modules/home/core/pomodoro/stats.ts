export type PomodoroRangeKey = 'day' | 'week' | 'month' | 'year' | 'all';
export function datesForRange(key: PomodoroRangeKey): {
	curStart: string;
	prevStart: string;
	prevEnd: string;
	dayCount: number;
} {
	const fmt = (d: Date) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	};
	const today = new Date();
	const daysSinceMonday = (today.getDay() + 6) % 7;
	const addDays = (d: Date, n: number) => {
		const r = new Date(d);
		r.setDate(r.getDate() + n);
		return r;
	};
	switch (key) {
		case 'day':
			return {
				curStart: fmt(today),
				prevStart: fmt(addDays(today, -1)),
				prevEnd: fmt(addDays(today, -1)),
				dayCount: 1,
			};
		case 'week': {
			const monday = addDays(today, -daysSinceMonday);
			return {
				curStart: fmt(monday),
				prevStart: fmt(addDays(monday, -7)),
				prevEnd: fmt(addDays(monday, -1)),
				dayCount: 7,
			};
		}
		case 'month': {
			const first = new Date(today.getFullYear(), today.getMonth(), 1);
			const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
			const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
			const dayCount = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
			return { curStart: fmt(first), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), dayCount };
		}
		case 'year': {
			const first = new Date(today.getFullYear(), 0, 1);
			const prevEnd = new Date(today.getFullYear() - 1, 11, 31);
			const prevStart = new Date(today.getFullYear() - 1, 0, 1);
			const dayCount = 365;
			return { curStart: fmt(first), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), dayCount };
		}
		case 'all':
			return { curStart: '0000-01-01', prevStart: '0000-01-01', prevEnd: '0000-01-01', dayCount: 365 };
	}
}
