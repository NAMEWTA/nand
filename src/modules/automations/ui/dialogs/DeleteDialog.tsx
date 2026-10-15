import { useTransient } from '../use-transient';
// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationDeleteDialogs.tsx
import { useId, useState } from 'react';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogCancel,
} from '../../../../ui/components/alert-dialog';
import { Button } from '../../../../ui/components/button';
import { Checkbox } from '../../../../ui/components/checkbox';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
import type { AutomationDefinition } from '../../../../shared/automation/types';
export function DeleteDialog({
	definition,
	onCancel,
	onConfirm,
}: {
	definition: AutomationDefinition;
	onCancel: () => void;
	onConfirm: (skipConfirmation: boolean) => Promise<void>;
}) {
	const t = useT(),
		layer = useTransient(),
		id = useId(),
		[skip, setSkip] = useState(false),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	return (
		<AlertDialog
			open
			onOpenChange={(open) => {
				if (!open && !busy) onCancel();
			}}
		>
			<AlertDialogContent onCloseAutoFocus={layer.onCloseAutoFocus} className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle className="text-sm">
						{t('automation.deleteNamed', { name: definition.name })}
					</AlertDialogTitle>
					<AlertDialogDescription className="text-xs">
						{t('automation.deleteKeepsHistory')}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex items-center gap-2">
					<Checkbox id={id} checked={skip} onCheckedChange={(v) => setSkip(v === true)} />
					<Label htmlFor={id}>{t('automation.dontAskAgain')}</Label>
				</div>
				{error && (
					<p role="alert" className="text-xs text-destructive">
						{error}
					</p>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>{t('automation.cancel')}</AlertDialogCancel>
					<Button
						variant="destructive"
						disabled={busy}
						onClick={() => {
							setBusy(true);
							void onConfirm(skip)
								.catch((e) => setError(String(e)))
								.finally(() => setBusy(false));
						}}
					>
						{t('automation.delete')}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
