// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/media-tag-editor-modal.ts
import { useState } from 'react';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { MEDIA_TAG_MAX_LEN, MEDIA_TAG_MAX_PER_FILE, normalizeTags } from '../../platform/media/media-tags';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { p1Classes } from '../theme/p1-classes';
export function MediaTagEditor({
	name,
	path,
	current,
	known,
	onClose,
	onSave,
}: {
	name: string;
	path: string;
	current: string[];
	known: string[];
	onClose: () => void;
	onSave: (tags: string[]) => void;
}) {
	const t = useT(),
		[tags, setTags] = useState(current),
		[input, setInput] = useState(''),
		[error, setError] = useState('');
	const add = (value: string) => {
		const tag = value.trim();
		if (!tag) return;
		if (tag.length > MEDIA_TAG_MAX_LEN) {
			setError(t('media.tagTooLong', { count: MEDIA_TAG_MAX_LEN }));
			return;
		}
		if (tags.length >= MEDIA_TAG_MAX_PER_FILE) {
			setError(t('media.tagLimitReached', { count: MEDIA_TAG_MAX_PER_FILE }));
			return;
		}
		setTags(normalizeTags([...tags, tag]));
		setInput('');
		setError('');
	};
	return (
		<DashboardDialog
			title={t('media.editTagsTitle', { name })}
			onClose={onClose}
			onSave={() => onSave(normalizeTags(tags))}
		>
			<p className={p1Classes('dashboard-media-tagedit-path')}>{path}</p>
			<div className={p1Classes('dashboard-media-tagedit-chips')}>
				{tags.map((tag) => (
					<Button
						key={tag}
						variant="outline"
						className={p1Classes('dashboard-media-tagedit-chip')}
						onClick={() => setTags(tags.filter((v) => v !== tag))}
						aria-label={t('home.p1.removeTag', { tag })}
					>
						{tag} ×
					</Button>
				))}
			</div>
			<div className="flex gap-2">
				<Input
					aria-label={t('media.addTagPlaceholder')}
					placeholder={t('media.addTagPlaceholder')}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
							e.preventDefault();
							add(input);
						}
					}}
				/>
				<Button onClick={() => add(input)}>{t('common.add')}</Button>
			</div>
			<div className={p1Classes('dashboard-media-tagedit-pick')}>
				{known
					.filter((tag) => !tags.includes(tag))
					.map((tag) => (
						<Button key={tag} variant="outline" onClick={() => add(tag)}>
							{tag}
						</Button>
					))}
			</div>
			{error && <p role="alert">{error}</p>}
		</DashboardDialog>
	);
}
