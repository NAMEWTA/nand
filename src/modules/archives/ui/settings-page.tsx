// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useState, useSyncExternalStore } from 'react';
import { FuzzySuggestModal, TFolder, type App } from 'obsidian';
import { toast } from 'sonner';
import { validContactsFolder, type ContactsSettings } from '../../../shared/contacts-settings';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { ContactsController } from '../platform/controller';
import { confirm, ct, errorText } from './forms';
import { useT } from '../../../ui/react/hooks';
import { SettingsRow } from '../../../ui/components/nand/SettingsRow';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { Choice } from '../../../ui/components/nand/Choice';
import { Input } from '../../../ui/components/input';
import { Button } from '../../../ui/components/button';
class ArchiveFolderPicker extends FuzzySuggestModal<TFolder> {
	constructor(
		app: App,
		private done: (path: string) => void,
	) {
		super(app);
		this.setPlaceholder(ct('folder'));
		this.emptyStateText = ct('noMatchingFolders');
	}
	getItems() {
		return this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && validContactsFolder(file.path));
	}
	getItemText(folder: TFolder) {
		return folder.path;
	}
	onChooseItem(folder: TFolder) {
		this.done(folder.path);
	}
}
export function archivesSettingsPage(
	app: App,
	controller: ContactsController,
	settings: SettingsHandle<ContactsSettings>,
) {
	return function ArchivesSettingsPage() {
		useT();
		const value = useSyncExternalStore(
				(listener) => settings.subscribe(listener),
				() => settings.get(),
			),
			[candidate, setCandidate] = useState(value.rootFolder),
			[busy, setBusy] = useState(false);
		const preview = async () => {
			setBusy(true);
			try {
				const root = candidate.trim().replace(/\\/g, '/').replace(/\/$/, '');
				if (!validContactsFolder(root)) {
					toast.error(ct('invalidFolder'));
					return;
				}
				const count = await controller.countFolder(root);
				if (!(await confirm(app, ct('folderPreview', { folder: root, count }), ct('apply')))) return;
				await controller.queue.settled();
				const previous = settings.get().rootFolder;
				try {
					await settings.update(
						(draft) => {
							draft.rootFolder = root;
						},
						{ persist: 'immediate' },
					);
				} catch (error) {
					void settings
						.update((draft) => {
							draft.rootFolder = previous;
						})
						.catch(() => undefined);
					throw error;
				}
				await controller.reload();
			} catch (error) {
				toast.error(errorText(error));
			} finally {
				setBusy(false);
			}
		};
		return (
			<SettingsSection title={ct('storage')}>
				<SettingsRow
					label={ct('folder')}
					description={ct('folderHint')}
					className="flex-wrap [&>div:last-child]:w-full"
					control={
						<div className="flex flex-wrap gap-2">
							<Input
								aria-label={ct('folder')}
								className="min-w-40 flex-1"
								value={candidate}
								onChange={(e) => setCandidate(e.target.value)}
							/>
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => new ArchiveFolderPicker(app, setCandidate).open()}
							>
								{ct('browse')}
							</Button>
							<Button
								disabled={busy}
								onClick={() => {
									void preview();
								}}
							>
								{ct('preview')}
							</Button>
						</div>
					}
				/>
				<SettingsRow
					label={ct('columns')}
					description={ct('columnsHint')}
					control={
						<Choice
							label={ct('columns')}
							value={String(value.maxColumns)}
							options={[
								['5', '5'],
								['6', '6'],
							]}
							onChange={(v) => {
								void settings
									.update((draft) => {
										draft.maxColumns = v === '5' ? 5 : 6;
									})
									.catch((error) => toast.error(errorText(error)));
							}}
						/>
					}
				/>
			</SettingsSection>
		);
	};
}
