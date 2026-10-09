import { useEffect, useState } from 'preact/hooks';
import { anniversaryDateThisYear, formatElapsed, parseAnniversaryDate } from '../../core/anniversaries/calendar';
import type { LunarLookup } from '../../core/anniversaries/lunar-map';
import { resolveWidgetLabel } from '../../core/board/default-widget-label';
import type { AnniversaryConfig } from '../../core/board/types';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { useWindowClock } from './use-window-clock';
export function AnniversaryPanel({ config, win, edit }: { config: AnniversaryConfig; win: Window; edit?: () => void }) {
	const now = useWindowClock(win);
	const start = parseAnniversaryDate(config.startDate);
	const [lookup, setLookup] = useState<LunarLookup | undefined>(undefined);
	useEffect(() => {
		if (config.calendar !== 'lunar') return;
		let cancel = false;
		void import('../../platform/calendar/lunar-lookup').then(async ({ createLunarLookup }) => {
			const created = await createLunarLookup();
			if (!cancel) setLookup(created);
		});
		return () => {
			cancel = true;
		};
	}, [config.calendar]);
	const mark = start ? anniversaryDateThisYear(start, now, config.calendar, lookup) : null;
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		<>
			{edit && (
				<button
					class="dashboard-widget-cfg-btn"
					aria-label={t('anniversary.editTitle')}
					onClick={(e) => {
						e.stopPropagation();
						edit();
					}}
				>
					<Icon name="settings" />
				</button>
			)}
			<div class="dashboard-sidebar-anniversary-title">
				{resolveWidgetLabel(config, 'anniversary') || t('anniversary.unnamed')}
			</div>
			<div class="dashboard-sidebar-anniversary-value">
				{start ? formatElapsed(start, now, config.precision) : '--'}
			</div>
			<div class="dashboard-sidebar-anniversary-date">
				{mark ? `${mark.getFullYear()}-${pad(mark.getMonth() + 1)}-${pad(mark.getDate())}` : ''}
			</div>
		</>
	);
}
