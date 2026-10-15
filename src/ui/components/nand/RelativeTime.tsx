import { useEffect, useState } from 'react';
import { useLanguage, useOwnerWindow } from '../../react/hooks';
import { useVisible } from '../../react/contexts';
export function RelativeTime({ value, className }: { value: number | string | Date; className?: string }) {
	const language = useLanguage();
	const win = useOwnerWindow();
	const visible = useVisible();
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (!visible) return;
		const timer = win.setInterval(() => setNow(Date.now()), 30_000);
		return () => win.clearInterval(timer);
	}, [visible, win]);
	const date = new Date(value);
	const delta = (date.getTime() - now) / 1000;
	if (!Number.isFinite(delta)) return null;
	const [unit, seconds]: [Intl.RelativeTimeFormatUnit, number] =
		Math.abs(delta) < 60
			? ['second', 1]
			: Math.abs(delta) < 3600
				? ['minute', 60]
				: Math.abs(delta) < 86400
					? ['hour', 3600]
					: ['day', 86400];
	return (
		<time dateTime={date.toISOString()} title={date.toLocaleString(language)} className={className}>
			{new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(Math.round(delta / seconds), unit)}
		</time>
	);
}
