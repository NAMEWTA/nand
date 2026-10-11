import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { BrowserError } from '../core/model';
import { exportMaiwHistory } from '../core/workspace/history-transfer';
import { HistoryImportError, MAX_HISTORY_IMPORT_BYTES } from '../core/workspace/maiw-format';
import type { BrowserModule } from '../services';
import type { HistoryImportReview, Workspace } from '../services/workspace';

export function HistoryTransfer({ workspace, module, disabled, run }: {
	workspace: Workspace; module: BrowserModule; disabled: boolean; run: (action: () => Promise<unknown>) => void;
}) {
	const [review, setReview] = useState<HistoryImportReview>(), [line, setLine] = useState<number>();
	const [imported, setImported] = useState(false), [selected, setSelected] = useState<string[]>([]);
	const [exported, setExported] = useState<string>(), [saved, setSaved] = useState('');
	const [showRecords, setShowRecords] = useState(false);
	return <details class="nand-browser-workspace-transfer">
		<summary>{t('browser.workspace.transfer')}</summary>
		<p>{t('browser.workspace.importScope')}</p>
		<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.importFile')}</span>
			<input type="file" accept=".jsonl" disabled={disabled} onChange={event => {
				const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
				setReview(undefined); setImported(false); setLine(undefined); setShowRecords(false);
				if (file) run(async () => {
					if (file.size > MAX_HISTORY_IMPORT_BYTES) throw new BrowserError('browser_workspace_import_size');
					try { setReview(await workspace.previewImport(await file.text(), t('browser.workspace.importedAccount'))); }
					catch (error) { if (error instanceof HistoryImportError) setLine(error.line); throw error; }
				});
			}} />
		</label>
		{line !== undefined && <p role="alert">{t('browser.workspace.importLine', { line })}</p>}
		{review && <section class="nand-browser-workspace-preview" aria-label={t('browser.workspace.importPreview')}>
			<h3>{t('browser.workspace.importPreview')}</h3>
			<ul>{(['sessions', 'turns', 'exchanges'] as const).map(kind => <li key={kind}>{t('browser.workspace.importCounts', {
				kind: t('browser.workspace.importKind.' + kind), added: review.counts[kind].added, duplicate: review.counts[kind].duplicate,
			})}</li>)}</ul>
			{review.conflicts.length > 0 && <>
				<p role="alert">{t('browser.browser_workspace_import_conflict')}</p>
				<ul>{review.conflicts.map(row => <li key={row.kind + row.sourceId}>{t('browser.workspace.importKind.' + row.kind)}: {row.sourceId}</li>)}</ul>
			</>}
			<Button disabled={disabled} onClick={() => setShowRecords(!showRecords)}>{t('browser.workspace.importRead')}</Button>
			{showRecords && <label class="nand-field"><span class="nand-field-label">{t('browser.workspace.importRead')}</span>
				<textarea class="nand-input" readOnly rows={12} value={JSON.stringify(review.history, null, 2)} />
			</label>}
			<Button variant="primary" disabled={disabled || !!review.conflicts.length || !Object.values(review.counts).some(count => count.added > 0)} onClick={() => run(async () => {
				const id = review.id; setReview(undefined); await workspace.commitImport(id); setImported(true);
			})}>{t('browser.workspace.importConfirm')}</Button>
		</section>}
		{imported && <p role="status">{t('browser.workspace.importSaved')}</p>}
		<h3>{t('browser.workspace.exportV3')}</h3>
		<p>{t('browser.workspace.exportV3Scope')}</p>
		<div class="nand-browser-workspace-actions">{workspace.data().tasks.map(task => <label key={task.id}>
			<input type="checkbox" disabled={disabled} checked={selected.includes(task.id)} onChange={event => {
				setSelected(event.currentTarget.checked ? [...selected, task.id] : selected.filter(id => id !== task.id)); setExported(undefined); setSaved('');
			}} />{task.title}
		</label>)}</div>
		<Button disabled={disabled || !selected.length} onClick={() => run(async () => {
			setExported(exportMaiwHistory(workspace.data(), selected, new Date().toISOString())); setSaved('');
		})}>{t('browser.workspace.exportV3Preview')}</Button>
		{exported !== undefined && <section class="nand-browser-workspace-preview">
			<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.exportV3Preview')}</span><textarea class="nand-input" readOnly rows={10} value={exported} /></label>
			<Button disabled={disabled} onClick={() => run(async () => setSaved(await module.exportWorkspace(exported, 'maiw.jsonl')))}>{t('browser.workspace.exportSave')}</Button>
			{saved && <p role="status">{t('browser.workspace.exportSaved', { path: saved })}</p>}
		</section>}
	</details>;
}
