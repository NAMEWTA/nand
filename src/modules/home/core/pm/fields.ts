// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pm-model.ts
const PM_FIELD_ALIASES: Record<string, readonly string[]> = {
	intro: ['intro', '一句话', '一句话介绍'],
	stage: ['stage', '阶段', '当前阶段'],
	status: ['status', '状态', '当前状态'],
	client: ['client', '客户'],
	income: ['income', '收入', '金额'],
	keyDate: ['keyDate', '关键日期'],
	cycleStart: ['cycleStart', '开始日期', '周期开始'],
	cycleEnd: ['cycleEnd', '结束日期', '周期结束'],
	nextStep: ['nextStep', '下一步'],
	deliverables: ['deliverables', '交付物', '交付物摘要'],
	payment: ['payment', '尾款', '合同尾款'],
};

/** Read one project field through its alias family. '' when unset. */
export function pmField(frontmatter: Record<string, unknown>, key: keyof typeof PM_FIELD_ALIASES): string {
	for (const alias of PM_FIELD_ALIASES[key]!) {
		const raw = frontmatter[alias];
		if (raw === undefined || raw === null) continue;
		const value = (typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '').trim();
		if (value) return value;
	}
	return '';
}

/** Numeric income through the alias family (NaN-guarded). */
export function pmIncome(frontmatter: Record<string, unknown>): number {
	const raw = pmField(frontmatter, 'income');
	if (!raw) return 0;
	const value = Number(raw.replace(/[¥$,，\s]/g, ''));
	return Number.isFinite(value) ? value : 0;
}

export function pmCycleText(frontmatter: Record<string, unknown>): string {
	const start = pmField(frontmatter, 'cycleStart').slice(0, 10);
	const end = pmField(frontmatter, 'cycleEnd').slice(0, 10);
	const fmt = (iso: string): string => (iso.length === 10 ? `${iso.slice(5, 7)}.${iso.slice(8, 10)}` : '');
	if (!start && !end) return '';
	const startAt = start ? new Date(`${start}T00:00:00`) : null;
	const endAt = end ? new Date(`${end}T00:00:00`) : null;
	let days = '';
	if (startAt && endAt && !Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime())) {
		days = ` · ${Math.round((endAt.getTime() - startAt.getTime()) / 86_400_000) + 1}d`;
	}
	return `${fmt(start) || '—'} – ${fmt(end) || '—'}${days}`;
}
