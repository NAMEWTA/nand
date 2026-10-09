import { TFile } from 'obsidian';
import type { Category, FileItem, Item } from '../../core/types';
import { t } from '../../../../shared/i18n';
import type IconicController from '../host/controller';
import { EMOJIS, ICONS } from '../resources';
import ObsidianUtils from '../utils/obsidian-utils';
import { evaluateOperator } from '../../core/rule-operators';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export type RuleTrigger = 'icon' | 'color' | 'rename' | 'move' | 'tag' | 'property' | 'modify' | 'date' | 'time';

export interface RuleItem extends Item {
	category: 'rule';
	match: 'all' | 'any' | 'none';
	conditions: ConditionItem[];
	enabled: boolean;
}
export interface ConditionItem {
	source: string;
	operator: string;
	value: string;
}

/**
 * Handles core rule logic, and tracks which items are currently affected by a ruling.
 */
export default class RuleManager {
	private readonly plugin: IconicController;
	private readonly fileRulings = new Map<string, RuleItem>();
	private readonly folderRulings = new Map<string, RuleItem>();
	private readonly fileTriggers = new Set<RuleTrigger>();
	private readonly folderTriggers = new Set<RuleTrigger>();
	private triggerTimerId?: number;
	private timerWindow?: Window;

	constructor(plugin: IconicController) {
		this.plugin = plugin;

		// Fix any duplicate rule IDs
		const fileRuleIds = new Set<string>();
		const folderRuleIds = new Set<string>();
		for (const ruleObj of this.getRuleObjects('file')) {
			if (!ruleObj.id || fileRuleIds.has(ruleObj.id)) {
				ruleObj.id = this.newRuleId('file');
			}
			fileRuleIds.add(ruleObj.id);
		}
		for (const ruleObj of this.getRuleObjects('folder')) {
			if (!ruleObj.id || folderRuleIds.has(ruleObj.id)) {
				ruleObj.id = this.newRuleId('folder');
			}
			folderRuleIds.add(ruleObj.id);
		}
		void this.plugin.saveSettings();

		// Initialize rulings
		this.updateRulings('file');
		this.updateRulings('folder');
		void this.startTriggerTimer();
	}

	/**
	 * Start a self-looping timer to manage time-based triggers. Runs once per minute.
	 */
	private async startTriggerTimer(): Promise<void> {
		if (this.triggerTimerId) {
			const isMidnight = 86400000 - (Date.now() % 86400000) < 3600000;
			// Check time triggers every minute, and date triggers every midnight
			if (this.fileTriggers.has('time') || (this.fileTriggers.has('date') && isMidnight)) {
				const isRulingChanged = this.triggerRulings('file', 'time');
				if (isRulingChanged) {
					this.plugin.refreshManagers('file');
				}
			}
		}
		// Recalculate delay every minute to avoid timing drift
		const delay = 60000 - (Date.now() % 60000);
		// Start the next timer
		this.timerWindow = activeWindow;
		this.triggerTimerId = this.timerWindow.setTimeout(() => {
			void this.startTriggerTimer();
		}, delay);
	}

	/**
	 * Get array of rule definitions from a given page.
	 */
	getRules(page: Category): RuleItem[] {
		return this.getRuleObjects(page).map((ruleObject) => this.defineRule(page, ruleObject));
	}

	/**
	 * Get rule definition from a given page.
	 */
	getRule(page: Category, ruleId: string): RuleItem | null {
		const ruleObj = this.getRuleObjects(page).find((rule) => rule.id === ruleId);
		return ruleObj ? this.defineRule(page, ruleObj) : null;
	}

	/**
	 * Get array of rule objects from a given page.
	 */
	private getRuleObjects(page: Category): typeof this.plugin.settings.fileRules {
		switch (page) {
			default:
				return this.plugin.settings.fileRules;
			case 'file':
				return this.plugin.settings.fileRules;
			case 'folder':
				return this.plugin.settings.folderRules;
		}
	}

