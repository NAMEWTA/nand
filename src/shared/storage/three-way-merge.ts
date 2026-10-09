export class DocumentConflict extends Error {
	constructor(
		readonly path: string,
		readonly baseline: unknown,
		readonly local: unknown,
		readonly remote: unknown,
	) {
		super(`Concurrent edit at ${path || '/'}`);
		this.name = 'DocumentConflict';
	}
}
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function identity(v: unknown): string | undefined {
	if (typeof v === 'string' || typeof v === 'number') return `${typeof v}:${v}`;
	if (!object(v)) return undefined;
	const id = v.id ?? v.timestamp ?? v.date ?? v.name;
	return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}

/** A missing key is a deletion, never an invitation to union old data back in. */
export function threeWayMerge<T>(base: T, local: T, remote: T, path = ''): T {
	if (equal(local, base)) return structuredClone(remote);
	if (equal(remote, base) || equal(local, remote)) return structuredClone(local);
	if (base === undefined && object(local) && object(remote)) return threeWayMerge({} as T, local, remote, path);
	if (base === undefined && Array.isArray(local) && Array.isArray(remote))
		return threeWayMerge([] as T, local, remote, path);
	if (object(base) && object(local) && object(remote)) {
		const merged: Record<string, unknown> = {};
		for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
			const value = threeWayMerge(base[key], local[key], remote[key], `${path}/${key}`);
			if (value !== undefined) merged[key] = value;
		}
		return merged as T;
	}
	if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
		const maps = [base, local, remote].map(
			(rows) => new Map<string | undefined, unknown>((rows as unknown[]).map((row) => [identity(row), row])),
		);
		if (maps.every((map, i) => !map.has(undefined) && map.size === [base, local, remote][i]!.length)) {
			const [b, l, r] = maps;
			const merged: unknown[] = [];
			for (const id of new Set([...l!.keys(), ...r!.keys(), ...b!.keys()])) {
				const value = threeWayMerge(b!.get(id), l!.get(id), r!.get(id), `${path}/${id}`);
				if (value !== undefined) merged.push(value);
			}
			return merged as T;
		}
	}
	throw new DocumentConflict(path, base, local, remote);
}
