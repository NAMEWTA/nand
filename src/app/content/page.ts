import { Notice } from 'obsidian';
import { h, render } from 'preact';
import { NativeSurface, type NativeSurfaceContext } from '../../ui/native-surface';
import type { PageCreate } from '../contracts/workbench-host';
import { contentFiles } from '../../host/obsidian/storage/content-files';
import { acquireContentDraft } from '../../host/obsidian/storage/content-draft';
import { handleContentLink } from '../../host/obsidian/storage/content-links';
import { isContentPath } from '../../shared/storage/content-paths';
import { t } from '../../shared/i18n';
import { ContentAttachment, ContentEditor, ContentSearch } from './ContentPanel';

class ContentSurface extends NativeSurface {
 private editor?: Awaited<ReturnType<typeof acquireContentDraft>>;
 private generation = 0;
 private opened = false;
 constructor(context: NativeSurfaceContext, private path = '', private focus?: string) { super(context); }
 getViewType(): string { return 'nand-content'; }
 getDisplayText(): string { return this.path.split('/').at(-1) || t('content.title'); }
 getIcon(): string { return 'files'; }
 get current(): string { return this.path; }
 async onOpen(): Promise<void> {
  this.opened = true; this.contentEl.addClass('nand-content-page');
  this.registerDomEvent(this.contentEl, 'click', event => { handleContentLink(this.app, event, this.path); }, true);
  this.register(contentFiles(this.app).subscribe(event => {
   if (event.kind === 'rename' && event.oldPath === this.path) void this.show(event.path, this.focus).catch(error => new Notice(String(error)));
   else if (event.path === this.path && event.kind === 'delete' && !this.editor?.draft.dirty) void this.releaseEditor().then(() => this.draw()).catch(error => new Notice(String(error)));
   else if (event.path === this.path && this.editor && !this.editor.draft.dirty) void this.editor.draft.refresh().catch(error => new Notice(String(error)));
  }));
  await this.draw();
 }
 async show(path: string, focus?: string): Promise<void> {
  if (path === this.path && focus === this.focus) return;
  if (path !== this.path) await this.releaseEditor();
  this.path = path; this.focus = focus; if (this.opened) await this.draw();
 }
 private async draw(): Promise<void> {
  const generation = ++this.generation, files = contentFiles(this.app);
  render(null, this.contentEl);
  if (!this.path) { render(h(ContentSearch, { app: this.app, folder: '', owner: this.contentEl.win }), this.contentEl); return; }
  if (!isContentPath(this.path)) throw new Error('nand-content.invalid-path');
  const file = files.getFileByPath(this.path);
  if (!file) {
   render(files.getAbstractFileByPath(this.path) ? h(ContentSearch, { app: this.app, folder: this.path, owner: this.contentEl.win }) : h('p', { role: 'status' }, t('workbench.missing')), this.contentEl); return;
  }
  if (!/^(md|txt|json|jsonl|csv|yaml|yml|log)$/i.test(file.extension)) {
   const url = await files.resourceUrl(file.path);
   if (generation === this.generation) render(h(ContentAttachment, { file, url }), this.contentEl); return;
  }
  const editor = this.editor ?? await acquireContentDraft(this.app, this.path);
  if (generation !== this.generation) { await editor.release(); return; }
  this.editor = editor;
  render(h(ContentEditor, { app: this.app, draft: editor.draft, owner: this.contentEl.win, focus: this.focus }), this.contentEl);
 }
 private async releaseEditor(): Promise<void> {
  // A failed navigation keeps its lease and draft; a later Save or navigation can retry.
  await this.editor?.draft.save();
  await this.editor?.release(); this.editor = undefined;
 }
 async onClose(): Promise<void> {
  this.opened = false; ++this.generation; render(null, this.contentEl);
  try { await this.editor?.release(); this.editor = undefined; }
  catch (error) { new Notice(t('content.saveFailed', { error: String(error) }), 0); throw error; }
 }
}

export const createContentPage: PageCreate = async (context, target) => {
 const surface = new ContentSurface(context, target.resourceId, target.focusId);
 return { surface, getTarget: () => ({ feature: 'content', ...(surface.current ? { resourceId: surface.current } : {}) }), navigate: async next => surface.show(next.resourceId ?? '', next.focusId) };
};
