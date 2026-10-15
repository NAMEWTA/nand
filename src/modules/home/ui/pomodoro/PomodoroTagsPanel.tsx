import { Choice } from '../board/controls';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pomodoro-stats-modal.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { Input } from '../../../../ui/components/input';
import { widgetClasses } from '../theme/widget-classes';
import { useLayoutEffect, useRef, useState } from 'react';
import { activityColor, type PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
type Prompt = { kind: 'rename' | 'merge' | 'delete'; name: string };
export function PomodoroTagsPanel({
	service,
	close,
	onChange,
}: {
	service: PomodoroService;
	close: () => void;
	onChange: () => void;
}) {
	const [, refresh] = useState(0),
		[open, setOpen] = useState<string | null>(null),
		[prompt, setPrompt] = useState<Prompt | null>(null),
		[value, setValue] = useState(''),
		[error, setError] = useState(''),
		[busy, setBusy] = useState(false),
		pending = useRef(false),
		alive = useRef(true),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		alive.current = true;
		const off = service.subscribe(() => refresh((n) => n + 1));
		return () => {
			alive.current = false;
			off();
		};
	}, [service]);
	useLayoutEffect(() => {
		input.current?.focus();
	}, [prompt]);
	const names = [...new Set([...service.getTags().map((tag) => tag.name), ...service.getActivityBreakdown().keys()])]
			.filter((n) => n && n !== t('pomodoro.defaultActivity'))
			.sort((a, b) => a.localeCompare(b)),
		others = names.filter((name) => name !== prompt?.name);
	const run = async (action: () => Promise<void>) => {
		if (pending.current) return;
		pending.current = true;
		setBusy(true);
		try {
			await action();
			if (alive.current) {
				setPrompt(null);
				refresh((n) => n + 1);
				onChange();
			}
		} catch (e) {
			if (alive.current) setError(e instanceof Error ? e.message : String(e));
		} finally {
			pending.current = false;
			if (alive.current) setBusy(false);
		}
	};
	const begin = (kind: Prompt['kind'], name: string) => {
		setError('');
		setValue(kind === 'rename' ? name : kind === 'merge' ? (names.find((n) => n !== name) ?? '') : '');
		setPrompt({ kind, name });
	};
	const confirm = () =>
		run(async () => {
			if (!prompt) return;
			const name = value.trim();
			if (prompt.kind === 'delete') await service.deleteTag(prompt.name);
			else if (
				!name ||
				!(await (prompt.kind === 'rename'
					? service.renameTag(prompt.name, name)
					: service.mergeTags(prompt.name, name)))
			)
				throw new Error(t('pomodoro.tagExists'));
		});
	return (
		<>
			<div className={widgetClasses('dashboard-pomodoro-stats-header')}>
				<div className={widgetClasses('dashboard-pomodoro-stats-header-title')}>{t('pomodoro.tagTitle')}</div>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-pomodoro-stats-close')}
					aria-label={t('common.close')}
					onClick={close}
				>
					<Icon name="x" />
				</Button>
			</div>
			<div className={widgetClasses('dashboard-pomodoro-tagmanager-hint')}>{t('pomodoro.tagHint')}</div>
			<div className={widgetClasses('dashboard-pomodoro-tagmanager-list')}>
				{names.length ? (
					names.map((name) => {
						const pinned = service.getTags().some((tag) => tag.name === name && tag.pinned);
						return (
							<div
								key={name}
								className={widgetClasses(
									`dashboard-pomodoro-tagmanager-row${open === name ? ' dashboard-pomodoro-tagmanager-row--open' : ''}`,
								)}
							>
								<Button
									variant="ghost"
									className={widgetClasses(
										`dashboard-pomodoro-tagmanager-chip${pinned ? ' dashboard-pomodoro-tagmanager-chip--pinned' : ''}`,
									)}
									onClick={() => setOpen(open === name ? null : name)}
								>
									<span
										className={widgetClasses('dashboard-pomodoro-donut-legend-dot')}
										style={{ backgroundColor: activityColor(name) }}
									/>
									<span className={widgetClasses('dashboard-pomodoro-tagmanager-chip-name')}>
										{name}
									</span>
									{pinned && <Icon name="pin" />}
								</Button>
								<div className={widgetClasses('dashboard-pomodoro-tagmanager-actions')}>
									<Button
										variant="ghost"
										className={widgetClasses('dashboard-pomodoro-tagmanager-action')}
										disabled={busy}
										title={t('pomodoro.tagPinHint')}
										onClick={() => void run(() => service.setTagPinned(name, !pinned))}
									>
										<Icon name={pinned ? 'pin-off' : 'pin'} />
										{t(pinned ? 'pomodoro.tagUnpin' : 'pomodoro.tagPin')}
									</Button>
									<Button
										variant="ghost"
										className={widgetClasses('dashboard-pomodoro-tagmanager-action')}
										disabled={busy}
										onClick={() => begin('rename', name)}
									>
										<Icon name="pencil" />
										{t('pomodoro.tagRename')}
									</Button>
									<Button
										variant="ghost"
										className={widgetClasses('dashboard-pomodoro-tagmanager-action')}
										disabled={busy || names.length < 2}
										title={t('pomodoro.tagMergeHint')}
										onClick={() => begin('merge', name)}
									>
										<Icon name="git-merge" />
										{t('pomodoro.tagMerge')}
									</Button>
									<Button
										variant="ghost"
										className={widgetClasses(
											'dashboard-pomodoro-tagmanager-action dashboard-pomodoro-tagmanager-action--danger',
										)}
										disabled={busy}
										onClick={() => begin('delete', name)}
									>
										<Icon name="trash-2" />
										{t('pomodoro.tagDelete')}
									</Button>
								</div>
							</div>
						);
					})
				) : (
					<div className={widgetClasses('dashboard-pomodoro-donut-empty')}>{t('pomodoro.tagNoTags')}</div>
				)}
			</div>
			{prompt && (
				<form
					className={widgetClasses('dashboard-pomodoro-tagmanager-prompt')}
					onSubmit={(e) => {
						e.preventDefault();
						void confirm();
					}}
				>
					<div className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-label')}>
						{t(
							prompt.kind === 'rename'
								? 'pomodoro.tagRenamePrompt'
								: prompt.kind === 'merge'
									? 'pomodoro.tagMergePrompt'
									: 'pomodoro.tagDeleteConfirm',
							{ name: prompt.name },
						)}
					</div>
					{prompt.kind === 'merge' ? (
						<Choice
							className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-select')}
							label={t('pomodoro.tagMerge')}
							value={value}
							onChange={setValue}
							options={others.map((name) => ({ value: name, label: name }))}
						/>
					) : (
						prompt.kind === 'rename' && (
							<Input
								ref={input}
								className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-input')}
								value={value}
								disabled={busy}
								onInput={(e) => setValue(e.currentTarget.value)}
							/>
						)
					)}
					<div className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-error')}>{error}</div>
					<div className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-btns')}>
						<Button
							variant="ghost"
							type="button"
							className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-cancel')}
							disabled={busy}
							onClick={() => setPrompt(null)}
						>
							{t('common.cancel')}
						</Button>
						<Button
							variant="ghost"
							type="submit"
							className={widgetClasses(
								`dashboard-pomodoro-tagmanager-prompt-ok${prompt.kind === 'delete' ? ' dashboard-pomodoro-tagmanager-prompt-ok--danger' : ''}`,
							)}
							disabled={busy}
						>
							{t(
								prompt.kind === 'rename'
									? 'pomodoro.tagRename'
									: prompt.kind === 'merge'
										? 'pomodoro.tagMerge'
										: 'pomodoro.tagDelete',
							)}
						</Button>
					</div>
				</form>
			)}
			{error && !prompt && (
				<div className={widgetClasses('dashboard-pomodoro-tagmanager-prompt-error')}>{error}</div>
			)}
		</>
	);
}
