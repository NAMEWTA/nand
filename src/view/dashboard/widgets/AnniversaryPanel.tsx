import { formatElapsed, parseAnniversaryDate } from '../../../core/anniversaries/calendar';
import type { AnniversaryConfig } from '../../../core/dashboard/types';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { useWindowClock } from './use-window-clock';
export function AnniversaryPanel({ config, win, edit }: { config: AnniversaryConfig; win: Window; edit?: () => void }) {
	const now = useWindowClock(win);
	const start = parseAnniversaryDate(config.startDate);
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
			<div class="dashboard-sidebar-anniversary-title">{config.label || t('anniversary.unnamed')}</div>
			<div class="dashboard-sidebar-anniversary-value">
				{start ? formatElapsed(start, now, config.precision) : '--'}
			</div>
			<div class="dashboard-sidebar-anniversary-date">
				{start ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` : ''}
			</div>
		</>
	);
}
