import type { ModuleManifest } from '../../app/contracts/module';
import { NEWS_HOME_WIDGETS, NEWS_READ, NEWS_WORKBENCH } from './api';
import { NOTIFICATION_OPENERS } from '../notifications/api';
export const newsManifest: ModuleManifest = { id: 'news', order: 25, icon: 'newspaper', titleKey: 'news.title', descriptionKey: 'news.description', platforms: { desktop: true, mobile: false }, defaultEnabled: false, activation: 'startup', provides: [NEWS_READ, NEWS_WORKBENCH], contributes: [NEWS_HOME_WIDGETS, NOTIFICATION_OPENERS], load: () => import('./module') };

