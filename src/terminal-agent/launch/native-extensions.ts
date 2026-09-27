// Native lifecycle adapters, informed by Orca 27b823f (MIT, Lovecast Inc.).
// Hooks are inert outside NAND and never infer completion from output silence.
const transport = `import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir = process.env.NAND_HOOK_DIR, token = process.env.NAND_HOOK_TOKEN;
function post(event, data) {
 if (!dir || !token) return;
 try { const file = path.join(dir, process.hrtime.bigint().toString().padStart(24, '0') + '-' + crypto.randomUUID());
 fs.writeFileSync(file + '.pending', JSON.stringify({ token, event, at: Date.now(), data }), { mode: 0o600 });
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
 let generation = 0, ended = -1, posted = -1, timer, settled = false;
 const data = ctx => ({ session_id: ctx.sessionManager?.getSessionId?.(), transcript_path: ctx.sessionManager?.getSessionFile?.(), cwd: ctx.cwd });
 const complete = ctx => { if (posted === ended || ended !== generation) return; posted = ended; post('Stop', data(ctx)); };
 pi.on('session_start', (_event, ctx) => { if (_event.reason !== 'reload') post('SessionStart', data(ctx)); });
 pi.on('agent_start', (_event, ctx) => { generation++; settled = false; clearTimeout(timer); post('UserPromptSubmit', data(ctx)); });
 pi.on('agent_settled', (_event, ctx) => { settled = true; clearTimeout(timer); complete(ctx); });
 pi.on('agent_end', (event, ctx) => {
  if (event?.willContinue) return;
  ended = generation;
  if (settled) return;
  const run = generation;
  const check = () => {
   if (run !== generation) return;
   if (typeof ctx.isIdle === 'function' && ctx.isIdle()) complete(ctx);
   else { timer = setTimeout(check, 100); timer.unref?.(); }
  };
  timer = setTimeout(check, 0); timer.unref?.();
 });
 pi.on('session_shutdown', () => { clearTimeout(timer); });
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
   if (event.type === 'session.status' && status === 'idle') post('Stop', data);
   // session.error can be recoverable compaction; it is not completion.
  }).catch(() => {});
  return tail;
 }};
};
`;
