// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { widgetClasses } from '../theme/widget-classes';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
export function ReadingMiniPanel({ elapsed, stop }: { elapsed: number; stop: () => void }) {
	const hours = Math.floor(elapsed / 3600),
		minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0'),
		seconds = String(elapsed % 60).padStart(2, '0');
	return (
		<>
			<Icon className={widgetClasses('dashboard-reading-mini-icon')} name="book-open" />
			<div className={widgetClasses('dashboard-reading-mini-time')} style={{ width: '8ch' }}>
				{hours > 0 ? `${hours}:` : ''}
				{minutes}:{seconds}
			</div>
			<Button
				variant="ghost"
				className={widgetClasses('dashboard-reading-mini-btn')}
				role="button"
				tabIndex={0}
				aria-label={t('reading.miniStop')}
				title={t('reading.miniStop')}
				onClick={stop}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						stop();
					}
				}}
			>
				<Icon name="square" />
			</Button>
		</>
	);
}
