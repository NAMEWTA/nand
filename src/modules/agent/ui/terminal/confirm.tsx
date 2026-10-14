import type { App } from 'obsidian';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { t } from '../../../../shared/i18n';
import { ContainerProviders } from '../../../../ui/react/providers';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../../../../ui/components/alert-dialog';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '../../../../ui/components/dialog';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
function dialogRoot<T>(
	app: App,
	render: (finish: (value: T) => void) => React.ReactNode,
	fallback: T,
	signal?: AbortSignal,
): Promise<T> {
	if (signal?.aborted) return Promise.resolve(fallback);
	return new Promise((resolve) => {
		const doc = (app.workspace.getMostRecentLeaf()?.view.containerEl ?? app.workspace.containerEl).ownerDocument;
		const container = doc.body.createDiv({ cls: 'nand-ui' }),
			root = createRoot(container);
		let finished = false;
		const abort = () => finish(fallback);
		const finish = (value: T) => {
			if (finished) return;
			finished = true;
			signal?.removeEventListener('abort', abort);
			queueMicrotask(() => {
				root.unmount();
				container.remove();
				resolve(value);
			});
		};
		signal?.addEventListener('abort', abort, { once: true });
		root.render(<ContainerProviders container={container}>{render(finish)}</ContainerProviders>);
	});
}
export function confirmAction(app: App, message: string, signal?: AbortSignal): Promise<boolean> {
	return dialogRoot(
		app,
		(finish) => (
			<AlertDialog
				defaultOpen
				onOpenChange={(open) => {
					if (!open) finish(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogTitle>{t('agent.confirmTitle')}</AlertDialogTitle>
					<AlertDialogDescription>{message}</AlertDialogDescription>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => finish(false)}>{t('common.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => finish(true)}
						>
							{t('agent.end')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		),
		false,
		signal,
	);
}
function Prompt({ title, value, finish }: { title: string; value: string; finish: (value: string | null) => void }) {
	const [draft, setDraft] = useState(value);
	return (
		<Dialog
			defaultOpen
			onOpenChange={(open) => {
				if (!open) finish(null);
			}}
		>
			<DialogContent>
				<DialogTitle>{title}</DialogTitle>
				<Input
					autoFocus
					aria-label={title}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.nativeEvent.isComposing) finish(draft.trim() || null);
					}}
				/>
				<DialogFooter>
					<Button onClick={() => finish(draft.trim() || null)}>{t('common.save')}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
export function promptText(app: App, title: string, value: string): Promise<string | null> {
	return dialogRoot(app, (finish) => <Prompt title={title} value={value} finish={finish} />, null as string | null);
}
