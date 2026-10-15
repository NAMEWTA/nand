import { useState } from 'react';
import type { App } from 'obsidian';
import { t } from '../../../shared/i18n';
import { useT } from '../../../ui/react/hooks';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Label } from '../../../ui/components/label';
import { openReactDialog, dialogOwner } from '../../../ui/react/dialog';

export function confirmAction(
	app: App,
	options: { title: string; message: string; action: string; danger?: boolean },
): Promise<boolean> {
	return new Promise((resolve) => {
		let confirmed = false;
		openReactDialog(dialogOwner(app), {
			title: options.title,
			description: options.message,
			content: (close) => (
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={close}>
						{t('common.cancel')}
					</Button>
					<Button
						variant={options.danger ? 'destructive' : 'default'}
						onClick={() => {
							confirmed = true;
							close();
						}}
					>
						{options.action}
					</Button>
				</div>
			),
			onClose: () => resolve(confirmed),
		});
	});
}
function Prompt({
	label,
	initial,
	placeholder,
	accept,
	close,
}: {
	label: string;
	initial: string;
	placeholder: string;
	accept: (value: string) => void;
	close: () => void;
}) {
	const t = useT(),
		[value, setValue] = useState(initial);
	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				accept(value);
				close();
			}}
		>
			<Label>
				{label}
				<Input autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
			</Label>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={close}>
					{t('common.cancel')}
				</Button>
				<Button type="submit">{t('common.confirm')}</Button>
			</div>
		</form>
	);
}
export function askText(app: App, title: string, label: string, value = '', placeholder = ''): Promise<string | null> {
	return new Promise((resolve) => {
		let result: string | null = null;
		openReactDialog(dialogOwner(app), {
			title,
			content: (close) => (
				<Prompt
					label={label}
					initial={value}
					placeholder={placeholder}
					close={close}
					accept={(v) => {
						result = v.trim() || null;
					}}
				/>
			),
			onClose: () => resolve(result),
		});
	});
}
