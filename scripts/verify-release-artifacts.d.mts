export const terminalAssets: string[];
export const pluginAssets: string[];
export function verifyVersions(root: string, tag: string): { id: string; version: string; minAppVersion: string };
export function verifyTerminalAssets(artifacts: string): void;
export function verifyPluginAssets(root: string, tag: string, dir: string): void;
export function writeChecksums(dir: string): string[];
export function verifyReleaseArtifacts(root: string, tag: string, artifacts?: string): void;
