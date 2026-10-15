import { useState, type ReactNode } from 'react';
import { Platform } from 'obsidian';
import { toast } from 'sonner';
import type IconicController from '../../platform/host/controller';
import { internalApp } from '../../platform/utils/obsidian-internal';
import { openReactDialog, dialogOwner } from '../../../../ui/react/dialog';
import { t } from '../../../../shared/i18n';
export function openIconicDialog(
	plugin: IconicController,
	title: string,
	content: (close: () => void) => ReactNode,
	onClose?: () => void,
) {
	function Commands({ close }: { close: () => void }) {
		const [, render] = useState(0);
		return (
			<div
				className="min-w-0 space-y-4"
				onKeyDownCapture={(event) => {
					if (event.nativeEvent.isComposing) return;
					for (const command of plugin.dialogCommands) {
						const hotkeys = internalApp(plugin.app).hotkeyManager?.customKeys?.[command.id] ?? [];
						if (
							hotkeys.some(
								(hotkey) =>
									hotkey.key.toLowerCase() === event.key.toLowerCase() &&
									event.altKey === hotkey.modifiers.includes('Alt') &&
									event.shiftKey === hotkey.modifiers.includes('Shift') &&
									event.ctrlKey ===
										(hotkey.modifiers.includes('Ctrl') ||
											(!Platform.isMacOS && hotkey.modifiers.includes('Mod'))) &&
									event.metaKey ===
										(hotkey.modifiers.includes('Meta') ||
											(Platform.isMacOS && hotkey.modifiers.includes('Mod'))),
							)
						) {
							event.preventDefault();
							event.stopPropagation();
							command.callback?.();
							render((v) => v + 1);
							break;
						}
					}
				}}
			>
				{content(close)}
			</div>
		);
	}
	const dialog = openReactDialog(dialogOwner(plugin.app), {
		title,
		className: 'w-[min(760px,calc(100vw-2rem))] sm:max-w-3xl max-h-[90vh] overflow-y-auto',
		content: (close) => <Commands close={close} />,
		onClose: () => {
			plugin.forgetDialog(dialog);
			onClose?.();
			void plugin.saveSettings().catch(() => toast.error(t('settings.writeFailed')));
		},
	});
	plugin.trackDialog(dialog);
	return dialog;
}