	/**
	 * Get default rule icon for a given page.
	 */
	getPageIcon(page: Category): string {
		switch (page) {
			default:
				return 'lucide-file';
			case 'file':
				return 'lucide-file';
			case 'folder':
				return 'lucide-folder';
		}
	}

	/**
	 * Create rule definition.
	 */
	private defineRule(page: Category, ruleObj: (typeof this.plugin.settings.fileRules)[number]): RuleItem {
		return {
			id: typeof ruleObj.id === 'string' ? ruleObj.id : '0',
			name: typeof ruleObj.name === 'string' ? ruleObj.name : '',
			category: 'rule',
			iconDefault: this.getPageIcon(page),
			icon: typeof ruleObj.icon === 'string' ? ruleObj.icon : null,
			color: typeof ruleObj.color === 'string' ? ruleObj.color : null,
			match: ruleObj.match === 'any' || ruleObj.match === 'none' ? ruleObj.match : 'all',
			conditions: ObsidianUtils.isArray(ruleObj.conditions)
				? ruleObj.conditions.map((condition) => {
						if (!ObsidianUtils.isObject(condition)) {
							return { source: 'name', operator: 'contains', value: '' };
						}
						return {
							source: typeof condition.source === 'string' ? condition.source : '',
							operator: typeof condition.operator === 'string' ? condition.operator : '',
							value: typeof condition.value === 'string' ? condition.value : '',
						};
					})
				: [],
			enabled: typeof ruleObj.enabled === 'boolean' ? ruleObj.enabled : false,
		};
	}

	/**
	 * Generate a 5-character rule ID. 916,132,832 possible values.
	 */
	newRuleId(page: Category): string {
		const ids = this.getRuleObjects(page).map((ruleObj) => ruleObj.id);
		let id: string;
		let collisions = 0;
		do {
			// Try to generate a unique ID (up to 10 times)
			id =
				BASE62.charAt(Math.floor(Math.random() * BASE62.length)) +
				BASE62.charAt(Math.floor(Math.random() * BASE62.length)) +
				BASE62.charAt(Math.floor(Math.random() * BASE62.length)) +
				BASE62.charAt(Math.floor(Math.random() * BASE62.length)) +
				BASE62.charAt(Math.floor(Math.random() * BASE62.length));
		} while (ids.includes(id) && ++collisions < 10);
		return id;
	}

	/**
	 * Create new rule on a given page.
	 */
	newRule(page: Category): RuleItem {
		const newRule: RuleItem = {
			id: this.newRuleId(page),
			name: t('iconic.rulePicker.untitledRule'),
			category: 'rule',
			iconDefault: this.getPageIcon(page),
			icon: null,
			color: null,
			match: 'all',
			conditions: [{ source: 'name', operator: 'contains', value: '' }],
			enabled: true,
		};
		this.saveRule(page, newRule);
		return newRule;
	}

	/**
	 * Duplicate rule on a given page, and return true if this changes any rulings.
	 */
	duplicateRule(page: Category, rule: RuleItem): RuleItem {
		const ruleObjects = this.getRuleObjects(page);
		const ruleObj = ruleObjects.find((ruleObj) => ruleObj.id === rule.id);
		if (!ruleObj) return this.newRule(page);

		const duplicateRule: RuleItem = {
			id: this.newRuleId(page),
			name: rule.name,
			category: rule.category,
			iconDefault: rule.iconDefault,
			icon: rule.icon,
			color: rule.color,
			match: rule.match,
			conditions: [...rule.conditions],
			enabled: rule.enabled,
		};

		const index = ruleObjects.indexOf(ruleObj) + 1;
		ruleObjects.splice(index, 0, {
			id: duplicateRule.id,
			name: duplicateRule.name,
			icon: duplicateRule.icon ?? undefined,
			color: duplicateRule.color ?? undefined,
			match: duplicateRule.match,
			conditions: [...duplicateRule.conditions],
			enabled: duplicateRule.enabled,
		});

		void this.plugin.saveSettings();
		return duplicateRule;
	}

