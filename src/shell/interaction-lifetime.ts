import { createContext, useContext } from 'react';

// A hidden leaf or an outgoing navigation must not restore focus from an old portal.
export const ShellInteractionContext = createContext<() => boolean>(() => true);
export function useShellCloseAutoFocus(): (event: Event) => void {
	const canRestoreFocus = useContext(ShellInteractionContext);
	return (event) => {
		if (!canRestoreFocus()) event.preventDefault();
	};
}
