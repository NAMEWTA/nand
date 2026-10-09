import { FuzzySuggestModal, Notice, type TFile } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import type { AgentController } from '../../services/controller';
import { attachMaterials } from '../../services/session-material';

/** Pick a note (archive records are notes too) and paste it into an agent session without sending it. */
class MaterialPicker extends FuzzySuggestModal<TFile> {
	constructor(private readonly controller: AgentController, private readonly sessionId: string) {
		super(controller.app);
		this.setPlaceholder(t('agent.attachPlaceholder'));
	}
	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime);
	}
	getItemText(file: TFile): string {
		return file.path;
	}
	onChooseItem(file: TFile): void {
		void (async () => {
			const editor = this.app.workspace.getLeavesOfType('markdown').map((leaf) => leaf.view as { file?: TFile; editor?: { getValue(): string } }).find((view) => view.file === file)?.editor;
			const text = editor ? editor.getValue() : await this.app.vault.cachedRead(file);
			await attachMaterials(this.controller, this.sessionId, [{ id: crypto.randomUUID(), kind: 'note', title: file.basename, text, source: file.path }]);
		})().catch((error: unknown) => new Notice(t('agent.attachFailed', { message: error instanceof Error ? error.message : String(error) })));
	}
}

export function pickMaterial(controller: AgentController, sessionId: string): void {
	new MaterialPicker(controller, sessionId).open();
}