	/**
	 * Move rule within a given page, and return true if this changes any rulings.
	 */
	moveRule(page: Category, rule: RuleItem, toIndex: number): boolean {
		const ruleObjects = this.getRuleObjects(page);
		const ruleObj = ruleObjects.find((ruleObj) => ruleObj.id === rule.id);
		if (!ruleObj) return false;

		const index = ruleObjects.indexOf(ruleObj);
		ruleObjects.splice(index, 1);
		ruleObjects.splice(toIndex, 0, ruleObj);

		void this.plugin.saveSettings();
		return this.updateRulings(page);
	}

	/**
	 * Save rule to a given page, and return true if this changes any rulings.
	 */
	saveRule(page: Category, newRule: RuleItem): boolean {
		const ruleObjects = this.getRuleObjects(page);
		let ruleObj = ruleObjects.find((rule) => rule.id === newRule.id);
		if (!ruleObj) {
			ruleObj = { id: newRule.id };
			ruleObjects.push({ id: newRule.id });
		}

		if (newRule.name) ruleObj.name = newRule.name;
		else delete ruleObj.name;
		if (newRule.icon) ruleObj.icon = newRule.icon;
		else delete ruleObj.icon;
		if (newRule.color) ruleObj.color = newRule.color;
		else delete ruleObj.color;
		if (newRule.match) ruleObj.match = newRule.match;
		else delete ruleObj.match;
		if (newRule.conditions.length > 0) {
			ruleObj.conditions = newRule.conditions.map(({ source, operator, value }) => {
				const conditionObj: Record<string, unknown> = {};
				if (source) conditionObj.source = source;
				if (operator) conditionObj.operator = operator;
				if (value) conditionObj.value = value;
				return conditionObj;
			});
		} else delete ruleObj.conditions;
		if (typeof newRule.enabled === 'boolean') ruleObj.enabled = newRule.enabled;
		else delete ruleObj.enabled;

		void this.plugin.saveSettings();
		return this.updateRulings(page);
	}

	/**
	 * Delete rule from a given page, and return true if this changes any rulings.
	 */
	deleteRule(page: Category, ruleId: string): boolean {
		const ruleObjects = this.getRuleObjects(page);
		const index = ruleObjects.findIndex((ruleObj) => ruleObj.id === ruleId);
		if (index === -1) return false;
		ruleObjects.splice(index, 1);

		void this.plugin.saveSettings();
		return this.updateRulings(page);
	}

	/**
	 * Check the ruling for a given item.
	 */
	checkRuling(page: Category, itemId: string, unloading?: boolean): RuleItem | null {
		if (unloading) return null;
		switch (page) {
			case 'file':
				return this.fileRulings.get(itemId) ?? null;
			case 'folder':
				return this.folderRulings.get(itemId) ?? null;
			default:
				return null;
		}
	}

