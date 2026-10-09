/** Structural frame plus the immersive board mode. The mode must not replace stacked or side, or the content column loses its width. */
export function boardFrame(immersive: boolean, stacked: boolean): { layout: 'stacked' | 'side'; board: 'immersive' | null } {
	return { layout: stacked ? 'stacked' : 'side', board: immersive ? 'immersive' : null };
}
