import { getIconIds } from 'obsidian';
import ResourceUtils from './utils/resource-utils';
export const [ICONS, ICON_KEYWORDS] = ResourceUtils.getIcons(getIconIds());
export const [EMOJIS, EMOJI_KEYWORDS] = ResourceUtils.getEmojis();
