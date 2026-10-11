import type { LibraryConfig } from '../../core/board/types/model';
import { libraryTableColumns } from '../../core/board/table-columns';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { Icon } from '../../../../ui/primitives/Icon';

export function tableColumnLabel(key: string): string {
	return key === 'file.name'
		? t('library.sortName')
		: key === 'file.modified'
			? t('library.sortModified')
			: key.slice('property:'.length);
}

/** Keyed native controls retain focus when preferences reorder their own rows. */
export function TableColumnsEditor({
	config,
	candidates,
	change,
}: {
	config: LibraryConfig;
	candidates: readonly string[];
	change: (config: LibraryConfig) => void;
}) {
	const { order, hidden } = libraryTableColumns(config, candidates);
	const move = (index: number, delta: number) => {
		if (index + delta < 0 || index + delta >= order.length) return;
		const next = [...order];
		[next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
		change({ ...config, tableOrder: next, tableHidden: hidden });
	};
	return (
		<section class="nand-ui-card nand-ui-stack nand-library-columns" aria-label={t('library.tableColumns')}>
			{order.map((key, index) => {
				const label = tableColumnLabel(key);
				return (
					<div class="nand-ui-toolbar" key={key} data-table-column={key}>
						<label class="nand-ui-toolbar">
							<input
								type="checkbox"
								checked={!hidden.includes(key)}
								onChange={(event) =>
									change({
										...config,
										tableOrder: order,
										tableHidden: event.currentTarget.checked
											? hidden.filter((value) => value !== key)
											: [...hidden, key],
									})
								}
							/>
							<span>{label}</span>
						</label>
						{!candidates.includes(key) && <small>{t('library.tableColumnAbsent')}</small>}
						<button
							type="button"
							class="nand-icon-btn"
							aria-label={t('library.tableColumnUp', { column: label })}
							aria-disabled={index === 0}
							onClick={() => move(index, -1)}
						>
							<Icon name="arrow-up" />
						</button>
						<button
							type="button"
							class="nand-icon-btn"
							aria-label={t('library.tableColumnDown', { column: label })}
							aria-disabled={index === order.length - 1}
							onClick={() => move(index, 1)}
						>
							<Icon name="arrow-down" />
						</button>
					</div>
				);
			})}
			<Button onClick={() => change({ ...config, tableOrder: undefined, tableHidden: undefined })}>
				{t('library.tableColumnReset')}
			</Button>
		</section>
	);
}
