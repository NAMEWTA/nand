import type { AgentId, AgentSessionsPort } from '../api';
import { formatContextMaterials } from '../core/launch/context-material';
import type { ContextMaterial } from '../core/launch/session-api';
import type { AgentController } from './controller';
import { t } from '../../../shared/i18n';

type MaterialHost = Pick<AgentController, 'app' | 'sessions' | 'show' | 'open'>;
type MaterialFailure = 'missing' | 'busy' | 'timeout' | 'cancelled' | 'targetChanged';

export class MaterialDeliveryError extends Error {
	constructor(readonly code: MaterialFailure) { super(t(`agent.delivery.${code}`)); }
}

/** One delivery owner per agent activation. Closing it immediately cancels all readiness waits. */
export class SessionMaterialService implements AgentSessionsPort {
	private closed = false;
	private pending = new Set<string>();
	private waits = new Set<AbortController>();
	constructor(private readonly host: MaterialHost) {}

	list() {
		return Promise.resolve(this.closed ? [] : this.host.sessions.list()
			.filter(session => session.agentId && session.running && !session.automated)
			.map(session => ({ id: session.id, title: session.title, agentId: session.agentId })));
	}

	attachMaterial(id: string, material: { title: string; text: string; files: string[] }, options?: { agentId?: AgentId; signal?: AbortSignal }): Promise<void> {
		return this.attach(id, [{ id: crypto.randomUUID(), kind: 'web', ...material }], options);
	}

	async attach(id: string, materials: readonly ContextMaterial[], options: { agentId?: AgentId; signal?: AbortSignal } = {}): Promise<void> {
		if (this.closed || options.signal?.aborted) throw new MaterialDeliveryError('cancelled');
		const session = this.host.sessions.get(id);
		if (!session?.agentId || !session.running || session.automated) throw new MaterialDeliveryError('missing');
		const agentId = options.agentId ?? session.agentId;
		if (session.agentId !== agentId) throw new MaterialDeliveryError('targetChanged');
		if (this.pending.has(id) || session.activity === 'running') throw new MaterialDeliveryError('busy');
		const text = formatContextMaterials(materials);
		const abort = new AbortController();
		this.pending.add(id); this.waits.add(abort);
		const cancel = () => abort.abort(options.signal?.reason);
		options.signal?.addEventListener('abort', cancel, { once: true });
		try {
			await new Promise<void>((resolve, reject) => {
				const win = this.host.app.workspace.containerEl.win;
				const deadline = Date.now() + 10_000;
				let finished = false;
				let opened = false;
				const stop = () => finish(new MaterialDeliveryError(abort.signal.reason === 'timeout' ? 'timeout' : 'cancelled'));
				const timer = win.setInterval(check, 50);
				function finish(error?: unknown) {
					if (finished) return;
					finished = true; win.clearInterval(timer); abort.signal.removeEventListener('abort', stop);
					if (error !== undefined) reject(error instanceof Error ? error : new Error(typeof error === 'string' ? error : t('agent.delivery.failed'))); else resolve();
				}
				const current = () => this.host.sessions.get(id);
				function check() {
					if (finished) return;
					if (abort.signal.aborted) return stop();
					if (current() !== session || session!.agentId !== agentId) return finish(new MaterialDeliveryError('targetChanged'));
					if (!session!.running || session!.automated) return finish(new MaterialDeliveryError('missing'));
					if (session!.activity === 'running') return finish(new MaterialDeliveryError('busy'));
					if (Date.now() >= deadline) return finish(new MaterialDeliveryError('timeout'));
					if (!opened || !session!.inputReady()) return;
					try { session!.paste(text); finish(); } catch (error) { finish(error); }
				}
				abort.signal.addEventListener('abort', stop, { once: true });
				check();
				if (finished) return;
				try {
					this.host.show(id);
					void this.host.open({ feature: 'terminal', section: 'running', resourceId: id })
						.then(() => { opened = true; check(); }, finish);
				} catch (error) { finish(error); }
			});
		} finally {
			options.signal?.removeEventListener('abort', cancel);
			this.pending.delete(id); this.waits.delete(abort);
		}
	}

	dispose(): void {
		this.closed = true;
		for (const wait of this.waits) wait.abort();
		this.waits.clear();
	}
}

/** Native note picker and public consumers share the same reservation and cancellation owner. */
export function attachMaterials(controller: AgentController, id: string, materials: readonly ContextMaterial[], signal?: AbortSignal): Promise<void> {
	return controller.materials.attach(id, materials, { signal });
}

export function sessionMaterialPort(controller: AgentController): AgentSessionsPort { return controller.materials; }
