import type { ModuleManifest } from '../../app/contracts/module';
import { NEWS_HOME_WIDGETS, NEWS_READ } from './api';
export const newsManifest: ModuleManifest = { id: 'news', order: 25, icon: 'newspaper', titleKey: 'news.title', descriptionKey: 'news.description', platforms: { desktop: true, mobile: true }, defaultEnabled: true, activation: 'startup', provides: [NEWS_READ], contributes: [NEWS_HOME_WIDGETS], load: () => import('./module') };

