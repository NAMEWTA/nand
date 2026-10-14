// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/modal-theme.ts
import { useRef, type ReactNode } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from '../../../../ui/components/dialog';
import { Button } from '../../../../ui/components/button';
import { useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { useDashboardLayout, useDashboardTheme } from '../theme/ThemeBridge';
export function DashboardDialog({
	title,
	children,
	onClose,
	onSave,
	wide = false,
	busy = false,
}: {
	title: string;
	children: ReactNode;
	onClose(this: void): void;
	onSave?(this: void): void;
	wide?: boolean;
	busy?: boolean;
}) {
	const visible = useVisible();
	const cancel = useRef<HTMLButtonElement>(null);
	const theme = useDashboardTheme(),
		layout = useDashboardLayout(),
		t = useT();
	return (
		<Dialog
			open={visible}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				overlayClassName={layout === 'mobile' ? 'md:backdrop-blur-none' : undefined}
				className={`nand-dashboard-root ${layout === 'mobile' ? 'md:backdrop-blur-none' : ''} ${wide ? 'sm:max-w-4xl' : 'sm:max-w-xl'} max-h-[85vh] overflow-y-auto bg-popover text-popover-foreground`}
				data-theme={theme}
				data-dashboard-layout={layout}
				data-dashboard-theme={theme}
				onOpenAutoFocus={(e) => {
					if (!onSave) {
						e.preventDefault();
						cancel.current?.focus();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription className="sr-only">{title}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">{children}</div>
				<DialogFooter>
					<Button ref={cancel} variant="outline" onClick={onClose}>
						{t('common.cancel')}
					</Button>
					{onSave && (
						<Button disabled={busy} onClick={onSave}>
							{t('common.save')}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
