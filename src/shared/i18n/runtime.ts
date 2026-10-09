import { messages as workbench } from './workbench';
import { messages as appearance } from './appearance';
import { messages as browser } from './browser';
import { messages as automation } from './automation';
import { messages as contacts } from './contacts';
import { messages as m11 } from './default-dashboard-content';
import { messages as m43 } from './editor';
import { iconicTranslations } from './iconic';
import { messages as m10 } from './main';
import { messages as m45 } from './nand';
import { messages as m1 } from './settings';
import { messages as m2 } from './workspace-switcher';

export type Language = 'en' | 'zh';

let currentLang: Language = 'zh';
const languageListeners = new Set<() => void>();

export function onLanguageChanged(listener: () => void): () => void {
	languageListeners.add(listener);
	return () => {
		languageListeners.delete(listener);
	};
}

export function setLanguage(lang: Language): void {
	if (currentLang === lang) return;
	currentLang = lang;
	for (const listener of [...languageListeners]) listener();
}

export function getLanguage(): Language {
	return currentLang;
}

function mergeDicts(...parts: Array<Record<string, string>>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const part of parts) {
		for (const key of Object.keys(part)) {
			const value = part[key];
			if (value !== undefined) out[key] = value;
		}
	}
	return out;
}

const translations: Record<Language, Record<string, string>> = {
	en: mergeDicts(
		appearance.en,
		workbench.en,
		browser.en,
		iconicTranslations.en,
		m1.en,
		m2.en,
		m10.en,
		m11.en,
		m43.en,
		m45.en,
		contacts.en,
		automation.en,
	),
	zh: mergeDicts(
		appearance.zh,
		workbench.zh,
		browser.zh,
		iconicTranslations.zh,
		m1.zh,
		m2.zh,
		m10.zh,
		m11.zh,
		m43.zh,
		m45.zh,
		contacts.zh,
		automation.zh,
	),
};

/**
 * Add a dictionary at runtime (a module registers its own messages when it loads).
 * Later registrations win for duplicate keys.
 */
export function registerMessages(messages: { en: Record<string, string>; zh: Record<string, string> }): void {
	Object.assign(translations.en, messages.en);
	Object.assign(translations.zh, messages.zh);
}

export function tFor(language: Language, key: string): string {
	return translations[language][key] ?? translations.en[key] ?? key;
}

export function t(key: string, params?: Record<string, string | number>): string {
	let str = tFor(currentLang, key);
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replaceAll(`{${k}}`, String(v));
		}
	}
	return str;
}
