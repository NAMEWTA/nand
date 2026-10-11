import type { App } from 'obsidian';
import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import { openDialog } from '../../../ui/primitives/dialog';
import type { BoardLayout } from '../core/board/types/model';
import { LayoutPicker } from './LayoutPicker';
import { ownDialog } from './ui/dialog-scope';

export function promptNewBoard(app: App): Promise<{ name: string; layout: BoardLayout } | null> {
	return new Promise(resolve => {
		let result: { name: string; layout: BoardLayout } | null = null;
		let release = () => {};
		function Body({ close }: { close: () => void }) {
			const [name, setName] = useState('');
			const [layout, setLayout] = useState<BoardLayout>('stacked');
			return <form class="nand-ui-stack" onSubmit={event => {
				event.preventDefault();
				if (!name.trim()) return;
				result = { name: name.trim(), layout };
				close();
			}}>
				<TextField label={t('workspace.namePlaceholder')} value={name} onInput={setName} autoFocus />
				<LayoutPicker value={layout} choose={setLayout} />
				<div class="nand-dialog-footer">
					<Button type="button" onClick={close}>{t('common.cancel')}</Button>
					<Button type="submit" variant="primary" disabled={!name.trim()}>{t('workbench.newBoard')}</Button>
				</div>
			</form>;
		}
		const close = openDialog(app, { title: t('workspace.newTitle'), content: close => <Body close={close} />, onClose: () => { release(); resolve(result); } });
		release = ownDialog(app, close);
	});
}
