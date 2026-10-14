// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/browser-pane/annotate/MarkupDrawButton.tsx and assemble-chrome/browser-chrome-element-tool-buttons.tsx
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Popover, PopoverAnchor, PopoverContent } from '../../../../ui/components/popover';
import { toast } from 'sonner';
import type { BrowserPageHandle } from '../../api';
import type { BrowserEngine } from '../../services/host';
import type { BrowserGrab } from '../../core/model';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Textarea } from '../../../../ui/components/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../ui/components/dialog';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '../../../../ui/components/dropdown-menu';
import { MarkupPanel } from './MarkupCanvas';
type Intent = 'copy' | 'annotate' | 'draw' | 'screenshot' | 'full' | 'annotations';
export function DesignTools({
	host,
	page,
	intent,
	reset,
}: {
	host: BrowserEngine;
	page: BrowserPageHandle;
	intent: Intent | undefined;
	reset: () => void;
}) {
	const t = useT(),
		[grab, setGrab] = useState<BrowserGrab>(),
		[image, setImage] = useState(''),
		[drawing, setDrawing] = useState(false),
		[note, setNote] = useState('');
	const annotations = useStore(page.store, (state) => state.annotations);
	const setAnnotations = (items: typeof annotations) => page.setAnnotations(items);
	const list = intent === 'annotations';
	const [agents, setAgents] = useState<Array<{ id: string; title: string }>>([]);
	useEffect(() => {
		if (!intent || intent === 'annotations') return;
		let live = true;
		const start = async () => {
			if (intent === 'copy' || intent === 'annotate')
				await page.startGrab(intent, (value) => {
					if (live) {
						setGrab(value);
						setNote('');
					}
				});
			else {
				const data = await page.captureScreenshot(intent === 'full');
				if (live) {
					setImage(data);
					setDrawing(intent === 'draw');
				}
			}
		};
		void start().catch((error) => {
			toast.error(String(error));
			reset();
		});
		return () => {
			live = false;
			void page.stopGrab().catch(() => undefined);
		};
	}, [intent, page, reset]);
	const text = (item: BrowserGrab) =>
		`${item.title}\n${item.url}\n${item.selector}\n${item.text}\n${item.html.slice(0, 2048)}\n${JSON.stringify(item.styles)}${item.source ? '\n' + item.source : ''}`;
	const attach = (id: string) => {
		const content = list
			? annotations.map((a) => `${text(a.grab)}\n${a.note}`).join('\n\n')
			: grab
				? `${text(grab)}\n${note}`
				: page.url;
		const pictures = list
			? annotations.flatMap((a) => (a.grab.screenshot ? [a.grab.screenshot] : []))
			: image
				? [image]
				: grab?.screenshot
					? [grab.screenshot]
					: [];
		void host
			.attach(id, content, pictures)
			.then(() => {
				toast.success(t('browser.attached'));
				if (list) setAnnotations([]);
				setGrab(undefined);
				setImage('');
				reset();
			})
			.catch((error) => toast.error(String(error)));
	};
	const chooser = (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open)
					void host.agents
						.list(page.id)
						.then(setAgents)
						.catch((error) => toast.error(String(error)));
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button>{t('browser.attach')}</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{agents.length ? (
					agents.map((agent) => (
						<DropdownMenuItem key={agent.id} onSelect={() => attach(agent.id)}>
							{agent.title}
						</DropdownMenuItem>
					))
				) : (
					<DropdownMenuItem disabled>{t('browser.noAgents')}</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
	const close = () => {
		setGrab(undefined);
		setImage('');
		reset();
	};
	const Surface = grab ? PopoverContent : DialogContent;
	const bounds = page.viewportBounds();
	const anchor = {
		current: {
			getBoundingClientRect: () =>
				new DOMRect(
					bounds.left + (grab?.rect.x ?? 0),
					bounds.top + (grab?.rect.y ?? 0),
					grab?.rect.width ?? 0,
					grab?.rect.height ?? 0,
				),
		},
	};
	return (
		<>
			<Dialog
				open={!grab && (!!image || list)}
				onOpenChange={(open) => {
					if (!open) close();
				}}
			>
				<Popover
					open={!!grab}
					onOpenChange={(open) => {
						if (!open) close();
					}}
				>
					<PopoverAnchor virtualRef={anchor} />
					<Surface
						aria-label={t('browser.selection')}
						className={
							drawing
								? 'flex h-[95vh] w-[98vw] max-w-[98vw] flex-col sm:max-w-[98vw]'
								: grab
									? 'w-96 max-h-[75vh] space-y-3 overflow-y-auto p-3'
									: 'max-h-[85vh] max-w-2xl overflow-y-auto'
						}
					>
						{!grab && (
							<DialogHeader>
								<DialogTitle>
									{t(
										drawing
											? 'browser.markup'
											: list
												? 'browser.annotations'
												: grab
													? 'browser.selection'
													: 'browser.screenshot',
									)}
								</DialogTitle>
								<DialogDescription>{t('browser.material')}</DialogDescription>
							</DialogHeader>
						)}
						{drawing ? (
							<MarkupPanel
								data={image}
								viewportWidth={page.viewportWidth()}
								close={close}
								finish={(data) => {
									setImage(data);
									setDrawing(false);
								}}
							/>
						) : (
							<>
								{grab && (
									<>
										{grab.screenshot && (
											<img
												alt={t('browser.selection')}
												src={grab.screenshot}
												className="max-h-48 rounded-md object-contain"
											/>
										)}
										<p className="text-sm">{grab.text.slice(0, 1000)}</p>
										<code className="break-all text-xs">{grab.selector}</code>
										<pre className="max-h-40 overflow-auto text-xs">{grab.html.slice(0, 2048)}</pre>
										<pre className="max-h-32 overflow-auto text-xs">
											{JSON.stringify(grab.styles, null, 2)}
										</pre>
										<p className="text-xs text-muted-foreground">
											{grab.source || t('browser.sourceMissing')}
										</p>
										{intent === 'annotate' && (
											<>
												<Textarea
													aria-label={t('browser.annotationHint')}
													placeholder={t('browser.annotationHint')}
													value={note}
													onChange={(e) => setNote(e.target.value)}
												/>
												<Button
													disabled={!note.trim()}
													onClick={() => {
														setAnnotations([...annotations, { grab, note }]);
														setGrab(undefined);
														setNote('');
														void page
															.startGrab('annotate', setGrab)
															.catch((error) => toast.error(String(error)));
													}}
												>
													{t('browser.save')}
												</Button>
											</>
										)}
										<div className="flex flex-wrap gap-2">
											<Button variant="outline" onClick={() => host.copyText(grab.text)}>
												{t('browser.copyText')}
											</Button>
											<Button variant="outline" onClick={() => host.copyText(grab.selector)}>
												{t('browser.copySelector')}
											</Button>
											<Button
												variant="outline"
												onClick={() => host.copyText(grab.html.slice(0, 2048))}
											>
												{t('browser.copyHtml')}
											</Button>
											{grab.screenshot && (
												<Button
													variant="outline"
													onClick={() => host.copyImage(grab.screenshot!)}
												>
													{t('browser.copyImage')}
												</Button>
											)}
											<Button
												variant="outline"
												onClick={() => {
													setGrab(undefined);
													void page.startGrab(
														intent === 'annotate' ? 'annotate' : 'copy',
														setGrab,
													);
												}}
											>
												{t('browser.reselect')}
											</Button>
										</div>
									</>
								)}
								{image && (
									<>
										<img
											alt={t('browser.screenshot')}
											src={image}
											className="max-h-[60vh] object-contain"
										/>
										<Button variant="outline" onClick={() => host.copyImage(image)}>
											{t('browser.copyImage')}
										</Button>
									</>
								)}
								{list &&
									annotations.map((annotation, i) => (
										<div key={i} className="space-y-2 rounded-md border p-3">
											<code className="text-xs">{annotation.grab.selector}</code>
											<Textarea
												aria-label={t('browser.annotationHint')}
												value={annotation.note}
												onChange={(e) =>
													setAnnotations(
														annotations.map((a, j) =>
															i === j ? { ...a, note: e.target.value } : a,
														),
													)
												}
											/>
											<Button
												variant="ghost"
												onClick={() => setAnnotations(annotations.filter((_, j) => i !== j))}
											>
												{t('browser.delete')}
											</Button>
										</div>
									))}
								<div className="flex gap-2">
									{chooser}
									<Button variant="outline" onClick={close}>
										{t('browser.close')}
									</Button>
								</div>
							</>
						)}
					</Surface>
				</Popover>
			</Dialog>
		</>
	);
}
