/** Bundled into each native adapter. Validate again in the writing process after preparation. */
export const SPOOL_GUARD = `function checkSpool() {
 const root = process.env.NAND_ACCOUNT_ROOT;
 if (!root || !dir) throw new Error('hookScopeMissing');
 const relative = path.relative(root, dir);
 if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('hookScopeInvalid');
 let cursor = path.resolve(dir);
 while (true) {
  if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('hookScopeInvalid');
  const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
 }
}
`;
