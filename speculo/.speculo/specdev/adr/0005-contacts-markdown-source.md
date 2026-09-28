## ADR-0005: 档案以可见 Markdown 为资料来源

**Status:** accepted
**Date:** 2026-09-28
**Source:** LOG-003（<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/LOG.md</Path>）；USER-DECISION:批准知识沉淀计划并要求实施；原始材料：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts-development.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>
**Supersedes:** none

### Context
档案需要面板编辑，也需在停用插件后直接阅读、备份和提供给 AI。显示名称和路径会变化，同名人物不能共享身份；企业人员与关系两侧显示不能产生互相冲突的双写。

### Decision
人物与企业各保存为配置目录中的可见 Markdown；nand-id 是稳定身份，nand-type 是类型。内存索引可重建，插件设置不保存实体正文。任职保存在人物，企业人员从任职派生；直接关系保存在录入方，反向展示派生。保存对基本字段和整段正文区域做三方合并，保留未知内容；同字段或同表并发修改拒绝覆盖。

### Trade-off
数据库作为唯一来源更易查询，但脱离插件后需要额外导出；整文重写简单，但会覆盖用户正文；双侧持久化关系便于直接读取，却增加一致性维护。当前选择承担 Markdown 解析、稳定身份和冲突检查的复杂度，以保留文件可用性和单一事实源。

### Consequences
改名不改变身份，不自动重命名文件；切换目录只切换数据源。删除不级联改写其他档案；失效关联保留历史。资料目录备份应包含附件，恢复需保留原身份。原始笔记未保存或结构损坏时拒绝面板覆盖；应用内三方合并不承诺跨设备同步冲突协调。

### Verification / Migration
格式协议以 CODE:<Path>src/core/contacts/persist/format-guide.md</Path> 为准。test:contacts 覆盖往返、未知内容保留、身份、派生关系和冲突；历史实机清单不等于全通过。

当前源码核验：
- CODE:<Path>src/core/contacts/model.ts</Path>
- CODE:<Path>src/core/contacts/persist/markdown.ts</Path>
- CODE:<Path>src/core/contacts/index-store.ts</Path>
- CODE:<Path>src/core/contacts/application.ts</Path>
- CODE:<Path>src/platform/obsidian/contacts/controller.ts</Path>
- CODE:<Path>scripts/verify-contacts.ts</Path>

本次为现有设计的文档确认，日期不代表最初实施日期。上述替代方案用于本次解释取舍，不声称存在未保存的历史讨论；不引入产品或数据迁移。
