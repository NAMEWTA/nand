import { t } from '../../../../shared/i18n/index';
import type { BannerData, DashboardData } from './types/model';
import { DEFAULT_BANNER } from './parser/syntax';

/** A fresh banner: the default poster with the quote in the current language. */
export function newBanner(): BannerData {
	return { ...DEFAULT_BANNER, images: [...(DEFAULT_BANNER.images ?? [])], quote: t('default.bannerQuote'), author: 'NAND' };
}

/** `default` is the board's original banner; every other banner widget keeps its own copy in `banners`. */
export function bannerOf(data: Pick<DashboardData, 'banner' | 'banners'>, instanceId = 'default'): BannerData {
	return instanceId === 'default' ? data.banner : (data.banners?.[instanceId] ?? newBanner());
}

export function withBanner<T extends Pick<DashboardData, 'banner' | 'banners'>>(data: T, instanceId: string, updates: Partial<BannerData>): T {
	if (instanceId === 'default') return { ...data, banner: { ...data.banner, ...updates } };
	return { ...data, banners: { ...data.banners, [instanceId]: { ...bannerOf(data, instanceId), ...updates } } };
}

/** Apply `change` to every banner a board holds (image renames). */
export function mapBanners<T extends Pick<DashboardData, 'banner' | 'banners'>>(data: T, change: (banner: BannerData) => BannerData): T {
	return {
		...data,
		banner: change(data.banner),
		...(data.banners ? { banners: Object.fromEntries(Object.entries(data.banners).map(([id, banner]) => [id, change(banner)])) } : {}),
	};
}
