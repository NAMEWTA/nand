import { anniversaryDateThisYear, formatElapsed, parseAnniversaryDate } from '../../core/anniversaries/calendar';
import { civilDate } from '../../core/anniversaries/civil-date';
import { resolveWidgetLabel } from '../../core/board/default-widget-label';
import type { AnniversaryConfig } from '../../core/board/types';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { useWindowClock } from './use-window-clock';
import { useLunarLookup } from './use-lunar-lookup';
export function AnniversaryPanel({ config, win, edit }: { config: AnniversaryConfig; win: Window; edit?: () => void }) {
	const now = useWindowClock(win);
	const start = parseAnniversaryDate(config.startDate);
	const lunar = config.calendar === 'lunar';
	const { lookup, failed } = useLunarLookup(lunar);
	let date = '';
	if (!start) date = t('anniversary.invalidDate');
	else if (lunar && !lookup) date = t(failed ? 'anniversary.conversionError' : 'anniversary.loading');
	else {
		try { date = civilDate(anniversaryDateThisYear(start, now, config.calendar, lookup)); }
		catch { date = t('anniversary.conversionError'); }
	}
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
				{date}
			</div>
		</>
	);
}
