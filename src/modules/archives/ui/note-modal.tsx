import { useState } from 'react';
import type { App } from 'obsidian';
import { openReactDialog, dialogOwner } from '../../../ui/react/dialog';
import { useT } from '../../../ui/react/hooks';
import { Input } from '../../../ui/components/input';
import { Label } from '../../../ui/components/label';
import { Button } from '../../../ui/components/button';
import { ct, errorText } from './forms';
function NoteForm({ create, close }: { create: (name: string) => Promise<void>; close: () => void }) {
	useT();
	const [name, setName] = useState(''),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (busy) return;
				setBusy(true);
				void create(name)
					.then(close)
					.catch((reason) => setError(errorText(reason)))
					.finally(() => setBusy(false));
			}}
		>
			<Label className="flex flex-col items-stretch gap-2">
				{ct('fileName')}
				<Input autoFocus value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
			</Label>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" disabled={busy} onClick={close}>
					{ct('cancel')}
				</Button>
				<Button type="submit" disabled={busy}>
					{ct('save')}
				</Button>
			</div>
		</form>
	);
}
export class ArchiveNoteModal {
	constructor(
		private app: App,
		private create: (name: string) => Promise<void>,
	) {}
	open() {
		openReactDialog(dialogOwner(this.app), {
			title: ct('newNote'),
			content: (close) => <NoteForm create={this.create} close={close} />,
		});
	}
}
