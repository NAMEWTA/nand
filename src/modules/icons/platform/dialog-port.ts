import type { Category, Item } from '../core/types';
import type { RuleItem } from './managers/rule-manager';

export interface IconicDialogs {
	openSingle(item: Item, callback: (icon: string | null, color: string | null) => void): void;
	openMulti(
		items: Item[],
		callback: (icon: string | null | undefined, color: string | null | undefined) => void,
	): void;
	openRuleEditor(page: Category, rule: RuleItem, callback: (rule: RuleItem | null) => void): void;
	openRulePicker(): void;
	registerCommands(): void;
}