	/**
	 * Update rulings for a given page, and return true if this changes any rulings.
	 */
	updateRulings(page: Category): boolean {
		const now = new Date(); // Use this timestamp to check any chronological conditions
		const enabledRules = this.getRules(page).filter((rule) => rule.enabled);

		// If no rules are enabled, clear out the rulings
		if (enabledRules.length === 0) {
			switch (page) {
				case 'file': {
					if (this.fileRulings.size > 0) {
						this.fileRulings.clear();
						this.fileTriggers.clear();
						return true;
					}
					break;
				}
				case 'folder': {
					if (this.folderRulings.size > 0) {
						this.folderRulings.clear();
						this.folderTriggers.clear();
						return true;
					}
					break;
				}
			}
			return false;
		}

		let currentRule: RuleItem | undefined;
		let matchedRule: RuleItem | undefined;
		let anyRulingsChanged = false;

		switch (page) {
			case 'file': {
				const files = this.plugin.getFileItems().filter((file) => !file.items);
				// Prune file rulings (remove files that no longer exist)
				const existingIds = files.map((file) => file.id);
				for (const [fileId] of this.fileRulings) {
					if (!existingIds.contains(fileId)) {
						this.fileRulings.delete(fileId);
						anyRulingsChanged = true;
					}
				}
				// Update file rulings
				for (const file of files) {
					// Judge whether a rule matches this file
					matchedRule = undefined;
					for (const rule of enabledRules) {
						if (this.judgeFile(file, rule, now)) {
							matchedRule = rule;
							break;
						}
					}
					// Compare against any current ruling
					currentRule = this.fileRulings.get(file.id);
					if (matchedRule) {
						this.fileRulings.set(file.id, matchedRule);
						anyRulingsChanged = anyRulingsChanged || RuleManager.distinguish(currentRule, matchedRule);
					} else if (currentRule) {
						this.fileRulings.delete(file.id);
						anyRulingsChanged = anyRulingsChanged || true;
					}
				}
				// Update file triggers
				this.fileTriggers.clear();
				for (const enabledRule of enabledRules) {
					for (const condition of enabledRule.conditions) {
						this.updateTriggers(page, condition);
					}
				}
				break;
			}
			case 'folder': {
				const folders = this.plugin.getFileItems().filter((folder) => folder.items);
				// Prune folder rulings (remove folders that no longer exist)
				const folderIds = folders.map((folder) => folder.id);
				for (const [folderId] of this.folderRulings) {
					if (!folderIds.contains(folderId)) {
						this.folderRulings.delete(folderId);
						anyRulingsChanged = true;
					}
				}
				// Update folder rulings
				for (const folder of folders) {
					matchedRule = undefined;
					// Judge whether a rule matches this folder
					for (const enabledRule of enabledRules) {
						if (this.judgeFile(folder, enabledRule, now)) {
							matchedRule = enabledRule;
							break;
						}
					}
					// Compare against any current ruling
					currentRule = this.folderRulings.get(folder.id);
					if (matchedRule) {
						this.folderRulings.set(folder.id, matchedRule);
						anyRulingsChanged = anyRulingsChanged || RuleManager.distinguish(currentRule, matchedRule);
					} else if (currentRule) {
						this.folderRulings.delete(folder.id);
						anyRulingsChanged = anyRulingsChanged || true;
					}
				}
				// Update folder triggers
				this.folderTriggers.clear();
				for (const enabledRule of enabledRules) {
					for (const condition of enabledRule.conditions) {
						this.updateTriggers(page, condition);
					}
				}
				break;
			}
		}

		return anyRulingsChanged;
	}

