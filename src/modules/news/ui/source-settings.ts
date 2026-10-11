import { Setting } from 'obsidian';
import { onLanguageChanged, t } from '../../../shared/i18n';
import { bindLocalizedControl, bindLocalizedOptions, setLocalizedText } from '../../../ui/primitives/localized-dom';
import { normalizeNewsSource, type NewsSource } from '../core/model';
import type { NewsActions } from '../services/news-actions';

export function sourceError(error: unknown): string {
	const message = error instanceof Error ? error.message : '';
	if (/^news\.http\.\d{3}$/.test(message)) return t('news.source.http', { status: message.slice(-3) });
	if (['news.source.invalid', 'news.source.duplicate', 'news.list.no_matches', 'news.list.invalid_selector', 'news.opml.invalid', 'news.timeout', 'news.tooLarge', 'news.stopped'].includes(message)) return t(message);
	return t('news.source.failed');
}

export function sourceSetting(container: HTMLElement, key: string): Setting {
	return bindLocalizedControl(new Setting(container).setName(t(key)), 'name', key);
}

/** A source draft is committed explicitly; a trial never stores fetched material or its cursor. */
export function sourceEditor(container: HTMLElement, original: NewsSource, actions: NewsActions, changed: () => void): () => void {
	const details = container.createEl('details', { cls: 'nand-news-source' });
	const heading = details.createEl('summary', { text: original.name });
	heading.setAttribute('aria-label', original.name);
	let draft: NewsSource = { ...original, selectors: { item: 'li', link: 'a', title: 'a', ...original.selectors } };
	const status = details.createEl('p', { attr: { role: 'status' } });
	const health = details.createEl('p');
	const paintHealth = (): void => {
		const value = actions.health(original.id);
		const state = !draft.enabled ? 'disabled' : value?.failureCount ? value.failureCount >= 5 ? 'failing' : 'retrying' : value?.lastSuccess ? 'healthy' : 'new';
		health.setText([t(`news.health.${state}`), value?.lastSuccess ? t('news.health.lastSuccess', { time: new Date(value.lastSuccess).toLocaleString() }) : '', value?.nextDue ? t('news.health.nextDue', { time: new Date(value.nextDue).toLocaleString() }) : '', value?.lastError ? sourceError(new Error(value.lastError)) : ''].filter(Boolean).join(' · '));
	};
	paintHealth();
	const text = (key: string, value: string, update: (value: string) => void): void => {
		sourceSetting(details, key).addText(input => input.setValue(value).onChange(update));
	};
	text('news.source.name', draft.name, value => { draft.name = value; });
	text('news.source', draft.url, value => { draft.url = value; });
	const dropdown = (key: string, values: string[], selected: string, update: (value: string) => void): void => {
		sourceSetting(details, key).addDropdown(control => {
			for (const value of values) control.addOption(value, t(`${key}.${value}`));
			control.setValue(selected).onChange(update);
			bindLocalizedOptions(control, Object.fromEntries(values.map(value => [value, [`${key}.${value}`]])));
		});
	};
	const selectors = details.createDiv();
	const paintSelectors = (): void => { selectors.hidden = draft.type !== 'web-list'; };
	dropdown('news.source.type', ['rss', 'atom', 'jsonfeed', 'web-list'], draft.type, value => { draft.type = value as NewsSource['type']; paintSelectors(); });
	dropdown('news.source.tier', ['T1', 'T1_5', 'T2', 'unlisted'], draft.tier, value => { draft.tier = value as NewsSource['tier']; });
	dropdown('news.source.participation', ['editorial', 'signal', 'isolated'], draft.participation, value => { draft.participation = value as NewsSource['participation']; });
	dropdown('news.source.strategy', ['source', 'author', 'community', 'group', 'owner'], draft.participantStrategy ?? 'source', value => { draft.participantStrategy = value as NewsSource['participantStrategy']; });
	text('news.source.group', draft.groupId ?? '', value => { draft.groupId = value; });
	text('news.source.owner', draft.ownerEntityId ?? '', value => { draft.ownerEntityId = value; });
	text('news.source.role', draft.publisherRole ?? '', value => { draft.publisherRole = value; });
	text('news.source.interval', String(draft.intervalMinutes), value => { draft.intervalMinutes = Number(value); });
	sourceSetting(details, 'news.source.enabled').addToggle(control => control.setValue(draft.enabled).onChange(value => { draft.enabled = value; paintHealth(); }));
	for (const key of ['item', 'link', 'title', 'date'] as const) sourceSetting(selectors, `news.selector.${key}`).addText(input => input.setValue(draft.selectors?.[key] ?? '').onChange(value => { draft.selectors = { ...draft.selectors!, [key]: value }; }));
	sourceSetting(selectors, 'news.selector.fragment').addToggle(control => control.setValue(draft.selectors?.preserveFragment ?? false).onChange(value => { draft.selectors = { ...draft.selectors!, preserveFragment: value }; }));
	paintSelectors();
	const preview = details.createDiv();
	const buttons = sourceSetting(details, 'news.source.actions');
	buttons.settingEl.addClass('nand-news-source-actions');
	let removed = false;
	for (const action of ['preview', 'save', 'refresh', 'remove'] as const) buttons.addButton(button => {
		bindLocalizedControl(button.setButtonText(t(`news.source.${action}`)), 'buttonText', `news.source.${action}`);
		button.onClick(async () => {
			button.setDisabled(true);
			try {
				if (action === 'remove') {
					if (button.buttonEl.dataset.confirm !== 'true') {
						button.buttonEl.dataset.confirm = 'true';
						bindLocalizedControl(button.setButtonText(t('news.source.confirmRemove')), 'buttonText', 'news.source.confirmRemove');
						return;
					}
					await actions.removeSource(original.id); changed(); return;
				}
				const source = normalizeNewsSource(draft);
				if (!source) throw new Error('news.source.invalid');
				if (action === 'preview') {
					const items = await actions.previewSource(source);
					if (removed) return;
					preview.empty();
					setLocalizedText(status, 'news.source.previewCount', { count: items.length });
					const list = preview.createEl('ul');
					for (const item of items.slice(0, 10)) list.createEl('li', { text: [item.title, item.originalUrl, item.publishedAt ? new Date(item.publishedAt).toLocaleString() : t('news.source.noDate')].join(' · ') });
				} else if (action === 'save') {
					await actions.saveSource(source); draft = { ...source, selectors: draft.selectors }; heading.setText(source.name); paintHealth(); setLocalizedText(status, 'news.source.saved');
				} else { await actions.refreshSource(original.id); paintHealth(); setLocalizedText(status, 'news.source.refreshed'); }
			} catch (error) { if (!removed) status.setText(sourceError(error)); }
			finally { button.setDisabled(false); }
		});
	});
	const off = actions.subscribe(paintHealth);
	const languageOff = onLanguageChanged(paintHealth);
	return () => { removed = true; off(); languageOff(); };
}
