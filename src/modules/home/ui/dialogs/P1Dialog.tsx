// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/theme-studio-modal.ts
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../../ui/components/dialog';
import { useVisible, useOwnerDocument } from '../../../../ui/react/contexts';
import { useDashboardAppearance } from '../theme/ThemeBridge';
import { p1Classes } from '../theme/p1-classes';
/** Apex content geometry; the design-system Dialog owns portal, focus trap and Escape. */
export function P1Dialog({
	title,
	classes,
	children,
	onClose,
	width = 640,
	height,
	contentHeight,
}: {
	title: string;
	classes: string;
	children: ReactNode;
	onClose: () => void;
	width?: number;
	height?: string;
	contentHeight?: string;
}) {
	const visible = useVisible(),
		ref = useDashboardAppearance(true),
		doc = useOwnerDocument(),
		opener = useRef(doc.activeElement as HTMLElement | null);
	return (
		<Dialog
			open={visible}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				ref={ref}
				className="nand-dashboard-root block max-h-[85vh] overflow-y-auto p-4 [scrollbar-width:thin] sm:max-w-none"
				style={{ width: `min(${width}px, calc(100vw - 40px))`, height, maxHeight: height }}
				onCloseAutoFocus={(e) => {
					e.preventDefault();
					if (opener.current?.isConnected) opener.current.focus();
				}}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{title}</DialogDescription>
				<div
					style={{
						height: contentHeight,
						fontSize: /dashboard-(pmsec-board|skillsec-detail)/.test(classes)
							? 'var(--font-ui-medium)'
							: undefined,
					}}
					className={p1Classes(classes)}
				>
					{children}
				</div>
			</DialogContent>
		</Dialog>
	);
}
