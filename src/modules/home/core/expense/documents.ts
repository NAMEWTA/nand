import { requireDailyRecords } from '../../../../shared/storage/document-validation';
import { collectionDocument as doc, recordRows, type DocumentCollectionCodec } from '../../../../shared/storage/document-collection';
import { emptyData, normalizeData, type ExpenseData } from './model';

const root = 'NAND/记账';
export const expenseDocuments: DocumentCollectionCodec<ExpenseData> = {
	root,
	empty: emptyData,
	encode: (data) => {
		const { records, ...settings } = data;
		const days = new Map<string, Array<Record<string, unknown>>>();
		for (const record of records) {
			const rows = days.get(record.date) ?? [];
			rows.push({ ...record });
			days.set(record.date, rows);
		}
		return [
			doc('expense-settings', `${root}/分类.md`, 'expense-settings', settings),
			...[...days].map(([date, rows]) =>
				doc(
					`expense:${date}`,
					`${root}/记录/${date.slice(0, 4)}/${date}.md`,
					'expense-records',
					{ date },
					rows,
				),
			),
		];
	},
	decode: (documents) => {
		for (const d of documents)
			if (d.properties['nand-type'] === 'expense-records') {
				requireDailyRecords(d, ['type', 'category', 'date'], ['amount', 'createdAt']);
				for (const row of d.rows!)
					if (
						!['expense', 'income'].includes(row.type as string) ||
						(row.amount as number) < 0 ||
						row.date !== d.properties.date
					)
						throw new Error('Invalid expense: ' + d.path);
			}
		return normalizeData({
			...emptyData(),
			...documents.find((d) => d.id === 'expense-settings')?.properties,
			records: documents
				.filter((d) => d.properties['nand-type'] === 'expense-records')
				.flatMap((d) => recordRows<Record<string, unknown>>(d)),
		});
	},
};
