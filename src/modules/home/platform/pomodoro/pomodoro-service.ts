import { pomodoroDocuments } from '../../core/pomodoro/documents';
import { MarkdownCollectionStorage } from '../../../../host/obsidian/storage/document-collection';
import { Notice, type App } from 'obsidian';
import { PomodoroApplication } from '../../core/pomodoro/application';
import { playDing, unlockChime } from '../audio/chime';
import type { WidgetSettingsHost } from '../widget-settings-host';
export * from '../../core/pomodoro/application';

/** Native wiring only; state and timer rules live in core. */
export class PomodoroService extends PomodoroApplication {
	private readonly storageCleanup: () => void;
	private readonly focusDoc: Document;
	private readonly focusHandler = () => { if (this.focusDoc.visibilityState === 'visible') void this.syncFromDisk(); };
	constructor(private readonly nativeHost: WidgetSettingsHost) {
		const storage = new MarkdownCollectionStorage(nativeHost.app, pomodoroDocuments, 'domain/pomodoro.json');
		const win = nativeHost.app.workspace.containerEl.win;
		super({
			get settings() { return nativeHost.settings; },
			saveSettings: () => nativeHost.saveSettings(),
			notify: message => { new Notice(message); },
			chime: playDing,
			setInterval: (callback, ms) => win.setInterval(callback, ms),
			clearInterval: handle => win.clearInterval(handle),
		}, storage, 'domain/pomodoro.json');
		this.storageCleanup = () => storage.dispose();
		this.focusDoc = win.document;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
		unlockChime(this.focusDoc);
	}
	getApp(): App { return this.nativeHost.app; }
	override destroy(): void {
		this.focusDoc.removeEventListener('visibilitychange', this.focusHandler);
		void this.shutdown().catch(() => undefined).finally(this.storageCleanup);
		super.destroy();
	}
}
