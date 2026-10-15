// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pipeline-section.ts
import type { App } from 'obsidian';
import type { DashboardColumn } from '../../core/board/types/model';
import type { RenderCallbacks } from '../render-contract';
import { mountRecordPanel } from '../dialogs/mount-record-panel';
import { PipelineSection } from './PipelineSection';
export function renderPipelineSection(
	root: HTMLElement,
	column: DashboardColumn,
	app: App,
	callbacks: RenderCallbacks,
	signal: AbortSignal,
): void {
	mountRecordPanel(
		root,
		<PipelineSection
			app={app}
			column={column}
			callbacks={callbacks}
			signal={signal}
			win={root.ownerDocument.defaultView!}
		/>,
	);
}
