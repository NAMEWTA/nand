import { useEffect, useState } from 'preact/hooks';
import type { SaveState } from '../../shared/storage/durable-state';
import { t } from '../../shared/i18n';

export interface SaveStatusSource {
	readonly saveState: SaveState;
	subscribe(listener: () => void): () => void;
	retrySave(): Promise<void>;
}
export function SaveStatus({ source }: { source: SaveStatusSource }) {
	const [, refresh] = useState(0);
	useEffect(() => source.subscribe(() => refresh((n) => n + 1)), [source]);
	const { status, error } = source.saveState;
	return (
		<div class={`nand-save-status nand-save-status--${status}`} role="status" aria-live="polite" title={error}>
			<span>{t(`storage.${status}`)}</span>
			{error && (
				<details>
					<summary>{t('storage.details')}</summary>
					<p>{error}</p>
				</details>
			)}
			{(status === 'unsaved' || status === 'conflict') && (
				<button
					type="button"
					onClick={() => {
						void source.retrySave().catch(() => undefined);
					}}
				>
					{t('storage.retry')}
				</button>
			)}
		</div>
	);
}
