import type { BoardLayout } from './types/model';

export function boardLayout(value: unknown): BoardLayout | undefined {
	return value === 'side' || value === 'stacked' || value === 'immersive' ? value : undefined;
}

/** A phone's presentation never changes the board's saved choice. */
export function effectiveBoardLayout(saved: unknown, historical: unknown, phone = false): BoardLayout {
	if (phone) return 'side';
	return boardLayout(saved) ?? (historical === 'side' ? 'side' : 'stacked');
}
