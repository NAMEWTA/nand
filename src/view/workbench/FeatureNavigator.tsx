import { useState } from 'preact/hooks';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';
import type { NavigationItem, WorkbenchTarget } from '../contracts/workbench';

export interface FeatureNavigatorProps {
 items: readonly NavigationItem[];
 current: WorkbenchTarget;
 expanded: readonly string[];
 toggle: (id: string) => void;
 open: (target: WorkbenchTarget) => void;
}
/** Ordinary disclosure navigation: focusing or expanding never launches a feature. */
export function FeatureNavigator(props: FeatureNavigatorProps) {
 const [query, setQuery] = useState('');
 const needle = query.trim().toLocaleLowerCase();
 const matches = (item: NavigationItem) => t(item.labelKey).toLocaleLowerCase().includes(needle);
 const rows = props.items.filter((item) => !needle || matches(item) || item.children?.some(matches));
 return <nav aria-label={t('workbench.navigation')} className="nand-workbench-navigation">
  <label className="nand-ui-field nand-workbench-search">
   <span>{t('workbench.search')}</span>
   <input type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={t('workbench.search')} />
  </label>
  <ul className="nand-workbench-nav-list">
   {rows.map((item) => {
    const active = item.target?.feature === props.current.feature;
    const expanded = !!needle || props.expanded.includes(item.id);
    return <li key={item.id}>
     <div className={'nand-workbench-nav-row' + (active ? ' is-active' : '')}>
      <button type="button" className="nand-workbench-nav-link" aria-current={active && !props.current.section ? 'page' : undefined} onClick={() => { if (item.target) props.open(item.target); }}>
       <Icon name={item.icon} /><span>{t(item.labelKey)}</span>
       {!!item.badge && <span className="nand-ui-badge">{item.badge}</span>}
      </button>
      {!!item.children?.length && <button type="button" className="nand-ui-icon-btn" aria-label={t(expanded ? 'workbench.collapse' : 'workbench.expand')} aria-expanded={expanded} onClick={() => props.toggle(item.id)}><Icon name={expanded ? 'chevron-down' : 'chevron-right'} /></button>}
     </div>
     {!!item.children?.length && <ul className="nand-workbench-nav-children" hidden={!expanded}>
      {item.children.filter((child) => !needle || matches(item) || matches(child)).map((child) => <li key={child.id}>
       <button type="button" className="nand-workbench-nav-link" aria-current={active && child.target?.section === props.current.section ? 'page' : undefined} onClick={() => { if (child.target) props.open(child.target); }}>{t(child.labelKey)}</button>
      </li>)}
     </ul>}
    </li>;
   })}
  </ul>
  {rows.length === 0 && <p className="nand-workbench-nav-empty">{t('workbench.noResults')}</p>}
 </nav>;
}
