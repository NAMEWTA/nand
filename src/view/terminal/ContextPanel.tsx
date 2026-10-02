import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContextMaterial } from '../../core/agent-launch/session-api';
import { t } from '../../shared/i18n/terminal-accessor';
import type { TerminalViewHost } from './host';

/** Drafts belong to the selected session; the execution service owns attachment readiness. */
export function ContextPanel({ host, id, title }: { host: TerminalViewHost; id: string; title: string }) {
	const [materials, setMaterials] = useState<ContextMaterial[]>([]);
	const [busy, setBusy] = useState(false),
		[error, setError] = useState('');
	const pending = useRef<AbortController>();
	useEffect(() => () => pending.current?.abort(), []);
	const add = async () => {
		try {
			const material = await host.pickContextMaterial?.();
			if (material) setMaterials((current) => [...current.filter((item) => item.id !== material.id), material]);
		} catch (cause) {
			setError(String(cause));
		}
	};
	const attach = async () => {
		const controller = new AbortController();
		pending.current = controller;
		setBusy(true);
		setError('');
		try {
			await host.attachContext?.(id, materials, controller.signal);
			setMaterials([]);
		} catch (cause) {
			if (!controller.signal.aborted) setError(String(cause));
		} finally {
			setBusy(false);
			pending.current = undefined;
		}
	};
	return (
		<details class="terminal-context-panel">
			<summary>
				{t('context.title')}
				{materials.length ? ` (${materials.length})` : ''}
			</summary>
			<div class="nand-ui-toolbar">
				<span>{t('context.target', { title })}</span>
				<button
					type="button"
					class="nand-ui-btn-ghost"
					disabled={busy}
					onClick={() => {
						void add();
					}}
				>
					{t('context.add')}
				</button>
				<button
					type="button"
					class="nand-ui-btn"
					disabled={busy || !materials.length}
					onClick={() => {
						void attach();
					}}
				>
					{t('context.attach')}
				</button>
			</div>
			{materials.map((material) => (
				<div key={material.id} class="nand-ui-toolbar">
					<span>{material.title}</span>
					<small>{material.source}</small>
					<button
						type="button"
						class="nand-ui-btn-ghost"
						disabled={busy}
						onClick={() => setMaterials((current) => current.filter((item) => item.id !== material.id))}
					>
						{t('context.remove')}
					</button>
				</div>
			))}
			{error && <p role="alert">{error}</p>}
		</details>
	);
}
