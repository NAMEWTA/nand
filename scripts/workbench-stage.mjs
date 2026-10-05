// Temporary implementation dispatch; removed before final review.
import './workbench-ui-stage.mjs';
import { read, put, replace } from './workbench-write.mjs';
const path = 'src/plugin/workbench/compose-workbench.ts';
put(path, read(path).replaceAll('.view.contentEl.win', '.view.containerEl.win').replace("if (anchor?.view.containerEl.win === win) workspace.setActiveLeaf(anchor", "if (anchor && anchor.view.containerEl.win === win) workspace.setActiveLeaf(anchor"));
replace('src/view/notifications/notification-presentation.tsx', 'markRead={(record) => { void this.service.markRead(record.id)', 'markRead={(id) => { void this.service.markRead(id)');
