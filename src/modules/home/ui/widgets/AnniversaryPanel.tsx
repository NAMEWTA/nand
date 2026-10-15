// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/anniversary-widget.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { widgetClasses } from '../theme/widget-classes';
import { formatElapsed, parseAnniversaryDate } from '../../core/anniversaries/calendar';
import { civilDate } from '../../core/anniversaries/civil-date';
import { resolveWidgetLabel } from '../../core/board/default-widget-label';
import type { AnniversaryConfig } from '../../core/board/types';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { useWindowClock } from './use-record-clock';
import { useLunarLookup } from './use-record-lunar';
export function AnniversaryPanel({ config, win, edit }: { config: AnniversaryConfig; win: Window; edit?: () => void }) {
	const now = useWindowClock(win);
	const start = parseAnniversaryDate(config.startDate);
	const lunar = config.calendar === 'lunar';
	const { lookup, failed } = useLunarLookup(lunar);
	let date = '';
	if (!start) date = t('anniversary.invalidDate');
	else if (lunar && !lookup) date = t(failed ? 'anniversary.conversionError' : 'anniversary.loading');
	else {
		try {
			const solar = civilDate(start);
			date =
				lunar && lookup
					? t('anniversary.lunarWithSolar', {
							lunar: t('anniversary.lunarDateValue', lookup.displayDate(solar)),
							solar,
						})
					: solar;
		} catch {
			date = t('anniversary.conversionError');
		}
	}
	return (
		<>
			{edit && (
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-widget-cfg-btn')}
					aria-label={t('anniversary.editTitle')}
					onClick={(e) => {
						e.stopPropagation();
						edit();
					}}
				>
					<Icon name="settings" />
				</Button>
			)}
			<div className={widgetClasses('dashboard-sidebar-anniversary-title')}>
				{resolveWidgetLabel(config, 'anniversary') || t('anniversary.unnamed')}
			</div>
			<div className={widgetClasses('dashboard-sidebar-anniversary-value')}>
				{start ? formatElapsed(start, now, config.precision) : '--'}
			</div>
			<div className={widgetClasses('dashboard-sidebar-anniversary-date')}>{date}</div>
		</>
	);
}
