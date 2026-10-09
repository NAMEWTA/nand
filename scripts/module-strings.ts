// Tests and verify scripts render module code without loading module entries; give them every module's
// strings and the dictionaries modules share (in the plugin each module registers them when it loads).
import { registerMessages } from '../src/shared/i18n/runtime';
import { messages as agent } from '../src/modules/agent/i18n';
import { messages as archives } from '../src/modules/archives/i18n';
import { messages as automations } from '../src/modules/automations/i18n';
import { messages as comments } from '../src/modules/comments/i18n';
import { messages as home } from '../src/modules/home/i18n';
import { messages as icons } from '../src/modules/icons/i18n';
import { messages as notifications } from '../src/modules/notifications/i18n';
import { messages as sync } from '../src/modules/sync/i18n';
import { messages as automationStrings } from '../src/shared/i18n/lazy/automation';
import { messages as browserStrings } from '../src/shared/i18n/lazy/browser';
import { messages as commonStrings } from '../src/shared/i18n/lazy/common';

for (const messages of [automationStrings, browserStrings, commonStrings, agent, archives, automations, comments, home, icons, notifications, sync]) registerMessages(messages);
