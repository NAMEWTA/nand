import { useState } from 'preact/hooks';
import type { App } from 'obsidian';
import type { DashboardColumn } from '../../core/board/types/model';
import type { RenderCallbacks } from '../render-contract';
import { mountDashboardPanel } from '../renderer/render-context';
import { RenderBoundary } from '../../../../ui/primitives/RenderBoundary';
import { PipelineSection } from './PipelineSection';
import { pipelineError } from './PipelineCard';

export function renderPipelineSection(root: HTMLElement, column: DashboardColumn, app: App, callbacks: RenderCallbacks, signal: AbortSignal): void {
	function Guard() {
		const [error, setError] = useState('');
		return error ? <p role="alert">{error}</p> : <RenderBoundary onError={error => setError(pipelineError(error))}><PipelineSection app={app} column={column} callbacks={callbacks} signal={signal} win={root.win} /></RenderBoundary>;
	}
	mountDashboardPanel(root, <Guard />);
}
