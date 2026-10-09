import { Modal, type App } from 'obsidian';
import { render } from 'preact';
import type { UsageSnapshot } from '../../core/launch/types';
import type { AgentUsageSource } from '../../core/launch/usage-source';
import { onLanguageChanged } from '../../../../shared/i18n';
import { UsagePanel } from './UsagePanel';

export class UsageModal extends Modal {
 private cleanup: Array<() => void> = [];
 constructor(app: App, private snapshots: readonly UsageSnapshot[], private readonly source?: AgentUsageSource) { super(app); }
 onOpen(): void {
  this.contentEl.addClass('terminal-usage-modal'); this.containerEl.addClass('terminal-usage-modal-host');
  this.cleanup.push(onLanguageChanged(() => this.draw()));
  if (this.source) {
   const update = () => { this.snapshots = this.source!.getState().snapshots; this.draw(); };
   this.cleanup.push(this.source.subscribe(update), this.source.retain()); update();
  }
  this.draw();
 }
 private draw(): void { render(<UsagePanel snapshots={this.snapshots} />, this.contentEl); }
 onClose(): void { for (const off of this.cleanup.splice(0)) off(); render(null, this.contentEl); }
}
