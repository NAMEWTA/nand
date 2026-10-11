import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { NewsSource } from '../core/model';
import type { NewsActions } from '../services/news-actions';
import { sourceEditor, sourceError } from './source-settings';

export function SourcesPage({ sources, actions }: { sources: readonly NewsSource[]; actions: NewsActions }) {
	const [url, setUrl] = useState(''), [opml, setOpml] = useState(''), [notice, setNotice] = useState('');
	const [revision, redraw] = useState(0), root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = root.current; if (!el) return;
		el.replaceChildren();
		const disposers = sources.map(source => sourceEditor(el, source, actions, () => redraw(value => value + 1)));
		return () => { for (const dispose of disposers) dispose(); el.replaceChildren(); };
	}, [sources, actions, revision]);
	return <section class="nand-news-sources-page">
		<form onSubmit={event => { event.preventDefault(); void actions.addSource(url).then(added => { if (added) setUrl(''); else setNotice(t('news.source.invalid')); }).catch(error => setNotice(sourceError(error))); }}>
			<TextField label={t('news.source')} type="url" value={url} onInput={setUrl} /><Button type="submit" disabled={!url.trim()}>{t('news.addSource')}</Button>
		</form>
		<details><summary>{t('news.opml')}</summary>
			<TextField label={t('news.opml')} multiline value={opml} onInput={setOpml} />
			<div class="nand-ui-toolbar"><Button onClick={() => void actions.importOpml(opml).then(report => { setOpml(''); setNotice(t('news.opml.report', { ...report })); }).catch(error => setNotice(sourceError(error)))}>{t('news.importOpml')}</Button>
				<Button variant="ghost" onClick={() => setOpml(actions.exportOpml())}>{t('news.exportOpml')}</Button></div>
		</details>
		<p role="status">{notice}</p><div ref={root} />
	</section>;
}
