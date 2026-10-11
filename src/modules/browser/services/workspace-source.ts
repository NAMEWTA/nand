import { BrowserError } from '../core/model';
import type { BrowserPageTarget } from '../core/control';
import type { PageLease } from '../core/page-ownership';
import type { ProviderFactory, ProviderSession } from '../core/providers/contracts';
import { officialConversationUrl } from '../core/providers/official-url';
import type { WorkspaceData } from '../core/workspace/model';

interface SourcePorts {
	providers: ProviderFactory;
	open(url: string, profileId: string): Promise<BrowserPageTarget>;
	claim(target: BrowserPageTarget): PageLease;
}

/** Source navigation consumes immutable saved identity and never changes a task binding or send journal. */
export async function openWorkspaceSource(data: WorkspaceData, exchangeId: string, captureId: string, ports: SourcePorts): Promise<void> {
	const exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
	const capture = exchange?.captures.find(row => row.id === captureId), original = turn?.targets.find(row => row.id === exchange?.targetId);
	if (!exchange || !turn || !capture || !original) throw new BrowserError('browser_workspace_answer_missing');
	if (!exchange.receipt || capture.parentId !== exchange.receipt.messageId || capture.conversationId !== exchange.receipt.conversationId)
		throw new BrowserError('browser_workspace_capture_identity');
	const url = officialConversationUrl(original.provider, capture.conversationId);
	// A DOM-only provider without a proved permalink can reveal only its originally captured page generation.
	const page = url ? await ports.open(url, original.profileId) : original.provider === 'coze' || original.provider === 'minimax' ? original.page : undefined;
	if (!page) throw new BrowserError('browser_workspace_source_not_loaded');
	if (page.profileId !== original.profileId) throw new BrowserError('browser_workspace_identity_changed');
	const lease = ports.claim(page); let session: ProviderSession | undefined;
	try {
		lease.admit(); session = await ports.providers.connect({ ...structuredClone(original), page, conversationId: capture.conversationId }, turn.taskId, lease.signal); lease.admit();
		if (!session.reveal) throw new BrowserError('browser_workspace_provider_unsupported');
		await session.reveal({ conversationId: capture.conversationId, messageId: capture.messageId, parentId: capture.parentId }, lease.signal);
	} finally { try { session?.dispose(); } finally { lease.release(); } }
}
