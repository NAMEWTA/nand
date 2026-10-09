import { requireFields, requireDailyRecords } from '../../../../shared/storage/document-validation';
import {
	collectionDocument as doc,
	documentName,
	type DocumentCollectionCodec,
} from '../../../../shared/storage/document-collection';
import { emptyData, normalizeData, type HabitData } from './model';

const root = 'NAND/习惯';
export const habitDocuments: DocumentCollectionCodec<HabitData> = {
	root,
	empty: emptyData,
	encode: (data) => [
		...data.habits.map((habit) =>
			doc(habit.id, `${root}/${documentName(habit.name)}-${habit.id.slice(-8)}/习惯.md`, 'habit', { ...habit }),
		),
		...Object.entries(data.records).map(([date, ids]) =>
			doc(
				`habit:${date}`,
				`${root}/记录/${date.slice(0, 4)}/${date}.md`,
				'habit-records',
				{ date },
				ids.map((id) => ({ id: `${date}:${id}`, habitId: id })),
			),
		),
	],
	decode: (documents) => {
		for (const d of documents) {
			if (d.properties['nand-type'] === 'habit') {
				requireFields(d.properties, ['name', 'createdAt'], [], d.path);
				if (!d.properties.name || !/^\d{4}-\d{2}-\d{2}$/.test(d.properties.createdAt as string))
					throw new Error('Invalid habit: ' + d.path);
			}
			if (d.properties['nand-type'] === 'habit-records') requireDailyRecords(d, ['habitId'], []);
		}
		return normalizeData({
			version: 1,
			habits: documents
				.filter((d) => d.properties['nand-type'] === 'habit')
				.map((d) => ({ id: d.id, name: d.properties.name, createdAt: d.properties.createdAt })),
			records: Object.fromEntries(
				documents
					.filter((d) => d.properties['nand-type'] === 'habit-records')
					.map((d) => [d.properties.date, (d.rows ?? []).map((r) => r.habitId)]),
			) as Record<string, unknown>,
		});
	},
};
