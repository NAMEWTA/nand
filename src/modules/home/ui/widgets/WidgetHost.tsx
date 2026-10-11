import { h } from 'preact';
import type { HomeWidgetContext, HomeWidgetKind } from '../../api';
import type { BoardWidgetMember } from '../../core/board/types/model';
import { WidgetLifetime } from '../../core/board/widget-lifetime';
import { t } from '../../../../shared/i18n';
import { bindRenderContext, DashboardRenderContext, destroyAllCharts, destroyDashboardPanels, getRenderContext, mountDashboardPanel } from '../renderer/render-context';

function WidgetStatus({ member, message, openSettings }: { member: BoardWidgetMember; message: string; openSettings: () => void }) {
	return <div class="dashboard-sidebar-widget nand-widget-status"><strong>{member.label ?? member.kind}</strong><p role="status">{message}</p><button type="button" onClick={openSettings}>{t('home.widget.openSettings')}</button></div>;
}

/** Every provider uses this host. Errors and teardown stay within this single member. */
export function mountWidgetHost(root: HTMLElement, member: BoardWidgetMember, descriptor: HomeWidgetKind | undefined, boardPath: string, openSettings: () => void, prepare?: (context: HomeWidgetContext) => void): void {
	const parent = getRenderContext(root);
	const own = new DashboardRenderContext(root);
	own.hoverParent = parent.hoverParent;
	own.noteOpener = parent.noteOpener;
	own.markdownComponent = parent.markdownComponent;
	bindRenderContext(root, own);
	let closed = false;
	const status = (message: string) => {
		destroyDashboardPanels(root);
		destroyAllCharts(root);
		root.empty();
		mountDashboardPanel(root, h(WidgetStatus, { member, message, openSettings }));
	};
	const lifetime = new WidgetLifetime(error => console.error('Home widget cleanup failed', member.provider, member.kind, error));
	const reportError = (error: unknown) => queueMicrotask(() => {
		if (closed) return;
		lifetime.dispose();
		const detail = error instanceof Error ? error.message : String(error);
		status(t('home.widget.failed', { detail: detail.startsWith('home.widget.') ? t(detail) : detail }));
	});
	own.onError = reportError;
	parent.resources.set(root, () => {
		if (closed) return;
		closed = true;
		lifetime.dispose();
		destroyDashboardPanels(root);
		destroyAllCharts(root);
	});
	const context: HomeWidgetContext = { boardPath, memberId: member.memberId, instanceId: member.instanceId, document: root.ownerDocument, window: root.ownerDocument.defaultView!, signal: lifetime.signal, register: lifetime.register, reportError, openSettings };
	prepare?.(context);
	if (!descriptor) { status(t('home.widget.unavailable')); return; }
	void (async () => {
		try {
			if (!descriptor.instances().some(instance => instance.id === member.instanceId)) { status(t('home.widget.instanceMissing')); return; }
			const dispose = await descriptor.render(root, context);
			if (dispose) lifetime.register(dispose);
		} catch (error) {
			reportError(error);
		}
	})();
}
