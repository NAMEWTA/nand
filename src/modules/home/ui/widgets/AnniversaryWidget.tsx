// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/anniversary-widget.ts
import { useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';
import { Plus } from 'lucide-react';
import type { BoardStore } from '../../services/board-store';
import type { AnniversaryConfig } from '../../core/board/types';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { AnniversaryPanel } from './AnniversaryPanel';
import { AnniversaryEditor } from './AnniversaryEditor';
import { RecordConfirm } from '../dialogs/RecordConfirm';
import { widgetClasses } from '../theme/widget-classes';
import { useImage } from '../board/hooks';
function Entry({ store, config, onEdit }: { store: BoardStore; config: AnniversaryConfig; onEdit(this: void): void }) {
	const doc = useOwnerDocument(),
		image = useImage(store, config.background?.image ?? '');
	const foreground = config.background?.foreground;
	const color =
		foreground === 'light'
			? 'var(--db-widget-light)'
			: foreground === 'dark'
				? 'var(--db-widget-dark)'
				: foreground && /^#[0-9a-fA-F]{3,8}$/.test(foreground)
					? foreground
					: undefined;
	return (
		<div
			className={widgetClasses('dashboard-sidebar-anniversary relative isolate overflow-hidden')}
			style={
				color
					? ({ '--db-text': color, '--db-text-muted': color, '--db-text-faint': color } as CSSProperties)
					: undefined
			}
		>
			{image && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-[var(--layer-content)] bg-cover bg-center"
					style={{
						backgroundImage: `url(${JSON.stringify(image)})`,
						opacity: (config.background?.opacity ?? 100) / 100,
						filter: `blur(${config.background?.blur ?? 0}px)`,
						transform: `scale(${1 + (config.background?.blur ?? 0) * 0.05})`,
					}}
				/>
			)}
			{image && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-[var(--layer-content)] bg-[var(--db-widget-shadow)]"
					style={{ opacity: (config.background?.dim ?? 30) / 100 }}
				/>
			)}
			<AnniversaryPanel config={config} win={doc.defaultView!} edit={onEdit} />
		</div>
	);
}
export function AnniversaryWidget({ store, entryId }: { store: BoardStore; entryId?: string }) {
	const settings = useStore(store.state, (s) => s.settings),
		t = useT(),
		[draft, setDraft] = useState<AnniversaryConfig | null>(null),
		[remove, setRemove] = useState(false);
	return (
		<>
			<div className="grid gap-2">
				{settings.anniversaries
					.filter((c) => !entryId || c.id === entryId)
					.map((config) => (
						<Entry store={store} config={config} key={config.id} onEdit={() => setDraft({ ...config })} />
					))}
			</div>
			{!entryId && (
				<Button
					variant="ghost"
					className="h-7 w-full text-xs"
					onClick={() =>
						setDraft({
							id: crypto.randomUUID(),
							label: '',
							startDate: new Date().toLocaleDateString('sv-SE'),
							precision: 'ymd',
							calendar: 'solar',
							annualReminder: true,
						})
					}
				>
					<Plus />
					{t('common.add')}
				</Button>
			)}
			{draft && (
				<AnniversaryEditor
					initial={draft}
					onClose={() => setDraft(null)}
					onDelete={settings.anniversaries.some((c) => c.id === draft.id) ? () => setRemove(true) : undefined}
					onSave={(value) => {
						void store
							.settings((s) => {
								const i = s.anniversaries.findIndex((c) => c.id === value.id);
								if (i < 0) s.anniversaries.push(value);
								else s.anniversaries[i] = value;
							})
							.then(() => setDraft(null));
					}}
				/>
			)}
			<RecordConfirm
				open={remove}
				onOpenChange={setRemove}
				title={t('common.delete')}
				description={draft?.label ?? ''}
				onConfirm={() => {
					if (draft)
						void store
							.settings((s) => {
								s.anniversaries = s.anniversaries.filter((c) => c.id !== draft.id);
							})
							.then(() => {
								setRemove(false);
								setDraft(null);
							});
				}}
			/>
		</>
	);
}
