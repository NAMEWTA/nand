import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { checkAccountTranscript } from '../agents/transcript';
import { systemAccountAgent } from '../agents/system-homes';
import { restoredAccountReference } from '../agents/accounts';
import { getAgent } from '../../../core/launch/catalog';
import type { AgentId } from '../../../core/launch/types';
import type { NativeSessionSummary } from '../server/agent-data-client';
import { transcriptDetails } from '../../../core/history/details';

/** The helper's text is Markdown. Read the account-owned source for structured metadata. */
export async function readHistoryDetails(
	row: NativeSessionSummary,
	vault: string,
	device: string,
	fallback: string,
	signal: AbortSignal,
) {
	signal.throwIfAborted();
	const raw: unknown = JSON.parse(row.accountKey);
	if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.values(raw).some((v) => typeof v !== 'string'))
		throw new Error('Invalid history account');
	const { env, transcriptPath } = await restoredAccountReference(
		getAgent(row.agentId as AgentId),
		raw as Record<string, string>,
		vault,
		device,
		row.transcriptPath,
	);
	await checkAccountTranscript(vault, env, transcriptPath);
	if (row.agentId === 'opencode') return transcriptDetails(fallback);
	const file =
		row.agentId === 'grok' ? path.join(path.dirname(transcriptPath!), 'chat_history.jsonl') : transcriptPath!;
	// A system account's transcript was checked against the provider's own history directory above.
	const safe = systemAccountAgent(env) ? file : await absoluteNandPath(vault, path.relative(vault, file).split(path.sep).join('/'));
	if (systemAccountAgent(env) && (await fs.lstat(file)).isSymbolicLink()) throw new Error('private-storage.symlink');
	return transcriptDetails(await fs.readFile(safe, { encoding: 'utf8', signal }));
}
