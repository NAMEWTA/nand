import type { App } from 'obsidian';
import type { DashboardData, DashboardSettings } from '../../core/board/types/model';
import type { RenderCallbacks } from '../render-contract';
/** Narrow adapter for the P1 skill/pipeline views retained until their React migration. */
export interface SkillSurface {
 readonly app: App;
 readonly isOpen: boolean;
 readonly data: DashboardData | null;
 readonly agentDeliveries: Map<string, AbortController>;
 readonly plugin: { settings: DashboardSettings };
 createCallbacks(): RenderCallbacks;
}
