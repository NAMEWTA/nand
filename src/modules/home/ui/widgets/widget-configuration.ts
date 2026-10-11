import type { Modal } from 'obsidian';
import type { HomeWidgetContext, HomeWidgetInstance } from '../../api';
import type { HomeHost } from '../../services/home-host';
import type { AlbumConfig, AnniversaryConfig, CountdownConfig } from '../../core/board/types/model';
import { t } from '../../../../shared/i18n';
import { ownDialog } from '../ui/dialog-scope';
import { AlbumSettingsModal } from './album-settings-modal';
import { AnniversarySettingsModal } from './anniversary-settings-modal';
import { CountdownSettingsModal } from './countdown-modal';

/** The existing native editors own drafts. Closing a draft never writes provider settings. */
function editInstance<T>(host: HomeHost, context: HomeWidgetContext, initial: T, editor: (value: T, save: (value: T) => void) => Modal, persist: (value: T) => Promise<HomeWidgetInstance>): Promise<HomeWidgetInstance | null> {
	if (context.signal.aborted) return Promise.resolve(null);
	return new Promise((resolve, reject) => {
		let pending: Promise<HomeWidgetInstance> | null = null;
		let release = () => {};
		const modal = editor(initial, value => {
			if (context.signal.aborted || pending) return;
			pending = persist(value);
		});
		const originalClose = modal.onClose.bind(modal);
		const close = () => modal.close();
		modal.onClose = () => {
			originalClose(); release(); context.signal.removeEventListener('abort', close);
			void (pending ?? Promise.resolve(null)).then(value => resolve(context.signal.aborted ? null : value), reject);
		};
		context.register(close);
		context.signal.addEventListener('abort', close, { once: true });
		modal.open();
		release = ownDialog(host.app, close);
	});
}

/** Persist one instance before the caller adds board membership. Never alter enable flags or another instance. */
async function saveInstance<K extends 'albums' | 'anniversaries' | 'countdowns'>(host: HomeHost, key: K, value: HomeHost['settings'][K][number]): Promise<void> {
	const previous = host.settings[key].find(item => item.id === value.id);
	const next = [...host.settings[key]];
	const index = next.findIndex(item => item.id === value.id);
	if (index < 0) next.push(value); else next[index] = value;
	host.settings = { ...host.settings, [key]: next };
	try { await host.saveSettings(); }
	catch (error) {
		// Undo this failed draft in memory while retaining independently edited instances.
		const current = host.settings[key];
		if (current.find(item => item.id === value.id) === value) host.settings = { ...host.settings, [key]: current.flatMap(item => item !== value ? [item] : previous ? [previous] : []) };
		throw error;
	}
	host.refreshAllDashboards();
}

export async function configureBuiltinWidget(host: HomeHost, kind: string, context: HomeWidgetContext, create: boolean): Promise<HomeWidgetInstance | null> {
	if (kind === 'album') {
		let id = Date.now(); while (host.settings.albums.some(item => item.id === id)) id++;
		const initial: AlbumConfig | undefined = create ? { id, folder: '', intervalSec: 8, recursive: true, ratio: '1:1', transition: 'fade', heightRatio: 'full' } : host.settings.albums.find(item => String(item.id) === context.instanceId);
		if (!initial) throw new Error(t('home.widget.instanceMissing'));
		return editInstance(host, context, initial, (value, save) => new AlbumSettingsModal(host.app, value, save), async value => { await saveInstance(host, 'albums', value); return { id: String(value.id), label: value.folder || t('home.widget.album') }; });
	}
	if (kind === 'anniversary') {
		const initial: AnniversaryConfig | undefined = create ? { id: `av-${crypto.randomUUID()}`, label: '', startDate: '', precision: 'ymd', annualReminder: false } : host.settings.anniversaries.find(item => item.id === context.instanceId);
		if (!initial) throw new Error(t('home.widget.instanceMissing'));
		return editInstance(host, context, initial, (value, save) => new AnniversarySettingsModal(host.app, value, save), async value => { await saveInstance(host, 'anniversaries', value); return { id: value.id, label: value.label || t('home.widget.anniversary') }; });
	}
	if (kind === 'countdown') {
		const initial: CountdownConfig | undefined = create ? { id: `cd-${crypto.randomUUID()}`, label: '', targetDate: '', displayMode: 'days', reminderDays: 0 } : host.settings.countdowns.find(item => item.id === context.instanceId);
		if (!initial) throw new Error(t('home.widget.instanceMissing'));
		return editInstance(host, context, initial, (value, save) => new CountdownSettingsModal(host.app, value, save), async value => { await saveInstance(host, 'countdowns', value); return { id: value.id, label: value.label || t('home.widget.countdown') }; });
	}
	return null;
}
