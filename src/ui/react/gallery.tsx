import { useEffect, useState } from 'react';
import { Bold, Italic, Plus, Inbox } from 'lucide-react';
import { useT } from './hooks';
import { usePortalContainer } from './contexts';
import { Button } from '../components/button';
import { Input } from '../components/input';
import { Textarea } from '../components/textarea';
import { Label } from '../components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/select';
import { Switch, SwitchIndicator } from '../components/switch';
import { Checkbox } from '../components/checkbox';
import { Slider } from '../components/slider';
import { Progress } from '../components/progress';
import { Toggle } from '../components/toggle';
import { ToggleGroup, ToggleGroupItem } from '../components/toggle-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../components/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../components/hover-card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from '../components/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../components/context-menu';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '../components/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '../components/sheet';
import {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandItem,
	CommandGroup,
} from '../components/command';
import { ScrollArea } from '../components/scroll-area';
import { Separator } from '../components/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/accordion';
import { Badge } from '../components/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/card';
import { Skeleton } from '../components/skeleton';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
	TableCaption,
	TableFooter,
} from '../components/table';
import { toast } from '../components/sonner';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/resizable';
import { EmptyState } from '../components/nand/EmptyState';
import { SettingsSection } from '../components/nand/SettingsSection';
import {
	SettingsRow,
	SettingsSwitchRow,
	SegmentedControl,
	SettingsBadge,
	SettingsSubsectionHeader,
	ColorField,
	NumberField,
} from '../components/nand/SettingsFormControls';
import { StatusDot, type AgentStatus } from '../components/nand/StatusDot';
import { AgentIcon } from '../components/nand/AgentIcon';
import { ObsidianIcon } from '../components/nand/ObsidianIcon';
import { ShortcutKeyCombo } from '../components/nand/ShortcutKeyCombo';
import { RelativeTime } from '../components/nand/RelativeTime';
import { InlineRename } from '../components/nand/InlineRename';
import { ConfirmDialog } from '../components/nand/ConfirmDialog';
import { PathPicker } from '../components/nand/PathPicker';
import { IconPicker } from '../components/nand/IconPicker';

const buttonSizes = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const;
const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const;

