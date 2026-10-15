// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/media-lightbox-modal.ts
import { useState, useLayoutEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import { MediaLightboxPanel } from './MediaLightboxPanel';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function MediaLightbox({
	startIndex,
	...props
}: Omit<ComponentProps<typeof MediaLightboxPanel>, 'index' | 'show'> & { startIndex: number }) {
	const [index, setIndex] = useState(startIndex);
	const root = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const owner = root.current?.ownerDocument;
		const handle = (event: KeyboardEvent) => {
			const tag = (event.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement)?.isContentEditable) return;
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				event.preventDefault();
				setIndex((i) =>
					Math.max(0, Math.min(props.files.length - 1, i + (event.key === 'ArrowLeft' ? -1 : 1))),
				);
			}
		};
		owner?.addEventListener('keydown', handle);
		return () => owner?.removeEventListener('keydown', handle);
	}, [props.files.length]);
	return (
		<DashboardDialog title={props.files[index]?.basename ?? ''} onClose={props.close} wide>
			<div ref={root}>
				<MediaLightboxPanel
					{...props}
					index={index}
					show={(i) => setIndex(Math.max(0, Math.min(props.files.length - 1, i)))}
				/>
			</div>
		</DashboardDialog>
	);
}
