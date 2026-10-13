import { execFile } from 'node:child_process';
import { chmod, lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { absoluteNandPath } from './nand-paths';

const windowsPolicy = String.raw`
$ErrorActionPreference='Stop'
$vault=[IO.Path]::GetFullPath($env:NAND_PRIVATE_VAULT).TrimEnd('\')
function Check-NandPath([string]$file) {
 if(-not $file.StartsWith($vault+'\.nand\',[StringComparison]::OrdinalIgnoreCase)) { throw 'private-storage.path' }
 $cursor=$file
 while($cursor -ne $vault) {
  $entry=Get-Item -LiteralPath $cursor -Force
  if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'private-storage.symlink' }
  $cursor=[IO.Path]::GetDirectoryName($cursor)
 }
}
$target=Get-Item -LiteralPath $env:NAND_PRIVATE_TARGET -Force
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$system=New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
$pending=New-Object 'System.Collections.Generic.Stack[System.IO.FileSystemInfo]'
$pending.Push($target)
$count=0
while($pending.Count -gt 0) {
 $item=$pending.Pop()
 Check-NandPath $item.FullName
 if((++$count) -gt 20000) { throw 'private-storage.repair-limit' }
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'private-storage.symlink' }
 $directory=$item -is [IO.DirectoryInfo]
 if($directory) { $acl=New-Object Security.AccessControl.DirectorySecurity; $inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit' }
 else { $acl=New-Object Security.AccessControl.FileSecurity; $inherit=[Security.AccessControl.InheritanceFlags]::None }
 $acl.SetAccessRuleProtection($true,$false)
 foreach($identity in @($sid,$system)) {
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl',$inherit,'None','Allow')
  $acl.AddAccessRule($rule)
 }
 $item.SetAccessControl($acl)
 $actual=$item.GetAccessControl()
 if(-not $actual.AreAccessRulesProtected) { throw 'private-storage.permissions' }
 foreach($rule in $actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
  if($rule.IdentityReference.Value -ne $sid.Value -and $rule.IdentityReference.Value -ne $system.Value) { throw 'private-storage.permissions' }
 }
 if($directory) { foreach($child in Get-ChildItem -LiteralPath $item.FullName -Force) { $pending.Push($child) } }
}
`;
const repairs = new Map<string, { identity: string; promise: Promise<void> }>();

/** Recheck current descendants before handing an owned tree to another process; ACL caches are unrelated. */
export async function checkOwnedDirectory(vault: string, relative: string): Promise<void> {
	const root = await absoluteNandPath(vault, relative);
	let count = 0;
	const visit = async (file: string): Promise<void> => {
		if (++count > 20000) throw new Error('private-storage.repair-limit');
		const info = await lstat(file);
		if (info.isSymbolicLink() || !info.isFile() && !info.isDirectory()) throw new Error('private-storage.symlink');
		if (info.isDirectory()) for (const child of await readdir(file)) await visit(path.join(file, child));
	};
	for (let attempt = 0; ; attempt++) {
		try { await visit(root); return; }
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || attempt === 2) throw error;
			// Hook publication can rename a descendant after enumeration. Recheck the
			// complete tree, including any newly arrived links, before allowing a launch.
			await absoluteNandPath(vault, relative);
		}
	}
}

/** Repair a NAND-owned tree once per process/root identity; new files inherit its private ACL. */
export async function secureOwnedDirectory(vault: string, relative: string, force = false): Promise<void> {
	const directory = await absoluteNandPath(vault, relative);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const metadata = await lstat(directory), identity = `${metadata.dev}:${metadata.ino}:${metadata.birthtimeMs}`;
	if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('private-storage.symlink');
	const current = repairs.get(directory);
	if (!force && current?.identity === identity) return current.promise;
	const promise = (async () => {
		if (current) await current.promise.catch(() => {});
		await absoluteNandPath(vault, relative);
		if (process.platform === 'win32') {
			await new Promise<void>((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(windowsPolicy, 'utf16le').toString('base64')], {
				windowsHide: true, timeout: 60000, maxBuffer: 64 * 1024, env: { ...process.env, NAND_PRIVATE_TARGET: directory, NAND_PRIVATE_VAULT: path.resolve(directory, ...relative.split('/').map(() => '..')) },
			}, error => error ? reject(new Error('private-storage.permissions', { cause: error })) : resolve()));
			return;
		}
		let count = 0;
		const visit = async (file: string): Promise<void> => {
			if (++count > 20000) throw new Error('private-storage.repair-limit');
			const relativeFile = relative + (file === directory ? '' : '/' + path.relative(directory, file).split(path.sep).join('/'));
			await absoluteNandPath(vault, relativeFile);
			const info = await lstat(file);
			if (!info.isFile() && !info.isDirectory()) throw new Error('private-storage.symlink');
			await chmod(file, info.isDirectory() || info.mode & 0o111 ? 0o700 : 0o600);
			if (info.isDirectory()) for (const child of await readdir(file)) await visit(path.join(file, child));
		};
		await visit(directory);
	})();
	repairs.set(directory, { identity, promise });
	void promise.catch(() => { if (repairs.get(directory)?.promise === promise) repairs.delete(directory); });
	return promise;
}
