// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pomodoro-stats-modal.ts, src/expense-stats-modal.ts
import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../../ui/components/dialog';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { useDashboardLayout, useDashboardTheme } from '../theme/ThemeBridge';
import { widgetClasses } from '../theme/widget-classes';

/** Keep Apex's content/header dimensions while Radix owns focus, Escape and the document portal. */
export function RecordDialog({
	title,
	classes,
	onClose,
	children,
	theme: suppliedTheme,
}: {
	title: string;
	classes: string;
	onClose(this: void): void;
	children: ReactNode;
	theme?: string;
}) {
	const doc = useOwnerDocument(), opener = useRef(doc.activeElement as HTMLElement | null);
	const size = classes.includes('fortune-card--result')
		? 'w-auto sm:max-w-[280px]'
		: classes.includes('fortune-card')
			? 'w-auto sm:max-w-[300px]'
			: classes.includes('calendar-fullscreen')
				? 'sm:max-w-[1100px] max-h-[85vh] p-[16px] pt-[calc(16px+0.75em)] overflow-auto border-0 shadow-none [background:transparent]'
				: classes.includes('ledger-modal')
					? 'sm:max-w-[1080px]'
					: classes.includes('--wide')
						? 'sm:max-w-[1040px]'
						: classes.includes('habit-stats')
							? 'sm:max-w-[480px]'
							: classes.includes('reading-book')
								? 'sm:max-w-[400px]'
								: 'sm:max-w-[380px]';
	const visible = useVisible(),
		theme = useDashboardTheme(),
		layout = useDashboardLayout();
	return (
		<Dialog
			open={visible}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (opener.current?.isConnected) opener.current.focus();
				}}
				showCloseButton={false}
				className={widgetClasses(
					`nand-dashboard-root block gap-0 md:backdrop-blur-none ${classes} ${size} [position:fixed] [font-size:inherit] [font-family:var(--db-font)]`,
				)}
				overlayClassName="md:backdrop-blur-none"
				data-theme={suppliedTheme ?? theme}
				data-dashboard-theme={suppliedTheme ?? theme}
				data-dashboard-layout={layout}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{title}</DialogDescription>
				{children}
			</DialogContent>
		</Dialog>
	);
}
