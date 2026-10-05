import type { FeatureRegistrationConfig, VisibilityConfig } from '../../../core/pty/visibility-types';

/** Local command/new-tab visibility only; global entry points belong to the shell. */
export class FeatureVisibilityManager {
 private readonly features = new Map<'terminal', FeatureRegistrationConfig>();
 registerFeature(config: FeatureRegistrationConfig): void { this.features.set(config.id, config); this.updateVisibility(config.id); }
 updateVisibility(id: 'terminal'): void { const config = this.features.get(id); config?.onVisibilityChange?.(config.getVisibility()); }
 updateAllVisibility(): void { for (const id of this.features.keys()) this.updateVisibility(id); }
 getVisibility(id: 'terminal'): VisibilityConfig | null { return this.features.get(id)?.getVisibility() ?? null; }
 isVisibleAt(id: 'terminal', position: keyof VisibilityConfig): boolean {
  const flags = this.getVisibility(id);
  return position !== 'showInRibbon' && position !== 'showInStatusBar' && flags?.enabled === true && flags[position] === true;
 }
 cleanup(): void { this.features.clear(); }
}
