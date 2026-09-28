import { notificationBody, type NotificationRecord } from '../../core/notifications/service';
import { getLanguage, t } from '../../shared/i18n';

export function InboxPanel({
	records,
	unread,
	markRead,
	clearRead,
	open,
}: {
	records: readonly NotificationRecord[];
	unread: number;
	markRead: (id?: string) => void;
	clearRead: () => void;
	open: (record: NotificationRecord) => void;
}) {
	return (
		<>
			<div className="setting-item setting-item-heading">
				<div className="setting-item-info">
					<div className="setting-item-name">
						{t('automation.inbox')} ({unread})
					</div>
				</div>
				<div className="setting-item-control">
					<button onClick={() => markRead()}>{t('automation.readAll')}</button>
					<button onClick={clearRead}>{t('automation.clearRead')}</button>
				</div>
			</div>
			{!records.length && <p>{t('automation.inboxEmpty')}</p>}
			{[...records].reverse().map((record) => {
				const body = notificationBody(record);
				return (
				<div className="setting-item" key={record.id}>
					<div className="setting-item-info">
						<div className="setting-item-name">
							{record.read ? '' : '● '}
							{record.title}
						</div>
						<div className="setting-item-description nand-notification-description">{`${body === record.title ? '' : body + '\n'}${new Date(record.createdAt).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}\n${record.channels.map((channel) => `${t(`automation.${channel}`)}${t('automation.colon')}${t(`automation.delivery.${record.deliveries[channel] ?? 'pending'}`)}`).join(' · ')}`}</div>
					</div>
					<div className="setting-item-control">
						{(record.source || record.target) && (
							<button onClick={() => open(record)}>{t('automation.open')}</button>
						)}
						{!record.read && <button onClick={() => markRead(record.id)}>{t('automation.read')}</button>}
					</div>
				</div>
				);
			})}
		</>
	);
}
