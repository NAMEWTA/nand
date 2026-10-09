import type { App } from 'obsidian';
import { useState } from 'preact/hooks';
import { t } from '../../shared/i18n';
import { Button } from './Button';
import { openDialog } from './dialog';
import { TextField } from './TextField';

/** Ask for one line of text. Resolves to the trimmed value, or null when cancelled or empty. */
export function promptText(app: App, options: { title: string; label?: string; placeholder?: string; value?: string; confirm?: string }): Promise<string | null> {
	return new Promise((resolve) => {
		let result: string | null = null;
		const holder = { value: options.value ?? '' };
		function Body({ close }: { close: () => void }) {
			const [value, setValue] = useState(holder.value);
			return (
				<TextField
					label={options.label}
					value={value}
					placeholder={options.placeholder}
					autoFocus
					onInput={(next) => {
						holder.value = next;
						setValue(next);
					}}
					onKeyDown={(event) => {
						if (event.key !== 'Enter' || event.isComposing) return;
						event.preventDefault();
						result = holder.value.trim() || null;
						close();
					}}
				/>
			);
		}
		openDialog(app, {
			title: options.title,
			content: (close) => <Body close={close} />,
			footer: (close) => (
				<>
					<Button onClick={close}>{t('common.cancel')}</Button>
					<Button variant="primary" onClick={() => { result = holder.value.trim() || null; close(); }}>{options.confirm ?? t('common.confirm')}</Button>
				</>
			),
			onClose: () => resolve(result),
		});
	});
}
