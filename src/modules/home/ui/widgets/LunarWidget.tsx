// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/lunar-widget.ts
import { lazy, Suspense, useState, useEffect } from 'react';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import type { BoardStore } from '../../services/board-store';
import { fetchHolidayData, type HolidayInfo } from '../../platform/calendar/holiday-service';
import { LunarPanel } from './LunarPanel';
const FortuneDialog = lazy(() => import('./FortuneDialog').then((m) => ({ default: m.FortuneDialog })));
export function LunarWidget({ store }: { store: BoardStore }) {
	const doc = useOwnerDocument(),
		[open, setOpen] = useState(false),
		[holidays, setHolidays] = useState<Record<string, HolidayInfo>>({});
	useEffect(() => {
		let live = true;
		void fetchHolidayData(store.host.app, new Date().getFullYear()).then((data) => {
			if (live) setHolidays(data);
		});
		return () => {
			live = false;
		};
	}, [store]);
	return (
		<>
			<LunarPanel holidays={holidays} win={doc.defaultView!} fortune={() => setOpen(true)} />
			{open && (
				<Suspense fallback={null}>
					<FortuneDialog onClose={() => setOpen(false)} />
				</Suspense>
			)}
		</>
	);
}