	/**
	 * Check a given condition and activate any triggers it will need.
	 */
	private updateTriggers(page: Category, condition: ConditionItem): void {
		let triggers: Set<RuleTrigger>;
		switch (page) {
			case 'file':
				triggers = this.fileTriggers;
				break;
			case 'folder':
				triggers = this.folderTriggers;
				break;
			default:
				return;
		}
		switch (condition.source) {
			case 'icon':
				triggers.add('icon');
				break;
			case 'color':
				triggers.add('color');
				break;
			case 'name': {
				triggers.add('rename');
				triggers.add('move');
				break;
			}
			case 'filename': {
				triggers.add('rename');
				triggers.add('move');
				break;
			}
			case 'extension': {
				triggers.add('rename');
				triggers.add('move');
				break;
			}
			case 'tree': {
				triggers.add('rename');
				triggers.add('move');
				break;
			}
			case 'path': {
				triggers.add('rename');
				triggers.add('move');
				break;
			}
			case 'headings':
				triggers.add('modify');
				break;
			case 'links':
				triggers.add('modify');
				break;
			case 'embeds':
				triggers.add('modify');
				break;
			case 'tags':
				triggers.add('modify');
				break;
			case 'modified':
				triggers.add('modify');
				break;
			case 'clock': {
				switch (condition.operator) {
					case 'is':
						triggers.add('time');
						break;
					case '!is':
						triggers.add('time');
						break;
					case 'isBefore':
						triggers.add('time');
						break;
					case 'timeIs':
						triggers.add('time');
						break;
					case '!timeIs':
						triggers.add('time');
						break;
					case 'timeIsBefore':
						triggers.add('time');
						break;
					case 'timeIsAfter':
						triggers.add('time');
						break;
					default:
						triggers.add('date');
						break;
				}
				break;
			}
			default: {
				if (condition.source.startsWith('property:')) {
					triggers.add('modify');
				}
				break;
			}
		}
		switch (condition.operator) {
			case 'isNow':
				triggers.add('time');
				break;
			case '!isNow':
				triggers.add('time');
				break;
			case 'isBeforeNow':
				triggers.add('time');
				break;
			case 'isAfterNow':
				triggers.add('time');
				break;
			case 'isToday':
				triggers.add('date');
				break;
			case '!isToday':
				triggers.add('date');
				break;
			case 'isBeforeToday':
				triggers.add('date');
				break;
			case 'isAfterToday':
				triggers.add('date');
				break;
			case 'isLessDaysAgo':
				triggers.add('date');
				break;
			case 'isLessDaysAway':
				triggers.add('date');
				break;
			case 'isMoreDaysAgo':
				triggers.add('date');
				break;
			case 'isMoreDaysAway':
				triggers.add('date');
				break;
		}
	}

	/**
	 * Check whether two rules have any different properties.
	 */
	private static distinguish(rule1: RuleItem | undefined, rule2: RuleItem | undefined): boolean {
		return (
			(rule1 === undefined) !== (rule2 === undefined) ||
			rule1?.enabled !== rule2?.enabled ||
			rule1?.id !== rule2?.id ||
			rule1?.name !== rule2?.name ||
			rule1?.icon !== rule2?.icon ||
			rule1?.color !== rule2?.color ||
			rule1?.match !== rule2?.match ||
			rule1?.conditions?.length !== rule2?.conditions?.length ||
			rule1?.conditions?.some((condition, i) => {
				return (
					condition.source !== rule2?.conditions[i]?.source ||
					condition.operator !== rule2?.conditions[i]?.operator ||
					condition.value !== rule2?.conditions[i]?.value
				);
			}) === true
		);
	}

	/**
	 * Update rulings for a given page, and return true if this changes any rulings.
	 * @param triggers If none of the specified triggers are active, skip the update.
	 */
	triggerRulings(page: Category, ...triggers: RuleTrigger[]): boolean {
		switch (page) {
			case 'file': {
				for (const trigger of triggers) {
					if (this.fileTriggers.has(trigger)) return this.updateRulings(page);
				}
				break;
			}
			case 'folder': {
				for (const trigger of triggers) {
					if (this.folderTriggers.has(trigger)) return this.updateRulings(page);
				}
				break;
			}
		}
		return false;
	}

	/**
	 * Judge how many files match a given rule.
	 * @param ignoreEnabled Ignore whether the rule is enabled.
	 */
	judgeFiles(rule: RuleItem, now: Date, ignoreEnabled?: true): FileItem[] {
		const files = this.plugin.getFileItems().filter((file) => !file.items);
		const matches: FileItem[] = [];
		for (const file of files) {
			if (this.judgeFile(file, rule, now, ignoreEnabled)) {
				matches.push(file);
			}
		}
		return matches.sort((a, b) => a.id.localeCompare(b.id));
	}

	/**
	 * Judge how many folders match a given rule.
	 * @param ignoreEnabled Ignore whether the rule is enabled.
	 */
	judgeFolders(rule: RuleItem, now: Date, ignoreEnabled?: true): FileItem[] {
		const folders = this.plugin.getFileItems().filter((file) => file.items);
		const matches: FileItem[] = [];
		for (const folder of folders) {
			if (this.judgeFile(folder, rule, now, ignoreEnabled)) {
				matches.push(folder);
			}
		}
		return matches.sort((a, b) => a.id.localeCompare(b.id));
	}

