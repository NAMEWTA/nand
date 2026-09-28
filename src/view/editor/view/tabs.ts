import { h, render } from 'preact';
import type { EditorDomainId } from '../../../shared/editor-workbench';
import type { EditorDomain } from '../domain';
import { DomainTabs } from './DomainTabs';

export function renderDomainTabs(
	host: HTMLElement,
	domains: readonly EditorDomain[],
	active: EditorDomainId,
	onPick: (id: EditorDomainId) => void,
): void {
	render(h(DomainTabs, { domains, active, onPick }), host);
}
