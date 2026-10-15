import type { IconicDialogs } from '../platform/dialog-port';
import type IconicController from '../platform/host/controller';
import { Notice } from 'obsidian';
import { t } from '../../../shared/i18n';
import { registerIconicCommands } from './commands';

/** Assemble native icon hooks and dialogs without a platform-to-view dependency. */
export function createIconicDialogs(controller: IconicController): IconicDialogs {
	const load = <T>(promise: Promise<T>, open: (value: T) => void) => {
		void promise
			.then((value) => {
				if (controller.isActive()) open(value);
			})
			.catch(() => new Notice(t('settings.writeFailed')));
	};
	return {
		openSingle: (item, callback) =>
			load(import('./dialogs/icon-picker'), ({ default: Picker }) =>
				Picker.openSingle(controller, item, callback),
			),
		openMulti: (items, callback) =>
			load(import('./dialogs/icon-picker'), ({ default: Picker }) =>
				Picker.openMulti(controller, items, callback),
			),
		openRuleEditor: (page, rule, callback) =>
			load(import('./dialogs/rule-editor'), ({ default: Editor }) =>
				Editor.open(controller, page, rule, callback),
			),
		openRulePicker: () => load(import('./dialogs/rule-picker'), ({ default: Picker }) => Picker.open(controller)),
		registerCommands: () => registerIconicCommands(controller),
	};
}
