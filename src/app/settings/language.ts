import { type Language } from '../../shared/i18n';

export function normalizeLanguage(value: unknown): Language {
	return value === 'en' ? 'en' : 'zh';
}

/** Publish only durable preferences. A failed write must not poison later requests. */
export function settingsWriter() {
	let tail = Promise.resolve();
	return <T>(write: () => Promise<T>): Promise<T> => {
		const operation = tail.then(write);
		tail = operation.then(() => {}, () => {});
		return operation;
	};
}

export function languageUpdater(persist: (language: Language) => Promise<void>, publish: (language: Language) => void,
	write = settingsWriter()) {
	return (language: Language): Promise<void> => write(async () => {
			await persist(language);
			publish(language);
		});
}
