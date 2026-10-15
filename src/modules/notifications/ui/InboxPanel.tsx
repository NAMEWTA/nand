import { notificationBody } from '../core/service';
import type { NotificationRecord } from '../api';
import { getLanguage } from '../../../shared/i18n';
import { EmptyState } from '../../../ui/components/nand/EmptyState';
import { Button } from '../../../ui/components/button';
import { Badge } from '../../../ui/components/badge';
import { BellOff, CheckCheck, Check, Clock, Trash2 } from 'lucide-react';
import { useT } from '../../../ui/react/hooks';

/** Presentation only: delivery states map to semantic badge tones. */
const DELIVERY_TONE: Record<string, string> = {
	sent: 'text-status-success',
	failed: 'text-destructive',
	unknown: 'text-status-warning',
};

/** The inbox list; the workbench page header already names the page, so there is no heading here. */
export function InboxPanel({
	records: all,
	filter,
	markRead,
	clearRead,
	open,
	openable,
}: {
	records: readonly NotificationRecord[];
	filter: 'all' | 'unread';
	markRead: (id?: string) => void;
	clearRead: () => void;
	open: (record: NotificationRecord) => void;
	openable: ReadonlySet<string>;
}) {
	const t = useT();
	const records = filter === 'unread' ? all.filter((record) => !record.read) : all;
	return (
		<div className="mx-auto w-full max-w-4xl space-y-4 p-6">
			<div className="flex justify-end">
				<div className="flex flex-wrap gap-2">
					<Button variant="ghost" onClick={() => markRead()}>
						<CheckCheck className="size-4" />
						{t('automation.readAll')}
					</Button>
					<Button variant="ghost" onClick={clearRead}>
						<Trash2 className="size-4" />
						{t('automation.clearRead')}
					</Button>
				</div>
			</div>
			{!records.length && (
				<EmptyState
					icon={<BellOff />}
					title={t(filter === 'unread' && all.length ? 'workbench.noUnread' : 'automation.inboxEmpty')}
					description=""
				/>
			)}
			{records.length > 0 && (
				<ul className="divide-y divide-border">
					{[...records].reverse().map((record) => {
						const body = notificationBody(record);
						return (
							<li
								className={`flex flex-wrap gap-3 py-4 ${record.read ? 'opacity-70' : ''}`}
								key={record.id}
							>
								{/* The unread marker is a named image so assistive tech keeps the old "●" cue. */}
								{record.read ? (
									<span className="mt-2 size-2 shrink-0" aria-hidden="true" />
								) : (
									<span
										className="mt-2 size-2 shrink-0 rounded-full bg-primary"
										role="img"
										aria-label={t('automation.unread')}
									/>
								)}
								<div className="min-w-0 flex-1 space-y-1">
									<div className="text-sm font-medium">{record.title}</div>
									{body !== record.title && (
										<div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
											{body}
										</div>
									)}
									<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										<span className="inline-flex items-center gap-1">
											<Clock className="size-3" />
											{new Date(record.createdAt).toLocaleString(
												getLanguage() === 'zh' ? 'zh-CN' : 'en-US',
											)}
										</span>
										{record.channels.map((channel) => {
											const delivery = record.deliveries[channel] ?? 'pending';
											return (
												<Badge
													variant="secondary"
													key={channel}
													className={DELIVERY_TONE[delivery]}
												>
													{`${t(`automation.${channel}`)}${t('automation.colon')}${t(`automation.delivery.${delivery}`)}`}
												</Badge>
											);
										})}
									</div>
								</div>
								<div className="flex flex-wrap items-start gap-2">
									{openable.has(record.id) && (
										<Button variant="outline" onClick={() => open(record)}>
											{t('automation.open')}
										</Button>
									)}
									{!record.read && (
										<Button variant="ghost" onClick={() => markRead(record.id)}>
											<Check className="size-4" />
											{t('automation.read')}
										</Button>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
