import { useId, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { View, type App } from 'obsidian';
import { ContainerProviders } from './providers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/dialog';

/** Follow the initiating view and its React surface, including an Obsidian popout. */
export function dialogOwner(app: App): HTMLElement {
	const view = app.workspace.getActiveViewOfType?.(View)?.containerEl ?? app.workspace.containerEl;
	return view.ownerDocument.activeElement?.closest<HTMLElement>('[role="dialog"], .nand-ui') ?? view;
}

/** A Radix dialog for commands originating outside a React tree. The caller owns its lifetime. */
export function openReactDialog(
	owner: HTMLElement,
	options: {
		title: string;
		description?: string;
		className?: string;
		content: (close: () => void) => ReactNode;
		onClose?: () => void;
		canClose?: () => boolean;
	},
): { close: () => void } {
	const doc = owner.ownerDocument;
	const previous = doc.activeElement as HTMLElement | null;
	const container = doc.createElement('div');
	container.className = 'nand-ui';
	doc.body.append(container);
	const root = createRoot(container);
	let disposed = false;
	const win = doc.defaultView;
	const Observer = (win as (Window & { MutationObserver?: typeof MutationObserver }) | null)?.MutationObserver;
	const observer = Observer
		? new Observer(() => {
				if (!owner.isConnected || owner.ownerDocument !== doc) close();
			})
		: undefined;
	const close = () => {
		if (disposed) return;
		disposed = true;
		observer?.disconnect();
		win?.removeEventListener('unload', close);
		// Event handlers may close their own root; unmount after the current React dispatch.
		queueMicrotask(() => {
			root.unmount();
			container.remove();
			if (previous?.isConnected && previous.ownerDocument === doc) previous.focus();
			options.onClose?.();
		});
	};
	observer?.observe(doc.body, { childList: true, subtree: true });
	win?.addEventListener('unload', close, { once: true });
	function Content() {
		const [open, setOpen] = useState(true);
		const descriptionId = useId();
		return (
			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!next && options.canClose?.() !== false) {
						setOpen(false);
						close();
					}
				}}
			>
				<DialogContent
					className={options.className}
					onCloseAutoFocus={(event) => event.preventDefault()}
					aria-describedby={options.description ? descriptionId : undefined}
				>
					<DialogHeader>
						<DialogTitle>{options.title}</DialogTitle>
						{options.description && (
							<DialogDescription id={descriptionId}>{options.description}</DialogDescription>
						)}
					</DialogHeader>
					{options.content(close)}
				</DialogContent>
			</Dialog>
		);
	}
	root.render(
		<ContainerProviders container={container}>
			<Content />
		</ContainerProviders>,
	);
	return { close };
}
