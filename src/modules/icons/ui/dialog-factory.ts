import type { IconicDialogs } from '../platform/dialog-port';
import type IconicController from '../platform/host/controller';
import IconPicker from './dialogs/icon-picker';
import RuleEditor from './dialogs/rule-editor';
import RulePicker from './dialogs/rule-picker';
import { registerIconicCommands } from './commands';

/** Assemble native icon hooks and dialogs without a platform-to-view dependency. */
export function createIconicDialogs(controller: IconicController): IconicDialogs {
	return {
		openSingle: (item, callback) => IconPicker.openSingle(controller, item, callback),
		openMulti: (items, callback) => IconPicker.openMulti(controller, items, callback),
		openRuleEditor: (page, rule, callback) => RuleEditor.open(controller, page, rule, callback),
		openRulePicker: () => RulePicker.open(controller),
		registerCommands: () => registerIconicCommands(controller),
	};
}
