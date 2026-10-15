// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/theme-studio-modal.ts
import type { App } from 'obsidian';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '../../../../ui/components/command';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { useT } from '../../../../ui/react/hooks';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function DashboardImagePicker({
	app,
	onPick,
	onClose,
}: {
	app: App;
	onPick: (path: string) => void;
	onClose: () => void;
}) {
	const t = useT();
	return (
		<DashboardDialog title={t('home.dashboard.image')} onClose={onClose}>
			<Command>
				<CommandInput aria-label={t('home.dashboard.image')} placeholder={t('ui.search')} />
				<CommandList>
					<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
					{contentFiles(app)
						.getFiles()
						.filter((file) => /^(png|jpe?g|webp|gif|svg|avif)$/i.test(file.extension))
						.map((file) => (
							<CommandItem key={file.path} value={file.path} onSelect={() => onPick(file.path)}>
								{file.path}
							</CommandItem>
						))}
				</CommandList>
			</Command>
		</DashboardDialog>
	);
}
