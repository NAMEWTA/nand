import type { FeatureAvailability, NavigationItem, WorkbenchFeature, WorkbenchTarget } from '../../contracts/workbench';
import type { NativeSurface, NativeSurfaceContext } from './native-surface';

export interface WorkbenchPageBinding {
 surface: NativeSurface;
 navigate(target: WorkbenchTarget, signal: AbortSignal): Promise<void>;
 getState?: () => Record<string, unknown>;
 getTarget?: () => WorkbenchTarget;
 restore?: (state: Record<string, unknown>) => Promise<void>;
}
export interface WorkbenchContribution {
 id: WorkbenchFeature;
 navigation: NavigationItem;
 availability(): FeatureAvailability;
 stateKeys: readonly string[];
 resourcePages?: boolean;
 navigationContext?: boolean;
 releaseWhenHidden?: boolean;
 create(context: NativeSurfaceContext, target: WorkbenchTarget, state: Record<string, unknown>, signal: AbortSignal): Promise<WorkbenchPageBinding>;
}
export interface WorkbenchHost {
 contributions: readonly WorkbenchContribution[];
 subscribe(listener: () => void): () => void;
 openSettings: (feature?: WorkbenchFeature) => void;
 manageFeatures: () => void;
 openStandalone: (target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow: Window) => Promise<void>;
 report: (error: unknown) => void;
}
