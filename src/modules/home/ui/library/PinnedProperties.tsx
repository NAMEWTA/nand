// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/visible-properties-editor.ts
import { useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
import type { LibraryConfig } from '../../core/board/types';
export function PinnedProperties({
	config,
	keys,
	onChange,
}: {
	config: LibraryConfig;
	keys: string[];
	onChange: (value: LibraryConfig) => void;
}) {
	const t = useT(),
		[custom, setCustom] = useState('');
	const picks = config.visibleProperties ?? [];
	const toggle = (key: string) => {
		const next = picks.includes(key) ? picks.filter((value) => value !== key) : [...picks, key];
		onChange({ ...config, visibleProperties: next.length ? next : undefined });
	};
	return (
		<div className="space-y-2">
			<Label>{t('library.visibleProperties')}</Label>
			<p className="text-xs text-muted-foreground">{t('library.visiblePropertiesHint')}</p>
			<div className="flex flex-wrap gap-1">
				{[...new Set(['title', 'author', 'status', 'type', 'rating', ...keys, ...picks])]
					.filter((k) => !['tags', 'position'].includes(k))
					.map((key) => (
						<Button
							key={key}
							size="xs"
							variant={picks.includes(key) ? 'secondary' : 'outline'}
							aria-pressed={picks.includes(key)}
							onClick={() => toggle(key)}
						>
							{key}
						</Button>
					))}
			</div>
			<div className="flex gap-2">
				<Input
					aria-label={t('library.visibleProperties')}
					value={custom}
					onChange={(e) => setCustom(e.target.value)}
				/>
				<Button
					size="xs"
					disabled={!custom.trim()}
					onClick={() => {
						if (!picks.includes(custom.trim())) toggle(custom.trim());
						setCustom('');
					}}
				>
					{t('library.addProperty')}
				</Button>
			</div>
		</div>
	);
}
