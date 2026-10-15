import { useEffect, useState } from 'react';
import type { SaveState } from '../../../../shared/storage/durable-state';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';

export function RecordSaveStatus({
	source,
}: {
	source: {
		readonly saveState: SaveState;
		subscribe(listener: () => void): () => void;
		retrySave(): Promise<void>;
	};
}) {
	const [, refresh] = useState(0),
		t = useT();
	useEffect(() => source.subscribe(() => refresh((n) => n + 1)), [source]);
	const { status, error } = source.saveState;
	if (status === 'saved') return null;
	return (
		<div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
			<span>{t(`storage.${status}`)}</span>
			{error && (
				<details>
					<summary>{t('storage.details')}</summary>
					<p>{error}</p>
				</details>
			)}
			{(status === 'unsaved' || status === 'conflict') && (
				<Button
					variant="outline"
					size="xs"
					onClick={() => {
						void source.retrySave().catch(() => undefined);
					}}
				>
					{t('storage.retry')}
				</Button>
			)}
		</div>
	);
}