export function ComponentGallery() {
	const t = useT();
	const portal = usePortalContainer();
	const [checked, setChecked] = useState(false);
	const [segment, setSegment] = useState('first');
	const [commandOpen, setCommandOpen] = useState(false);
	const [number, setNumber] = useState(42);
	const [color, setColor] = useState('#888888');
	const [path, setPath] = useState('');
	const [icon, setIcon] = useState('file');
	const [name, setName] = useState('NAND');
	const [palette, setPalette] = useState('host');
	const [font, setFont] = useState('geist');
	const options = [
		{ value: 'first', label: t('ui.optionA') },
		{ value: 'second', label: t('ui.optionB') },
		{ value: 'third', label: t('ui.optionC'), disabled: true, tooltip: t('ui.disabled') },
	];
	const [sampleTime] = useState(() => Date.now() - 60_000);
	useEffect(() => {
		const oldPalette = portal.getAttribute('data-palette');
		const oldFont = portal.getAttribute('data-font');
		portal.setAttribute('data-palette', palette);
		portal.setAttribute('data-font', font);
		return () => {
			if (oldPalette === null) portal.removeAttribute('data-palette');
			else portal.setAttribute('data-palette', oldPalette);
			if (oldFont === null) portal.removeAttribute('data-font');
			else portal.setAttribute('data-font', oldFont);
		};
	}, [portal, palette, font]);
	return (
		<div
			className="nand-ui min-w-0 space-y-8 p-4 [&_[data-slot=settings-row]]:flex-wrap [&_[data-slot=settings-row]>div]:max-w-full [&_[data-slot=settings-row]_button]:max-w-full [&_[data-slot=settings-row]_.flex]:flex-wrap"
			data-palette={palette}
			data-font={font}
			data-slot="component-gallery"
		>
			<SettingsSection title={t('ui.gallery')} description={t('ui.galleryDescription')}>
				<SettingsRow
					label={t('ui.appearance')}
					control={
						<SegmentedControl
							wrap
							value={palette}
							onChange={setPalette}
							options={[
								{ value: 'host', label: t('ui.hostPalette') },
								{ value: 'orca', label: t('ui.orcaPalette') },
							]}
						/>
					}
				/>
				<SettingsRow
					label={t('ui.text')}
					control={
						<SegmentedControl
							wrap
							value={font}
							onChange={setFont}
							options={[
								{ value: 'geist', label: t('ui.geistFont') },
								{ value: 'host', label: t('ui.hostFont') },
							]}
						/>
					}
				/>
			</SettingsSection>
			<SettingsSection title={t('ui.buttons')}>
				{buttonVariants.map((variant) => (
					<div key={variant} className="flex flex-wrap items-center gap-2">
						<code className="w-24 text-xs">{variant}</code>
						{buttonSizes.map((size) =>
							size.startsWith('icon') ? (
								<Tooltip key={size}>
									<TooltipTrigger asChild>
										<Button variant={variant} size={size} aria-label={t('ui.create')}>
											<Plus />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										{t('ui.create')}
										<ShortcutKeyCombo keys={['Mod', 'N']} />
									</TooltipContent>
								</Tooltip>
							) : (
								<Button key={size} variant={variant} size={size}>
									{size}
								</Button>
							),
						)}
						<Button disabled variant={variant}>
							{t('ui.disabled')}
						</Button>
					</div>
				))}
			</SettingsSection>
			<SettingsSection title={t('ui.inputs')}>
				<div className="grid gap-3 sm:grid-cols-3">
					{['normal', 'disabled', 'invalid'].map((state) => (
						<div key={state} className="space-y-1">
							<Label htmlFor={`gallery-${state}`}>
								{t(
									state === 'normal'
										? 'ui.text'
										: state === 'disabled'
											? 'ui.disabled'
											: 'ui.invalid',
								)}
							</Label>
							<Input
								id={`gallery-${state}`}
								disabled={state === 'disabled'}
								aria-invalid={state === 'invalid'}
								placeholder={t('ui.sample')}
							/>
							<Textarea
								aria-label={t('ui.text')}
								disabled={state === 'disabled'}
								aria-invalid={state === 'invalid'}
								placeholder={t('ui.sample')}
							/>
						</div>
					))}
				</div>
				<Textarea variant="code" aria-label={t('ui.text')} defaultValue="const nand = true;" />
				<Textarea variant="cell" aria-label={t('ui.text')} defaultValue="NAND" />
				<div className="flex flex-wrap items-center gap-4">
					<Select defaultValue="first">
						<SelectTrigger aria-label={t('ui.sample')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.map((option) => (
								<SelectItem key={option.value} value={option.value} disabled={option.disabled}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Switch checked={checked} onCheckedChange={setChecked} aria-label={t('ui.enabled')} />
					<Switch disabled aria-label={t('ui.disabled')} />
					<SwitchIndicator checked={checked} />
					<SwitchIndicator checked={checked} size="compact" />
					<Checkbox
						checked={checked}
						onCheckedChange={(value) => setChecked(value === true)}
						aria-label={t('ui.enabled')}
					/>
					<Checkbox checked="indeterminate" aria-label={t('ui.sample')} />
					<Checkbox disabled aria-label={t('ui.disabled')} />
				</div>
				<Select defaultValue="first">
					<SelectTrigger size="sm" aria-label={t('ui.sample')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="first">{t('ui.optionA')}</SelectItem>
					</SelectContent>
				</Select>
				<Slider
					value={[number]}
					onValueChange={(values) => setNumber(values[0] ?? 0)}
					aria-label={t('ui.number')}
				/>
				<Progress value={number} aria-label={t('ui.progress')} />
				<div className="flex flex-wrap gap-2">
					{(['default', 'outline'] as const).flatMap((variant) =>
						(['default', 'xs', 'sm', 'lg'] as const).map((size) => (
							<Toggle key={variant + size} variant={variant} size={size} aria-label={t('ui.bold')}>
								<Bold />
							</Toggle>
						)),
					)}
					<ToggleGroup type="multiple" aria-label={t('ui.text')}>
						<ToggleGroupItem value="bold" aria-label={t('ui.bold')}>
							<Bold />
						</ToggleGroupItem>
						<ToggleGroupItem value="italic" aria-label={t('ui.italic')}>
							<Italic />
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</SettingsSection>
			<SettingsSection title={t('ui.overlays')}>
				<div className="flex flex-wrap items-center gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">DropdownMenu</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem>{t('ui.open')}</DropdownMenuItem>
							<DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
								{t('ui.enabled')}
							</DropdownMenuCheckboxItem>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>{t('ui.details')}</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuItem>{t('ui.sample')}</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						</DropdownMenuContent>
					</DropdownMenu>
					<ContextMenu>
						<ContextMenuTrigger className="rounded-md border border-border p-3 text-sm">
							ContextMenu
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem>{t('ui.open')}</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline">Popover</Button>
						</PopoverTrigger>
						<PopoverContent className="w-72 p-4">
							<Label htmlFor="popover-input">{t('ui.name')}</Label>
							<Input id="popover-input" />
						</PopoverContent>
					</Popover>
					<HoverCard>
						<HoverCardTrigger asChild>
							<Button variant="link">HoverCard</Button>
						</HoverCardTrigger>
						<HoverCardContent>{t('ui.sampleDescription')}</HoverCardContent>
					</HoverCard>
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="outline">Dialog</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>{t('ui.sample')}</DialogTitle>
								<DialogDescription>{t('ui.sampleDescription')}</DialogDescription>
							</DialogHeader>
							<Input aria-label={t('ui.name')} />
							<Select defaultValue="first">
								<SelectTrigger aria-label={t('ui.sample')}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="first">{t('ui.optionA')}</SelectItem>
								</SelectContent>
							</Select>
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="outline">Popover</Button>
								</PopoverTrigger>
								<PopoverContent className="p-4">{t('ui.sample')}</PopoverContent>
							</Popover>
						</DialogContent>
					</Dialog>
					{(['right', 'left', 'top', 'bottom'] as const).map((side) => (
						<Sheet key={side}>
							<SheetTrigger asChild>
								<Button variant="outline">Sheet · {side}</Button>
							</SheetTrigger>
							<SheetContent side={side}>
								<SheetHeader>
									<SheetTitle>{t('ui.sample')}</SheetTitle>
									<SheetDescription>{t('ui.sampleDescription')}</SheetDescription>
								</SheetHeader>
							</SheetContent>
						</Sheet>
					))}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" aria-label="Tooltip · tab-preview">
								Tooltip 2
							</Button>
						</TooltipTrigger>
						<TooltipContent variant="tab-preview" showArrow={false}>
							{t('ui.sampleDescription')}
						</TooltipContent>
					</Tooltip>
					<HoverCard>
						<HoverCardTrigger asChild>
							<Button variant="link" aria-label="HoverCard · workspace-details">
								HoverCard 2
							</Button>
						</HoverCardTrigger>
						<HoverCardContent variant="workspace-details">{t('ui.sampleDescription')}</HoverCardContent>
					</HoverCard>
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="outline" aria-label="Dialog · feature-tip">
								Dialog 2
							</Button>
						</DialogTrigger>
						<DialogContent surface="feature-tip" closeButtonVariant="minimize">
							<DialogHeader className="p-6">
								<DialogTitle size="display">{t('ui.sample')}</DialogTitle>
								<DialogDescription>{t('ui.sampleDescription')}</DialogDescription>
							</DialogHeader>
						</DialogContent>
					</Dialog>
					<Button variant="outline" onClick={() => setCommandOpen(true)}>
						CommandDialog
					</Button>
					<CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
						<CommandInput aria-label={t('ui.search')} />
						<CommandList>
							<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
							<CommandItem onSelect={() => setCommandOpen(false)}>{t('ui.optionA')}</CommandItem>
						</CommandList>
					</CommandDialog>
					<ConfirmDialog
						title={t('ui.delete')}
						description={t('ui.deleteDescription')}
						onConfirm={() => {
							toast(t('ui.toastMessage'));
						}}
						destructive
					>
						<Button variant="destructive">AlertDialog</Button>
					</ConfirmDialog>
					<Button onClick={() => toast(t('ui.toastMessage'))}>{t('ui.toast')}</Button>
				</div>
				<Command className="rounded-md border border-border">
					<CommandInput aria-label={t('ui.search')} placeholder={t('ui.search')} />
					<CommandList>
						<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
						<CommandGroup heading={t('ui.sample')}>
							{options.map((option) => (
								<CommandItem
									key={option.value}
									disabled={option.disabled}
									onSelect={() => toast(option.label)}
								>
									{option.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
				<Command surface="inline" density="menu">
					<CommandInput variant="framed" aria-label={t('ui.search')} placeholder={t('ui.search')} />
					<CommandList animateHeight>
						<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
						{options.map((option) => (
							<CommandItem key={option.value} selection="palette" disabled={option.disabled}>
								{option.label}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</SettingsSection>
			<SettingsSection title={t('ui.settings')}>
				<SettingsSubsectionHeader
					title={t('ui.details')}
					description={t('ui.sampleDescription')}
					action={<SettingsBadge tone="accent">{t('ui.enabled')}</SettingsBadge>}
				/>
				<SettingsSwitchRow
					label={t('ui.enabled')}
					description={t('ui.sampleDescription')}
					checked={checked}
					onChange={() => setChecked(!checked)}
				/>
				<SegmentedControl
					wrap
					value={segment}
					onChange={setSegment}
					options={options}
					ariaLabel={t('ui.sample')}
				/>
				<NumberField
					label={t('ui.number')}
					description={t('ui.sampleDescription')}
					value={number}
					min={0}
					max={100}
					onChange={setNumber}
				/>
				<ColorField
					label={t('ui.color')}
					description={t('ui.sampleDescription')}
					value={color}
					fallback="#888888"
					onChange={setColor}
				/>
				<div className="flex flex-wrap gap-3">
					<InlineRename value={name} onRename={setName} />
					<PathPicker
						value={path}
						onChange={setPath}
						items={[
							{ path: 'NAND', kind: 'folder' },
							{ path: 'NAND/README.md', kind: 'file' },
						]}
					/>
					<IconPicker value={icon} onChange={setIcon} />
					<ObsidianIcon name="settings" label={t('ui.settings')} />
				</div>
			</SettingsSection>
			<SettingsSection title={t('ui.feedback')}>
				<div className="flex flex-wrap gap-3">
					{(
						[
							'idle',
							'working',
							'question',
							'completed',
							'interrupted',
							'failed',
							'unknown',
						] as AgentStatus[]
					).map((status) => (
						<StatusDot key={status} status={status} />
					))}
					{['claude-code', 'codex', 'gemini-cli', 'unknown'].map((agent) => (
						<AgentIcon key={agent} agent={agent} />
					))}
					<RelativeTime value={sampleTime} />
					<ShortcutKeyCombo keys={['Mod', 'Shift', 'P']} />
				</div>
				<div className="flex flex-wrap gap-2">
					{(['default', 'secondary', 'dot', 'outline', 'destructive', 'ghost', 'link'] as const).map(
						(variant) => (
							<Badge key={variant} variant={variant}>
								{variant}
							</Badge>
						),
					)}
					{(['neutral', 'accent', 'muted'] as const).map((tone) => (
						<SettingsBadge key={tone} tone={tone}>
							{tone}
						</SettingsBadge>
					))}
				</div>
				<Skeleton className="h-8 w-48 max-w-full" />
				<EmptyState
					icon={<Inbox />}
					title={t('ui.empty')}
					description={t('ui.emptyDescription')}
					action={<Button>{t('ui.create')}</Button>}
				/>
			</SettingsSection>
			<SettingsSection title={t('ui.layout')}>
				{(['horizontal', 'vertical'] as const).flatMap((orientation) =>
					(['default', 'line'] as const).map((variant) => (
						<Tabs key={orientation + variant} defaultValue="first" orientation={orientation}>
							<div className="max-w-full overflow-x-auto scrollbar-sleek">
								<TabsList variant={variant}>
									{options.map((option) => (
										<TabsTrigger key={option.value} value={option.value} disabled={option.disabled}>
											{option.label}
										</TabsTrigger>
									))}
								</TabsList>
							</div>
							{options.map((option) => (
								<TabsContent key={option.value} value={option.value}>
									{option.label}
								</TabsContent>
							))}
						</Tabs>
					)),
				)}
				<Card>
					<CardHeader>
						<CardTitle>{t('ui.sample')}</CardTitle>
						<CardDescription>{t('ui.sampleDescription')}</CardDescription>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-24">
							{Array.from({ length: 12 }, (_, i) => (
								<div key={i} className="p-2">
									{t('ui.sample')} {i + 1}
								</div>
							))}
						</ScrollArea>
					</CardContent>
					<CardFooter>
						<Button>{t('ui.open')}</Button>
					</CardFooter>
				</Card>
				<Separator />
				<Collapsible>
					<CollapsibleTrigger asChild>
						<Button variant="outline">Collapsible</Button>
					</CollapsibleTrigger>
					<CollapsibleContent>{t('ui.sample')}</CollapsibleContent>
				</Collapsible>
				<Collapsible>
					<CollapsibleTrigger variant="row">{t('ui.details')}</CollapsibleTrigger>
					<CollapsibleContent animation="height">{t('ui.sampleDescription')}</CollapsibleContent>
				</Collapsible>
				<Accordion type="single" collapsible>
					<AccordionItem value="first">
						<AccordionTrigger>{t('ui.details')}</AccordionTrigger>
						<AccordionContent>{t('ui.sampleDescription')}</AccordionContent>
					</AccordionItem>
				</Accordion>
				<Table>
					<TableCaption>{t('ui.sampleDescription')}</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>{t('ui.name')}</TableHead>
							<TableHead>{t('ui.value')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell>NAND</TableCell>
							<TableCell>{number}</TableCell>
						</TableRow>
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell>{t('ui.all')}</TableCell>
							<TableCell>1</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
				<ResizablePanelGroup direction="horizontal" className="min-h-24 rounded-md border border-border">
					<ResizablePanel defaultSize={50}>
						<div className="p-4">{t('ui.optionA')}</div>
					</ResizablePanel>
					<ResizableHandle withHandle aria-label={t('ui.resize')} />
					<ResizablePanel defaultSize={50}>
						<div className="p-4">{t('ui.optionB')}</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</SettingsSection>
		</div>
	);
}
