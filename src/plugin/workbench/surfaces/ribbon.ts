import type { Plugin } from 'obsidian';
import { stableRibbon } from '../../ribbon';
import { t } from '../../../shared/i18n';

/** The only NAND Ribbon registration. Command and contextual shortcuts remain. */
export function registerWorkbenchRibbon(plugin: Plugin, open: (ownerWindow?: Window) => Promise<void>, report: (error: unknown) => void): void {
 stableRibbon(plugin, 'home', t('workbench.open'), (event) => {
  void open(event.view ?? undefined).catch(report);
 }, (icon, id, callback) => plugin.addRibbonIcon(icon, id, callback));
}
