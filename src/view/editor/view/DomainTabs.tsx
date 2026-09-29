import type { EditorDomainId } from '../../../shared/editor-workbench';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import type { EditorDomain } from '../domain';

export function DomainTabs({
	domains,
	active,
	onPick,
}: {
	domains: readonly EditorDomain[];
	active: EditorDomainId;
	onPick: (id: EditorDomainId) => void;
}) {
	return (
		<div className="nand-editor-tabs nand-ui-segmented">
			{domains.map((domain) => (
				<button
					key={domain.id}
					type="button"
					className={`nand-editor-tab${domain.id === active ? ' is-active' : ''}`}
					aria-pressed={domain.id === active}
					onClick={() => onPick(domain.id)}
				>
					<span className="nand-editor-tab-icon">
						<Icon name={domain.icon} />
					</span>
					<span className="nand-editor-tab-label">{t(domain.titleKey)}</span>
				</button>
			))}
		</div>
	);
}
