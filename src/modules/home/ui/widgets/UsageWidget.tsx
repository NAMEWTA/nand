import { useEffect, useSyncExternalStore } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { IconButton } from '../board/controls';
import { Progress } from '../../../../ui/components/progress';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { EmptyState } from '../../../../ui/components/nand/EmptyState';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { UsageProvider, UsageSnapshot } from '../../../../app/contracts/workbench';
import type { AgentUsage } from '../../../agent/api';
import {
	maxUsed,
	rankProviders,
	resetIn,
	resetUnits,
	usageStatusKey,
	shownPercent,
	usageMode,
	usageTone,
	type ResetIn,
	type UsageTone,
} from '../../core/board/usage-view';
import type { BoardStore } from '../../services/board-store';
import { useClock } from '../board/hooks';
import { useBox } from './use-box';
import { WidgetHeader } from './WidgetHeader';

const TONE_TEXT: Record<UsageTone, string> = {
	normal: 'text-[var(--db-text-muted)]',
	warning: 'text-status-warning',
	danger: 'text-destructive',
};
const TONE_BAR: Record<UsageTone, string> = {
	normal: '',
	warning: '[&_[data-slot=progress-indicator]]:bg-status-warning',
	danger: '[&_[data-slot=progress-indicator]]:bg-destructive',
};

const none = () => undefined;

/** The agent module's quota service while it is active, with its latest snapshot. */
function useAgentUsage(store: BoardStore): { usage: AgentUsage | undefined; snapshot: UsageSnapshot | undefined } {
	const { usage: current, watchUsage } = store.widgets,
		doc = useOwnerDocument(),
		visible = useVisible(),
		usage = useSyncExternalStore(
			(listener: () => void) => watchUsage?.(listener) ?? none,
			() => current?.(),
		),
		snapshot = useSyncExternalStore(
			(listener: () => void) => usage?.subscribe(listener) ?? none,
			() => usage?.snapshot(),
		);
	useEffect(() => {
		const win = doc.defaultView;
		return win && visible ? usage?.observeWindow?.(win) : undefined;
	}, [doc, usage, visible]);
	return { usage, snapshot };
}

function Bar({ used, display = 'used' }: { used: number; display?: 'used' | 'remaining' }) {
	const tone = usageTone(used);
	return (
		<Progress
			value={shownPercent(used, display)}
			aria-hidden
			className={`h-1.5 min-w-8 flex-1 bg-[var(--db-bg-hover)] ${TONE_BAR[tone]}`}
		/>
	);
}

function resetText(t: ReturnType<typeof useT>, reset: ResetIn): string {
	const { key, values } = resetUnits(reset);
	return t(key, values);
}

function ProviderName({ provider }: { provider: UsageProvider }) {
	return (
		<>
			<AgentIcon agent={provider.id === 'gemini' ? 'gemini-cli' : provider.id} size={14} className="shrink-0" />
			<span className="min-w-0 truncate font-medium">
				{provider.name}
				{provider.account && <span className="font-normal text-[var(--db-text-muted)]"> · {provider.account}</span>}
			</span>
		</>
	);
}

function Percent({ used }: { used: number }) {
	return (
		<span className={`shrink-0 tabular-nums text-[.85em] ${TONE_TEXT[usageTone(used)]}`}>
			{shownPercent(used, 'used')}%
		</span>
	);
}

/** One provider: name and top share, then (in `detail`) one bar per quota window. */
function ProviderRow({ provider, detail, now }: { provider: UsageProvider; detail: boolean; now: number }) {
	const t = useT(),
		used = maxUsed(provider),
		reset = resetIn(
			provider.windows.flatMap((window) => (window.resetsAt ? [window.resetsAt] : [])),
			now,
		);
	return (
		<li className="flex min-w-0 flex-col gap-1" data-usage-provider={provider.id}>
			<div className="flex min-w-0 items-center gap-1.5 text-[.85em]">
				<ProviderName provider={provider} />
				<span className="flex-1" />
				{provider.windows.length ? (
					<Percent used={used} />
				) : (
					<span className="flex shrink-0 items-center gap-1 text-[.8em] text-[var(--db-text-muted)]">
						{provider.failed && <TriangleAlert className="size-3" />}
						{provider.statusLabel ?? t(usageStatusKey(provider.status))}
					</span>
				)}
				{provider.stale && provider.windows.length > 0 && (
					<TriangleAlert className="size-3 shrink-0 text-[var(--db-text-muted)]" aria-label={t('usage.stale')} />
				)}
			</div>
			{provider.windows.length > 0 && !detail && (
				<div className="flex items-center gap-2">
					<Bar used={used} />
					{reset && (
						<span className="shrink-0 text-[.7em] text-[var(--db-text-muted)]">
							{t('usage.resetsIn', { time: resetText(t, reset) })}
						</span>
					)}
				</div>
			)}
			{detail &&
				provider.windows.map((window) => {
					const own = window.resetsAt ? resetIn([window.resetsAt], now) : undefined;
					return (
						<div key={window.key ?? window.label} className="flex items-center gap-2 pl-5 text-[.75em]">
							<span className="w-10 shrink-0 truncate text-[var(--db-text-muted)]">{window.label}</span>
							<Bar used={window.usedPercent} />
							<Percent used={window.usedPercent} />
							{own && (
								<span className="hidden shrink-0 text-[var(--db-text-muted)] @[260px]:inline">
									{resetText(t, own)}
								</span>
							)}
						</div>
					);
				})}
		</li>
	);
}

/** Provider quotas from the agent module: the busiest provider at S, every provider at M, every window at L. */
export function UsageWidget({ store }: { store: BoardStore }) {
	const t = useT(),
		{ usage, snapshot } = useAgentUsage(store),
		[ref, box] = useBox<HTMLDivElement>(),
		now = useClock(60_000),
		mode = usageMode(box),
		providers = rankProviders(snapshot?.providers ?? []),
		refreshing = snapshot?.refreshing ?? false;
	const refresh = (
		<IconButton
			label={t('usage.refresh')}
			className="size-5 shrink-0"
			disabled={!usage || refreshing}
			onClick={() => {
				void usage?.refresh().catch(() => undefined);
			}}
		>
			<RefreshCw className={`size-3 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
		</IconButton>
	);
	const list = (
		<ul className="m-0 flex min-h-0 min-w-0 flex-1 list-none flex-col justify-center gap-2.5 overflow-auto p-0">
			{(mode === 'top' ? providers.slice(0, 1) : providers).map((provider) => (
				<ProviderRow key={provider.id} provider={provider} detail={mode === 'detail'} now={now} />
			))}
		</ul>
	);
	return (
		<div ref={ref} data-usage-mode={mode} className="@container flex h-full min-h-0 flex-col">
			{!usage ? (
				<EmptyState
					className="p-2"
					icon={<TriangleAlert />}
					title={t('usage.unavailable')}
					description={mode === 'top' ? undefined : t('usage.unavailableHint')}
				/>
			) : (
				<>
					{mode !== 'top' && <WidgetHeader icon="gauge" title={t('home.widget.usage')} actions={refresh} />}
					{mode === 'top' ? (
						<div className="flex min-h-0 flex-1 items-center gap-1">
							{providers.length === 0 ? (
								<span className="min-w-0 flex-1 truncate text-[.85em] text-[var(--db-text-muted)]">
									{t('usage.empty')}
								</span>
							) : (
								list
							)}
							{refresh}
						</div>
					) : providers.length === 0 ? (
						<EmptyState className="p-2" title={t('usage.empty')} description={t('usage.emptyHint')} />
					) : (
						list
					)}
				</>
			)}
		</div>
	);
}
