import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
export function ReadingMiniPanel({ elapsed, stop }: { elapsed: number; stop: () => void }) {
	const hours = Math.floor(elapsed / 3600),
		minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0'),
		seconds = String(elapsed % 60).padStart(2, '0');
	return (
		<>
			<Icon className="dashboard-reading-mini-icon" name="book-open" />
			<div class="dashboard-reading-mini-time" style={{ width: '8ch' }}>
				{hours > 0 ? `${hours}:` : ''}
				{minutes}:{seconds}
			</div>
			<div
				class="dashboard-reading-mini-btn"
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
			</div>
		</>
	);
}
