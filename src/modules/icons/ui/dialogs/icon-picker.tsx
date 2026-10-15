// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Item } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { EMOJIS, ICONS, loadResources } from '../../platform/resources';
import { t } from '../../../../shared/i18n';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { Toggle } from '../../../../ui/components/toggle';
import { Choice } from '../../../../ui/components/nand/Choice';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { IconPreview } from '../IconPreview';
import { searchIcons } from '../icon-search';
import { openIconicDialog } from './react-dialog';
export type IconPickerCallback = (icon: string | null, color: string | null) => void;
export type MultiIconPickerCallback = (icon: string | null | undefined, color: string | null | undefined) => void;
const COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'gray'];
export function IconPickerContent({
	plugin,
	items,
	accept,
	close,
}: {
	plugin: IconicController;
	items: Item[];
	accept: MultiIconPickerCallback;
	close: () => void;
}) {
	const t = useT(),
		first = items[0];
	const initialIcon = items.every((item) => item.icon === first?.icon) ? first?.icon : undefined;
	const [color, setColor] = useState(items.every((item) => item.color === first?.color) ? first?.color : undefined);
	const [query, setQuery] = useState(
		initialIcon ? (ICONS.get(initialIcon)?.[0] ?? EMOJIS.get(initialIcon)?.[0] ?? initialIcon) : '',
	);
	const state = plugin.settings.dialogState;
	const [iconMode, setIconMode] = useState(
		(!!initialIcon && ICONS.has(initialIcon)) || state.iconMode || !state.emojiMode,
	);
	const [emojiMode, setEmojiMode] = useState((!!initialIcon && EMOJIS.has(initialIcon)) || state.emojiMode);
	const [, refresh] = useState(0),
		grid = useRef<HTMLDivElement>(null);
	const keywordMode = plugin.isSettingEnabled('useSearchKeywords'),
		maxResults = plugin.settings.maxSearchResults;
	const results = useMemo(
		() =>
			!query && initialIcon
				? [[initialIcon, ICONS.get(initialIcon)?.[0] ?? initialIcon, [], 0] as const]
				: searchIcons(query, { iconMode, emojiMode, keywordMode }).slice(0, maxResults),
		[query, initialIcon, iconMode, emojiMode, keywordMode, maxResults],
	);
	const save = (icon: string | null | undefined, nextColor = color) => {
		accept(icon, nextColor);
		close();
	};
	const overruled = items
		.map((item) => ({ item, rule: plugin.ruleManager?.checkRuling(item.category, item.id) }))
		.find((entry) => entry.rule);
	const placeholder = t(
		iconMode && emojiMode
			? 'iconic.iconPicker.searchMix'
			: emojiMode
				? 'iconic.iconPicker.searchEmojis'
				: 'iconic.iconPicker.searchIcons',
	);
	const picker = useRef<HTMLInputElement>(null);
	const [colorListOpen, setColorListOpen] = useState(false);
	const [colorMode, setColorMode] = useState(plugin.settings.colorPicker1 === 'rgb' ? 'rgb' : 'list');
	const openColorPicker = (mode: string) => {
		if (mode === 'rgb') {
			setColorListOpen(false);
			picker.current?.showPicker?.();
		} else setColorListOpen(true);
	};
	return (
		<div className="space-y-4">
			{overruled?.rule && (
				<p className="rounded-md border border-border bg-muted p-3 text-sm">
					{items.length > 1 ? (
						t('iconic.iconPicker.overrules')
					) : (
						<>
							{t('iconic.iconPicker.overrulePrefix')}
							<Button
								variant="link"
								onClick={() =>
									plugin.openRuleEditor(overruled.item.category, overruled.rule!, (rule) => {
										const changed = rule
											? plugin.ruleManager?.saveRule(overruled.item.category, rule)
											: plugin.ruleManager?.deleteRule(
													overruled.item.category,
													overruled.rule!.id,
												);
										if (changed) plugin.refreshManagers(overruled.item.category);
										refresh((v) => v + 1);
									})
								}
							>
								{overruled.rule.name}
							</Button>
							{t('iconic.iconPicker.overruleSuffix')}
						</>
					)}
				</p>
			)}
			{plugin.isSettingEnabled('showItemName') && (
				<p className="break-words text-sm text-muted-foreground">{items.map((item) => item.name).join(', ')}</p>
			)}
			<div
				className="flex flex-wrap items-center gap-2"
				onWheel={(e) =>
					setColor(
						COLORS[
							(COLORS.indexOf(color ?? '') + (e.deltaY + e.deltaX < 0 ? COLORS.length - 1 : 1)) %
								COLORS.length
						],
					)
				}
			>
				<input
					ref={picker}
					type="color"
					aria-label={t('iconic.ruleEditor.source.color')}
					value={/^#[0-9a-f]{6}$/i.test(color ?? '') ? color! : '#ffffff'}
					onChange={(e) => setColor(e.target.value)}
					onContextMenu={(e) => {
						e.preventDefault();
						openColorPicker(plugin.settings.colorPicker2);
					}}
					onClick={(e) => {
						e.preventDefault();
						openColorPicker(colorMode);
					}}
					className="h-8 w-10 rounded-md border border-input bg-transparent p-1"
				/>
				<Choice
					label={t('iconic.settings.colorPicker1.name')}
					value={colorMode}
					options={['list', 'rgb'].map((v) => [v, t(`iconic.settings.values.${v}`)])}
					onChange={setColorMode}
				/>
				{(colorMode === 'list' || colorListOpen) && (
					<Choice
						open={colorListOpen}
						onOpenChange={setColorListOpen}
						label={t('iconic.ruleEditor.source.color')}
						value={color ?? ''}
						options={[
							['', t('iconic.iconPicker.resetColor')],
							...COLORS.map((v) => [v, t(`iconic.iconPicker.colors.${v}`)] as const),
						]}
						onChange={(v) => setColor(v || null)}
					/>
				)}
				{colorMode === 'rgb' && (
					<Input
						aria-label={t('iconic.ruleEditor.source.color')}
						className="w-40"
						value={color ?? ''}
						placeholder={t('iconic.ruleEditor.enterHexCode')}
						onChange={(e) => setColor(e.target.value || null)}
					/>
				)}
				<Button variant="ghost" disabled={color == null} onClick={() => setColor(null)}>
					{t('iconic.iconPicker.resetColor')}
				</Button>
			</div>
			<Label className="flex flex-col items-stretch gap-2">
				{t('iconic.iconPicker.search')}
				<Input
					autoFocus
					type="search"
					placeholder={placeholder}
					aria-label={placeholder}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onFocus={(e) => e.target.select()}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && results[0]) {
							e.preventDefault();
							save(results[0][0]);
						} else if (e.key === 'ArrowRight' && !query)
							grid.current?.querySelector<HTMLButtonElement>('button')?.focus();
					}}
				/>
			</Label>
			<div
				ref={grid}
				className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 overflow-y-auto"
				onKeyDown={(e) => {
					const buttons = [...e.currentTarget.querySelectorAll('button')],
						index = buttons.indexOf(e.target as HTMLButtonElement);
					if (index < 0) return;
					if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
						e.preventDefault();
						buttons[(index + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
					} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
						e.preventDefault();
						setColor(
							COLORS[
								(COLORS.indexOf(color ?? '') + (e.key === 'ArrowUp' ? COLORS.length - 1 : 1)) %
									COLORS.length
							],
						);
					} else if (e.key === 'Delete' || e.key === 'Backspace') {
						e.preventDefault();
						setColor(null);
					}
				}}
			>
				{results.map(([id, name, keywords]) => (
					<Tooltip key={id}>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" aria-label={name} onClick={() => save(id)}>
								<IconPreview icon={id} color={color} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{name}
							{keywords.length > 0 && <span> · {keywords.slice(0, 3).join(' • ')}</span>}
						</TooltipContent>
					</Tooltip>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{(initialIcon || color) && (
					<Button variant="destructive" onClick={() => save(null, null)}>
						{t(items.length === 1 ? 'iconic.menu.removeIcon' : 'iconic.menu.removeIcons', {
							'#': items.length,
						})}
					</Button>
				)}
				<Toggle
					aria-label={t('iconic.iconPicker.toggleIcons')}
					pressed={iconMode}
					onPressedChange={(v) => {
						plugin.updateDialogState({ iconMode: v });
						setIconMode(v);
					}}
				>
					{t('iconic.iconPicker.toggleIcons')}
				</Toggle>
				<Toggle
					aria-label={t('iconic.iconPicker.toggleEmojis')}
					pressed={emojiMode}
					onPressedChange={(v) => {
						plugin.updateDialogState({ emojiMode: v });
						setEmojiMode(v);
					}}
				>
					{t('iconic.iconPicker.toggleEmojis')}
				</Toggle>
				<span className="flex-1" />
				<Button variant="outline" onClick={close}>
					{t('iconic.iconPicker.cancel')}
				</Button>
				<Button onClick={() => save(initialIcon)}>{t('iconic.iconPicker.save')}</Button>
			</div>
		</div>
	);
}
export default class IconPicker {
	static openSingle(plugin: IconicController, item: Item, callback: IconPickerCallback) {
		this.openMulti(plugin, [item], (icon, color) => callback(icon ?? null, color ?? null));
	}
	static openMulti(plugin: IconicController, items: Item[], accept: MultiIconPickerCallback) {
		void loadResources()
			.then(() => {
				if (plugin.isActive())
					openIconicDialog(
						plugin,
						t(items.length === 1 ? 'iconic.iconPicker.changeIcon' : 'iconic.iconPicker.changeIcons', {
							'#': items.length,
						}),
						(close) => <IconPickerContent plugin={plugin} items={items} accept={accept} close={close} />,
					);
			})
			.catch(() => toast.error(t('settings.writeFailed')));
	}
}
