import { t } from '../../../shared/i18n/index';
import type { GitErrorKind } from '../core/errors';
import type { StepResult } from '../core/flow';
import type { RunReport, SyncAction } from './sync-service';

/** What an error kind means for the user, and what to do about it. */
export function errorText(kind: GitErrorKind): string {
	return t(`sync.error.${kind}`);
}

/** One step as a short phrase: "Committed 3 files", "Already up to date", "Push failed: …". */
export function stepText(step: StepResult): string {
	const text = stepSummary(step);
	const skipped = step.squash && step.squash !== 'squashed' ? ` · ${t(`sync.squash.skip.${step.squash}`)}` : '';
	const recovery = step.recovery ? `\n${t('sync.squash.recovery', { head: step.recovery.head })}` : '';
	return text + skipped + recovery;
}

function stepSummary(step: StepResult): string {
	const count = step.count ?? 0;
	switch (step.state) {
		case 'done':
			if (step.step === 'commit') return t('sync.step.committed', { count });
			if (step.step === 'pull') return step.count === undefined ? t('sync.step.pulledDone') : t('sync.step.pulled', { count });
			if (step.upstreamSet) return t('sync.step.pushedUpstream', { count });
			if (step.count === undefined) return t('sync.step.pushedDone');
			if (step.squash === 'squashed') return t('sync.step.pushedSquashed');
			return t('sync.step.pushed', { count });
		case 'nothing':
			return t(`sync.step.nothing.${step.step}`);
		case 'conflict':
			return t('sync.step.conflict', { count });
		case 'skipped':
			return t(`sync.step.skipped.${step.reason ?? 'disabled'}`, { step: t(`sync.stepName.${step.step}`) });
		case 'failed':
			return t('sync.step.failed', { step: t(`sync.stepName.${step.step}`), reason: errorText(step.error?.kind ?? 'unknown') });
	}
}

const actionNames: Partial<Record<SyncAction, string>> = {
	fetch: 'sync.done.fetch',
	continue: 'sync.done.continue',
	abort: 'sync.done.abort',
};

/** The notice for a finished run: each step that did or failed something, plus git's own words on failure. */
export function describeReport(report: RunReport): string {
	const special = actionNames[report.action];
	const failure = report.steps.find((step) => step.error)?.error;
	if (special && report.ok) {
		const step = report.steps[0];
		if (report.action === 'continue' && step?.state === 'conflict') return stepText(step);
		return t(special);
	}
	const shown = report.steps.filter((step) => !(step.state === 'skipped' && step.reason === 'disabled'));
	const lines = [shown.map(stepText).join(' · ')];
	if (failure?.detail) lines.push(failure.detail);
	return lines.join('\n');
}

/** A one-line summary of the last run for the panel. */
export function lastRunText(report: RunReport | undefined): string {
	if (!report) return t('sync.never');
	const failed = report.steps.find((step) => step.state === 'failed' || step.state === 'conflict');
	return failed ? stepText(failed) : report.steps.filter((step) => step.state !== 'skipped').map(stepText).join(' · ') || t('sync.ok');
}
