// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.; shadcn/ui (MIT).
// Original: src/renderer/src/components/ui/sonner.tsx
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { createPortal } from 'react-dom';
import { useT } from '../react/hooks';
import { usePortalContainer } from '../react/contexts';
export { toast } from 'sonner';

const Toaster = ({ container, ...props }: ToasterProps & { container?: HTMLElement }) => {
	const portal = usePortalContainer();
	const t = useT();

	return createPortal(
		<Sonner
			theme="light"
			position="bottom-right"
			containerAriaLabel={t('ui.toastMessage')}
			// Why: Orca has persistent bottom chrome, so bottom-right toasts need
			// breathing room above the status bar instead of sitting on its edge.
			// mobileOffset keeps that clearance below Sonner's 600px breakpoint
			// (narrow/resized windows and the web client), which otherwise reverts
			// to Sonner's default 16px and lets toasts crowd the status bar again.
			offset={{ bottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
			mobileOffset={{ bottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					zIndex: 'var(--layer-notice)',
					fontFamily: 'var(--nd-font-sans)',
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': 'var(--radius)',
					'--width': 'min(26rem, calc(100vw - 2rem))',
				} as React.CSSProperties
			}
			{...props}
		/>,
		container ?? portal,
	);
};

export { Toaster };
