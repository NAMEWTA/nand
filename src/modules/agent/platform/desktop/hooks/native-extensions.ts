// Native lifecycle adapters, informed by Orca 27b823f (MIT, Lovecast Inc.).
// Hooks are inert outside NAND and never infer completion from output silence.
import { EVENT_PAYLOAD_SCRIPT } from './event-payload';

const transport = `import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir = process.env.NAND_HOOK_DIR, token = process.env.NAND_HOOK_TOKEN;
${EVENT_PAYLOAD_SCRIPT}
function post(event, data) {
 if (!dir || !token) return;
 try { const file = path.join(dir, process.hrtime.bigint().toString().padStart(24, '0') + '-' + crypto.randomUUID());
 fs.writeFileSync(file + '.pending', JSON.stringify({ token, event, at: Date.now(), data: eventData(data) }), { mode: 0o600 });
 fs.renameSync(file + '.pending', file + '.json'); } catch {}
}
function owner() {
 if (!dir || !token) return false;
 const pid = process.env.NAND_NATIVE_OWNER;
 if (pid && pid !== String(process.pid)) { try { process.kill(Number(pid), 0); return false; } catch (e) { if (e.code !== 'ESRCH') return false; } }
 process.env.NAND_NATIVE_OWNER = String(process.pid); return true;
}
`;
export const PI_EXTENSION =
	transport +
	`
export default function(pi) {
 if (!owner()) return;
 let pending = false, answer = '', failure = '';
 const data = ctx => ({ session_id: ctx.sessionManager?.getSessionId?.(), transcript_path: ctx.sessionManager?.getSessionFile?.(), cwd: ctx.cwd });
 pi.on('session_start', (_event, ctx) => { if (_event.reason !== 'reload') post('SessionStart', data(ctx)); });
 pi.on('agent_start', (_event, ctx) => { pending = true; answer = ''; failure = ''; post('UserPromptSubmit', data(ctx)); });
 pi.on('ui_prompt_start', (_event, ctx) => { if (pending) post('PermissionRequest', data(ctx)); });
 pi.on('ui_prompt_end', (_event, ctx) => { if (pending) post('PreToolUse', data(ctx)); });
 pi.on('agent_end', event => {
  const message = [...(event?.messages || [])].reverse().find(item => item.role === 'assistant');
  answer = (message?.content || []).filter(part => part.type === 'text').map(part => part.text).join('\\n');
  failure = message?.stopReason === 'error' || message?.stopReason === 'aborted' ? 'nativeAnswerFailed' : '';
 });
 pi.on('agent_settled', (event, ctx) => {
  if (!pending) return;
  pending = false;
  post(event.aborted ? 'StopCancelled' : failure ? 'StopFailure' : 'Stop', { ...data(ctx), last_assistant_message: answer, nand_answer_error: event.aborted ? '' : failure });
 });
 pi.on('session_shutdown', () => { pending = false; });
}
`;
export const OPENCODE_EXTENSION =
	transport +
	`
export const NandStatus = async ({ client }) => {
 if (!owner()) return {};
 let tail = Promise.resolve();
 return { event: ({event}) => {
  tail = tail.then(async () => {
   const id = event.properties?.sessionID;
   if (!id) return;
   let session;
   try { session = (await client.session.get({ path: { id } })).data; } catch { return; }
   if (!session || session.parentID) return;
   const data = { session_id: id, cwd: session.directory };
   const status = event.properties?.status?.type;
   if (event.type === 'session.status' && (status === 'busy' || status === 'retry')) post('UserPromptSubmit', data);
   if (event.type === 'permission.asked' || event.type === 'question.asked') post('PermissionRequest', data);
   if (event.type === 'session.status' && status === 'idle') {
    try {
     const messages = (await client.session.messages({ path: { id } })).data;
     const user = [...messages].reverse().find(row => row.info?.role === 'user');
     const answer = [...messages].reverse().find(row => row.info?.role === 'assistant' && row.info?.parentID === user?.info?.id);
     if (!answer || answer.info.error || !answer.info.time?.completed) post('StopFailure', { ...data, nand_answer_error: 'nativeAnswerMissing' });
     else post('Stop', { ...data, last_assistant_message: answer.parts.filter(part => part.type === 'text' && !part.ignored).map(part => part.text).join('\\n') });
    } catch { post('StopFailure', { ...data, nand_answer_error: 'nativeAnswerMissing' }); }
   }
   // session.error can be recoverable compaction; it is not completion.
  }).catch(() => {});
  return tail;
 }};
};
`;
