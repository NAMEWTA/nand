import type { Ref } from 'react';
/** Page roots belong to WorkbenchPages and never become children of the shell React tree. */
export function PageSlot({ contentRef }: { contentRef: Ref<HTMLDivElement> }) {
	return <div className="nand-shell-pages relative min-h-0 min-w-0 flex-1 overflow-hidden" ref={contentRef} />;
}
