import { useEffect, useRef, useState } from 'react';
import { useVisible } from '../../../ui/react/contexts';

/** Close owned overlays when their leaf is hidden; never restore focus into a hidden/unmounted leaf. */
export function useTransient() {
	const visible = useVisible();
	const [open, setOpen] = useState(false);
	const active = useRef(visible);
	useEffect(() => {
		active.current = visible;
		if (!visible) setOpen(false);
		return () => {
			active.current = false;
		};
	}, [visible]);
	return {
		visible,
		open: visible && open,
		onOpenChange: setOpen,
		onCloseAutoFocus: (event: Event) => {
			if (!active.current) event.preventDefault();
		},
	};
}
