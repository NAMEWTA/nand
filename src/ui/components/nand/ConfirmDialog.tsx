import { useState, type ReactNode } from 'react';
import {
	AlertDialog,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../alert-dialog';
import { buttonVariants } from '../button';
import { useT } from '../../react/hooks';
export function ConfirmDialog({
	title,
	description,
	children,
	onConfirm,
	destructive = false,
	confirmLabel,
}: {
	title: string;
	description: string;
	children: ReactNode;
	onConfirm: () => void | Promise<void>;
	destructive?: boolean;
	confirmLabel?: string;
}) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const confirm = async () => {
		if (busy) return;
		setBusy(true);
		setError('');
		try {
			await onConfirm();
			setOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusy(false);
		}
	};
	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!busy) {
					setOpen(next);
					setError('');
				}
			}}
		>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent aria-busy={busy}>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>{t('ui.cancel')}</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
						onClick={(event) => {
							event.preventDefault();
							void confirm();
						}}
					>
						{confirmLabel ?? t('ui.confirm')}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
