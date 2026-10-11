import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { NewsFilter, NewsSource, NewsView } from '../core/model';
import type { NewsActions } from '../services/news-actions';

export function ViewEditor({ filter, view, sources, categories, actions, onFilter, onSaved, onRemoved }: {
	filter: NewsFilter; view?: NewsView; sources: readonly NewsSource[]; categories: readonly string[]; actions: NewsActions;
	onFilter: (filter: NewsFilter) => void; onSaved: (id: string) => void; onRemoved: () => void;
}) {
	const [name, setName] = useState(view?.name ?? ''), [notice, setNotice] = useState('');
	const [tags, setTags] = useState(filter.tags?.join(', ') ?? '');
	const parseTags = (value: string): string[] => [...new Set(value.split(/[,，]/).map(item => item.trim()).filter(Boolean))];
	useEffect(() => { if (JSON.stringify(parseTags(tags)) !== JSON.stringify(filter.tags ?? [])) setTags(filter.tags?.join(', ') ?? ''); }, [filter.tags, tags]);
	useEffect(() => { setName(view?.name ?? ''); setNotice(''); }, [view?.id, view?.name]);
	const patch = (value: Partial<NewsFilter>): void => onFilter({ ...filter, ...value });
	const save = async (copy: boolean): Promise<void> => {
		try { const id = await actions.saveView(copy ? undefined : view?.id, name, filter); onSaved(id); setNotice(t('news.view.saved')); }
		catch (error) { setNotice(t(error instanceof Error && error.message === 'news.view.limit' ? 'news.view.limit' : 'news.view.invalid')); }
	};
	return <section class="nand-news-filter">
		<TextField label={t('news.filter.query')} value={filter.query ?? ''} onInput={query => patch({ query })} />
		<details>
			<summary>{t('news.filter.title')}</summary>
			<div class="nand-news-filter-fields">
				<label class="nand-field"><span class="nand-field-label">{t('news.filter.category')}</span><select value={filter.category ?? ''} onChange={event => patch({ category: event.currentTarget.value })}>
					<option value="">{t('news.filter.any')}</option>{[...new Set([...categories, filter.category ?? ''])].filter(Boolean).map(category => <option key={category} value={category}>{category}</option>)}
				</select></label>
				<TextField label={t('news.filter.tags')} value={tags} onInput={value => { setTags(value); patch({ tags: parseTags(value) }); }} />
				<TextField label={t('news.filter.minScore')} type="number" value={filter.minScore === undefined ? '' : String(filter.minScore)} onInput={value => patch({ minScore: value.trim() ? Number(value) : undefined })} />
				<fieldset><legend>{t('news.section.sources')}</legend>{sources.map(source => <label class="nand-news-filter-source" key={source.id}>
					<input type="checkbox" checked={filter.sourceIds?.includes(source.id) ?? false} onChange={event => patch({ sourceIds: event.currentTarget.checked ? [...(filter.sourceIds ?? []), source.id] : filter.sourceIds?.filter(id => id !== source.id) })} />{source.name}
				</label>)}</fieldset>
			</div>
			<div class="nand-ui-toolbar"><Button variant="ghost" onClick={() => onFilter({})}>{t('news.filter.clear')}</Button></div>
			<TextField label={t('news.view.name')} value={name} onInput={setName} />
			<div class="nand-ui-toolbar">
				<Button disabled={!name.trim()} onClick={() => void save(false)}>{t(view ? 'news.view.update' : 'news.view.save')}</Button>
				{view && <><Button variant="ghost" disabled={!name.trim()} onClick={() => void save(true)}>{t('news.view.copy')}</Button><Button variant="danger" onClick={() => void actions.removeView(view.id).then(onRemoved).catch(() => setNotice(t('news.view.failed')))}>{t('news.view.delete')}</Button></>}
			</div>
			<p role="status">{notice}</p>
		</details>
	</section>;
}
