import { useRef } from 'react';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../../../../ui/components/alert-dialog';
import { useT } from '../../../../ui/react/hooks';
import { useDashboardTheme, useDashboardLayout } from '../theme/ThemeBridge';
export function RecordConfirm({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
}: {
	open: boolean;
	onOpenChange(this: void, open: boolean): void;
	title: string;
	description: string;
	onConfirm(this: void): void;
}) {
	const t = useT(),
		theme = useDashboardTheme(),
		layout = useDashboardLayout(),
		cancel = useRef<HTMLButtonElement>(null),
		opener = useRef<HTMLElement | null>(null);
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				className="nand-dashboard-root"
				data-theme={theme}
				data-dashboard-layout={layout}
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					opener.current = cancel.current?.ownerDocument.activeElement as HTMLElement | null;
					cancel.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (opener.current?.isConnected) opener.current.focus();
				}}
			>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel ref={cancel}>{t('common.cancel')}</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>{t('common.confirm')}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
