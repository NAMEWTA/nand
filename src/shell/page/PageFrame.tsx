// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/app-shell/AppWorkspaceShell.tsx
import type { ReactNode } from 'react';
export function PageFrame({ children }: { children: ReactNode }) {
 return <main data-shell-region="page" tabIndex={-1} className="nand-shell-main relative flex flex-col flex-1 min-w-0 min-h-0">{children}</main>;
}
