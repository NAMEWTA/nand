import { getMethod } from '../utils/obsidian-internal';
import { internalSuggest, type SuggestionMethod } from '../utils/obsidian-internal';
import { AbstractInputSuggest, EditorSuggest, TFile } from 'obsidian';
import type IconicController from '../host/controller';
import IconManager from './icon-manager';
import ObsidianUtils from '../utils/obsidian-utils';

const FILE_SUGGESTION = 'file';
const TAG_SUGGESTION = 'tag';
const PROPERTY_SUGGESTION = 'property';

/**
 * Intercepts suggestion popovers to add custom icons.
 */
export default class SuggestionIconManager extends IconManager {
	private showAbstractSuggestionsOriginal!: SuggestionMethod;
	private showAbstractSuggestionsProxy!: SuggestionMethod;
	renderAbstractSuggestionProxy: ((this: void, value: unknown, el: HTMLElement) => void) | null = null;

	private showEditorSuggestionsOriginal!: SuggestionMethod;
	private showEditorSuggestionsProxy!: SuggestionMethod;
	renderEditorSuggestionProxy: ((this: void, value: unknown, el: HTMLElement) => void) | null = null;

	private readonly rendererRestorers: Array<() => void> = [];
	rememberRenderer(target: { renderSuggestion: (value: unknown, el: HTMLElement) => void }): () => void {
		const previous = new WeakRef(getMethod(target, 'renderSuggestion'));
		const weak = new WeakRef(target);
		let installed: WeakRef<(value: unknown, el: HTMLElement) => void> | undefined;
		this.rendererRestorers.push(() => {
			const instance = weak.deref();
			const original = previous.deref();
			if (instance && original && instance.renderSuggestion === installed?.deref())
				instance.renderSuggestion = original;
		});
		return () => {
			installed = new WeakRef(getMethod(target, 'renderSuggestion'));
		};
	}

	constructor(plugin: IconicController) {
		super(plugin);
		this.setupAbstractSuggestionProxies();
		this.setupEditorSuggestionProxies();
	}

	/**
	 * Intercept property key/value suggestion popovers.
	 */
	private setupAbstractSuggestionProxies(): void {
		// Store original method

		this.showAbstractSuggestionsOriginal = internalSuggest(AbstractInputSuggest.prototype).showSuggestions;

		// Catch popovers before they open

		this.showAbstractSuggestionsProxy = new Proxy(
			internalSuggest(AbstractInputSuggest.prototype).showSuggestions,
			new ShowAbstractSuggestionsProxyHandler(this),
		);

		// Replace original method
		internalSuggest(AbstractInputSuggest.prototype).showSuggestions = this.showAbstractSuggestionsProxy;
	}

	/**
	 * Intercept editor suggestion popovers.
	 */
	private setupEditorSuggestionProxies(): void {
		// Store original method

		this.showEditorSuggestionsOriginal = internalSuggest(EditorSuggest.prototype).showSuggestions;

		// Catch popovers before they open

		this.showEditorSuggestionsProxy = new Proxy(
			internalSuggest(EditorSuggest.prototype).showSuggestions,
			new ShowEditorSuggestionsProxyHandler(this),
		);

		// Replace original method
		internalSuggest(EditorSuggest.prototype).showSuggestions = this.showEditorSuggestionsProxy;
	}

	/**
	 * Determine which type of suggestion this is.
	 */
	getSuggestionType(value: unknown): string | null {
		if (!ObsidianUtils.isObject(value)) {
			return null;
		} else if (value.type === 'file' && value.file instanceof TFile) {
			return FILE_SUGGESTION;
		} else if (value.type === 'alias' && value.file instanceof TFile) {
			return FILE_SUGGESTION;
		} else if (value.tag) {
			return TAG_SUGGESTION;
		} else if (value.widget) {
			return PROPERTY_SUGGESTION;
		} else {
			return null;
		}
	}

	/**
	 * Refresh a file suggestion icon.
	 */
	refreshFileIcon(value: unknown, el: HTMLElement): void {
		if (!ObsidianUtils.isObject(value) || !(value.file instanceof TFile)) return;

		const fileId = value.file.path;
		const file = this.plugin.getFileItem(fileId);
		if (!file) return;
		const rule = this.plugin.ruleManager?.checkRuling('file', fileId) ?? file;

		el.addClass('iconic-item');
		const iconContainerEl = el.find(':scope > .suggestion-icon') ?? createDiv({ cls: 'suggestion-icon' });
		const iconEl =
			iconContainerEl.find(':scope > .suggestion-flair') ??
			iconContainerEl.createSpan({ cls: 'suggestion-flair' });
		el.prepend(iconContainerEl);
		if (rule) {
			if (!rule.icon && !rule.color) iconEl.addClass('iconic-invisible');
			this.refreshIcon(rule, iconEl);
		}
	}

	/**
	 * Refresh a property suggestion icon.
	 */
	refreshPropertyIcon(value: unknown, el: HTMLElement): void {
		if (!ObsidianUtils.isObject(value)) return;
		switch (value.type) {
			// Property suggestions
			case 'text': {
				if (typeof value.text !== 'string') break;
				const propId = value.text;
				const prop = this.plugin.getPropertyItem(propId);
				const iconEl = el.find(':scope > .suggestion-icon > .suggestion-flair');
				if (prop && iconEl) this.refreshIcon(prop, iconEl);
				break;
			}
			// BASES: File attribute suggestions
			case 'file':
				break;
			// BASES: Formula suggestions
			case 'formula':
				break;
			// BASES: Property suggestions
			case 'note': {
				if (typeof value.name !== 'string') break;
				const propId = value.name;
				const prop = this.plugin.getPropertyItem(propId);
				const iconEl = el.find(':scope > .suggestion-icon > .suggestion-flair');
				if (prop && iconEl) this.refreshIcon(prop, iconEl);
				break;
			}
		}
	}

