/**
 * Table header labels of archive notes. They are part of the stored format: a note is written with the
 * labels of the current language and reads back in either language (or with the raw column keys).
 */
export const COLUMN_LABELS: Record<'en' | 'zh', Record<string, string>> = {
	en: {
		company: 'Companies',
		department: 'Department',
		title: 'Role',
		start: 'Start date',
		end: 'End date',
		status: 'Employment status',
		key_role: 'Key role',
		notes: 'Notes',
		person: 'People',
		kind: 'This person’s…',
	},
	zh: {
		company: '企业',
		department: '部门',
		title: '职务',
		start: '开始时间',
		end: '结束时间',
		status: '任职状态',
		key_role: '关键角色',
		notes: '备注',
		person: '联系人',
		kind: '对方是此人的…',
	},
};
