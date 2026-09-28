import { useLayoutEffect, useState } from 'preact/hooks';
import type { BannerData } from '../../../core/dashboard/types';
import { BANNER_QUOTE_OFFSET_MS, BANNER_QUOTE_ROTATION_MS } from '../view/timing';
export function BannerQuotePanel({ banner, win }: { banner: BannerData; win: Window }) {
	const quotes = banner.quotes?.length ? banner.quotes : [{ quote: banner.quote, author: banner.author }],
		[index, setIndex] = useState(
			() => Math.floor((Date.now() + BANNER_QUOTE_OFFSET_MS) / BANNER_QUOTE_ROTATION_MS) % quotes.length,
		),
		[fading, setFading] = useState(false);
	useLayoutEffect(() => {
		if (quotes.length < 2) return;
		let fade: number | undefined;
		const timer = win.setInterval(() => {
			setFading(true);
			fade = win.setTimeout(() => {
				setIndex((value) => (value + 1) % quotes.length);
				setFading(false);
			}, 400);
		}, BANNER_QUOTE_ROTATION_MS);
		return () => {
			win.clearInterval(timer);
			if (fade !== undefined) win.clearTimeout(fade);
		};
	}, [win, quotes.length]);
	const active = quotes[index % quotes.length]!;
	if (!active.quote && !active.author) return null;
	const style = { color: banner.quoteColor || undefined, fontFamily: banner.quoteFont || undefined };
	return (
		<>
			<p
				class={`dashboard-banner-quote${fading ? ' dashboard-banner-quote--fading' : ''}`}
				style={{ ...style, textShadow: banner.quoteColor ? '0 1px 3px rgba(0,0,0,0.3)' : undefined }}
			>
				{active.quote}
			</p>
			<cite
				class={`dashboard-banner-author${fading ? ' dashboard-banner-author--fading' : ''}`}
				style={{ ...style, textShadow: banner.quoteColor ? '0 1px 2px rgba(0,0,0,0.2)' : undefined }}
			>
				{active.author}
			</cite>
		</>
	);
}
