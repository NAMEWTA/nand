import type { Item } from '../core/types';

export interface TabItem extends Item {
	isActive: boolean;
	isRoot: boolean;
	isStacked: boolean;
	iconEl: HTMLElement | null;
	tabEl: HTMLElement | null;
}

export interface RibbonItem extends Item {
	isHidden: boolean;
	iconEl: HTMLElement | null;
}
