// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/ticktick-login-modal.ts, src/ticktick-task-edit-modal.ts
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'obsidian';
import { P2Dialog } from '../dialogs/P2Dialog';
import { p2Classes as c } from '../theme/p2-classes';
import { Choice } from '../board/controls';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import type { HomeHost } from '../../services/home-host';
import type { DashboardSettings } from '../../core/board/types';
import { TickTickClient, parseTickDate, type TickTickTask } from '../../platform/ticktick/ticktick-service';
import { fromTzInputs, tzParts } from '../../core/ticktick/ticktick-tz';
export function TickTickLoginDialog({
	host,
	settings,
	onClose,
}: {
	host: HomeHost;
	settings: DashboardSettings;
	onClose: () => void;
}) {
	const t = useT(),
		doc = useOwnerDocument(),
		visible = useVisible(),
		[token, setToken] = useState(''),
		[csrf, setCsrf] = useState(''),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(''),
		abort = useRef<AbortController | null>(null);
	useEffect(() => {
		const original = credentials(host.settings);
		const stop = host.subscribeSettings(() => {
			if (credentials(host.settings) !== original) abort.current?.abort();
		});
		if (!visible) abort.current?.abort();
		return () => {
			abort.current?.abort();
			stop();
		};
	}, [
		host,
		visible,
		settings.ticktickRegion,
		settings.ticktickCookie,
		settings.ticktickCsrf,
		settings.ticktickDeviceVersion,
	]);
	const close = () => {
		abort.current?.abort();
		onClose();
	};
	const save = async (popup: boolean) => {
		abort.current?.abort();
		const controller = new AbortController(),
			original = credentials(host.settings);
		abort.current = controller;
		setBusy(true);
		setError('');
		try {
			let cookie = token,
				csrfValue = csrf;
			if (popup) {
				const { loginTickTick } = await import('../../platform/desktop/ticktick-login');
				if (controller.signal.aborted) return;
				const tokens = await loginTickTick(
					host.app,
					doc.defaultView!,
					settings.ticktickRegion,
					controller.signal,
				);
				cookie = tokens.cookie;
				csrfValue = tokens.csrf;
			}
			await new TickTickClient(
				settings.ticktickRegion,
				cookie,
				settings.ticktickDeviceVersion,
				csrfValue,
			).fetchSnapshot({ signal: controller.signal, ownerWindow: doc.defaultView! });
			if (controller.signal.aborted || credentials(host.settings) !== original) return;
			await host.updateSettings((s) => {
				if (controller.signal.aborted || credentials(s) !== original) throw Error('CANCELLED');
				s.ticktickCookie = cookie.trim();
				s.ticktickCsrf = csrfValue.trim();
			});
			if (abort.current === controller) onClose();
		} catch (e) {
			if (!controller.signal.aborted)
				setError(
					t(
						e instanceof Error && e.message === 'CANCELLED'
							? 'ticktick.popupClosed'
							: 'ticktick.loginFailed',
					),
				);
		} finally {
			if (abort.current === controller) setBusy(false);
		}
	};
	return (
		<P2Dialog title={t('ticktick.loginTitle')} onClose={close} footer={false}>
			<div className={c('dashboard-library-config-hint')}>{t('ticktick.loginHint')}</div>
			{!Platform.isMobile && (
				<>
					<Button
						size="xs"
						disabled={busy}
						className={c('dashboard-modal-btn dashboard-modal-btn--confirm w-full mb-1.5')}
						onClick={() => {
							void save(true);
						}}
					>
						{t('ticktick.loginViaPopup')}
					</Button>
					<div className={c('dashboard-ticktick-login-status')}>
						{busy && <div className={c('dashboard-ticktick-login-info')}>{t('ticktick.popupHint')}</div>}
					</div>
				</>
			)}
			<div className={c('dashboard-ticktick-manual')}>
				<div className={c('dashboard-library-config-section-title')}>{t('ticktick.manualTitle')}</div>
				<div className={c('dashboard-library-config-hint')}>{t('ticktick.manualHint')}</div>
				<Button
					size="xs"
					variant="outline"
					className={c('dashboard-modal-btn dashboard-modal-btn--cancel')}
					onClick={() => {
						void host.openBrowser({
							url:
								settings.ticktickRegion === 'ticktick'
									? 'https://ticktick.com/signin'
									: 'https://dida365.com/signin',
						});
					}}
				>
					{t('ticktick.openWeb')}
				</Button>
				<div className={c('dashboard-library-config-inline-row')}>
					<div className={c('dashboard-library-config-inline-label')}>t</div>
					<Input
						className={c('dashboard-task-input dashboard-section-name-input')}
						type="password"
						aria-label={t('settings.ticktickCookie')}
						placeholder={t('ticktick.pastePlaceholder')}
						value={token}
						onChange={(e) => setToken(e.target.value)}
					/>
					<Button
						size="xs"
						disabled={busy || !token.trim()}
						className={c('dashboard-modal-btn dashboard-modal-btn--confirm')}
						onClick={() => {
							void save(false);
						}}
					>
						{t('common.save')}
					</Button>
				</div>
				<div className={c('dashboard-library-config-inline-row')}>
					<div className={c('dashboard-library-config-inline-label')}>{t('ticktick.csrfLabel')}</div>
					<Input
						className={c('dashboard-task-input dashboard-section-name-input')}
						type="password"
						aria-label={t('ticktick.csrfLabel')}
						placeholder="_csrf_token"
						value={csrf}
						onChange={(e) => setCsrf(e.target.value)}
					/>
				</div>
			</div>
			{error && (
				<p role="alert" className={c('dashboard-ticktick-login-error')}>
					{error}
				</p>
			)}
		</P2Dialog>
	);
}
function credentials(settings: DashboardSettings): string {
	return JSON.stringify([
		settings.ticktickRegion,
		settings.ticktickCookie,
		settings.ticktickCsrf,
		settings.ticktickDeviceVersion,
	]);
}
export function TickTickEditDialog({
	task,
	tz,
	onSave,
	onClose,
}: {
	task: TickTickTask;
	tz: string;
	onSave: (fields: Partial<TickTickTask>) => Promise<void>;
	onClose: () => void;
}) {
	const t = useT(),
		due = parseTickDate(task.dueDate),
		p = due ? tzParts(due, tz) : null,
		pad = (n: number) => String(n).padStart(2, '0'),
		[date, setDate] = useState(p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : ''),
		[time, setTime] = useState(p ? `${pad(p.hour)}:${pad(p.minute)}` : '09:00'),
		[priority, setPriority] = useState(String(task.priority));
	return (
		<P2Dialog
			title={task.title}
			onClose={onClose}
			onSave={() => onSave({ dueDate: date ? fromTzInputs(date, time, tz) : '', priority: Number(priority) })}
		>
			<div className={c('dashboard-library-config-inline-row')}>
				<div className={c('dashboard-library-config-inline-label')}>{t('ticktick.dueDate')}</div>
				<Input
					className={c('dashboard-task-input dashboard-section-name-input')}
					aria-label={t('ticktick.dueDate')}
					type="date"
					value={date}
					onChange={(e) => setDate(e.target.value)}
				/>
				<label className="flex h-8 w-16 shrink-0 items-center">
					<Input
						className={c('dashboard-library-config-number')}
						aria-label={t('ticktick.dueTime')}
						type="time"
						style={{ minHeight: 30, height: 30 }}
						value={time}
						onChange={(e) => setTime(e.target.value)}
					/>
				</label>
			</div>
			<div className={c('dashboard-library-config-inline-row')}>
				<div className={c('dashboard-library-config-inline-label')}>{t('ticktick.priority')}</div>
				<Choice
					compact
					className={`${c('dashboard-library-filter-property')} w-8 min-w-0 gap-0 px-0 [&>svg]:hidden`}
					label={t('ticktick.priority')}
					value={priority}
					options={[0, 1, 3, 5].map((value) => ({
						value: String(value),
						label: t(
							`ticktick.prio${value === 0 ? 'None' : value === 1 ? 'Low' : value === 3 ? 'Medium' : 'High'}`,
						),
					}))}
					onChange={setPriority}
				/>
			</div>
			<div className={c('dashboard-library-config-inline-row')}>
				<Button
					size="xs"
					variant="outline"
					className={c('dashboard-modal-btn dashboard-modal-btn--cancel')}
					onClick={() => setDate('')}
				>
					{t('ticktick.clearDue')}
				</Button>
			</div>
		</P2Dialog>
	);
}
