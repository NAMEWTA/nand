import { render } from 'preact';
import { t, onLanguageChanged } from '../../shared/i18n';
import type { NotificationService } from '../../core/notifications/service';
import { NativeSurface, type NativeSurfaceContext } from '../hosts/obsidian/native-surface';
import { InboxPanel } from './InboxPanel';

export class NotificationPresentation extends NativeSurface {
 constructor(context: NativeSurfaceContext, private readonly service: NotificationService, private readonly report: (error: unknown) => void) { super(context); }
 getViewType(): string { return 'nand-notification-surface'; }
 getDisplayText(): string { return t('workbench.notifications'); }
 getIcon(): string { return 'bell'; }
 onOpen(): Promise<void> {
  this.contentEl.addClass('nand-inbox');
  this.register(this.service.subscribe(() => this.draw()));
  this.register(onLanguageChanged(() => this.draw()));
  this.draw(); return Promise.resolve();
 }
 private draw(): void {
  render(<InboxPanel records={this.service.records} unread={this.service.unread} markRead={(id) => { void this.service.markRead(id).catch(this.report); }} clearRead={() => { void this.service.clearRead().catch(this.report); }} open={(record) => { void this.service.open(record).catch(this.report); }} />, this.contentEl);
 }
 onClose(): Promise<void> { render(null, this.contentEl); return Promise.resolve(); }
}