	/**
	 * Judge whether a given file matches a given rule.
	 * @param ignoreEnabled Ignore whether the rule is enabled.
	 */
	judgeFile(file: FileItem, rule: RuleItem, now: Date, ignoreEnabled?: true): boolean {
		if (!file.id || rule.conditions.length === 0) return false;
		if (!rule.enabled && !ignoreEnabled) return false;
		const { basename, filename, extension, path, tree } = this.plugin.splitFilePath(file.id);
		const tAbstractFile = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!tAbstractFile) return false;
		const metadata =
			tAbstractFile instanceof TFile ? this.plugin.app.metadataCache.getFileCache(tAbstractFile) : null;

		for (const condition of rule.conditions) {
			let source: unknown = undefined;
			const isNegated = condition.operator.startsWith('!');
			const operator = condition.operator.replace('!', '');
			const value = condition.value;

			// Resolve the source
			if (condition.source.startsWith('property:')) {
				const propId = condition.source.replace('property:', '');
				if (metadata?.frontmatter) {
					const fmProps = Object.entries(metadata.frontmatter);
					const fmProp = fmProps.find(([fmPropId]) => fmPropId.toLowerCase() === propId.toLowerCase());
					if (Array.isArray(fmProp)) source = fmProp[1];
				}
			} else
				switch (condition.source) {
					case 'icon': {
						if (!file.icon || operator === 'iconIs' || operator === 'hasValue') {
							source = file.icon;
						} else if (ICONS.has(file.icon)) {
							source = ICONS.get(file.icon)?.[0] ?? null;
						} else if (EMOJIS.get(file.icon)) {
							source = EMOJIS.get(file.icon)?.[0] ?? null;
						}
						break;
					}
					case 'color':
						source = file.color;
						break;
					case 'name':
						source = basename;
						break;
					case 'filename':
						source = filename;
						break;
					case 'extension':
						source = extension;
						break;
					case 'tree':
						source = tree;
						break;
					case 'path':
						source = path;
						break;
					case 'headings':
						source = metadata?.headings?.map((heading) => heading.heading) ?? [];
						break;
					case 'links':
						source = metadata?.links?.map((link) => link.link) ?? [];
						break;
					case 'embeds':
						source = metadata?.embeds?.map((embed) => embed.link) ?? [];
						break;
					case 'tags': {
						const tags: (string | null)[] = [];
						source = tags;
						const propTags =
							(metadata?.frontmatter as { tags?: (string | null)[] } | undefined)?.tags ?? [];
						const inlineTags = metadata?.tags?.map((tag) => tag.tag.replace('#', '')) ?? [];
						for (const tag of [...propTags, ...inlineTags]) {
							if (!tags.includes(tag)) tags.push(tag);
						}
						break;
					}
					case 'created':
						if (tAbstractFile instanceof TFile) source = tAbstractFile.stat.ctime;
						break;
					case 'modified':
						if (tAbstractFile instanceof TFile) source = tAbstractFile.stat.mtime;
						break;
					case 'clock':
						source = now.getTime();
						break;
				}

			// Check if condition is true
			let isConditionMatched = evaluateOperator(operator, source, value, now);

			// Flip negated operators
			isConditionMatched = isConditionMatched !== isNegated;

			// Return if remaining conditions are now redundant
			if (rule.match === 'all' && !isConditionMatched) {
				return false;
			} else if (rule.match === 'any' && isConditionMatched) {
				return true;
			} else if (rule.match === 'none' && isConditionMatched) {
				return false;
			}
		}

		// If no condition returned early, check the match mode
		return rule.match !== 'any';
	}

	/**
	 * Stop the trigger timer.
	 */
	unload(): void {
		this.timerWindow?.clearTimeout(this.triggerTimerId);
	}
}
