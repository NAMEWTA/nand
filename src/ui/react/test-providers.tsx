import type { ReactNode } from 'react';
import { NandProviders } from './providers';
export function TestProviders({
	children,
	ownerDocument = document,
}: {
	children: ReactNode;
	ownerDocument?: Document;
}) {
	return (
		<NandProviders ownerDocument={ownerDocument}>
			<div className="nand-ui">{children}</div>
		</NandProviders>
	);
}
