import { requireDailyRecords, requireFields } from '../../shared/storage/document-validation';
import { collectionDocument as doc, type DocumentCollectionCodec } from '../../shared/storage/document-collection';
import type { PomodoroData, PomodoroRecord } from './application';

const root = 'NAND/番茄钟';
export const pomodoroDocuments: DocumentCollectionCodec<PomodoroData> = {
	root,
	empty: () => ({ version: 2, currentActivity: '', tags: [], sessions: [] }),
	encode: (data) => [
		doc('pomodoro-settings', `${root}/活动.md`, 'pomodoro-settings', {
			currentActivity: data.currentActivity,
			tags: data.tags,
		}),
		...data.sessions.map((day) =>
			doc(
				`pomodoro:${day.date}`,
				`${root}/记录/${day.date.slice(0, 4)}/${day.date}.md`,
				'pomodoro-records',
				{ date: day.date, completed: day.completed },
				(day.records ?? []).map((record) => ({ id: record.timestamp, ...record })),
			),
		),
	],
	decode: (documents) => {
		for (const d of documents)
			if (d.properties['nand-type'] === 'pomodoro-records') {
				requireDailyRecords(d, ['timestamp', 'activity'], ['duration']);
				requireFields(d.properties, [], ['completed'], d.path);
			}

		const settings = documents.find((d) => d.id === 'pomodoro-settings')?.properties;
		return {
			version: 2,
			currentActivity: typeof settings?.currentActivity === 'string' ? settings.currentActivity : '',
			tags: (settings?.tags ?? []) as PomodoroData['tags'],
			sessions: documents
				.filter((d) => d.properties['nand-type'] === 'pomodoro-records')
				.map((d) => ({
					date: String(d.properties.date),
					completed: Number(d.properties.completed),
					records: (d.rows ?? []) as unknown as PomodoroRecord[],
				})),
		};
	},
};
