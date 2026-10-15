/** Real-browser fixture: built with the production dependency adapters. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NandProviders } from '../../src/ui/react/providers';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '../../src/ui/components/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../../src/ui/components/sheet';
import { Button } from '../../src/ui/components/button';
import { Switch } from '../../src/ui/components/switch';
import { Label } from '../../src/ui/components/label';
import { Checkbox } from '../../src/ui/components/checkbox';
import { Toggle } from '../../src/ui/components/toggle';
import { Input } from '../../src/ui/components/input';
import { Textarea } from '../../src/ui/components/textarea';
import { ScrollArea } from '../../src/ui/components/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../../src/ui/components/resizable';
import { ToggleGroup, ToggleGroupItem } from '../../src/ui/components/toggle-group';
import { Progress } from '../../src/ui/components/progress';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../src/ui/components/select';
import { SegmentedControl } from '../../src/ui/components/nand/SegmentedControl';
import { Command } from '../../src/ui/components/command';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from '../../src/ui/components/dropdown-menu';
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
} from '../../src/ui/components/context-menu';

const docs = { main: document, other: document.querySelector('iframe')!.contentDocument! };
const controls = {} as Record<string, (part: string, open: boolean) => void>;
const listeners = new Map<Document, Map<string, Set<EventListenerOrEventListenerObject>>>();
const roots: ReturnType<typeof createRoot>[] = [];
const observers = new Map<Document, Set<ResizeObserver>>();
const resizeErrors: string[] = [];
for (const doc of Object.values(docs)) {
	const win = doc.defaultView!;
	const active = new Set<ResizeObserver>();
	observers.set(doc, active);
	const NativeResizeObserver = win.ResizeObserver;
	win.ResizeObserver = class extends NativeResizeObserver {
		private readonly nodes = new Set<Element>();
		override observe(target: Element, options?: ResizeObserverOptions) {
			this.nodes.add(target);
			active.add(this);
			super.observe(target, options);
		}
		override unobserve(target: Element) {
			this.nodes.delete(target);
			if (!this.nodes.size) active.delete(this);
			super.unobserve(target);
		}
		override disconnect() {
			this.nodes.clear();
			active.delete(this);
			super.disconnect();
		}
	};
	win.addEventListener('error', (event) => {
		if (event.message.includes('ResizeObserver')) resizeErrors.push(event.message);
	});
	// Track precisely the document listeners that modal dependencies must clean up.
	const tracked = new Map<string, Set<EventListenerOrEventListenerObject>>();
	listeners.set(doc, tracked);
	const add = doc.addEventListener.bind(doc),
		remove = doc.removeEventListener.bind(doc);
	doc.addEventListener = ((
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	) => {
		const key = type + ':' + (typeof options === 'boolean' ? options : !!options?.capture);
		if (!tracked.has(key)) tracked.set(key, new Set());
		tracked.get(key)!.add(listener);
		add(type, listener, options);
	}) as typeof doc.addEventListener;
	doc.removeEventListener = ((
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	) => {
		const key = type + ':' + (typeof options === 'boolean' ? options : !!options?.capture);
		tracked.get(key)?.delete(listener);
		remove(type, listener, options);
	}) as typeof doc.removeEventListener;
	Object.defineProperty(doc.body, 'createDiv', {
		value: (options?: { cls?: string }) => {
			const div = doc.createElement('div');
			div.className = options?.cls ?? '';
			doc.body.append(div);
			return div;
		},
	});
	doc.body.className = 'theme-light';
}
// R1: the real control must remain the parent's layout item and Label's peer.
function LayoutSamples({ id }: { id: string }) {
	return (
		<div data-layout style={{ width: 300 }}>
			<div data-case="stretch" style={{ display: 'flex', height: 36 }}>
				<Button size="xs" style={{ height: 'auto' }}>
					Stretch
				</Button>
			</div>
			<div data-case="connected">
				<ToggleGroup type="single" size="xs" variant="outline">
					<ToggleGroupItem value="a" aria-label="joined first">
						<svg aria-hidden />
					</ToggleGroupItem>
					<ToggleGroupItem value="b" aria-label="joined second">
						<svg aria-hidden />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<div data-case="orca-split">
				<div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border bg-background shadow-xs">
					<Button variant="ghost" size="xs" className="rounded-none border-0 shadow-none">
						Edit File in Orca
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						className="rounded-none border-l border-border"
						aria-label="file menu"
					>
						<svg className="size-3" />
					</Button>
				</div>
			</div>
			<div data-case="row-top" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
				<span style={{ lineHeight: '20px' }}>Label</span>
				<Switch aria-label="top switch" />
			</div>
			<div data-case="positioned" style={{ position: 'relative', height: 24 }}>
				<Button size="icon-xs" className="absolute" style={{ left: 12, top: 0 }} aria-label="absolute icon">
					X
				</Button>
			</div>
			<div data-case="full">
				<Button size="xs" className="w-full">
					Full
				</Button>
			</div>
			<div data-case="flex" style={{ display: 'flex', gap: 8 }}>
				<Button size="xs" className="flex-1">
					Left
				</Button>
				<Button size="xs" className="flex-1">
					Right
				</Button>
			</div>
			<div data-case="hidden" style={{ display: 'flex' }}>
				<Button size="xs" className="hidden">
					Hidden
				</Button>
				<span>After</span>
			</div>
			<div data-case="hidden-attribute" style={{ display: 'flex' }}>
				<Button size="icon-xs" hidden>
					H
				</Button>
				<span>After</span>
			</div>
			<div data-case="peer" style={{ display: 'flex', alignItems: 'center' }}>
				<Checkbox id={id + '-disabled'} disabled />
				<Label htmlFor={id + '-disabled'}>Disabled label</Label>
			</div>
			<div data-case="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
				<Button size="xs" style={{ gridColumn: 'span 2', width: '100%' }}>
					Grid span
				</Button>
				<Button size="xs">Left</Button>
				<Button size="xs">Right</Button>
			</div>
			<div data-case="style">
				<Button size="xs" style={{ width: 120, marginLeft: 12 }}>
					Style
				</Button>
			</div>
			<div data-case="as-child">
				<Button size="xs" asChild className="w-full">
					<a
						href="#layout"
						data-ref="pending"
						ref={(node) => {
							if (node) node.dataset.ref = node.tagName;
						}}
					>
						Link
					</a>
				</Button>
			</div>
			<div data-case="compact-flex" style={{ display: 'flex', gap: 8 }}>
				<Toggle size="xs" className="flex-1">
					One
				</Toggle>
				<Toggle size="xs" className="flex-1">
					Two
				</Toggle>
			</div>
			<div data-case="group">
				<ToggleGroup type="single" size="xs" variant="outline" className="w-full">
					<ToggleGroupItem value="a" className="flex-1">
						One
					</ToggleGroupItem>
					<ToggleGroupItem value="b" className="flex-1">
						Two
					</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<div data-case="segmented">
				<SegmentedControl
					equalWidth
					value="a"
					onChange={() => {}}
					options={[
						{ value: 'a', label: 'One', tooltip: 'First' },
						{ value: 'b', label: 'Two' },
					]}
				/>
			</div>
			<div data-case="compact-hidden" style={{ display: 'flex' }}>
				<Checkbox className="hidden" />
				<Switch className="hidden" />
				<Toggle size="xs" className="hidden">
					Hidden
				</Toggle>
				<ToggleGroup type="single" size="xs">
					<ToggleGroupItem value="h" className="hidden">
						Hidden
					</ToggleGroupItem>
				</ToggleGroup>
				<span>After</span>
			</div>
		</div>
	);
}
function Samples({ id }: { id: string }) {
	const [open, setOpen] = useState<Record<string, boolean>>({});
	controls[id] = (part, value) => setOpen((previous) => ({ ...previous, [part]: value }));
	return (
		<>
			<div className="fixture-controls">
				<Button size="icon-xs" aria-label="small icon">
					X
				</Button>
				<Button size="xs">Small</Button>
				<Switch aria-label="switch" />
				<Checkbox aria-label="checkbox" />
				<Toggle size="xs" aria-label="toggle">
					T
				</Toggle>
				<ToggleGroup type="single" size="xs">
					<ToggleGroupItem value="x" aria-label="group toggle">
						G
					</ToggleGroupItem>
				</ToggleGroup>
				<SegmentedControl
					value="a"
					onChange={() => {}}
					options={[
						{ value: 'a', label: 'A' },
						{ value: 'b', label: 'B' },
					]}
				/>
			</div>
			<div className="fixture-adjacent">
				<Button size="icon-xs" aria-label="first icon">
					X
				</Button>
				<Button size="icon-xs" aria-label="second icon">
					Y
				</Button>
			</div>
			<div className="fixture-isolated">
				<Button size="icon-xs" aria-label="isolated icon">
					X
				</Button>
				<Switch aria-label="isolated switch" />
				<Checkbox aria-label="isolated checkbox" />
				<Toggle size="xs" aria-label="isolated toggle">
					T
				</Toggle>
			</div>
			<Input aria-label="input" />
			<Textarea aria-label="textarea" />
			<Progress value={30} />
			<div className="fixture-extra">
				<ResizablePanelGroup direction="horizontal" style={{ height: 64 }}>
					<ResizablePanel>
						<span>A</span>
					</ResizablePanel>
					<ResizableHandle aria-label="resize" withHandle />
					<ResizablePanel>
						<span>B</span>
					</ResizablePanel>
				</ResizablePanelGroup>
				<ScrollArea type="always" style={{ height: 96 }}>
					<div style={{ height: 300 }}>Scroll content</div>
				</ScrollArea>
			</div>
			<Command aria-label="command" />
			<Dialog open={!!open.dialog} onOpenChange={(value) => controls[id]('dialog', value)}>
				<DialogTrigger asChild>
					<Button id={id + '-open'}>Open</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogTitle>Dialog</DialogTitle>
					<DialogDescription>Details</DialogDescription>
					<Input aria-label="dialog-input" />
					<Select defaultValue="a">
						<SelectTrigger aria-label="choice">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="a">Alpha</SelectItem>
							<SelectItem value="b">Beta</SelectItem>
						</SelectContent>
					</Select>
				</DialogContent>
			</Dialog>
			<Sheet open={!!open.sheet} onOpenChange={(value) => controls[id]('sheet', value)}>
				<SheetContent>
					<SheetTitle>Sheet</SheetTitle>
					<SheetDescription>Details</SheetDescription>
					<Input aria-label="sheet-input" />
				</SheetContent>
			</Sheet>
			<DropdownMenu open={!!open.menu} onOpenChange={(value) => controls[id]('menu', value)}>
				<DropdownMenuTrigger asChild>
					<Button>Menu</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>One</DropdownMenuItem>
					<DropdownMenuSub open={!!open.sub}>
						<DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>Nested</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuItem>Last</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<Button id={id + '-context'}>Context</Button>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem>One</ContextMenuItem>
					<ContextMenuSub open={!!open.sub}>
						<ContextMenuSubTrigger>Submenu</ContextMenuSubTrigger>
						<ContextMenuSubContent>
							<ContextMenuItem>Nested</ContextMenuItem>
						</ContextMenuSubContent>
					</ContextMenuSub>
				</ContextMenuContent>
			</ContextMenu>
			<LayoutSamples id={id} />
		</>
	);
}
for (const [id, doc] of Object.entries(docs)) {
	const container = doc.createElement('div');
	container.className = 'nand-ui fixture-root';
	doc.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	root.render(
		<NandProviders ownerDocument={doc}>
			<Samples id={id} />
		</NandProviders>,
	);
}
Object.assign(window, {
	uiFixture: {
		docs,
		controls,
		resizeErrors,
		observerCounts: () =>
			Object.fromEntries(Object.entries(docs).map(([id, doc]) => [id, observers.get(doc)!.size])),
		unmount: () => {
			for (const root of roots) root.unmount();
		},
		listenerCounts: (doc: Document) =>
			Object.fromEntries(
				[...listeners.get(doc)!]
					.filter(
						([key, set]) =>
							set.size &&
							/^(wheel|touchmove|touchstart|focusin|focusout|pointerdown:false|keydown|dismissableLayer)/.test(
								key,
							),
					)
					.map(([key, set]) => [key, set.size]),
			),
	},
});
