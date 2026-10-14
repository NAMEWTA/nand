// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/capture-search-widgets.ts
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '../../../../ui/components/input';
import { Popover, PopoverAnchor, PopoverContent } from '../../../../ui/components/popover';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { iconForExtension } from '../../../../shared/file-types';
import type { ContentFile } from '../../../../host/obsidian/storage/content-files';
import type { BoardStore } from '../../services/board-store';
import { RecordButton } from '../dialogs/RecordButton';
import { inputWidgetClasses as css } from '../theme/input-widget-classes';
import { useDashboardTheme } from '../theme/ThemeBridge';
import { formatRelativeTime } from '../ui/recent-time';

function InputWidget({ store, search }: { store: BoardStore; search: boolean }) {
	const t = useT(),
		theme = useDashboardTheme(),
		visible = useVisible();
	const [text, setText] = useState(''),
		[rows, setRows] = useState<ContentFile[]>([]),
		[open, setOpen] = useState(false),
		[recent, setRecent] = useState(false),
		[index, setIndex] = useState(0),
		[busy, setBusy] = useState(false),
		[wasVisible, setWasVisible] = useState(visible);
	// Retain the input state while dismissing overlays at the visibility boundary.
	if (wasVisible !== visible) {
		setWasVisible(visible);
		if (!visible) setOpen(false);
	}
	const draftRevision = useRef(0);
	const pending = useRef(false),
		alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const show = (isRecent = false) => {
		setRows(isRecent ? store.recentFiles() : store.searchFiles(text));
		setRecent(isRecent);
		setIndex(0);
		setOpen(true);
	};
	const pick = (file: ContentFile | undefined) => {
		if (!file) return;
		setOpen(false);
		void store.openFile(file.path, true);
	};
	const submit = () => {
		if (!text.trim() || pending.current) return;
		if (search) {
			show();
			return;
		}
		pending.current = true;
		setBusy(true);
		const submitted = text, revision = draftRevision.current;
		void store
			.capture(submitted)
			.then(() => {
				if (alive.current && draftRevision.current === revision) setText('');
			})
			.catch(() => toast(t('storage.unsaved')))
			.finally(() => {
				pending.current = false;
				if (alive.current) setBusy(false);
			});
	};
	return (
		<Popover open={open && visible} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<div className={css('dashboard-capturebar')}>
					{search ? (
						<RecordButton
							className={css('dashboard-capturebar-glyph')}
							aria-label={t('fileSearchWidget.recent')}
							onClick={() => show(true)}
						>
							<ObsidianIcon name="plus" />
						</RecordButton>
					) : (
						<span
							className={css('dashboard-capturebar-glyph dashboard-capturebar-glyph--static')}
							aria-hidden="true"
						>
							<ObsidianIcon name="pencil" />
						</span>
					)}
					<Input
						className={css('dashboard-capturebar-input')}
						spellCheck={false}
						aria-label={t(search ? 'fileSearchWidget.title' : 'captureWidget.title')}
						placeholder={t(search ? 'quickNote.searchPlaceholder' : 'quickNote.capturePlaceholder')}
						value={text}
						onChange={(event) => {
							draftRevision.current++;
							setText(event.target.value);
							setOpen(false);
						}}
						onKeyDown={(event) => {
							if (event.nativeEvent.isComposing) return;
							if (event.key === 'Enter') {
								event.preventDefault();
								if (search && open) pick(rows[index]);
								else submit();
							}
							if (open && event.key === 'ArrowDown') {
								event.preventDefault();
								setIndex((i) => Math.min(rows.length - 1, i + 1));
							}
							if (open && event.key === 'ArrowUp') {
								event.preventDefault();
								setIndex((i) => Math.max(0, i - 1));
							}
							if (event.key === 'Escape') setOpen(false);
						}}
					/>
					<RecordButton
						className={css('dashboard-skills-orb dashboard-capturebar-key')}
						disabled={busy}
						aria-label={t(search ? 'fileSearchWidget.title' : 'captureWidget.submit')}
						onClick={submit}
					>
						<ObsidianIcon name={search ? 'search' : 'send'} />
					</RecordButton>
				</div>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				sideOffset={6}
				collisionPadding={8}
				wheelScroll
				className={css(
					'nand-dashboard-root dashboard-filesearch-pop is-open [position:relative] md:backdrop-blur-none [font-size:inherit] [font-family:var(--db-font)] max-h-[min(280px,var(--radix-popover-content-available-height))]',
				)}
				data-theme={theme}
				data-dashboard-theme={theme}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				{!rows.length && (
					<div className={css('dashboard-docsearch-hint')}>
						{t(recent ? 'recent.empty' : 'quickActions.noResults')}
					</div>
				)}
				{rows.map((file, i) => (
					<RecordButton
						key={file.path}
						className={css(`dashboard-docsearch-item ${i === index ? 'bg-[var(--db-bg-hover)]' : ''}`)}
						onClick={() => pick(file)}
					>
						<span className={css('dashboard-docsearch-icon')}>
							<ObsidianIcon name={iconForExtension(file.extension)} />
						</span>
						<span className={css('dashboard-docsearch-info')}>
							<span className={css('dashboard-docsearch-name block')}>{file.basename}</span>
							<span className={css('dashboard-docsearch-path block')}>{file.path}</span>
						</span>
						{recent && (
							<span className={css('dashboard-filesearch-meta')}>
								{formatRelativeTime(file.stat.mtime)}
							</span>
						)}
					</RecordButton>
				))}
			</PopoverContent>
		</Popover>
	);
}
export function QuickCaptureWidget({ store }: { store: BoardStore }) {
	return <InputWidget store={store} search={false} />;
}
export function FileSearchWidget({ store }: { store: BoardStore }) {
	return <InputWidget store={store} search />;
}
