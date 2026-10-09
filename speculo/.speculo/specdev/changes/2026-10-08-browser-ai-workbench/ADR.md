# 浏览器快捷键修复与多 AI 工作台、受限网页助手 — Change ADR

## ADR-001: 完整产品阶段

**Status:** accepted
**Source:** LOG-001；用户本轮五项推荐全部确认；#145 §§9–14
**Supersedes:** none（本change合同，不改写永久知识）

### Context

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

### Decision

按可交付源码三站 PoC → 八站完整适配 → 可靠历史与迁移 → 可选综合/受限助手 → 用户指认/可复用流程与本地外接推进；最终不缩为研究或三站。PoC Gate 只决定后续 readiness，不删除后续票。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-002: 保存与迁移

**Status:** accepted
**Source:** LOG-004；用户本轮明确选择；#145 §§3/10/14
**Supersedes:** none（本change合同，不改写永久知识）

### Context

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

### Decision

可见 Markdown 保存 task/turn 问题、模板不可变快照、当前轮原文及来源；maiw v3 映射导入导出。默认不镜像全部官网历史、附件、全部分支或 cookies。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-003: 额外模型与外接

**Status:** accepted
**Source:** LOG-006；用户本轮明确选择；父任务跨 change owner 合同
**Supersedes:** none（本change合同，不改写永久知识）

### Context

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

### Decision

统一发送/站点采集不调用额外模型；综合和助手独立 opt-in，显式选择 agent 会话/能力与材料范围。复用 home owner 提供的 agent dispatch / automation receipt API；外接走现有本地 token IPC 的 scoped grant。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。

## ADR-004: 规范与参考使用

**Status:** accepted
**Source:** LOG-007；用户原始约束、dev/ui SKILL、已读参考许可证
**Supersedes:** none（本change合同，不改写永久知识）

### Context

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

### Decision

按 dev/ui 技能与目录规则实施，运行时规划中文由用户特批；产品 en/zh 和双语文档继续遵守。主参考固定 SHA 的 MIT 代码可按许可适配；AGPL/混合许可仅公开行为比较。依赖引入必须证明现有 CDP 不够，不能因参考就捆绑整个浏览器框架。

### Trade-off

以现有NAND边界实现源需求；直接移植参考的宿主/存储/调度会形成第二权威或破坏兼容。接受必要的适配成本，不照搬已识别缺陷。具体差异见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。

### Consequences

下游遵循本选择，变更公共合同/数据/授权边界必须回G更新而不能仅改Ticket。风险见Spec，约束不等同完成证据。

### Verification / Migration

以Spec AC与Ticket验证矩阵核验；未涉及迁移时保持格式，涉及时按对应Expand→Migrate→Contract票实施。
