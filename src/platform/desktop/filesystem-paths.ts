type NativePath = Pick<typeof import('path'), 'isAbsolute' | 'normalize' | 'resolve' | 'join'>;

/** Native filesystem paths must never pass through a vault-relative normalizer. */
export function absoluteVaultPath(base: string, paths: NativePath): string {
	if (!base || !paths.isAbsolute(base)) throw new Error('An absolute vault filesystem path is required');
	return paths.normalize(base);
}

export function resolvePluginDirectory(
	base: string,
	configDir: string,
	manifestDir: string | undefined,
	id: string,
	paths: NativePath,
): string {
	const root = absoluteVaultPath(base, paths);
	const directory = manifestDir || paths.join(configDir, 'plugins', id);
	return paths.resolve(root, directory);
}
