// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/library-section.ts
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { IconButton } from '../board/controls';
const dateKey = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function DateRangeCalendar({
	start,
	end,
	onChange,
}: {
	start: string;
	end: string;
	onChange(this: void, start: string, end: string): void;
}) {
	const t = useT(),
		[month, setMonth] = useState(() => new Date(start ? start + 'T12:00:00' : Date.now())),
		anchor = useRef<string | null>(null);
	const first = new Date(month.getFullYear(), month.getMonth(), 1),
		offset = (first.getDay() + 6) % 7;
	const choose = (value: string) => {
		if (anchor.current) {
			const pair = [anchor.current, value].sort();
			onChange(pair[0]!, pair[1]!);
		} else {
			anchor.current = value;
			onChange(value, value);
		}
	};
	return (
		<div
			className="grid gap-2"
			onPointerUp={() => {
				anchor.current = null;
			}}
			onPointerCancel={() => {
				anchor.current = null;
			}}
		>
			<div className="flex items-center justify-between">
				<IconButton
					label={t('home.dashboard.previous')}
					onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
				>
					<ChevronLeft />
				</IconButton>
				<span>{month.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</span>
				<IconButton
					label={t('home.dashboard.next')}
					onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
				>
					<ChevronRight />
				</IconButton>
			</div>
			<div className="grid grid-cols-7 gap-1">
				{Array.from({ length: 42 }, (_, i) => {
					const date = new Date(first.getFullYear(), first.getMonth(), i - offset + 1),
						key = dateKey(date);
					return (
						<Button
							key={key}
							variant={key >= start && key <= end ? 'secondary' : 'ghost'}
							size="sm"
							aria-label={key}
							aria-pressed={key >= start && key <= end}
							className={date.getMonth() === month.getMonth() ? 'p-0' : 'p-0 text-muted-foreground'}
							onPointerDown={(e) => {
								e.preventDefault();
								anchor.current = key;
								choose(key);
							}}
							onPointerEnter={(e) => {
								if (e.buttons === 1 && anchor.current) choose(key);
							}}
							onClick={(e) => {
								if (e.detail === 0) {
									if (!start || start !== end) onChange(key, key);
									else {
										const pair = [start, key].sort();
										onChange(pair[0]!, pair[1]!);
									}
								}
							}}
						>
							{date.getDate()}
						</Button>
					);
				})}
			</div>
		</div>
	);
}
