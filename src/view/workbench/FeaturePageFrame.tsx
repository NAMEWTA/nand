import type { ComponentChildren, Ref } from 'preact';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';

export interface FeaturePageFrameProps {
 title: string;
 navigationId?: string;
 navigationOpen?: boolean;
 busy: boolean;
 error?: string;
 unavailable?: string;
 toggleNavigation: () => void;
 more: (event: MouseEvent) => void;
 retry: () => void;
 settings: () => void;
 contentRef: Ref<HTMLDivElement>;
 inert?: boolean;
 actions?: ComponentChildren;
}
export function FeaturePageFrame(props: FeaturePageFrameProps) {
 return <main className="nand-workbench-main" inert={props.inert}>
  <header className="nand-workbench-header">
   <button type="button" className="nand-ui-icon-btn" aria-label={t('workbench.toggleNavigation')} aria-controls={props.navigationId} aria-expanded={props.navigationOpen} onClick={props.toggleNavigation}><Icon name="panel-left" /></button>
   <h2 tabIndex={-1} data-workbench-focus="title">{props.title}</h2><span className="nand-ui-spacer" />
   {props.busy && <span role="status" className="nand-workbench-progress">{t('workbench.loading')}</span>}
   {props.actions}
   <button type="button" className="nand-ui-icon-btn" aria-label={t('workbench.more')} onClick={props.more}><Icon name="ellipsis" /></button>
  </header>
  {props.error && <div role="alert" className="nand-workbench-error"><strong>{t('workbench.failed')}</strong><span>{props.error}</span><button type="button" className="nand-ui-btn" onClick={props.retry}>{t('workbench.retry')}</button></div>}
  {props.unavailable && <section className="nand-workbench-unavailable"><p>{props.unavailable}</p><button type="button" className="nand-ui-btn" onClick={props.settings}>{t('workbench.manage')}</button></section>}
  <div className="nand-workbench-pages" ref={props.contentRef} aria-busy={props.busy} />
 </main>;
}
