import type { App } from 'obsidian';
import { useState } from 'preact/hooks';
import { openDialog } from '../../../../ui/primitives/dialog';
import { Button } from '../../../../ui/primitives/Button';
import { t } from '../../../../shared/i18n';
import { ownAgentPreview } from '../skills/preview-lifetime';

/** Closing the preview resolves its edited draft before background delivery begins. */
export function previewAgentPrompt(app: App, prompt: string, agent: string, owner: unknown): Promise<string | null> {
	return new Promise(resolve => {
		let result: string | null = null;
		let release = () => {};
		function Body({ close }: { close: () => void }) {
			const [draft, setDraft] = useState(prompt);
			return <div class="nand-ui-stack nand-agent-prompt-preview">
				<p>{t('quickActions.skillTarget', { name: agent })}</p>
				<label class="nand-ui-field"><span>{t('quickActions.skillFinalPrompt')}</span>
					<textarea rows={10} value={draft} onInput={event => setDraft(event.currentTarget.value)} />
				</label>
				<div class="nand-dialog-footer"><Button onClick={close}>{t('common.cancel')}</Button>
					<Button variant="primary" disabled={!draft.trim()} onClick={() => { result = draft; close(); }}>{t('quickActions.skillSend')}</Button>
				</div>
			</div>;
		}
		const close = openDialog(app, { title: t('quickActions.skillPreview'), content: close => <Body close={close} />,
			onClose: () => { release(); resolve(result); } });
		release = ownAgentPreview(app, close, owner);
	});
}
