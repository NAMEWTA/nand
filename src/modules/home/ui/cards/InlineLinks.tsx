import { Platform, type App, type TFile } from 'obsidian';
import type { TargetedMouseEvent } from 'preact';
import { resolveNoteFile, type DashboardRenderContext } from '../renderer/render-context';
import { documentLink } from '../../core/board/document-link';

export function noteHover(
	app: App,
	context: DashboardRenderContext,
	file: TFile | null,
	event: TargetedMouseEvent<HTMLElement>,
	subpath?: string,
): void {
	if (!file || Platform.isMobile || !context.hoverParent) return;
	app.workspace.trigger('hover-link', {
		event,
		source: 'nand-dashboard',
		hoverParent: context.hoverParent,
		targetEl: event.currentTarget,
		linktext: file.path + (subpath ?? ''),
		sourcePath: '',
	});
}

export function InlineLinks({ text, app, context }: { text: string; app: App; context: DashboardRenderContext }) {
	return (
		<>
			{text.split(/(\[\[[^\]]+?\]\]|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
				const wiki = part.match(/^\[\[([^\]]+)\]\]$/);
				if (wiki) {
					const { path, subpath, alias } = documentLink(wiki[1]!);
					const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
					const file = resolveNoteFile(app, path);
					return (
						<span
							key={index}
							class="dashboard-wikilink"
							role="link"
							tabIndex={0}
							onMouseOver={(event) => noteHover(app, context, file, event, subpath)}
							onClick={(event) => {
								event.stopPropagation();
								if (file) context.noteOpener?.(file, subpath);
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.stopPropagation();
									if (file) context.noteOpener?.(file, subpath);
								}
							}}
						>
							{alias || (subpath ? `${name} > ${subpath.slice(1)}` : name)}
						</span>
					);
				}
				const external = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
				if (external)
					return (
						<a
							key={index}
							class="dashboard-external-link"
							href={external[2]}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								event.currentTarget.ownerDocument.defaultView?.open(external[2], '_blank');
							}}
						>
							{external[1]}
						</a>
					);
				return part;
			})}
		</>
	);
}
