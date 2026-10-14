import { useRef, type HTMLAttributes } from 'react';

/** Keep Enter/Escape from submitting or dismissing a form while the IME owns the key. */
export function useImeTextFieldProps<T extends HTMLElement>(props: HTMLAttributes<T>) {
	const composing = useRef(false);
	return {
		onCompositionStart: ((event) => {
			composing.current = true;
			props.onCompositionStart?.(event);
		}) as NonNullable<HTMLAttributes<T>['onCompositionStart']>,
		onCompositionEnd: ((event) => {
			composing.current = false;
			props.onCompositionEnd?.(event);
		}) as NonNullable<HTMLAttributes<T>['onCompositionEnd']>,
		onKeyDown: ((event) => {
			if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
				event.stopPropagation();
				// Prevent the browser's implicit form submission as well as React handlers.
				if (event.key === 'Enter') event.preventDefault();
				return;
			}
			props.onKeyDown?.(event);
		}) as NonNullable<HTMLAttributes<T>['onKeyDown']>,
	};
}
export function handleImeOverlayEscape(event: KeyboardEvent, handler?: (event: KeyboardEvent) => void): void {
	if (event.isComposing || event.keyCode === 229) {
		event.preventDefault();
		return;
	}
	handler?.(event);
}
