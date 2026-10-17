// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { File, FileText, Folder, FolderOpen, Hash, Tag } from 'lucide-react';
import { ObsidianIcon } from '../../../ui/components/nand/ObsidianIcon';
import type { IconTarget } from '../../icons/api';
import type { NavigatorEnv } from './env';

const ICON = 'size-4 shrink-0';

/** Folder, tag or file icon: the icons module's rule-book icon when it has one, otherwise a default. */
export function EntryIcon({ env, target, open, version }: { env: NavigatorEnv; target: IconTarget; open?: boolean; version: number }) {
	void version;
	const resolved = env.resolveIcon(target);
	const style = resolved.color ? { color: resolved.color } : undefined;
	if (resolved.icon && resolved.emoji) {
		return <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center text-[13px] leading-none" style={style}>{resolved.icon}</span>;
	}
	if (resolved.icon) return <span className="inline-flex shrink-0" style={style}><ObsidianIcon name={resolved.icon} className={ICON} /></span>;
	const tone = resolved.color ? undefined : 'text-muted-foreground';
	switch (target.kind) {
		case 'folder':
			return open ? <FolderOpen className={`${ICON} ${tone ?? ''}`} style={style} aria-hidden /> : <Folder className={`${ICON} ${tone ?? ''}`} style={style} aria-hidden />;
		case 'tag':
			return <Hash className={`${ICON} ${tone ?? ''}`} style={style} aria-hidden />;
		case 'property':
			return <Tag className={`${ICON} ${tone ?? ''}`} style={style} aria-hidden />;
		default:
			return target.key.endsWith('.md') ? <FileText className={`${ICON} ${tone ?? ''}`} style={style} aria-hidden /> : <File className={`${ICON} ${tone ?? ''}`} style={style} aria-hidden />;
	}
}
