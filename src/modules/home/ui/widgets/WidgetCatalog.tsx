import type { App } from 'obsidian';
import { useLayoutEffect, useReducer, useState } from 'preact/hooks';
import type { BoardWidgetMember } from '../../core/board/types/model';
import type { IndexedWidgets } from '../../core/board/widget-registry';
import { widgetProviderKey } from '../../core/board/widget-registry';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { openDialog } from '../../../../ui/primitives/dialog';
import { ownDialog } from '../ui/dialog-scope';
import type { HomeWidgetContext, HomeWidgetKind } from '../../api';
import { WidgetLifetime } from '../../core/board/widget-lifetime';
import { widgetMemberLabel } from './widget-label';

interface CatalogContext {
	owner: unknown;
	boardPath: string;
	element: HTMLElement;
	currentIndex(this: void): IndexedWidgets | undefined;
	watchIndex(this: void, listener: () => void): () => void;
	openSettings(this: void): void;
}

export function editBoardWidgets(app: App, initial: readonly BoardWidgetMember[], index: IndexedWidgets, options: CatalogContext): Promise<BoardWidgetMember[] | null> {
	return new Promise(resolve => {
		let result: BoardWidgetMember[] | null = null;
		let release = () => {};
		const lifetime = new WidgetLifetime(error => console.error('Home widget catalog cleanup failed', error));
		let activeOperation: { provider: string; kind: HomeWidgetKind } | null = null;
		function Body({ close }: { close: () => void }) {
			const [, refresh] = useReducer((revision: number) => revision + 1, 0);
			useLayoutEffect(() => options.watchIndex(() => refresh(undefined)), []);
			const currentIndex = options.currentIndex() ?? index;
			const [members, setMembers] = useState(() => initial.map(member => ({ ...member })));
			const [busy, setBusy] = useState(false);
			const [failure, setFailure] = useState('');
			const errors: string[] = [];
			const choices = [...currentIndex.byKey.values()].flatMap(({ module, kind }) => {
				try { return kind.instances().filter(instance => !members.some(member => member.provider === module && member.kind === kind.key && (!kind.multiple || member.instanceId === instance.id))).map(instance => ({ module, kind, instance })); }
				catch (error) { errors.push(t('home.widget.failed', { detail: `${t(kind.titleKey)}: ${error instanceof Error ? error.message : String(error)}` })); return []; }
			});
			const move = (from: number, delta: number) => {
				const next = [...members];
				const [member] = next.splice(from, 1);
				if (member) next.splice(from + delta, 0, member);
				setMembers(next);
			};
			const operate = async (provider: string, kind: HomeWidgetKind, member?: BoardWidgetMember) => {
				if (busy || activeOperation) return;
				activeOperation = { provider, kind };
				setBusy(true); setFailure('');
				const memberId = member?.memberId ?? `widget-${crypto.randomUUID()}`;
				const context: HomeWidgetContext = { memberId, instanceId: member?.instanceId ?? '', boardPath: options.boardPath,
					document: options.element.ownerDocument, window: options.element.ownerDocument.defaultView!, signal: lifetime.signal,
					register: lifetime.register, reportError: error => { if (!lifetime.signal.aborted) setFailure(String(error)); }, openSettings: options.openSettings };
				try {
					if (options.currentIndex()?.byKey.get(widgetProviderKey(provider, kind.key))?.kind !== kind) throw new Error(t('home.widget.unavailable'));
					if (member) await kind.configure?.(context);
					else {
						const instance = await kind.create?.(context);
						if (instance && !lifetime.signal.aborted) {
							if (options.currentIndex()?.byKey.get(widgetProviderKey(provider, kind.key))?.kind !== kind) throw new Error(t('home.widget.unavailable'));
							result = [...members, { memberId, provider, kind: kind.key, instanceId: instance.id }];
							close();
						}
					}
				} catch (error) { if (!lifetime.signal.aborted) setFailure(error instanceof Error ? error.message : String(error)); }
				finally { activeOperation = null; if (!lifetime.signal.aborted) setBusy(false); }
			};
			return <div class="nand-ui-stack nand-widget-catalog">
				{failure && <p role="alert">{failure}</p>}
				{errors.map(message => <p role="status" key={message}>{message}</p>)}
				<ol>{members.map((member, i) => <li key={member.memberId} data-member-id={member.memberId}>
					<span>{widgetMemberLabel(member, currentIndex.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind)}</span>
					<Button disabled={busy || i === 0} onClick={() => move(i, -1)}>{t('home.widget.moveUp')}</Button>
					<Button disabled={busy || i === members.length - 1} onClick={() => move(i, 1)}>{t('home.widget.moveDown')}</Button>
					{currentIndex.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind.configure && <Button disabled={busy} onClick={() => { void operate(member.provider, currentIndex.byKey.get(widgetProviderKey(member.provider, member.kind))!.kind, member); }}>{t('home.widget.configure')}</Button>}
					<Button disabled={busy} onClick={() => setMembers(members.filter(item => item.memberId !== member.memberId))}>{t('home.widget.remove')}</Button>
				</li>)}</ol>
				<div class="nand-ui-stack">{[...currentIndex.byKey.values()].map(({ module, kind }) => <section key={widgetProviderKey(module, kind.key)} data-widget-kind={`${module}/${kind.key}`}>
					<h3>{t(kind.titleKey)}</h3>
						{choices.filter(choice => choice.module === module && choice.kind === kind).map(({ instance }) => <Button disabled={busy} key={instance.id} onClick={() => setMembers([...members, { memberId: `widget-${crypto.randomUUID()}`, provider: module, kind: kind.key, instanceId: instance.id }])}>{t('home.widget.addNamed', { name: instance.label ?? t(kind.titleKey) })}</Button>)}
					{kind.create && <Button disabled={busy || (!kind.multiple && members.some(member => member.provider === module && member.kind === kind.key))} onClick={() => { void operate(module, kind); }}>{t('home.widget.createNamed', { name: t(kind.titleKey) })}</Button>}
				</section>)}</div>
				<div class="nand-dialog-footer"><Button onClick={close}>{t('common.cancel')}</Button><Button disabled={busy} variant="primary" onClick={() => { result = members; close(); }}>{t('common.save')}</Button></div>
			</div>;
		}
		const close = openDialog(app, { title: t('home.widget.manage'), content: close => <Body close={close} />, onClose: () => { release(); lifetime.dispose(); resolve(result); } });
		release = ownDialog(app, close, options.owner);
		lifetime.register(options.watchIndex(() => {
			if (activeOperation && options.currentIndex()?.byKey.get(widgetProviderKey(activeOperation.provider, activeOperation.kind.key))?.kind !== activeOperation.kind) close();
		}));
	});
}
