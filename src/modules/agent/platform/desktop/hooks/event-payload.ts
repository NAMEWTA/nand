/** The native answer contract is measured in UTF-8 bytes, never screen columns. */
export const MAX_ANSWER_BYTES = 2 * 1024 * 1024;
export const MAX_HOOK_INPUT_BYTES = 16 * 1024 * 1024;

/** Included in both command hooks and native extensions. Do not spool prompts or tool input. */
export const EVENT_PAYLOAD_SCRIPT = `
function eventData(input) {
 const data = {};
 for (const key of ['session_id', 'sessionId', 'transcript_path', 'cwd', 'turn_id', 'agent_id', 'subagent_id', 'parent_session_id']) {
  if (typeof input[key] === 'string' && input[key].length <= 8192) data[key] = input[key];
 }
 if (typeof input.nand_answer_error === 'string') data.nand_answer_error = input.nand_answer_error;
 const answer = typeof input.last_assistant_message === 'string' ? input.last_assistant_message : input.prompt_response;
 if (typeof answer === 'string') {
  if (Buffer.byteLength(answer, 'utf8') > ${MAX_ANSWER_BYTES}) data.nand_answer_error = 'answerTooLarge';
  else data.last_assistant_message = answer;
 }
 return data;
}
`;
