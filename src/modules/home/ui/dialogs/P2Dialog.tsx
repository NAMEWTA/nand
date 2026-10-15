// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-config-modal.ts
import { useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../../ui/components/dialog';
import { Button } from '../../../../ui/components/button';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { useDashboardAppearance, useDashboardTheme, useDashboardLayout } from '../theme/ThemeBridge';
import { p2Classes as c } from '../theme/p2-classes';
export function P2Dialog({
	title,
	children,
	onClose,
	onSave,
	disabled = false,
	width = 560,
	classes = '',
	raw = false,
	footer = true,
}: {
	title: string;
	children: ReactNode;
	onClose: () => void;
	onSave?: () => Promise<void>;
	disabled?: boolean;
	width?: number;
	classes?: string;
	raw?: boolean;
	footer?: boolean;
}) {
	const t = useT(),
		doc = useOwnerDocument(),
		opener = useRef(doc.activeElement as HTMLElement | null),
		visible = useVisible(),
		theme = useDashboardTheme(),
		layout = useDashboardLayout(),
		ref = useDashboardAppearance(true),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	return (
		<Dialog
			open={visible}
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
		>
			<DialogContent
				ref={ref}
				data-theme={theme}
				data-dashboard-layout={layout}
				className={`nand-dashboard-root block border-0 bg-transparent shadow-none p-4 ${raw ? 'h-[86vh] max-h-[86vh] overflow-hidden' : 'max-h-[85vh] overflow-y-auto'} sm:max-w-none`}
				showCloseButton={!raw}
				style={{ width: `min(${width}px, calc(100vw - 40px))`, fontSize: 'var(--font-ui-medium)' }}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (opener.current?.isConnected) opener.current.focus();
				}}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{title}</DialogDescription>
				{raw ? (
					<div className={c(`dashboard-modal ${classes}`)} style={{ fontSize: 'var(--font-ui-medium)' }}>
						{children}
					</div>
				) : (
					<div
						className={c(`dashboard-modal dashboard-modal--compact ${classes}`)}
						style={{ fontSize: 'var(--font-ui-medium)' }}
					>
						<div className={c('dashboard-modal-header')}>
							<div className={c('dashboard-modal-title')}>{title}</div>
						</div>
						<div className={c('dashboard-modal-body')}>
							{children}
							{error && (
								<p role="alert" className="text-destructive">
									{error}
								</p>
							)}
						</div>
						{footer && (
							<div className={c('dashboard-modal-footer')}>
								<Button
									size="xs"
									variant="outline"
									disabled={busy}
									className={c('dashboard-modal-btn dashboard-modal-btn--cancel')}
									onClick={onClose}
								>
									{t('common.cancel')}
								</Button>
								{onSave && (
									<Button
										size="xs"
										disabled={disabled || busy}
										className={c('dashboard-modal-btn dashboard-modal-btn--confirm')}
										onClick={() => {
											setBusy(true);
											void onSave()
												.then(onClose)
												.catch((e) => setError(e instanceof Error ? e.message : String(e)))
												.finally(() => setBusy(false));
										}}
									>
										{t('common.save')}
									</Button>
								)}
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
