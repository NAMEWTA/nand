import { RecordStorage } from '../record-storage';
import { Notice, type App } from 'obsidian';
import { PomodoroApplication } from '../../core/pomodoro/application';
import { playDing, unlockChime } from '../audio/chime';
import type { WidgetSettingsHost } from '../widget-settings-host';
export * from '../../core/pomodoro/application';

/** Native wiring only; state and timer rules live in core. */
export class PomodoroService extends PomodoroApplication {
	private readonly focusDoc: Document;
	private readonly unsubscribe: () => void;
	private readonly focusHandler = () => {
		if (this.focusDoc.visibilityState === 'visible') void this.syncFromDisk();
	};
	constructor(private readonly nativeHost: WidgetSettingsHost) {
		const storage = new RecordStorage(nativeHost.app, '.nand/content/NAND/番茄钟/pomodoro.json');
		const win = nativeHost.app.workspace.containerEl.win;
		super(
			{
				get settings() {
					return nativeHost.settings;
				},
				saveSettings: () => nativeHost.saveSettings(),
				notify: (message) => {
					new Notice(message);
				},
				chime: playDing,
				setInterval: (callback, ms) => win.setInterval(callback, ms),
				clearInterval: (handle) => win.clearInterval(handle),
			},
			storage,
			'.nand/content/NAND/番茄钟/pomodoro.json',
		);
		this.unsubscribe = storage.subscribeInvalidation(() => { void this.syncFromDisk(); });
		this.focusDoc = win.document;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
		unlockChime(this.focusDoc);
	}
	getApp(): App {
		return this.nativeHost.app;
	}
	override destroy(): void {
		this.unsubscribe();
		this.focusDoc.removeEventListener('visibilitychange', this.focusHandler);
		void this.shutdown().catch(() => undefined);
		super.destroy();
	}
}
