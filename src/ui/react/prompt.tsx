import type { App } from 'obsidian';
import { useId, useState } from 'react';
import { Button } from '../components/button';
import { Input } from '../components/input';
import { Label } from '../components/label';
import { dialogOwner, openReactDialog } from './dialog';
import { useT } from './hooks';

type PromptOptions = { title: string; label?: string; placeholder?: string; value?: string; confirm?: string };

function PromptBody({ options, submit, close }: { options: PromptOptions; submit: (value: string) => void; close: () => void }) {
	const t = useT();
	const id = useId();
	const [value, setValue] = useState(options.value ?? '');
	return (
		<form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(value); }}>
			<div className="space-y-2">
				{options.label && <Label htmlFor={id}>{options.label}</Label>}
				<Input id={id} aria-label={options.label ?? options.title} placeholder={options.placeholder} value={value} autoFocus onChange={(event) => setValue(event.target.value)} />
			</div>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
				<Button type="submit">{options.confirm ?? t('common.confirm')}</Button>
			</div>
		</form>
	);
}

/** Ask for one line of text. Resolves to the trimmed value, or null when cancelled or empty. */
export function promptText(app: App, options: PromptOptions): Promise<string | null> {
	return new Promise((resolve) => {
		let result: string | null = null;
		openReactDialog(dialogOwner(app), {
			title: options.title,
			content: (close) => <PromptBody options={options} close={close} submit={(value) => { result = value.trim() || null; close(); }} />,
			onClose: () => resolve(result),
		});
	});
}
