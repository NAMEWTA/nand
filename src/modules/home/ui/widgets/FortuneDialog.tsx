// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/fortune-stick-modal.ts
import { useEffect, useState } from 'react';
import { RecordButton as Button } from '../dialogs/RecordButton';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { RecordDialog } from '../dialogs/RecordDialog';
import { widgetClasses } from '../theme/widget-classes';
import { drawFortuneStick, FORTUNE_CATEGORIES, type FortuneStick } from './fortune-stick';
export function FortuneDialog({ onClose }: { onClose(this: void): void }) {
	const [stick, setStick] = useState<FortuneStick | null>(null),
		[revealed, setRevealed] = useState(false),
		[ready, setReady] = useState(false),
		[shown, setShown] = useState(0),
		doc = useOwnerDocument(),
		t = useT();
	useEffect(() => {
		if (!stick) return;
		const win = doc.defaultView!,
			length = [...stick.verse].length;
		if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			const timer = win.setTimeout(() => {
				setShown(length);
				setReady(true);
			}, 0);
			return () => win.clearTimeout(timer);
		}
		let position = 0;
		const id = win.setInterval(() => {
			position++;
			setShown(Math.min(position, length));
			if (position >= length) {
				win.clearInterval(id);
				setReady(true);
			}
		}, 80);
		return () => win.clearInterval(id);
	}, [stick, doc]);
	const category = FORTUNE_CATEGORIES.find((c) => c.key === stick?.category);
	return (
		<RecordDialog
			title={t('fortune.title')}
			classes={`fortune-card ${stick ? 'fortune-card--result' : ''}`}
			onClose={onClose}
		>
			<Button
				variant="ghost"
				className="absolute right-0 top-0 size-7"
				aria-label={t('common.close')}
				onClick={onClose}
			>
				×
			</Button>
			{!stick ? (
				<>
					<div className={widgetClasses('fortune-card-title')}>{t('fortune.title')}</div>
					<div className={widgetClasses('fortune-card-subtitle')}>{t('fortune.choose')}</div>
					<div className={widgetClasses('fortune-category-grid')}>
						{FORTUNE_CATEGORIES.map((c) => (
							<Button
								key={c.key}
								variant="ghost"
								className={widgetClasses('fortune-category-btn')}
								onClick={() => {
									setShown(0);
									setReady(false);
									setRevealed(false);
									setStick(drawFortuneStick(c.key));
								}}
							>
								<span className={widgetClasses('fortune-category-emoji')}>{c.emoji}</span>
								<span className={widgetClasses('fortune-category-label')}>{t(`fortune.${c.key}`)}</span>
							</Button>
						))}
					</div>
				</>
			) : (
				<>
					<div className={widgetClasses('fortune-result-category')}>
						{category?.emoji} {t(`fortune.${stick.category}`)}
					</div>
					<div className={widgetClasses('fortune-flip-container')}>
						<div
							className={widgetClasses(
								`fortune-flip-card ${revealed ? 'fortune-flip-card--flipped' : ''}`,
							)}
						>
							<div className={widgetClasses('fortune-flip-front')} inert={revealed}>
								<div className={widgetClasses('fortune-result-header')}>
									<div
										className={widgetClasses(
											`fortune-result-seal fortune-result-seal--${stick.level}`,
										)}
									>
										{t(`fortune.${stick.level}`)}
									</div>
								</div>
								<div className={widgetClasses('fortune-result-divider')} />
								<div className={widgetClasses('fortune-result-verse')}>
									{[...stick.verse].map((char, i) => (
										<span key={i} style={{ opacity: i < shown ? 1 : 0 }}>
											{char}
										</span>
									))}
								</div>
								<Button
									variant="ghost"
									disabled={!ready}
									className={widgetClasses('fortune-result-reveal-btn')}
									onClick={() => setRevealed(true)}
								>
									{t('fortune.reveal')}
								</Button>
							</div>
							<div className={widgetClasses('fortune-flip-back')} inert={!revealed}>
								<div className={widgetClasses('fortune-back-title')}>{t('fortune.reveal')}</div>
								<div className={widgetClasses('fortune-back-interpretation')}>
									{stick.interpretation}
								</div>
								<Button
									variant="ghost"
									className={widgetClasses('fortune-result-back-btn')}
									onClick={() => setStick(null)}
								>
									{t('fortune.again')}
								</Button>
							</div>
						</div>
					</div>
				</>
			)}
		</RecordDialog>
	);
}
