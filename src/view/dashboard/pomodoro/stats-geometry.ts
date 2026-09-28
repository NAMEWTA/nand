export function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
	const polar = (angle: number): [number, number] => {
		const rad = (angle * Math.PI) / 180;
		return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
	};
	const [sx, sy] = polar(startAngle);
	const [ex, ey] = polar(endAngle);
	const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
	return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
}
