import { Platform } from 'obsidian';
import { t } from '../../../../../shared/i18n/index';

/** Loaded only at the desktop execution boundary. */
export function runtimeProcess(): typeof import('node:process') {
	if (!Platform.isDesktop) throw new Error(t('agent.sessionMissing'));
	return window.require('node:process') as typeof import('node:process');
}
