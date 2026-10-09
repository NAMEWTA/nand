/**
 * Frames exchanged with the native terminal helper over its standard streams: a 4-byte big-endian length
 * of the rest, a 1-byte kind, then the body. Control bodies are JSON; session bodies start with a 4-byte
 * big-endian session number.
 */

export const FRAME_CONTROL = 1;
export const FRAME_INPUT = 2;
export const FRAME_OUTPUT = 3;
export const MAX_FRAME = 16 * 1024 * 1024;
export const HELPER_PROTOCOL = 3;

export type HelperFrame =
	| { kind: typeof FRAME_CONTROL; message: Record<string, unknown> }
	| { kind: typeof FRAME_OUTPUT | typeof FRAME_INPUT; session: number; bytes: Uint8Array };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function header(length: number, kind: number): Uint8Array {
	const out = new Uint8Array(5 + length);
	new DataView(out.buffer).setUint32(0, length + 1);
	out[4] = kind;
	return out;
}

export function encodeControl(message: Record<string, unknown>): Uint8Array {
	const body = encoder.encode(JSON.stringify(message));
	const out = header(body.length, FRAME_CONTROL);
	out.set(body, 5);
	return out;
}

export function encodeInput(session: number, bytes: Uint8Array | string): Uint8Array {
	const data = typeof bytes === 'string' ? encoder.encode(bytes) : bytes;
	const out = header(data.length + 4, FRAME_INPUT);
	new DataView(out.buffer).setUint32(5, session);
	out.set(data, 9);
	return out;
}

/** Incremental decoder: push stdout chunks of any size, get whole frames back in order. */
export class FrameDecoder {
	private buffer = new Uint8Array(0);

	push(chunk: Uint8Array): HelperFrame[] {
		const joined = new Uint8Array(this.buffer.length + chunk.length);
		joined.set(this.buffer);
		joined.set(chunk, this.buffer.length);
		const frames: HelperFrame[] = [];
		let at = 0;
		while (joined.length - at >= 4) {
			const length = new DataView(joined.buffer, joined.byteOffset + at, 4).getUint32(0);
			if (length === 0 || length > MAX_FRAME) throw new Error(`Terminal helper frame length ${length} is out of range`);
			if (joined.length - at - 4 < length) break;
			const kind = joined[at + 4]!;
			const body = joined.subarray(at + 5, at + 4 + length);
			at += 4 + length;
			if (kind === FRAME_CONTROL) {
				const message: unknown = JSON.parse(decoder.decode(body));
				if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Terminal helper sent a non-object message');
				frames.push({ kind, message: message as Record<string, unknown> });
			} else if (kind === FRAME_OUTPUT || kind === FRAME_INPUT) {
				if (body.length < 4) throw new Error('Terminal helper sent a short session frame');
				const session = new DataView(body.buffer, body.byteOffset, 4).getUint32(0);
				frames.push({ kind, session, bytes: body.slice(4) });
			} else {
				throw new Error(`Terminal helper sent unknown frame kind ${kind}`);
			}
		}
		this.buffer = joined.slice(at);
		return frames;
	}
}
