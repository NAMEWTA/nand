import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CountdownConfig } from '../../../core/dashboard/types';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { useWindowClock } from './use-window-clock';
export interface CountdownPanelProps {
	config: CountdownConfig;
	win: Window;
	edit?: () => void;
}
function CountdownValue({ value, win }: { value: number; win: Window }) {
	const previous = useRef(value);
	const [flipping, setFlipping] = useState(false);
	useLayoutEffect(() => {
		if (previous.current === value) return;
		previous.current = value;
		setFlipping(true);
		const timer = win.setTimeout(() => setFlipping(false), 400);
		return () => win.clearTimeout(timer);
	}, [value, win]);
	return (
		<div class={`dashboard-sidebar-countdown-value${flipping ? ' dashboard-sidebar-countdown-value--flip' : ''}`}>
			{value}
		</div>
	);
}
export function CountdownPanel({ config, win, edit }: CountdownPanelProps) {
	const now = useWindowClock(win);
	const target = config.targetDate
		? new Date(config.targetDate.includes('T') ? config.targetDate : config.targetDate + 'T00:00:00')
		: null;
	const valid = target && Number.isFinite(target.getTime());
	const mode = config.displayMode;
	const value = valid
		? Math.ceil(
				(target.getTime() - now.getTime()) /
					(mode === 'minutes' ? 60_000 : mode === 'hours' ? 3_600_000 : 86_400_000),
			)
		: 0;
	return (
		<>
			{edit && (
				<button
					class="dashboard-sidebar-countdown-settings-btn"
					aria-label={t('countdown.settingsTitle')}
					onClick={(e) => {
						e.stopPropagation();
						edit();
					}}
				>
					<Icon name="settings" />
				</button>
			)}
			<div class="dashboard-sidebar-countdown-content">
				{!valid ? (
					<div class="dashboard-sidebar-countdown-placeholder">{t('countdown.setTarget')}</div>
				) : (
					<>
						{config.label && (
							<div class="dashboard-sidebar-countdown-until">
								{t('countdown.untilLabel', { label: config.label })}
							</div>
						)}
						{value <= 0 ? (
							<div class="dashboard-sidebar-countdown-expired">{t('countdown.expired')}</div>
						) : (
							<div class="dashboard-sidebar-countdown-flip">
								<CountdownValue value={value} win={win} />
								<div class="dashboard-sidebar-countdown-unit">
									{t(
										mode === 'minutes'
											? 'countdown.minutes'
											: mode === 'hours'
												? 'countdown.hours'
												: 'countdown.days',
									)}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</>
	);
}
