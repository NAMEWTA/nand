import { useId, useState } from 'preact/hooks';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';
import type { NavigationItem, WorkbenchTarget } from '../contracts/workbench';

export interface FeatureNavigatorProps {
 items: readonly NavigationItem[];
 current: WorkbenchTarget;
 expanded: readonly string[];
 collapsed: readonly string[];
 toggle: (id: string, expanded: boolean) => void;
 open: (target: WorkbenchTarget, keyboard?: boolean) => void;
}
/** Ordinary disclosure navigation: focusing or expanding never launches a feature. */
export function FeatureNavigator(props: FeatureNavigatorProps) {
 const [query, setQuery] = useState('');
 const prefix = useId();
 const needle = query.trim().toLocaleLowerCase();
 const matches = (item: NavigationItem) => [t(item.labelKey), ...(item.aliases ?? [])].some((text) => text.toLocaleLowerCase().includes(needle));
 const rows = props.items.filter((item) => !needle || matches(item) || item.children?.some(matches));
 return <nav aria-label={t('workbench.navigation')} className="nand-workbench-navigation">
  <label className="nand-ui-field nand-workbench-search">
   <span>{t('workbench.search')}</span>
   <input type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={t('workbench.search')} />
  </label>
  <ul className="nand-workbench-nav-list">
   {rows.map((item) => {
    const active = item.target?.feature === props.current.feature;
    const expanded = !!needle || props.expanded.includes(item.id) || (active && !props.collapsed.includes(item.id));
    const controls = prefix + '-' + item.id;
    return <li key={item.id}>
     <div className={'nand-workbench-nav-row' + (active ? ' is-active' : '')}>
      <button type="button" className="nand-workbench-nav-link" aria-current={active && (!props.current.section || !expanded) ? 'page' : undefined} onClick={(event) => { if (item.target) props.open(item.target, event.detail === 0); }}>
       <Icon name={item.icon} /><span>{t(item.labelKey)}</span>
       {!!item.badge && <span className="nand-ui-badge">{item.badge}</span>}
      </button>
      {!!item.children?.length && <button type="button" className="nand-ui-icon-btn" aria-label={t(expanded ? 'workbench.collapse' : 'workbench.expand') + ': ' + t(item.labelKey)} aria-controls={controls} aria-expanded={expanded} onClick={() => props.toggle(item.id, expanded)}><Icon name={expanded ? 'chevron-down' : 'chevron-right'} /></button>}
     </div>
     {!!item.children?.length && <ul id={controls} className="nand-workbench-nav-children" hidden={!expanded}>
      {item.children.filter((child) => !needle || matches(item) || matches(child)).map((child) => <li key={child.id}>
       <button type="button" className="nand-workbench-nav-link" aria-current={active && child.target?.section === props.current.section ? 'page' : undefined} onClick={(event) => { if (child.target) props.open(child.target, event.detail === 0); }}>{t(child.labelKey)}</button>
      </li>)}
     </ul>}
    </li>;
   })}
  </ul>
  {rows.length === 0 && <p role="status" className="nand-workbench-nav-empty">{t('workbench.noResults')}</p>}
 </nav>;
}
