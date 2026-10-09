import { notificationBody } from '../core/service';
import type { NotificationRecord } from '../api';
import { getLanguage, t } from '../../../shared/i18n';
import { EmptyState } from '../../../ui/primitives/EmptyState';
import { Icon } from '../../../ui/primitives/Icon';

/** Presentation only: delivery states map to semantic badge tones. */
const DELIVERY_TONE: Record<string, string> = { sent: 'success', failed: 'error', unknown: 'warning' };

/** The inbox list; the workbench page header already names the page, so there is no heading here. */
export function InboxPanel({
	records: all,
	filter,
	markRead,
	clearRead,
	open,
}: {
	records: readonly NotificationRecord[];
	filter: 'all' | 'unread';
	markRead: (id?: string) => void;
	clearRead: () => void;
	open: (record: NotificationRecord) => void;
}) {
	const records = filter === 'unread' ? all.filter((record) => !record.read) : all;
	return (
		<div className="nand-inbox">
			<div className="nand-inbox-header">
				<div className="nand-inbox-actions nand-ui-toolbar">
					<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => markRead()}>
						<Icon name="check-check" />
						{t('automation.readAll')}
					</button>
					<button className="nand-ui-btn nand-ui-btn-ghost" onClick={clearRead}>
						<Icon name="trash-2" />
						{t('automation.clearRead')}
					</button>
				</div>
			</div>
			{!records.length && (
				<EmptyState icon="bell-off" title={t(filter === 'unread' && all.length ? 'workbench.noUnread' : 'automation.inboxEmpty')} description="" layout="content" />
			)}
			{records.length > 0 && (
				<ul className="nand-inbox-list">
					{[...records].reverse().map((record) => {
						const body = notificationBody(record);
						return (
							<li className={`nand-inbox-item${record.read ? ' is-read' : ' is-unread'}`} key={record.id}>
								{/* The unread marker is a named image so assistive tech keeps the old "●" cue. */}
								{record.read ? (
									<span className="nand-inbox-dot" aria-hidden="true" />
								) : (
									<span className="nand-inbox-dot" role="img" aria-label={t('automation.unread')} />
								)}
								<div className="nand-inbox-item-main">
									<div className="nand-inbox-item-title">{record.title}</div>
									{body !== record.title && <div className="nand-inbox-item-body nand-notification-description">{body}</div>}
									<div className="nand-inbox-item-meta">
										<span className="nand-inbox-item-time">
											<Icon className="nand-inbox-meta-icon" name="clock" />
											{new Date(record.createdAt).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}
										</span>
										{record.channels.map((channel) => {
											const delivery = record.deliveries[channel] ?? 'pending';
											return (
												<span
													key={channel}
													className={`nand-ui-badge${DELIVERY_TONE[delivery] ? ` nand-ui-badge--${DELIVERY_TONE[delivery]}` : ''}`}
												>
													{`${t(`automation.${channel}`)}${t('automation.colon')}${t(`automation.delivery.${delivery}`)}`}
												</span>
											);
										})}
									</div>
								</div>
								<div className="nand-inbox-item-actions">
									{(record.source || record.target) && (
										<button className="nand-ui-btn" onClick={() => open(record)}>
											{t('automation.open')}
										</button>
									)}
									{!record.read && (
										<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => markRead(record.id)}>
											<Icon name="check" />
											{t('automation.read')}
										</button>
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
