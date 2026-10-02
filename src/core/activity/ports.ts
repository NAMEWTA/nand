import type { DashboardSettings } from '../dashboard/types/model';

/** Host effects for timer domains; no Obsidian, DOM or audio dependency. */
export interface ActivityHost {
	settings: DashboardSettings;
	saveSettings(): Promise<void>;
	notify(message: string): void;
	chime(frequency: number): void;
	setInterval(callback: () => void, milliseconds: number): number;
	clearInterval(handle: number): void;
}