	/**
	 * Refresh a tag suggestion icon.
	 */
	refreshTagIcon(value: unknown, el: HTMLElement): void {
		if (!ObsidianUtils.isObject(value)) return;
		const tagId = value.tag;
		if (typeof tagId !== 'string') return;

		el.addClass('mod-complex', 'iconic-item');
		const tag = this.plugin.getTagItem(tagId);
		const iconContainerEl = el.find(':scope > .suggestion-icon') ?? createDiv({ cls: 'suggestion-icon' });
		const iconEl =
			iconContainerEl.find(':scope > .suggestion-flair') ??
			iconContainerEl.createSpan({ cls: 'suggestion-flair' });
		el.prepend(iconContainerEl);
		if (tag) {
			tag.iconDefault = 'lucide-tag';
			if (!tag.icon && !tag.color) iconEl.addClass('iconic-invisible');
			this.refreshIcon(tag, iconEl);
		}
	}

	/**
	 * Check whether user has disabled suggestion icons.
	 */
	isDisabled(): boolean {
		return !this.plugin.isActive() || !this.plugin.settings.showSuggestionIcons;
	}

	/**
	 * @override
	 */
	unload(): void {
		for (const restore of this.rendererRestorers.reverse()) restore();
		this.rendererRestorers.length = 0;

		if (internalSuggest(AbstractInputSuggest.prototype).showSuggestions === this.showAbstractSuggestionsProxy) {
			internalSuggest(AbstractInputSuggest.prototype).showSuggestions = this.showAbstractSuggestionsOriginal;
		}

		if (internalSuggest(EditorSuggest.prototype).showSuggestions === this.showEditorSuggestionsProxy) {
			internalSuggest(EditorSuggest.prototype).showSuggestions = this.showEditorSuggestionsOriginal;
		}
	}
}

/**
 * Proxy handler for {@link AbstractInputSuggest.showSuggestions}.
 */
class ShowAbstractSuggestionsProxyHandler implements ProxyHandler<object> {
	private readonly iconManager: SuggestionIconManager;

	constructor(manager: SuggestionIconManager) {
		this.iconManager = manager;
	}

	apply(
		showSuggestions: (...args: unknown[]) => unknown,
		popover: AbstractInputSuggest<unknown>,
		args: unknown[],
	): unknown {
		if (this.iconManager.isDisabled()) {
			return showSuggestions.call(popover, ...args);
		}

		// Proxy renderSuggestion() for each instance
		if (popover.renderSuggestion !== this.iconManager.renderAbstractSuggestionProxy) {
			const remember = this.iconManager.rememberRenderer(popover);
			this.iconManager.renderAbstractSuggestionProxy = new Proxy(getMethod(popover, 'renderSuggestion'), {
				apply: (
					renderSuggestion: (value: unknown, el: HTMLElement) => void,
					popover: AbstractInputSuggest<unknown>,
					args: [value: unknown, el: HTMLElement],
				) => {
					// Call base method first to pre-populate elements
					const returnValue = renderSuggestion.call(popover, ...args);
					if (this.iconManager.isDisabled()) return returnValue;

					const [value, el] = args;
					switch (this.iconManager.getSuggestionType(value)) {
						case FILE_SUGGESTION:
							this.iconManager.refreshFileIcon(value, el);
							break;
						case TAG_SUGGESTION:
							this.iconManager.refreshTagIcon(value, el);
							break;
						case PROPERTY_SUGGESTION:
							this.iconManager.refreshPropertyIcon(value, el);
							break;
					}

					return returnValue;
				},
			}).bind(popover);

			// Replace original method
			popover.renderSuggestion = this.iconManager.renderAbstractSuggestionProxy;
			remember();
		}

		return showSuggestions.call(popover, ...args);
	}
}

/**
 * Proxy handler for {@link EditorSuggest.showSuggestions}.
 */
class ShowEditorSuggestionsProxyHandler implements ProxyHandler<object> {
	private readonly iconManager: SuggestionIconManager;

	constructor(manager: SuggestionIconManager) {
		this.iconManager = manager;
	}

	apply(showSuggestions: (...args: unknown[]) => unknown, popover: EditorSuggest<unknown>, args: unknown[]): unknown {
		if (this.iconManager.isDisabled()) return showSuggestions.call(popover, ...args);

		// Proxy renderSuggestion() for each instance
		if (popover.renderSuggestion !== this.iconManager.renderEditorSuggestionProxy) {
			const remember = this.iconManager.rememberRenderer(popover);
			this.iconManager.renderEditorSuggestionProxy = new Proxy(getMethod(popover, 'renderSuggestion'), {
				apply: (
					renderSuggestion: (value: unknown, el: HTMLElement) => void,
					popover: EditorSuggest<unknown>,
					args: [value: unknown, el: HTMLElement],
				) => {
					// Call base method first to pre-populate elements
					const returnValue = renderSuggestion.call(popover, ...args);
					if (this.iconManager.isDisabled()) return returnValue;

					const [value, el] = args;
					switch (this.iconManager.getSuggestionType(value)) {
						case FILE_SUGGESTION:
							this.iconManager.refreshFileIcon(value, el);
							break;
						case TAG_SUGGESTION:
							this.iconManager.refreshTagIcon(value, el);
							break;
						case PROPERTY_SUGGESTION:
							this.iconManager.refreshPropertyIcon(value, el);
							break;
					}

					return returnValue;
				},
			}).bind(popover);

			// Replace original method
			popover.renderSuggestion = this.iconManager.renderEditorSuggestionProxy;
			remember();
		}

		return showSuggestions.call(popover, ...args);
	}
}
