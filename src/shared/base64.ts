/** Decode protocol bytes without depending on the Node Buffer implementation. */
export function decodeBase64(data: string): Uint8Array {
	return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
}
