# 领域文档布局

## 读取顺序

1. 永久领域上下文：`<Path>{roots.state}/specdev/context/</Path>`
2. 永久架构决策：`<Path>{roots.state}/specdev/adr/</Path>`
3. 当前领域上下文：`<Path>{roots.state}/specdev/changes/{change}/CONTEXT.md</Path>`
4. 当前架构决策：`<Path>{roots.state}/specdev/changes/{change}/ADR.md</Path>`
5. 当前 Spec：`<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
6. 当前 Ticket 目录：`<Path>{roots.state}/specdev/changes/{change}/ticket/</Path>`
7. 当前 Goal Plan：`<Path>{roots.state}/specdev/changes/{change}/goal-plan.md</Path>`
8. 当前设计日志：`<Path>{roots.state}/specdev/changes/{change}/LOG.md</Path>`

## 职责

- `<Path>{roots.state}/specdev/changes/{change}/CONTEXT.md</Path>`：当前 bounded context 的项目规范术语和 `_Avoid_` 同义词；不保存代码导航或 change 历史。
- `<Path>{roots.state}/specdev/changes/{change}/ADR.md</Path>`：当前 change 已接受、被替代或废弃的架构决策。
- `<Path>{roots.state}/specdev/changes/{change}/LOG.md</Path>`：设计讨论轨迹，不作为当前架构的最终权威。
- `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`：用户问题、外部行为、范围与验收合同。
- `<Path>{roots.state}/specdev/changes/{change}/ticket/</Path>`：单个垂直切片的执行契约。
- `<Path>{roots.state}/specdev/changes/{change}/goal-plan.md</Path>`：跨 Ticket 的门禁、调度和治理。

change 完成后，只有仍真实、跨 change 有用且有实现证据的规范术语或符合三项准入条件的 ADR 才能提升到永久目录。

## 文档受众与维护入口

用户使用指南放在 <Path>docs/</Path>，只包含操作、设置、备份恢复、能力限制及必要配图和公开许可证。开发设计、代码导航、实施过程与验收证据不再写入该目录。

维护者的永久知识在 <Path>{roots.state}/specdev/context/</Path> 与 <Path>{roots.state}/specdev/adr/</Path>。前者按领域定义规范语言，后者每份说明一个经验证的长期架构取舍；本次知识提升来源为 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/</Path>。

| 主题 | 读取入口 |
|---|---|
| 领域关系与数据归属 | <Path>{roots.state}/specdev/context/context-map.md</Path> |
| 插件壳层、看板、评论、档案 | 对应词汇：<Path>{roots.state}/specdev/context/nand-shell.md</Path>、<Path>{roots.state}/specdev/context/dashboard.md</Path>、<Path>{roots.state}/specdev/context/comments.md</Path>、<Path>{roots.state}/specdev/context/contacts.md</Path> |
| 图标、终端智能体、自动化、通知 | 对应词汇：<Path>{roots.state}/specdev/context/icons.md</Path>、<Path>{roots.state}/specdev/context/terminal-agent.md</Path>、<Path>{roots.state}/specdev/context/automations.md</Path>、<Path>{roots.state}/specdev/context/notifications.md</Path> |
| 原 docs 来源、维护清单与历史截图 | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-map.md</Path> |
| 本次文档整理的验证 | <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/direct-spec.md</Path> |

架构决定按主题读取永久 ADR。新增或改变长期决定仍走 A 的代码验证、毕业评估及确认流程，不直接将会议结论写成永久事实。来源、核验日期与代码指针写在 ADR 或归档 Evidence，词汇表不承担导航索引。

当前 change 的详细行为、维护步骤和验证记录留在其 Spec/Evidence，完成后归档。原始证据不由派生文档覆盖；历史截图及早期测试数量不能自动成为最新构建的验收保证。原 docs 快照中的相对链接按当时的项目位置解释；现役阅读使用来源映射中的当前入口。

现有开发技能继续提供编辑时执行规则并指向上述知识，不复制旧开发文档作为第二份手册。技能入口为 <Path>.agents/skills/dev/SKILL.md</Path>，渲染约定为 <Path>.agents/skills/view-render/SKILL.md</Path>。用户指南不链接这些内部记录；仓库根 README 只保留维护者入口。

## 已提升的架构决定

| 决定 | 永久工件 |
|---|---|
| 五层依赖边界 | <Path>{roots.state}/specdev/adr/0001-layered-dependency-boundaries.md</Path> |
| 原生宿主生命周期与 Preact 业务界面 | <Path>{roots.state}/specdev/adr/0002-native-host-preact-surfaces.md</Path> |
| 终端会话与叶子生命周期分离 | <Path>{roots.state}/specdev/adr/0003-pty-session-view-lifetimes.md</Path> |
| 当前库范围内的只读原生历史 | <Path>{roots.state}/specdev/adr/0004-vault-scoped-native-history.md</Path> |
| 档案以可见 Markdown 为资料来源 | <Path>{roots.state}/specdev/adr/0005-contacts-markdown-source.md</Path> |
| 评论旁路保存且不改写笔记 | <Path>{roots.state}/specdev/adr/0006-comment-sidecar-storage.md</Path> |
| 设备所属自动化先持久化再执行 | <Path>{roots.state}/specdev/adr/0007-device-owned-durable-automation.md</Path> |
| 通知回执独立于可见收件箱 | <Path>{roots.state}/specdev/adr/0008-independent-notification-receipts.md</Path> |
| Iconic 保留独立领域数据与上游语义 | <Path>{roots.state}/specdev/adr/0009-isolated-iconic-store.md</Path> |
