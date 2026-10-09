# 首页看板自由网格、组件贡献与智能体技能派发 — Change ADR

## ADR-001: 组件成员和数据归属

**Status:** accepted
**Source:** LOG-003；#137 小组件注册与按看板成员要求；ADR-0001/0003/0004；本轮实现决策。
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### Decision

看板特有 layout/members/immersive/skills 存于该 Markdown YAML；实例配置由提供方现有命名空间/文档拥有。member 的 provider+kind+instanceId 保持稳定，禁用模块保留成员和位置，只显示可恢复占位。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-002: 技能新建与既有会话

**Status:** accepted
**Source:** LOG-004；#137 §三、用户/父任务本轮跨 change 所有权指示。
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### Decision

新会话由 agent 公开派发端口最终进入 AgentRuntimePort.start 并复用自动化记录；已有 interactive 会话调用 AGENT_SESSIONS.attachMaterial 一次粘贴，不自动回车。所有入口共享本 change 所有的公共契约，news/browser 依赖它，不能另写平行派发层。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-003: 命名外观范围

**Status:** accepted
**Source:** LOG-006；用户本轮确认：保存全局 theme + home 组合；ADR-0006。
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### Decision

保存全局 theme + home 外观的组合快照；应用到所有看板、编辑器及弹出窗口，各字段仍由 theme/home 命名空间拥有。禁止按看板私有颜色/主题。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-004: 列头技能范围

**Status:** accepted
**Source:** LOG-007；用户本轮确认：列头默认预览，可显式直发整列 paths。
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### Decision

列头默认打开预览，用户可选择本次文件子集；每按钮可显式 directSend，直发时展开整列当前适用文件为完整 paths，不隐含沿用上次选区。空列不得默默扩大到全库。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-005: 顺序与发布边界

**Status:** accepted
**Source:** LOG-008；用户/父任务本轮确认及 #137 分阶段计划。
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### Decision

#141 是 T-01 独立首修，不等待重构；后续执行严格串行，公共接口由本 change 拥有，最终集成序列由父 goal-plan 编排。本轮仅规划，P0-P6 的未来 PR 分组不等于授权当前发布。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-006: 验证力度

**Status:** accepted
**Source:** LOG-009；用户本轮明确要求；dev/testing。
**Supersedes:** none（本change合同，不改写永久知识）

### Context

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

### Decision

优先完成可用功能和规范结构；新增测试只锁定纯算法、格式、派发语义、真实错误路径等关键风险。复用现有 Vitest/golden/真实 Obsidian 探针，不建新测试平台、不添加广泛兜底或实现镜像断言。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。
