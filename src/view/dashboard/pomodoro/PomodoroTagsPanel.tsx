import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { activityColor, type PomodoroService } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
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
			<div class="dashboard-pomodoro-stats-header">
				<div class="dashboard-pomodoro-stats-header-title">{t('pomodoro.tagTitle')}</div>
				<button class="dashboard-pomodoro-stats-close" aria-label={t('common.close')} onClick={close}>
					<Icon name="x" />
				</button>
			</div>
			<div class="dashboard-pomodoro-tagmanager-hint">{t('pomodoro.tagHint')}</div>
			<div class="dashboard-pomodoro-tagmanager-list">
				{names.length ? (
					names.map((name) => {
						const pinned = service.getTags().some((tag) => tag.name === name && tag.pinned);
						return (
							<div
								key={name}
								class={`dashboard-pomodoro-tagmanager-row${open === name ? ' dashboard-pomodoro-tagmanager-row--open' : ''}`}
							>
								<button
									class={`dashboard-pomodoro-tagmanager-chip${pinned ? ' dashboard-pomodoro-tagmanager-chip--pinned' : ''}`}
									onClick={() => setOpen(open === name ? null : name)}
								>
									<span
										class="dashboard-pomodoro-donut-legend-dot"
										style={{ backgroundColor: activityColor(name) }}
									/>
									<span class="dashboard-pomodoro-tagmanager-chip-name">{name}</span>
									{pinned && <Icon name="pin" />}
								</button>
								<div class="dashboard-pomodoro-tagmanager-actions">
									<button
										class="dashboard-pomodoro-tagmanager-action"
										disabled={busy}
										title={t('pomodoro.tagPinHint')}
										onClick={() => void run(() => service.setTagPinned(name, !pinned))}
									>
										<Icon name={pinned ? 'pin-off' : 'pin'} />
										{t(pinned ? 'pomodoro.tagUnpin' : 'pomodoro.tagPin')}
									</button>
									<button
										class="dashboard-pomodoro-tagmanager-action"
										disabled={busy}
										onClick={() => begin('rename', name)}
									>
										<Icon name="pencil" />
										{t('pomodoro.tagRename')}
									</button>
									<button
										class="dashboard-pomodoro-tagmanager-action"
										disabled={busy || names.length < 2}
										title={t('pomodoro.tagMergeHint')}
										onClick={() => begin('merge', name)}
									>
										<Icon name="git-merge" />
										{t('pomodoro.tagMerge')}
									</button>
									<button
										class="dashboard-pomodoro-tagmanager-action dashboard-pomodoro-tagmanager-action--danger"
										disabled={busy}
										onClick={() => begin('delete', name)}
									>
										<Icon name="trash-2" />
										{t('pomodoro.tagDelete')}
									</button>
								</div>
							</div>
						);
					})
				) : (
					<div class="dashboard-pomodoro-donut-empty">{t('pomodoro.tagNoTags')}</div>
				)}
			</div>
			{prompt && (
				<form
					class="dashboard-pomodoro-tagmanager-prompt"
					onSubmit={(e) => {
						e.preventDefault();
						void confirm();
					}}
				>
					<div class="dashboard-pomodoro-tagmanager-prompt-label">
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
						<select
							class="dashboard-pomodoro-tagmanager-prompt-select"
							value={value}
							disabled={busy}
							onChange={(e) => setValue(e.currentTarget.value)}
						>
							{others.map((name) => (
								<option key={name} value={name}>
									{name}
								</option>
							))}
						</select>
					) : (
						prompt.kind === 'rename' && (
							<input
								ref={input}
								class="dashboard-pomodoro-tagmanager-prompt-input"
								value={value}
								disabled={busy}
								onInput={(e) => setValue(e.currentTarget.value)}
							/>
						)
					)}
					<div class="dashboard-pomodoro-tagmanager-prompt-error">{error}</div>
					<div class="dashboard-pomodoro-tagmanager-prompt-btns">
						<button
							type="button"
							class="dashboard-pomodoro-tagmanager-prompt-cancel"
							disabled={busy}
							onClick={() => setPrompt(null)}
						>
							{t('common.cancel')}
						</button>
						<button
							type="submit"
							class={`dashboard-pomodoro-tagmanager-prompt-ok${prompt.kind === 'delete' ? ' dashboard-pomodoro-tagmanager-prompt-ok--danger' : ''}`}
							disabled={busy}
						>
							{t(
								prompt.kind === 'rename'
									? 'pomodoro.tagRename'
									: prompt.kind === 'merge'
										? 'pomodoro.tagMerge'
										: 'pomodoro.tagDelete',
							)}
						</button>
					</div>
				</form>
			)}
			{error && !prompt && <div class="dashboard-pomodoro-tagmanager-prompt-error">{error}</div>}
		</>
	);
}
