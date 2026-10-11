import { localizedAttributes } from '../../../../ui/primitives/localized-dom';
import { Platform, setIcon } from 'obsidian';
import type { BannerData } from '../../core/board/types/index';
import { resolveVaultImage } from '../banner/banner';
import type { DashboardSurface } from './dashboard-surface';
import { BANNER_IMAGE_ROTATION_MS } from './timing';
import { focalPosition } from '../../core/board/focal-point';

export function setupBannerBehavior(this: DashboardSurface, bannerEl: HTMLElement): void {
	const win = bannerEl.ownerDocument.defaultView!;
	const pinBtn = bannerEl.createEl('button', {
		cls: 'dashboard-banner-pin-btn',
		attr: { ...localizedAttributes('banner.toggleCollapse', undefined, 'aria-label') },
	});
	setIcon(pinBtn, 'bookmark');

	pinBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		if (win.innerWidth <= 640) return;
		this.bannerCollapsed = !this.bannerCollapsed;
		bannerEl.toggleClass('dashboard-banner--collapsed', this.bannerCollapsed);
		this.app.saveLocalStorage('nand.dashboard.banner-collapsed', String(this.bannerCollapsed));
	});

	const onResize = () => {
		if (win.innerWidth <= 640 && this.bannerCollapsed) {
			bannerEl.removeClass('dashboard-banner--collapsed');
		} else if (this.bannerCollapsed) {
			bannerEl.addClass('dashboard-banner--collapsed');
		}
	};
	win.addEventListener('resize', onResize);
	this.cleanupFns.push(() => win.removeEventListener('resize', onResize));
}

export function setupBannerRotation(this: DashboardSurface, container: HTMLElement, banner: BannerData): void {
	// Image rotation — applies to both quote and stats modes (stats uses the
	// same .dashboard-banner background, so it rotates identically).
	const win = container.ownerDocument.defaultView!;
	const images = banner.images;
	if (images && images.length > 1) {
		const imgIndex = Math.floor(Date.now() / BANNER_IMAGE_ROTATION_MS) % images.length;
		this.bannerImageIndex = imgIndex;

		const bannerEl = container.querySelector('.dashboard-banner') as HTMLElement;
		if (bannerEl) {
			const resolved = resolveVaultImage(this.app, images[imgIndex]!);
			if (resolved) {
				bannerEl.style.backgroundImage = `url("${resolved}")`;
				bannerEl.style.backgroundPosition = focalPosition(banner.imagePos?.[images[imgIndex]!]);
			}

			let fadeTimer: number | undefined;
			const rotateImage = () => {
				this.bannerImageIndex = (this.bannerImageIndex + 1) % images.length;
				const nextPath = images[this.bannerImageIndex]!;
				const nextResolved = resolveVaultImage(this.app, nextPath);

				bannerEl.addClass('dashboard-banner--fading');

				fadeTimer = win.setTimeout(() => {
					if (nextResolved) {
						bannerEl.style.backgroundImage = `url("${nextResolved}")`;
						bannerEl.style.backgroundPosition = focalPosition(banner.imagePos?.[nextPath]);
					}
					bannerEl.removeClass('dashboard-banner--fading');
				}, 600);
			};

			const imgTimer = win.setInterval(rotateImage, BANNER_IMAGE_ROTATION_MS);
			this.cleanupFns.push(() => {
				win.clearInterval(imgTimer);
				if (fadeTimer !== undefined) win.clearTimeout(fadeTimer);
			});
		}
	}
}

/** Desktop-only sidebar pin, anchored at the banner's bottom-left corner.
 *  Distinct from the banner-collapse bookmark button (top-right,
 *  .dashboard-banner-pin-btn): this one pins/unpins the sidebar. Works in
 *  both layouts — in stacked mode it pins the widget strip open instead of
 *  the left rail. */
export function renderBannerPinButton(this: DashboardSurface, bannerEl: HTMLElement): void {
	if (Platform.isMobile) return;
	const pinBtn = bannerEl.createEl('button', {
		cls: 'dashboard-sidebar-pin-btn',
		attr: { ...localizedAttributes('banner.toggleSidebarPin', undefined, 'aria-label') },
	});
	const update = () => {
		setIcon(pinBtn, this.sidebarPinned ? 'pin' : 'pin-off');
		pinBtn.toggleClass('dashboard-sidebar-pin-btn--active', this.sidebarPinned);
	};
	update();
	pinBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		this.sidebarPinned = !this.sidebarPinned;
		this.app.saveLocalStorage('nand.dashboard.sidebar-pinned', String(this.sidebarPinned));
		const sidebar = this.containerEl.querySelector('.dashboard-sidebar');
		if (sidebar) {
			if (this.sidebarPinned) {
				sidebar.addClass('dashboard-sidebar--pinned');
				sidebar.removeClass('dashboard-sidebar--expanded');
				sidebar.removeClass('dashboard-sidebar--collapsed');
				this.sidebarExpanded = false;
			} else {
				sidebar.removeClass('dashboard-sidebar--pinned');
				sidebar.addClass('dashboard-sidebar--collapsed');
				this.sidebarExpanded = false;
			}
		}
		update();
	});
}
